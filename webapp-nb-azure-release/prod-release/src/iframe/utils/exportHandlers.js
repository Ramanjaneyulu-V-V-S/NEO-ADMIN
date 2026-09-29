/**
 * PDF Export Handlers
 *
 * Handles PDF export functionality:
 * - Detects export button clicks (direct button or via dropdown menu)
 * - Waits for export dialog to appear
 * - Clicks export submit button
 * - Handles export success event and downloads PDF
 * - Fixes protocol issues for srcdoc iframes (about: protocol)
 *
 * Uses polling with backoff instead of fixed delays for reliability.
 */

import { TIMING, EXPORT_SELECTORS } from "./constants";
import { wrapHandler } from "./errorHandling";
import { CleanupManager } from "./CleanupManager";
import { log } from "./logger";
import { getParentTargetOriginForPostMessage } from "./postMessageProtocol";

// Rewrite publication API URLs to go through proxy (hides backend host from network tab)
// Dynamically matches any host with /publication/ path and routes through proxy
const PUBLICATION_PROXY_PATH = import.meta.env.VITE_BRAVA_PUBLICATION_AUTHORITY;

const rewritePublicationUrl = (url) => {
  if (typeof url !== "string" || !PUBLICATION_PROXY_PATH) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/publication/")) {
      return PUBLICATION_PROXY_PATH + parsed.pathname + parsed.search;
    }
  } catch {
    // not an absolute URL, return as-is
  }
  return url;
};

const originalFetch = globalThis.fetch;
globalThis.fetch = function (...args) {
  const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
  if (url.includes("publication")) {
    const rewritten = rewritePublicationUrl(url);
    if (typeof args[0] === "string") {
      args[0] = rewritten;
    }
  }
  return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest to rewrite publication API URLs through proxy
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  if (typeof url === "string" && url.includes("publication")) {
    url = rewritePublicationUrl(url);
  }
  return originalXHROpen.call(this, method, url, ...rest);
};

// Module-level CleanupManager for export handlers
const exportHandlersCleanup = new CleanupManager("ExportHandlers");

const getPublicationArtifactsFromEvent = (e) => e?.detail?._embedded?.["pa:get_publication_artifacts"];

const getPdfArtifactContent = (publicationArtifacts) => {
  const pdfArtifact = publicationArtifacts.find((artifact) => artifact.name === "pdf" && artifact._embedded?.["ac:get_artifact_content"]);
  return pdfArtifact?._embedded?.["ac:get_artifact_content"] || null;
};

const fixUrlTemplateProtocol = (urlTemplate) => {
  if (!urlTemplate.startsWith("http://")) return urlTemplate;

  // For srcdoc iframes, globalThis.location.protocol can be "about:" which is invalid.
  // Use parent window's protocol or default to https.
  let protocol = "https:";
  try {
    // Use != per S3403; preserves reference comparison behavior for Window objects.
    if (globalThis.parent != null && globalThis.parent != globalThis && globalThis.parent.location?.protocol !== "about:") {
      protocol = globalThis.parent.location.protocol;
    } else if (globalThis.location?.protocol && globalThis.location.protocol !== "about:") {
      protocol = globalThis.location.protocol;
    }
  } catch (e) {
    log.warn("[ExportHandlers] Failed to determine protocol; defaulting to https:", { error: e });
    protocol = "https:";
  }
  return urlTemplate.replace("http://", protocol + "//");
};

const shouldSkipDuplicateMessage = (messageKey) => {
  const now = Date.now();
  const lastSent = sentPostMessages.get(messageKey);
  if (lastSent && now - lastSent < 5000) return true;
  sentPostMessages.set(messageKey, now); // Mark as sent immediately to prevent races
  return false;
};

const arrayBufferToBase64 = (buffer) => {
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 8192; // Process in 8KB chunks
  let base64String = "";

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64String += String.fromCodePoint.apply(null, chunk);
  }

  return btoa(base64String);
};

/**
 * Wait for element to appear in DOM using MutationObserver
 *
 * Event-driven approach - watches for DOM changes instead of polling.
 * Supports CSS selectors (string or array) or a function that returns an element.
 *
 * @param {string|string[]|Function} selectors - CSS selector(s) or function to find element
 * @param {number} maxAttempts - Maximum check attempts (default: 50) - converted to timeout (maxAttempts * 100ms)
 * @param {number} _interval - Deprecated, kept for API compatibility
 * @returns {Promise<Element|null>} Found element or null if not found
 */
