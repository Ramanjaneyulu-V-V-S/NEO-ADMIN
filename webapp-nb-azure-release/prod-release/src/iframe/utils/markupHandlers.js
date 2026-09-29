/**
 * Markup Handlers
 *
 * Handles markup interactions, hyperlink clicks, cursor styling, and dialog management.
 *
 * Features:
 * - Event-based markup detection: Uses viewer API events (markupAdded, markupsLoaded, etc.)
 * - ViewerEventBus integration: Event-driven architecture for reliable event handling
 * - Hyperlink cursor: Automatically applies pointer cursor to markups containing hyperlinks
 * - Module-level cache: Stores markups to avoid repeated API calls
 * - Dialog prevention: Prevents dialogs from opening for server-loaded markups while allowing
 *   dialogs for newly created openSketch markups
 * - Error handling: All event handlers wrapped with try-catch to prevent single errors from breaking viewer
 *
 * Dialog Management:
 * - Server-loaded markups: Dialogs are prevented by checking if markups exist in cache
 *   and by using a flag that blocks dialog opening for 10 seconds after markups are loaded
 * - Newly created markups: Dialogs open only when user creates openSketch markups with the tool active
 *
 * Uses MutationObserver for dynamically added markups.
 */

import { viewerEventBus } from "./ViewerEventBus";
import { VIEWER_EVENTS } from "./ViewerEventTypes";
import { wrapHandler, wrapMutationObserver, logError } from "./errorHandling";
import { CleanupManager } from "./CleanupManager";
import { log } from "./logger";
import { getParentTargetOriginForPostMessage } from "./postMessageProtocol";

// Module-level storage for markups (replaces global window state)
// Registry keyed by viewer ID (string) to support multiple viewers
const viewerStateRegistry = {};

/**
 * Get instance state for a specific viewer
 * @param {string} viewerId - Viewer ID/Name
 * @returns {Object} State object for the viewer
 */
const getInstanceState = (viewerId) => {
  // Use 'default' bucket if no ID provided (legacy support)
  const id = viewerId || "default";

  if (!viewerStateRegistry[id]) {
    viewerStateRegistry[id] = {
      allMarkupsCache: null,
      cursorAppliedSet: new Set(),
    };
  }
  return viewerStateRegistry[id];
};

/**
 * Unregister viewer state
 * Clears memory when a viewer instance is unmounted
 * @param {string} viewerId - Viewer ID/Name
 */
export const unregisterViewer = (viewerId) => {
  if (viewerId && viewerStateRegistry[viewerId]) {
    delete viewerStateRegistry[viewerId];
  }
};

/**
 * Refresh all loaded markups from API
 * @param {Object} api - Brava viewer API instance
 * @param {string} [viewerId] - Viewer ID (optional)
 * @returns {Object|null} All markups object or null
 */
export const refreshAllMarkups = (api, viewerId) => {
  try {
    if (typeof api.getAllLoadedMarkups === "function") {
      const allMarkups = api.getAllLoadedMarkups();
      if (allMarkups) {
        getInstanceState(viewerId).allMarkupsCache = allMarkups;
        return allMarkups;
      }
    }
  } catch (error) {
    log.error("[MarkupHandlers] Error refreshing allMarkups", error);
  }
  return null;
};

/**
 * Get cached markups
 * @param {string} [viewerId] - Viewer ID (optional)
 * @returns {Object|null} Cached markups or null
 */
export const getCachedMarkups = (viewerId) => {
  return getInstanceState(viewerId).allMarkupsCache;
};

/**
 * Handle markup click
 * Activates select tool and handles hyperlinks within markups
 *
 * CRITICAL: Always refreshes cache to ensure newly created markups are included.
 * This ensures new markups are immediately clickable after creation/save.
 *
 * Uses ViewerEventBus subscription for new markup detection.
 *
 * @param {string} markupId - Markup ID that was clicked
 * @param {Object} api - Brava viewer API instance
 * @param {string} [viewerId] - Viewer ID (optional)
 */
export const handleMarkupClick = (markupId, api, viewerId) => {
  try {
    if (!markupId || !api) {
      return;
    }

    // Always refresh cache to ensure newly created/saved markups are included
    // This is critical for new markups that may not be in cache yet
    refreshAllMarkups(api, viewerId);

    const state = getInstanceState(viewerId);

    // Try to get markup from cache first
    let markupDetails = state.allMarkupsCache?.[markupId];

    // If not in cache, try to get directly from API (markup might be loaded but cache stale)
    if (!markupDetails && typeof api.getMarkup === "function") {
      try {
        markupDetails = api.getMarkup(markupId);
        if (markupDetails) {
          handleMarkupClickInternal(markupId, markupDetails);
          return;
        }
      } catch (apiError) {
        log.warn("[MarkupClick] API.getMarkup() failed", { error: apiError });
      }
    }

    // If still not found, try getAllLoadedMarkups to refresh cache one more time
    if (!markupDetails && typeof api.getAllLoadedMarkups === "function") {
      try {
        const allMarkups = api.getAllLoadedMarkups();
        if (allMarkups && allMarkups[markupId]) {
          markupDetails = allMarkups[markupId];
          // Update cache
          state.allMarkupsCache = allMarkups;
          handleMarkupClickInternal(markupId, markupDetails);
          return;
        }
      } catch (apiError) {
        log.warn("[MarkupClick] getAllLoadedMarkups() failed", { error: apiError });
      }
    }

    // If markup is in cache now, handle it
    if (markupDetails || (state.allMarkupsCache && state.allMarkupsCache[markupId])) {
      const finalMarkup = markupDetails || state.allMarkupsCache[markupId];
      handleMarkupClickInternal(markupId, finalMarkup);
      return;
    }

    // Markup not in cache - subscribe to markupAdded event to catch when markup becomes available
    const instanceId = viewerId || "default";
    let handled = false;

    const unsubscribe = viewerEventBus.subscribe(
      VIEWER_EVENTS.MARKUP_ADDED,
      instanceId,
      (event) => {
        if (handled) return;

        // Check if this is the markup we're waiting for
        const addedMarkupId = event.detail?.markup?.id || event.detail?.id;
        if (addedMarkupId === markupId) {
          handled = true;
          unsubscribe();

          // Refresh cache and handle
          refreshAllMarkups(api, viewerId);
          const retryState = getInstanceState(viewerId);
          if (retryState.allMarkupsCache?.[markupId]) {
            handleMarkupClickInternal(markupId, retryState.allMarkupsCache[markupId]);
          }
        }
      }
    );

    // Event-driven retry: Subscribe to PAGE_RENDER and MARKUP_ADDED events
    // This ensures we retry when markup becomes available, rather than polling with setTimeout
    let retryAttempts = 0;
    const maxRetryAttempts = 5; // Allow more attempts since we're event-driven

    const handleMarkupAvailable = () => {
      if (handled) return;

      retryAttempts++;

      // Refresh cache and try again
      refreshAllMarkups(api, viewerId);
      const retryState = getInstanceState(viewerId);

      if (retryState.allMarkupsCache?.[markupId]) {
        handled = true;
        unsubscribe();
        unsubscribePageRender();
        unsubscribeMarkupsLoaded();
        handleMarkupClickInternal(markupId, retryState.allMarkupsCache[markupId]);
      } else if (retryAttempts >= maxRetryAttempts) {
        unsubscribe();
        unsubscribePageRender();
        unsubscribeMarkupsLoaded();
      }
    };

    // Subscribe to PAGE_RENDER events (fires when page renders, markup might become available)
    const unsubscribePageRender = viewerEventBus.subscribe(
      VIEWER_EVENTS.PAGE_RENDER,
      instanceId,
      handleMarkupAvailable
    );

    // Also subscribe to MARKUPS_LOADED (fires when all markups are loaded)
    const unsubscribeMarkupsLoaded = viewerEventBus.subscribe(
      VIEWER_EVENTS.MARKUPS_LOADED,
      instanceId,
      handleMarkupAvailable
    );

    // Initial attempt
    handleMarkupAvailable();
  } catch (error) {
    logError('MarkupHandlers', 'handleMarkupClick', error, { markupId, viewerId });
  }
};

/**
 * Internal handler for markup click (handles hyperlink logic)
 * @param {string} markupId - Markup ID
 * @param {Object} markupDetails - Markup details object
 */
const handleMarkupClickInternal = (markupId, markupDetails) => {
  try {
    if (
      markupDetails &&
      markupDetails.hyperlink &&
      markupDetails.hyperlink.trim() !== ""
    ) {
      // Handle hyperlink in markup
      try {
        const hyperlinkUrl = markupDetails.hyperlink;

        // Parse URL to check if it's a document link
        const urlParams = new URLSearchParams(hyperlinkUrl.split("?")[1] || "");
        const publicationId =
          urlParams.get("pid") ||
          urlParams.get("publicationId") ||
          urlParams.get("publishing_id");
        const page = urlParams.get("pageNumber") || urlParams.get("page");
        const linkType = urlParams.get("type");

        if (publicationId) {
          // This is a document link - send to parent
          const pageNumber = page ? parseInt(page, 10) : null;
          const message = {
            type: "HYPERLINK_CLICK",
            url: hyperlinkUrl,
            page: pageNumber,
            publicationId: publicationId,
            linkType: linkType || "page",
            source: "markup",
          };

          window.parent.postMessage(message, getParentTargetOriginForPostMessage());
        } else {
          // This is an external link - open in new window
          // Validate protocol to prevent javascript: / data: URI injection
          try {
            const url = new URL(hyperlinkUrl, window.location.origin);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              const newWindow = window.open(hyperlinkUrl, "_blank", "noopener,noreferrer");
              if (!newWindow) {
                log.warn("[MARKUP HYPERLINK] New window blocked (popup blocker or user preference)");
              }
            } else {
              log.warn("[MARKUP HYPERLINK] Blocked opening URL with unsafe protocol", { protocol: url.protocol });
            }
          } catch (urlError) {
            log.warn("[MARKUP HYPERLINK] Invalid URL, not opening", { hyperlinkUrl, error: urlError });
          }
        }
      } catch (error) {
        log.error("[MarkupHandlers] Error handling markup click", error, {
          markupId,
          hyperlinkUrl: markupDetails?.hyperlink,
        });
      }
    }
  } catch (error) {
    logError('MarkupHandlers', 'handleMarkupClickInternal', error, { markupId });
  }
};

// Constants for markup ID detection
const UUID_SEGMENT_COUNT = 5; // Standard UUID format: xxxxx-xxxx-xxxx-xxxx-xxxx
const DEFAULT_MAX_DOM_TRAVERSAL_DEPTH = 10;
const TEXTAREA_MAX_DOM_TRAVERSAL_DEPTH = 15; // Textarea markups may have deeper nesting

/**
 * Check if element ID matches a markup in the cache
 * Handles both exact matches and parent markup detection for child elements
 * 
 * @param {string[]} markupIds - Array of markup IDs from cache
 * @param {string} elementId - Element ID to check
 * @returns {string|null} Matched markup ID or null
 */
const findMarkupIdInCache = (markupIds, elementId) => {
  // Quick validation: ensure inputs are valid
  if (!markupIds || !elementId || markupIds.length === 0) {
    return null;
  }

  // Strategy 1: Direct exact match (fastest path)
  if (markupIds.includes(elementId)) {
    return elementId;
  }

  // Strategy 2 & 3: Parent markup detection (only if needed)
  // Quick check: only proceed if element ID contains hyphens (potential child element)
  // This avoids expensive operations for non-UUID IDs
  if (!elementId.includes('-')) {
    return null;
  }

  // Validate UUID-like format (alphanumeric + hyphens) to avoid processing invalid IDs
  // This prevents wasting time on IDs like "ot-iv", "IGCDisplaylistPage2", etc.
  const segments = elementId.split('-');
  if (segments.length < UUID_SEGMENT_COUNT) {
    // Not enough segments to be a UUID or child element, skip expensive checks
    return null;
  }

  // Strategy 2: Extract potential parent ID (first 5 UUID segments)
  const possibleParentId = segments.slice(0, UUID_SEGMENT_COUNT).join('-');

  if (possibleParentId !== elementId && markupIds.includes(possibleParentId)) {
    return possibleParentId;
  }

  // Strategy 3: Prefix matching - find markup ID that is a prefix of element ID
  // This is the most expensive operation, so it runs last
  const parentMarkupId = markupIds.find(id => elementId.startsWith(id + '-'));
  if (parentMarkupId) {
    return parentMarkupId;
  }

  return null;
};