const pollForElement = (selectors, maxAttempts = TIMING.POLLING_MAX_ATTEMPTS) => {
  return new Promise((resolve) => {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

    // Helper to find element
    const findElement = () => {
      for (const selector of selectorArray) {
        let element = null;

        if (typeof selector === "function") {
          // If selector is a function, call it
          element = selector();
        } else {
          // Otherwise, treat as CSS selector
          element = document.querySelector(selector);
        }

        if (element) {
          return element;
        }
      }
      return null;
    };

    // Try immediately first
    const element = findElement();
    if (element) {
      resolve(element);
      return;
    }

    // Use MutationObserver to watch for element appearance
    const observer = new MutationObserver(() => {
      const el = findElement();
      if (el) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(el);
      }
    });

    // Observe document for child list and subtree changes
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Track observer for cleanup
    exportHandlersCleanup.addObserver(observer);

    // CRITICAL FIX: Add timeout to prevent hanging forever
    // If element doesn't appear within timeout, resolve with null
    const timeoutMs = maxAttempts * 100; // Convert attempts to milliseconds (default: 5000ms)
    const timeoutId = setTimeout(() => {
      log.warn("[ExportHandlers] pollForElement timeout - element not found", { selectorArray });
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
};

/**
 * Handle PDF export success and download
 *
 * Processes the export success event, fetches the PDF file, and sends it to parent globalThis.
 * Handles protocol issues for srcdoc iframes (about: protocol) by using parent window's protocol.
 *
 * @param {Event} e - Export success event from viewer API
 * @param {Object} config - Viewer configuration with accessToken
 */
export const handleExportSuccess = async (e, config) => {
  // NOTE: Global fuse check is now in handleExportSuccessWrapped (outside this function)
  // This prevents race conditions where two calls enter before flag is set
  // Fuse is released in finally block, not timeout-based

  try {
    if (!e.detail) {
      throw new Error("No event detail found in export success event");
    }

    // Check if we have the publication response structure
    const publicationArtifacts = getPublicationArtifactsFromEvent(e);
    if (!publicationArtifacts) {
      throw new Error("No publication artifacts found in event detail");
    }

    const artifactContent = getPdfArtifactContent(publicationArtifacts);
    if (!artifactContent) {
      throw new Error("No PDF artifact found in publication artifacts");
    }

    if (!artifactContent.urlTemplate || !artifactContent.contentLinks || artifactContent.contentLinks?.length === 0) {
      throw new Error("PDF artifact missing urlTemplate or contentLinks");
    }

    let urlTemplate = fixUrlTemplateProtocol(artifactContent.urlTemplate);
    const contentLink = artifactContent.contentLinks[0];
    const filename = contentLink.file;

    const downloadUrl = urlTemplate.replace("{file}", filename);

    // CRITICAL: Check if we already sent this exact file to parent (BEFORE expensive fetch)
    // Use filename + downloadUrl as unique key to prevent duplicates
    const messageKey = `${filename}-${downloadUrl}`;
    if (shouldSkipDuplicateMessage(messageKey)) return; // Don't send duplicate
    // Clean up happens automatically on component destroy via CleanupManager

    // CRITICAL: Check if viewer already downloaded (some viewers auto-download)
    // If a download link with this filename exists, viewer might have already triggered it
    const safeFilename = CSS.escape(filename);
    const existingDownloadLink = document.querySelector(`a[download="${safeFilename}"], a[href*="${safeFilename}"]`);
    if (existingDownloadLink?.href && existingDownloadLink.href !== downloadUrl) {
      // Don't download again - viewer already handled it
      sentPostMessages.delete(messageKey); // Remove from sent set since we're not sending
      return;
    }

    // Download the file
    const response = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config?.accessToken || ""}`,
        Accept: "application/pdf",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      throw new Error("Downloaded file is empty");
    }

    const base64String = arrayBufferToBase64(buffer);

    // Generate unique message ID to track this specific message
    const messageId = `${messageKey}-${Date.now()}`;

    // Send file data to parent window for download
    globalThis.parent.postMessage(
      {
        type: "PDF_EXPORT_DOWNLOAD_SUCCESS",
        filename: filename,
        fileData: base64String,
        mimeType: "application/pdf",
        downloadUrl: downloadUrl,
        messageId: messageId, // Include message ID for tracking
      },
      getParentTargetOriginForPostMessage(),
    );

    // CRITICAL: Release fuse immediately after sending message to parent
    // The parent will handle the download, message is sent synchronously via postMessage
    globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = false;
  } catch (error) {
    // Release fuse on error
    globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = false;
    globalThis.parent.postMessage(
      {
        type: "PDF_EXPORT_DOWNLOAD_FAILURE",
        error: error.message || "Export processing failed",
      },
      getParentTargetOriginForPostMessage(),
    );
    log.error("[ExportHandlers] Export processing failed", error);
  }
};

const clickOrWarn = (element, label) => {
  if (!element) return false;
  try {
    element.click();
    return true;
  } catch (error) {
    log.error(`[ExportHandlers] Error clicking ${label}`, error);
    return false;
  }
};

const clickExportSubmitIfPresent = async () => {
  const exportSubmit = await pollForElement(EXPORT_SELECTORS.EXPORT_SUBMIT, 30); // 3 seconds
  if (!exportSubmit) {
    log.warn("[ExportHandlers] exportSubmit not found after clicking export trigger");
    return false;
  }
  return clickOrWarn(exportSubmit, "exportSubmit");
};

const tryMenuExportPath = async () => {
  const menuOptionsButton = await pollForElement(EXPORT_SELECTORS.MENU_OPTIONS, 50); // 5 seconds
  if (!clickOrWarn(menuOptionsButton, "menuOptions")) return false;

  const menuExportButton = await pollForElement(
    [
      ...EXPORT_SELECTORS.MENU_EXPORT,
      () => findExportMenuItemByText(), // Fallback to text search
    ],
    30,
  ); // 3 seconds for menu item to appear

  if (!clickOrWarn(menuExportButton, "menuExport")) {
    log.warn("[ExportHandlers] menuExport not found after clicking menuOptions");
    return false;
  }
  return await clickExportSubmitIfPresent();
};

const tryDirectExportPath = async () => {
  const exportButton = await pollForElement(EXPORT_SELECTORS.EXPORT_BUTTON, 30); // 3 seconds
  if (!clickOrWarn(exportButton, "exportButton")) return false;
  return await clickExportSubmitIfPresent();
};

/**
 * Handle PDF export failure
 * @param {Event} e - Export failure event
 */
export const handleExportFailure = (e) => {
  const errorMessage = e.detail?.message || e.detail?.error || "Unknown export error";
  globalThis.parent.postMessage(
    {
      type: "PDF_EXPORT_DOWNLOAD_FAILURE",
      error: errorMessage,
    },
    getParentTargetOriginForPostMessage(),
  );
};

// CRITICAL: Singleton guard to prevent duplicate listener setup
// If setupExportHandlers is called multiple times (React re-renders, reconnects),
// we only want ONE set of listeners, not multiple pipelines
let EXPORT_HANDLERS_INITIALIZED = false;

// CRITICAL: Track sent postMessages to prevent duplicate sends
// Key: filename, Value: timestamp
const sentPostMessages = new Map();

/**
 * Setup export event listeners
 *
 * CRITICAL: Returns cleanup function to prevent duplicate listeners.
 * Without cleanup, listeners accumulate on each setup call, causing multiple downloads.
 *
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} config - Viewer configuration
 * @returns {Function} Cleanup function to remove event listeners
 */
export const setupExportHandlers = (viewerName, config) => {
  // FIX 3: Singleton guard - prevent duplicate listener setup
  // If called multiple times (React re-renders, reconnects), only setup once
  if (EXPORT_HANDLERS_INITIALIZED) {
    return () => {}; // Return no-op cleanup
  }
  EXPORT_HANDLERS_INITIALIZED = true;

  const eventHandlers = [];

  // CRITICAL: Create a Set for this specific handler instance to track processing exports
  // This prevents race conditions and ensures each setup call has its own tracking
  const processingExports = new Set();

  // Create wrapped handlers with robust deduplication
  const handleExportSuccessWrapped = (e) => {
    // FIX 1: Move global fuse check OUTSIDE handleExportSuccess
    // This prevents race conditions where two calls enter before flag is set
    if (globalThis.__PDF_DOWNLOAD_IN_PROGRESS__) {
      return;
    }

    // Set fuse IMMEDIATELY before any async operations
    globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = true;

    // Create unique identifier from event detail
    // FIX 2: Use stable event detail instead of filename (filename can be reused/modified)
    // JSON.stringify of _embedded ensures uniqueness even if filename is same
    let eventId;
    try {
      eventId = JSON.stringify(e.detail?._embedded || {});
    } catch (err) {
      log.warn("[ExportHandlers] Failed to stringify export event detail for dedupe key; using fallback id", { error: err });
      // Fallback if stringify fails (circular refs, etc)
      eventId = e.detail?.id || e.timeStamp || Date.now().toString();
    }

    // CRITICAL: Check if already processing - use Set for thread-safe check
    if (processingExports.has(eventId)) {
      globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = false; // Release fuse since we're not processing
      return;
    }

    // Mark as processing immediately (prevents race conditions)
    processingExports.add(eventId);

    // Process export
    // CRITICAL: Fuse will be released in handleExportSuccess after message is sent to parent
    handleExportSuccess(e, config)
      .then(() => {
        // Remove from processing set immediately after success
        processingExports.delete(eventId);
        // Fuse is released in handleExportSuccess after sending message to parent
      })
      .catch(() => {
        // Release fuse on error
        globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = false;
        processingExports.delete(eventId);
      });
  };

  const exportSuccessEvent = viewerName + "-exportSuccess-download";
  const exportFailureEvent = viewerName + "-exportFailure";
  const exportSuccessGeneric = viewerName + "-exportSuccess";

  // CRITICAL: Use a single unified handler that processes all export success events
  // This prevents multiple handlers from processing the same event
  const handleExportSuccessUnified = (e) => {
    // CRITICAL: Prevent viewer's automatic download behavior
    // The viewer API may automatically trigger downloads - we need to stop that
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (e.stopImmediatePropagation) {
      e.stopImmediatePropagation();
    }

    // Check if event has the required download structure
    // Some viewers fire events with different structures, so we check multiple paths
    const hasDownloadStructure =
      e.detail?._embedded?.["pa:get_publication_artifacts"] || e.detail?._links?.["pa:get_publication_artifacts"] || e.detail?.artifacts || e.detail?.publicationArtifacts;

    if (!hasDownloadStructure) {
      return;
    }

    // If structure is slightly different, try to normalize it
    if (!e.detail?._embedded?.["pa:get_publication_artifacts"] && (e.detail?.artifacts || e.detail?.publicationArtifacts)) {
      // Normalize the structure to match expected format
      if (!e.detail._embedded) {
        e.detail._embedded = {};
      }
      if (!e.detail._embedded["pa:get_publication_artifacts"]) {
        e.detail._embedded["pa:get_publication_artifacts"] = e.detail.artifacts || e.detail.publicationArtifacts || [];
      }
    }

    handleExportSuccessWrapped(e);
  };

  // Listen for primary export success event
  globalThis.addEventListener(exportSuccessEvent, handleExportSuccessUnified);
  eventHandlers.push({ event: exportSuccessEvent, handler: handleExportSuccessUnified });

  // Listen for export failure
  globalThis.addEventListener(exportFailureEvent, handleExportFailure);
  eventHandlers.push({ event: exportFailureEvent, handler: handleExportFailure });

  // CRITICAL: Also listen for generic exportSuccess event (fired by manual button clicks)
  // The viewer may fire both exportSuccess-download AND exportSuccess events
  // We use the same unified handler for both, which has built-in duplicate prevention
  // The handler checks for the download structure before processing
  globalThis.addEventListener(exportSuccessGeneric, handleExportSuccessUnified);
  eventHandlers.push({ event: exportSuccessGeneric, handler: handleExportSuccessUnified });

  // Return cleanup function
  return () => {
    eventHandlers.forEach(({ event, handler }) => {
      globalThis.removeEventListener(event, handler);
    });
    processingExports.clear();
    // Reset singleton guard on cleanup (allows re-initialization if needed)
    EXPORT_HANDLERS_INITIALIZED = false;
  };
};

/**
 * Detect and handle export button clicks via DOM event listeners
 * @param {Object} api - Brava viewer API instance (not used but kept for consistency)
 */
export const setupExportButtonClickDetection = () => {
  // FIX 1: Global handler should only DETECT, not ACT
  // REMOVED: All auto-click logic to prevent multiple exportSubmit clicks
  // The global handler now only logs/detects clicks for debugging
  // Export automation is handled by parent-triggered functions only
  const handleDocumentClickUnsafe = (e) => {
    // Check for export button (first button) - DETECT ONLY
    const exportButton = e.target.closest('button[data-testid="exportButton"], button[data-testid="exportMenuButton"]');
    if (exportButton) {
      return;
    }

    // Check for export submit button (second button) - DETECT ONLY
    const exportSubmitButton = e.target.closest('button[data-testid="exportSubmit"]');
    if (exportSubmitButton) {
      return;
    }

    // Check for export menu button (button element) - DETECT ONLY
    const exportMenuButton = e.target.closest('button[data-testid="exportMenuButton"]');
    if (exportMenuButton) {
      return;
    }

    // Check for export menu anchor - DETECT ONLY
    const exportMenuAnchor = e.target.closest('a[data-testid="exportMenuButton"]');
    if (exportMenuAnchor) {
      return;
    }

    // Check for DIV containing export menu button (detect only, no action)
    if (e.target.tagName === "DIV" && e.target.textContent?.includes("Export to PDF")) {
      return;
    }
  };

  // Wrap handler with error handling
  const handleDocumentClick = wrapHandler(handleDocumentClickUnsafe, "ExportHandlers", "handleDocumentClick");

  // Use capture phase to catch events early
  // CRITICAL: Document-level listener handles all clicks (including dynamically added elements)
  // No need for MutationObserver to add duplicate listeners - that causes double handling
  document.addEventListener("click", handleDocumentClick, true);

  // Return cleanup function
  return () => {
    document.removeEventListener("click", handleDocumentClick, true);
  };
};

/**
 * Handle TRIGGER_EXPORT_DOWNLOAD message from parent
 * @param {Object} publicationData - Publication data for manual export
 * @param {Object} config - Viewer configuration
 */
export const triggerExportDownload = (publicationData, config) => {
  // FIX 1: Apply same fuse check here as in wrapper
  // This prevents race condition if parent triggers while viewer event fires
  if (globalThis.__PDF_DOWNLOAD_IN_PROGRESS__) {
    return;
  }

  if (publicationData) {
    const fakeEvent = {
      detail: publicationData,
      type: "manual-trigger",
    };
    // Set fuse - it will be released in handleExportSuccess after sending message
    globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = true;
    handleExportSuccess(fakeEvent, config).catch((error) => {
      log.error("[ExportHandlers] Manual export trigger error, releasing fuse", error);
      globalThis.__PDF_DOWNLOAD_IN_PROGRESS__ = false;
    });
    // Fuse is released in handleExportSuccess after sending message to parent (with timeout safety)
  }
};

/**
 * Handle TRIGGER_EXPORT_BUTTON_CLICK message from parent
 * Direct path: exportButton → exportSubmit (with polling)
 */
export const triggerExportButtonClick = async () => {
  // Try to find exportButton first
  const exportButton = await pollForElement(EXPORT_SELECTORS.EXPORT_BUTTON);

  if (exportButton) {
    try {
      exportButton.click();

      // Poll for export dialog/modal to appear, then click exportSubmit
      const exportSubmit = await pollForElement(EXPORT_SELECTORS.EXPORT_SUBMIT);
      if (exportSubmit) {
        try {
          exportSubmit.click();
          return; // Success - exit
        } catch (error) {
          log.error("[ExportHandlers] Error clicking exportSubmit", error);
        }
      } else {
        log.warn("[ExportHandlers] exportSubmit not found after clicking exportButton");
      }
    } catch (error) {
      log.error("[ExportHandlers] Error clicking exportButton", error);
    }
  } else {
    log.warn("[ExportHandlers] exportButton not found");
  }

  // CRITICAL FIX: If we reach here, export failed - notify parent
  log.error("[ExportHandlers] Export failed - could not find export buttons");
  globalThis.parent.postMessage(
    {
      type: "PDF_EXPORT_DOWNLOAD_FAILURE",
      error: "Export buttons not found. The viewer may not be fully loaded or the export feature is not available.",
    },
    getParentTargetOriginForPostMessage(),
  );
};

/**
 * Find export menu item by text content
 * @returns {Element|null} Export menu item or null
 */
const findExportMenuItemByText = () => {
  const allMenuItems = document.querySelectorAll('a, button, [role="menuitem"], .dropdown-item');
  for (const item of allMenuItems) {
    const text = (item.textContent || "").trim().toLowerCase();
    if (text.includes("export") || text.includes("pdf")) {
      return item;
    }
  }
  return null;
};

/**
 * Handle TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK message from parent
 *
 * Optimized Flow (menu button is more common):
 * Primary path: menuOptions → menuExport → exportSubmit (5 second timeout)
 * Fallback path: exportButton → exportSubmit (3 second timeout)
 */
export const triggerExportButtonClickWithDropdown = async () => {
  // Step 1: Try menu path first (PRIMARY PATH - most common)
  if (await tryMenuExportPath()) return;

  // Step 2: Fallback path - direct exportButton → exportSubmit (FALLBACK - less common)
  if (await tryDirectExportPath()) return;

  // CRITICAL FIX: If we reach here, export failed - notify parent
  log.error("[ExportHandlers] Export failed - tried both menu path (5s) and direct button path (3s)");
  globalThis.parent.postMessage(
    {
      type: "PDF_EXPORT_DOWNLOAD_FAILURE",
      error: "Export buttons not found. The viewer may not be fully loaded or the export feature is not available.",
    },
    getParentTargetOriginForPostMessage(),
  );
};