/**
 * Find markup ID from element or its parents
 *
 * CRITICAL: This function works for both old and new markups by:
 * 1. Traversing DOM to find element IDs (works regardless of cache state)
 * 2. Checking cache if available (fast path for known markups)
 * 3. Returning any valid-looking ID if cache is empty (handles new markups)
 *
 * This ensures newly created markups are clickable even if cache hasn't been refreshed yet.
 *
 * @param {Element} element - Clicked element
 * @param {number} maxDepth - Maximum depth to traverse (default: 10)
 * @param {string} viewerName - Optional viewer name for cache lookup
 * @returns {string|null} Markup ID or null
 */
export const findMarkupIdFromElement = (element, maxDepth = DEFAULT_MAX_DOM_TRAVERSAL_DEPTH, viewerName = null) => {
  let current = element;
  let depth = 0;

  while (current && current !== document && depth < maxDepth) {
    let elementId = null;

    // Try multiple ways to get the ID (for SVG elements and HTML elements)
    if (current.id) {
      elementId = current.id;
    } else if (current.getAttribute && current.getAttribute("id")) {
      elementId = current.getAttribute("id");
    } else if (current.hasAttribute && current.hasAttribute("id")) {
      elementId = current.getAttribute("id");
    }

    // If we found an ID, check if it's a markup
    if (elementId) {
      // Fast path: Check cache if available
      // Try viewer-specific cache first, then fall back to default
      const viewerToCheck = viewerName || "default";
      const state = getInstanceState(viewerToCheck);

      if (state.allMarkupsCache) {
        const markupIds = Object.keys(state.allMarkupsCache);
        const matchedId = findMarkupIdInCache(markupIds, elementId);
        if (matchedId) {
          return matchedId;
        }
      }

      // Also check default cache if we checked a specific viewer
      if (viewerName && viewerName !== "default") {
        const defaultState = getInstanceState("default");
        if (defaultState.allMarkupsCache) {
          const markupIds = Object.keys(defaultState.allMarkupsCache);
          const matchedId = findMarkupIdInCache(markupIds, elementId);
          if (matchedId) {
            return matchedId;
          }
        }
      }

      // Cache is empty or ID not found - still return the ID if it looks valid
      // Markup IDs are typically UUIDs or have specific patterns
      // This allows new markups to be clickable even before cache refresh
      // The handleMarkupClick function will refresh cache and validate
      if (elementId.length > 0) {
        return elementId;
      }
    }

    current = current.parentElement;
    depth++;
  }

  return null;
};

/**
 * Find DOM element(s) for a markup by its ID
 * Uses only stable attributes (element IDs) - no class selectors
 * @param {string} markupId - Markup ID (stable, from viewer API)
 * @returns {Element[]} Array of found elements (may be empty)
 */
const findMarkupElementsById = (markupId) => {
  const elements = [];

  if (!markupId) return elements;

  try {
    // Strategy 1: Direct ID lookup (most reliable - IDs are stable from API)
    const byId = document.getElementById(markupId);
    if (byId) {
      elements.push(byId);
    }

    // Strategy 2: Query by ID attribute (for SVG elements)
    // Only use ID attribute - stable, guaranteed by viewer API
    const safeId = CSS.escape(markupId);
    const byAttribute = document.querySelector(`[id="${safeId}"]`);
    if (byAttribute && !elements.includes(byAttribute)) {
      elements.push(byAttribute);
    }

    // Strategy 3: Search within SVG elements (markups are in SVG layers)
    // Use getElementsByTagName (stable, not a class selector)
    // Note: Cannot use # selector for IDs starting with numbers (invalid CSS)
    // Use attribute selector only: [id="..."] works for any ID format
    if (elements.length === 0) {
      const svgElements = document.getElementsByTagName("svg");
      for (const svg of svgElements) {
        // Use attribute selector only (works with IDs starting with numbers)
        const child = svg.querySelector(`[id="${safeId}"]`);
        if (child && !elements.includes(child)) {
          elements.push(child);
        }
      }
    }
  } catch (error) {
    // Silently fail - element may not exist yet (lazy loading)
  }

  return elements;
};

/**
 * Apply pointer cursor to markup elements that have hyperlinks
 * Uses only stable element IDs - no DOM class selectors
 * @param {Object} api - Brava viewer API instance
 * @param {string[]} markupIds - Optional array of specific markup IDs to process (for incremental updates)
 * @param {boolean} forceReapply - If true, reapply even if already processed (for re-renders)
 * @param {string} [viewerId] - Viewer ID (optional)
 */
export const applyHyperlinkCursor = (
  api,
  markupIds = null,
  forceReapply = false,
  viewerId
) => {
  if (!api || typeof api.getAllLoadedMarkups !== "function") {
    return;
  }

  try {
    // Refresh markups cache
    const allMarkups = refreshAllMarkups(api, viewerId);
    if (!allMarkups) return;

    const state = getInstanceState(viewerId);

    // Determine which markups to process
    const markupsToProcess = markupIds
      ? markupIds.filter((id) => allMarkups[id])
      : Object.keys(allMarkups);

    let appliedCount = 0;

    markupsToProcess.forEach((markupId) => {
      // Skip if already processed (unless force reapply or explicit request)
      if (!forceReapply && !markupIds && state.cursorAppliedSet.has(markupId)) {
        return;
      }

      const markup = allMarkups[markupId];

      // Check if markup has a hyperlink
      if (
        markup &&
        markup.hyperlink &&
        typeof markup.hyperlink === "string" &&
        markup.hyperlink.trim() !== ""
      ) {
        // Find the DOM element(s) for this markup (using stable ID only)
        const elements = findMarkupElementsById(markupId);

        if (elements.length > 0) {
          // Apply pointer cursor to all found elements
          elements.forEach((element) => {
            try {
              // Apply cursor style directly - safe, no side effects
              if (element.style) {
                element.style.cursor = "pointer";
                appliedCount++;
              }

              // Also apply to parent elements for better hover area (SVG groups)
              let parent = element.parentElement;
              let depth = 0;
              while (
                parent &&
                depth < 2 &&
                parent.tagName !== "BODY" &&
                parent.tagName !== "HTML"
              ) {
                if (parent.tagName === "svg" || parent.tagName === "g") {
                  if (parent.style) {
                    parent.style.cursor = "pointer";
                  }
                }
                parent = parent.parentElement;
                depth++;
              }
            } catch (styleError) {
              // Silently fail - element may be in transition
            }
          });

          // Mark as processed
          state.cursorAppliedSet.add(markupId);
        }
      } else {
        // Markup doesn't have hyperlink - remove from tracking if it was there
        state.cursorAppliedSet.delete(markupId);
      }
    });

  } catch (error) {
    log.error("[MarkupHandlers] Error applying hyperlink cursor", error);
  }
};

/**
 * Setup markup click detection via DOM event listeners (fallback only)
 * Primary detection should use viewer API events via setupMarkupEventListeners
 * @param {Object} api - Brava viewer API instance
 */
/**
 * Setup DOM-based markup click detection (fallback method)
 *
 * This is a fallback that catches clicks on markup elements even if API events fail.
 * It refreshes the markup cache when needed and finds markup IDs by traversing the DOM.
 *
 * IMPORTANT: This works for both old and new markups because it:
 * 1. Refreshes cache if empty (handles lazy loading)
 * 2. Traverses DOM to find markup ID (works even if cache is stale)
 * 3. Always refreshes cache on click to ensure new markups are included
 *
 * @param {Object} api - Brava viewer API instance
 * @returns {Function} Cleanup function
 */
/**
 * Setup markup click detection via DOM event listeners (fallback only)
 * Primary detection should use viewer API events via setupMarkupEventListeners
 * @param {Object} api - Brava viewer API instance
 * @param {string} [viewerName] - Viewer ID (optional)
 */
export const setupMarkupClickDetection = (api, viewerName) => {
  const handleDocumentClickUnsafe = (e) => {
    // Always refresh cache on click to ensure markups are up to date
    refreshAllMarkups(api, viewerName);

    // First, try to find markup ID from clicked element (works for all markup types)
    // Use deeper traversal depth for textarea markups which have nested child elements
    const markupId = findMarkupIdFromElement(e.target, TEXTAREA_MAX_DOM_TRAVERSAL_DEPTH, viewerName);

    if (markupId) {
      // Found a markup ID - check if this markup has a hyperlink
      const state = getInstanceState(viewerName);
      const markupDetails = state.allMarkupsCache?.[markupId];

      if (markupDetails && markupDetails.hyperlink && markupDetails.hyperlink.trim() !== "") {
        // This is a markup with a hyperlink (e.g., textarea markup with hyperlink)
        // Prevent default behavior if clicking on an anchor tag within the markup
        const clickedLink = e.target.closest('a[href]');
        if (clickedLink) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }

        handleMarkupClick(markupId, api, viewerName);
        return;
      }

      // Markup without hyperlink - check if it's an anchor tag that should be skipped
      const clickedLink = e.target.closest('a[href]');
      if (clickedLink) {
        const isMarkupCommentPaneHyperlink = clickedLink.classList?.contains('ot-iv-MarkupCommentPane-hyperlink');
        const href = clickedLink.getAttribute('href') || clickedLink.href;

        // Check if it's a document hyperlink (has publicationId in URL)
        const urlParams = new URLSearchParams(href.split("?")[1] || "");
        const hasPublicationId = !!(urlParams.get("pid") || urlParams.get("publicationId") || urlParams.get("publishing_id"));

        if (hasPublicationId) {
          // Document hyperlink - will be handled by setupHyperlinkClickDetection in hyperlinkHandlers.js
          return;
        }

        if (isMarkupCommentPaneHyperlink) {
          // Markup comment pane hyperlink - will be handled by setupHyperlinkClickDetection in hyperlinkHandlers.js
          return;
        }
      }

      // Regular markup click (no hyperlink)
      handleMarkupClick(markupId, api, viewerName);
      return;
    }

    // No markup found - check if it's a standalone hyperlink
    const clickedLink = e.target.closest('a[href]');
    if (clickedLink) {
      const isMarkupCommentPaneHyperlink = clickedLink.classList?.contains('ot-iv-MarkupCommentPane-hyperlink');
      const href = clickedLink.getAttribute('href') || clickedLink.href;

      // Check if it's a document hyperlink (has publicationId in URL)
      const urlParams = new URLSearchParams(href.split("?")[1] || "");
      const hasPublicationId = !!(urlParams.get("pid") || urlParams.get("publicationId") || urlParams.get("publishing_id"));

      if (hasPublicationId || isMarkupCommentPaneHyperlink) {
        return;
      }
    }
  };

  // Wrap handler with error handling to prevent single errors from breaking all clicks
  const handleDocumentClick = wrapHandler(handleDocumentClickUnsafe, 'MarkupHandlers', 'handleDocumentClick');

  // Use capture phase to catch events early
  document.addEventListener("click", handleDocumentClick, true);

  // Return cleanup function
  return () => {
    document.removeEventListener("click", handleDocumentClick, true);
  };
};

/**
 * Setup hyperlink cursor for markups
 * Production-safe implementation that works in all scenarios:
 * - Initial publication load
 * - Lazy page loading
 * - Markup layer re-renders
 * - New markups added/edited
 * - Saved markups
 *
 * Uses Viewer API events + MutationObserver fallback (scoped to markup layer)
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 * @returns {Function} Cleanup function
 */
/**
 * Setup hyperlink cursor for markups containing hyperlinks
 *
 * Automatically applies pointer cursor to all markups that contain hyperlinks.
 * Works in all scenarios: initial load, lazy loading, re-renders, new markups, saved markups.
 *
 * Strategy:
 * 1. Listens to viewer API events (markupsLoaded, markupAdded, markupsSaved, pageRender, publicationLoaded)
 * 2. Uses MutationObserver as fallback for dynamically added markups
 * 3. Finds markup DOM elements by ID (stable, doesn't rely on class names)
 * 4. Applies cursor: pointer to markups with hyperlinks
 *
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 * @returns {Function|null} Cleanup function or null if setup fails
 */
export const setupHyperlinkCursor = (viewerName, api) => {
  if (!viewerName || !api) return null;

  // CleanupManager for automatic memory management
  const cleanup = new CleanupManager('HyperlinkCursor');

  /**
   * Find markup layer container (for MutationObserver scoping)
   * Uses only stable element types (SVG) and IDs - no class selectors
   * @returns {Element|null} Markup layer element or null
   */
  const findMarkupLayer = () => {
    // Find SVG elements (markups are rendered in SVG layers)
    // SVG is a stable element type, guaranteed by viewer
    const svgElements = document.getElementsByTagName("svg");

    // Prefer SVG elements that contain elements with IDs matching markup IDs
    for (const svg of svgElements) {
      // Check if this SVG contains any elements with markup IDs
      // Use attribute selector only (works with IDs starting with numbers, unlike # selector)
      const state = getInstanceState(viewerName);
      if (state.allMarkupsCache) {
        const markupIds = Object.keys(state.allMarkupsCache);
        for (const markupId of markupIds) {
          // Use attribute selector: [id="..."] works for any ID format
          // Cannot use # selector for IDs starting with numbers (invalid CSS)
          const safeMarkupId = CSS.escape(markupId);
          const element = svg.querySelector(`[id="${safeMarkupId}"]`);

          // Also check if element exists in document and is within this SVG
          if (!element) {
            try {
              const docElement = document.getElementById(markupId);
              if (docElement && svg.contains(docElement)) {
                return svg; // Found SVG containing markups
              }
            } catch (e) {
              // Ignore errors
            }
          } else {
            return svg; // Found SVG containing markups
          }
        }
      }
    }

    // Fallback: return first SVG if found (markups are typically in SVG)
    return svgElements.length > 0 ? svgElements[0] : null;
  };

  // Apply cursor with retry logic (for lazy loading)
  // Uses pageRender event subscription for retries
  const applyCursorWithRetry = (markupIds = null, retries = 5) => {
    let retryCount = retries;

    const attempt = () => {
      // Call the exported function
      applyHyperlinkCursor(api, markupIds, false, viewerName);

      // If specific IDs requested and not all found, retry
      if (markupIds && retryCount > 0) {
        const foundCount = markupIds.filter((id) => {
          const elements = findMarkupElementsById(id);
          return elements.length > 0;
        }).length;

        if (foundCount < markupIds.length) {
          retryCount--;
          // Subscribe to pageRender to retry when page finishes rendering
          const instanceId = viewerName.includes("viewer") ? viewerName : `${viewerName}-viewer`;
          const unsubscribe = viewerEventBus.subscribe(
            VIEWER_EVENTS.PAGE_RENDER,
            instanceId,
            () => {
              unsubscribe();
              attempt();
            }
          );
          // Track subscription cleanup - cleanup.destroy() will auto-unsubscribe
          cleanup.addSubscription(unsubscribe);
        }
      } else if (!markupIds && retryCount > 0) {
        // For bulk application, check if we found any elements at all
        // If not, retry (might be too early)
        const allMarkups = getInstanceState(viewerName).allMarkupsCache;
        if (allMarkups) {
          const hyperlinkMarkups = Object.keys(allMarkups).filter((id) => {
            const markup = allMarkups[id];
            return (
              markup &&
              markup.hyperlink &&
              typeof markup.hyperlink === "string" &&
              markup.hyperlink.trim() !== ""
            );
          });

          const foundAny = hyperlinkMarkups.some((id) => {
            const elements = findMarkupElementsById(id);
            return elements.length > 0;
          });

          if (!foundAny && hyperlinkMarkups.length > 0) {
            retryCount--;
            const instanceId = viewerName.includes("viewer") ? viewerName : `${viewerName}-viewer`;
            const unsubscribe = viewerEventBus.subscribe(
              VIEWER_EVENTS.PAGE_RENDER,
              instanceId,
              () => {
                unsubscribe();
                attempt();
              }
            );
            // Track subscription cleanup - cleanup.destroy() will auto-unsubscribe
            cleanup.addSubscription(unsubscribe);
          }
        }
      }
    };

    // Try immediately, subscribe to pageRender for retry
    attempt();
  };

  // Also apply immediately on setup (in case events already fired)
  applyCursorWithRetry(null, 3);

  // 1. Initial load: markupsLoaded event
  const markupsLoadedEvent = viewerName + "-markupsLoaded";
  const handleMarkupsLoaded = () => {
    refreshAllMarkups(api);
    applyCursorWithRetry();
  };
  cleanup.addEventListener(window, markupsLoadedEvent, handleMarkupsLoaded);

  // 2. New markup added: markupAdded event (lazy loading, new markups)
  const markupAddedEvent = viewerName + "-markupAdded";
  const handleMarkupAdded = (e) => {
    refreshAllMarkups(api);

    // Extract markup ID from event if available
    let markupId = null;
    if (e.detail) {
      if (e.detail.markup && e.detail.markup.id) {
        markupId = e.detail.markup.id;
      } else if (e.detail.id) {
        markupId = e.detail.id;
      } else if (typeof e.detail === "string") {
        markupId = e.detail;
      }
    }

    if (markupId) {
      applyCursorWithRetry([markupId]);
    } else {
      // Bulk addition - process all
      applyCursorWithRetry();
    }
  };
  cleanup.addEventListener(window, markupAddedEvent, handleMarkupAdded);

  // 3. Markups saved: markupsSaved event (when user saves new markup)
  const markupsSavedEvent = viewerName + "-markupsSaved";
  const handleMarkupsSaved = () => {
    refreshAllMarkups(api);
    // Reapply to catch newly saved markups with hyperlinks
    applyCursorWithRetry(null, 5); // More retries for saved markups
  };
  cleanup.addEventListener(window, markupsSavedEvent, handleMarkupsSaved);

  // 4. Page render: pageRender event (lazy page loading, layer re-renders)
  const pageRenderEvent = viewerName + "-pageRender";
  const handlePageRender = () => {
    // Clear tracking for re-rendered page (markups may have been redrawn)
    const state = getInstanceState(viewerName);
    state.cursorAppliedSet.clear();
    refreshAllMarkups(api, viewerName);
    applyCursorWithRetry();
  };
  cleanup.addEventListener(window, pageRenderEvent, handlePageRender);

  // 5. Publication loaded: publicationLoaded event (initial load)
  const publicationLoadedEvent = viewerName + "-publicationLoaded";
  const handlePublicationLoaded = () => {
    refreshAllMarkups(api, viewerName);
    applyCursorWithRetry();
  };
  cleanup.addEventListener(window, publicationLoadedEvent, handlePublicationLoaded);

  // MutationObserver fallback (scoped to markup layer only)
  const setupMutationObserver = () => {
    const markupLayer = findMarkupLayer();
    if (!markupLayer || !window.MutationObserver) return;

    const mutationCallback = wrapMutationObserver((mutations) => {
      // Check for new elements with IDs that match markup IDs
      const newMarkupIds = new Set();
      const state = getInstanceState(viewerName);
      const currentCache = state.allMarkupsCache;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this element has an ID that matches a markup
            const elementId = node.id || node.getAttribute?.("id");
            if (elementId && currentCache && currentCache[elementId]) {
              newMarkupIds.add(elementId);
            }

            // Also check children
            if (node.querySelectorAll) {
              const childrenWithIds = node.querySelectorAll("[id]");
              childrenWithIds.forEach((child) => {
                const childId = child.id || child.getAttribute?.("id");
                if (childId && currentCache && currentCache[childId]) {
                  newMarkupIds.add(childId);
                }
              });
            }
          }
        });
      });

      // Apply cursor to newly detected markups
      if (newMarkupIds.size > 0) {
        applyCursorWithRetry(Array.from(newMarkupIds));
      }
    }, 'MarkupHandlers');

    const mutationObserver = new MutationObserver(mutationCallback);

    // Observe only the markup layer (not entire DOM)
    mutationObserver.observe(markupLayer, {
      childList: true,
      subtree: true,
      // Note: attributes and attributeFilter omitted - we only care about structure changes
    });

    // Track observer for cleanup
    cleanup.addObserver(mutationObserver);
  };

  // Setup MutationObserver after publication loads (ensure markup layer exists)
  // Use event-driven approach: setup observer when publication loads
  const instanceId = viewerName.includes("viewer") ? viewerName : `${viewerName}-viewer`;
  const unsubscribeObserver = viewerEventBus.subscribe(
    VIEWER_EVENTS.PUBLICATION_LOADED,
    instanceId,
    () => {
      // Event-driven: PUBLICATION_LOADED event means DOM is ready
      // No delay needed - setup MutationObserver immediately when event fires
      setupMutationObserver();
    }
  );
  // Track subscription for cleanup
  cleanup.addSubscription(unsubscribeObserver);

  // Also try immediately in case publication already loaded
  setupMutationObserver();

  // Fallback: Mouseover handler to apply cursor on hover (catches any missed cases)
  // Only applies if cursor isn't already set to pointer
  const handleMouseOverUnsafe = (e) => {
    const element = e.target;

    // Skip if cursor already set
    if (element.style && element.style.cursor === "pointer") {
      return;
    }

    // Find markup ID from hovered element
    const markupId = findMarkupIdFromElement(element, 10, viewerName);
    const state = getInstanceState(viewerName);
    if (markupId && state.allMarkupsCache) {
      const markup = state.allMarkupsCache[markupId];
      // If markup has hyperlink, apply cursor immediately
      if (
        markup &&
        markup.hyperlink &&
        typeof markup.hyperlink === "string" &&
        markup.hyperlink.trim() !== ""
      ) {
        if (element.style) {
          element.style.cursor = "pointer";
        }
        // Also apply to parent if needed
        let parent = element.parentElement;
        if (parent && (parent.tagName === "svg" || parent.tagName === "g")) {
          if (parent.style && parent.style.cursor !== "pointer") {
            parent.style.cursor = "pointer";
          }
        }
      }
    }
  };

  // Wrap handler with error handling
  const handleMouseOver = wrapHandler(handleMouseOverUnsafe, 'MarkupHandlers', 'handleMouseOver');

  // Add mouseover listener to document (catches all markups)
  // Use capture phase to catch early, but only apply if needed
  cleanup.addEventListener(document, "mouseover", handleMouseOver, true);

  // Return cleanup function - military-grade cleanup
  return () => {
    // Destroy all tracked resources (event listeners, observers, subscriptions)
    cleanup.destroy();

    // Clear tracking - get state for this viewer instance
    const state = getInstanceState(viewerName);
    state.cursorAppliedSet.clear();
  };
};

/**
 * Setup markup event listeners (primary detection method)
 * Uses viewer API events for reliable markup click detection
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 */
/**
 * Setup markup event listeners (primary detection method)
 *
 * Listens to viewer API events for markup interactions.
 *
 * CRITICAL: Also listens to markupAdded and markupsSaved events to refresh cache
 * when new markups are created/saved, ensuring they become clickable immediately.
 *
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {Object} api - Brava viewer API instance
 * @returns {Function} Cleanup function
 */
export const setupMarkupEventListeners = (viewerName, api) => {
  // CleanupManager for automatic memory management
  const cleanup = new CleanupManager('MarkupEventListeners');

  // Handler for markup click/selection events (primary method)
  const handleMarkupEvent = (e) => {
    // Refresh markups cache on event to ensure new markups are included
    refreshAllMarkups(api);

    // Try to get markup ID from event detail or API
    let clickedMarkupId = null;

    // Check event detail first
    if (e.detail && e.detail.markup) {
      clickedMarkupId = e.detail.markup.id || e.detail.markup;
    } else if (e.detail && e.detail.id) {
      clickedMarkupId = e.detail.id;
    }

    // If not in event detail, try to get active markup from API
    if (!clickedMarkupId && typeof api.getActiveMarkup === "function") {
      try {
        const activeMarkup = api.getActiveMarkup();
        if (activeMarkup && activeMarkup.id) {
          clickedMarkupId = activeMarkup.id;
        }
      } catch (apiError) {
        log.error("[MarkupHandlers] API call failed", apiError);
      }
    }

    // Handle markup click if we have an ID
    if (clickedMarkupId) {
      handleMarkupClick(clickedMarkupId, api, viewerName);
    }
  };

  // Listen for markup selection/click events (use canonical event names)
  const markupEventNames = [
    viewerName + "-markupSelected",
    viewerName + "-markupClicked",
    viewerName + "-markupActivated",
  ];

  markupEventNames.forEach((eventName) => {
    cleanup.addEventListener(window, eventName, handleMarkupEvent);
  });

  // CRITICAL: Listen for markup creation/save events to refresh cache
  // This ensures newly created/saved markups become clickable immediately
  const markupAddedEvent = viewerName + "-markupAdded";

  // Track if markups have been loaded from server (to distinguish user-created vs loaded markups)
  let markupsLoadedFromServer = false;
  let freehandToolActiveTime = null; // Track when freehand tool was last active

  /**
   * Handle markupsLoaded event - fired when markups are loaded from server
   *
   * Responsibilities:
   * - Refresh markup cache with loaded markups
   * - Log markup IDs for debugging
   * - Set flag to prevent dialogs from opening for loaded markups
   * - Clear flag after 10 seconds to allow dialogs for newly created markups
   */
  /*
   * Handle markupsLoaded event - fired when markups are loaded from server
   *
   * Responsibilities:
   * - Refresh markup cache with loaded markups
   * - Log markup IDs for debugging
   * - Set flag to prevent dialogs from opening for loaded markups
   * - Clear flag after 10 seconds to allow dialogs for newly created markups
   */
  const markupsLoadedEvent = viewerName + "-markupsLoaded";
  const handleMarkupsLoaded = () => {
    // Refresh cache when markups are loaded
    refreshAllMarkups(api, viewerName);

    // Log all markup IDs from the API response
    let markupIds = [];
    const state = getInstanceState(viewerName);
    if (state.allMarkupsCache) {
      markupIds = Object.keys(state.allMarkupsCache);
    } else {
      // Try to get markups directly from API if cache is empty
      try {
        if (typeof api.getAllLoadedMarkups === "function") {
          const allMarkups = api.getAllLoadedMarkups();
          if (allMarkups) {
            markupIds = Object.keys(allMarkups);
          }
        }
      } catch (error) {
        log.warn("[MarkupHandlers] Error getting markup IDs", { error });
      }
    }

    // Set flag to prevent dialogs from opening for loaded markups
    // The handleMarkupAdded function checks this flag and also verifies if markups
    // already exist in cache to distinguish between loaded and newly created markups
    markupsLoadedFromServer = true;

    // Event-driven reset: Clear flag when user activates any tool
    // This is more reliable than timeout - we know markups are loaded when user interacts
    // Using {once: true} for one-time event listener (built-in browser cleanup)
    const clearLoadedFlag = () => {
      markupsLoadedFromServer = false;
    };
    cleanup.addEventListener(window, viewerName + "-toolActivated", clearLoadedFlag, { once: true });

    // Notify parent window that markups are loaded.
    // The Brava viewer fires this event on the iframe's window — the parent window cannot
    // receive iframe window events directly, so we bridge it via postMessage.
    try {
      if (globalThis.parent != null && globalThis.parent !== globalThis) {
        globalThis.parent.postMessage(
          { type: "MARKUPS_LOADED_IN_VIEWER" },
          getParentTargetOriginForPostMessage()
        );
      }
    } catch (_e) {
      // Non-critical — fallback timeout in parent will handle restoration
    }
  };
  cleanup.addEventListener(window, markupsLoadedEvent, handleMarkupsLoaded);

  // Track when openSketch tool is activated
  const toolActivatedEvent = viewerName + "-toolActivated";
  const handleToolActivated = (e) => {
    try {
      const tool = e.detail?.tool || e.detail;
      // Check if openSketch tool was activated (checking for both "openSketch" and "opensketch")
      const isOpenSketch = (toolValue) => {
        if (!toolValue) return false;
        const toolStr =
          typeof toolValue === "string"
            ? toolValue
            : toolValue.name || toolValue.type || "";
        const toolLower = toolStr.toLowerCase();
        return (
          toolLower === "opensketch" ||
          toolLower.includes("opensketch") ||
          toolStr === "openSketch"
        );
      };

      if (
        tool &&
        ((typeof tool === "string" && isOpenSketch(tool)) ||
          (tool.name && isOpenSketch(tool.name)) ||
          (tool.type && isOpenSketch(tool.type)))
      ) {
        freehandToolActiveTime = Date.now();
      } else {
        // If another tool is activated, clear openSketch tracking
        freehandToolActiveTime = null;
      }
    } catch (error) {
      // Ignore errors
    }
  };
  cleanup.addEventListener(window, toolActivatedEvent, handleToolActivated);

  /**
   * Handle markupAdded event - fired when a markup is added (either loaded or newly created)
   *
   * Dialog Management:
   * - Prevents dialogs for server-loaded markups by checking:
   *   1. markupsLoadedFromServer flag (blocks for 10 seconds after markups load)
   *   2. If markup ID already exists in cache (indicates loaded markup, not new)
   * - Allows dialogs only for newly created openSketch markups when:
   *   1. openSketch tool is active or was recently active
   *   2. Markup type is openSketch
   *   3. Markup doesn't exist in cache (truly new)
   */
  const handleMarkupAdded = (e) => {
    // Extract markup ID from event first to check if it's already in cache
    let newMarkupId = null;
    if (e.detail) {
      if (e.detail.markup && e.detail.markup.id) {
        newMarkupId = e.detail.markup.id;
      } else if (e.detail.id) {
        newMarkupId = e.detail.id;
      } else if (typeof e.detail === "string") {
        newMarkupId = e.detail;
      }
    }

    // Check 1: If markups are still loading from server, ignore (prevents dialogs for loaded markups)
    if (markupsLoadedFromServer) {
      return;
    }

    // Check 2: If markup ID already exists in cache, it's a loaded markup, not newly created
    // This prevents dialogs from opening for server-loaded markups that trigger markupAdded events
    // Check BEFORE refreshing cache to catch markups that were already loaded
    const state = getInstanceState(viewerName);
    if (
      newMarkupId &&
      state.allMarkupsCache &&
      state.allMarkupsCache[newMarkupId]
    ) {
      return;
    }

    // Refresh cache when new markup is added (after checks, so we can detect if it was already there)
    refreshAllMarkups(api, viewerName);

    // Check if opensketch tool is currently active or was recently active (within last 5 seconds)
    // Also check the active tool from API as a more reliable method
    let isOpensketchCreation = false;

    // Method 1: Check if opensketch tool was recently active
    if (freehandToolActiveTime && Date.now() - freehandToolActiveTime < 5000) {
      isOpensketchCreation = true;
    }

    // Method 2: Check active tool from API (more reliable)
    if (!isOpensketchCreation && typeof api.getActiveTool === "function") {
      try {
        const activeTool = api.getActiveTool();
        if (activeTool) {
          const toolName =
            typeof activeTool === "string"
              ? activeTool
              : activeTool.name || activeTool.type || "";
          const toolLower = toolName.toLowerCase();
          // Check for "openSketch" (exact match) or "opensketch" (case-insensitive)
          if (
            toolName &&
            (toolName === "openSketch" ||
              toolLower === "opensketch" ||
              toolLower.includes("opensketch"))
          ) {
            isOpensketchCreation = true;
            freehandToolActiveTime = Date.now(); // Update tracking
          }
        }
      } catch (apiError) {
        // API might not support getActiveTool, ignore
      }
    }

    // Method 3: Check markup type if available (openSketch markups have specific type)
    if (!isOpensketchCreation && e.detail) {
      const markup = e.detail.markup || e.detail;
      if (markup) {
        const markupType = markup.type || markup.toolType || "";
        const typeLower = markupType.toLowerCase();
        // Check for "openSketch" (exact match) or "opensketch" (case-insensitive)
        if (
          markupType &&
          (markupType === "openSketch" ||
            typeLower === "opensketch" ||
            typeLower.includes("opensketch"))
        ) {
          isOpensketchCreation = true;
        }
      }
    }

    if (!isOpensketchCreation) {
      return;
    }

    // Clear the opensketch tool active time to prevent opening dialog for subsequent markups
    // (unless opensketch tool is still active)
    // Subscribe to toolActivated event to detect when tool changes
    const instanceIdForTool = viewerName.includes("viewer") ? viewerName : `${viewerName}-viewer`;
    const unsubscribeToolCheck = viewerEventBus.subscribe(
      VIEWER_EVENTS.TOOL_ACTIVATED,
      instanceIdForTool,
      (event) => {
        const toolName = event.detail?.tool || "";
        const toolLower = typeof toolName === "string" ? toolName.toLowerCase() : "";
        if (
          !toolName ||
          (toolName !== "openSketch" &&
            toolLower !== "opensketch" &&
            !toolLower.includes("opensketch"))
        ) {
          freehandToolActiveTime = null;
        }
        unsubscribeToolCheck();
      }
    );
    // Track subscription - will auto-cleanup on component destroy
    cleanup.addSubscription(unsubscribeToolCheck);

    // Extract markup ID from event (if not already extracted above)
    if (!newMarkupId) {
      if (e.detail) {
        if (e.detail.markup && e.detail.markup.id) {
          newMarkupId = e.detail.markup.id;
        } else if (e.detail.id) {
          newMarkupId = e.detail.id;
        } else if (typeof e.detail === "string") {
          newMarkupId = e.detail;
        }
      }
    }

    // If we have a markup ID, select it to open the dialog
    // The markupAdded event already indicates the markup is ready
    // We can call setSelection immediately since we're already in the event handler
    if (newMarkupId && typeof api.setSelection === "function") {
      try {
        api.setSelection([newMarkupId]);
      } catch (selectError) {
        // Event-driven retry: Subscribe to PAGE_RENDER event
        // This ensures selection happens when the page is actually rendered
        const instanceIdForSelection = viewerName.includes("viewer") ? viewerName : `${viewerName}-viewer`;
        let selectionAttempted = false;

        const unsubscribeSelection = viewerEventBus.subscribe(
          VIEWER_EVENTS.PAGE_RENDER,
          instanceIdForSelection,
          () => {
            if (selectionAttempted) return;
            selectionAttempted = true;
            unsubscribeSelection();

            try {
              api.setSelection([newMarkupId]);
            } catch (retryError) {
              log.warn("[MarkupHandlers] setSelection failed on retry", { error: retryError });
            }
          }
        );

        // Track subscription - will auto-cleanup on component destroy
        cleanup.addSubscription(unsubscribeSelection);
      }
    }
  };
  cleanup.addEventListener(window, markupAddedEvent, handleMarkupAdded);

  const markupsSavedEvent = viewerName + "-markupsSaved";
  const handleMarkupsSaved = (e) => {
    // Refresh cache when markups are saved (newly created markups are now saved)
    refreshAllMarkups(api, viewerName);
  };
  cleanup.addEventListener(window, markupsSavedEvent, handleMarkupsSaved);

  // Return cleanup function - military-grade cleanup
  return () => {
    // Destroy all tracked resources (event listeners, observers, subscriptions)
    cleanup.destroy();
    // Clear cache and cursor tracking for this instance
    delete viewerStateRegistry[viewerName];
  };
};
