import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

//components
import "./IntegratedBravaViewer.css";
import bravaconfig from "./bravaconfig";
import { ivTokenManager } from "../../services/iv/tokenManager";
import { AnnotationsLayout } from "./AnnotationsLayout";
import { sentCaseService } from "../../services/caseManagement/sentCases/sentCaseService";
import { CONSTANTS, PUBLICATION_STATUS, MESSAGE_TYPES, shouldShowCopyLinkButton } from "./utils/bravaConstants";
import { getBaseUrl } from "./utils/getBasePath";
import { validatePublicationId, sanitizePublicationIdForStorage, sanitizeInstanceId, sanitizeMarkups } from "./utils/bravaViewerUtils";
import { log } from "../../iframe/utils/logger";
import { getSrcdocIframeTargetOrigin, getParentTargetOrigin } from "./utils/postMessageTargets";
import { encryptMarkups, decryptMarkups, isEncryptionAvailable } from "./utils/markupEncryption";
import { isValidIntegratedIframeReadyEvent, sendConfigAndTokenAfterIntegratedIframeReady } from "./utils/integratedIframeReadyHelpers";
import { isValidIntegratedViewerMessage, handlePdfMessage, handleViewerLifecycleMessage, handleMarkupMessage, handleClickLogOnly } from "./utils/integratedViewerMessageHandlers";
import { runNoPublicationIdPath, runPublicationChangeReset, checkAlreadyCompleteAndNotify } from "./utils/integratedPublicationInitHelpers";
import { runSrcdocAlreadySetPath, runAlreadyInitializedPath } from "./utils/integratedIframeViewerInitHelpers";
import { showSweetAlert } from "../sweetAlert/SweetAlert";
// NOTE: initializeEditableApi import removed - not used with React iframe bundle approach

// Integrated Brava viewer with auth, publication loading, and markup support
const IntegratedBravaViewer = ({ publicationId, ivTitle, instanceId = "default", caseId = null, onPublicationIdUpdate = null, page = null, caseStatus = null, onStatusChange = null, onNotFound = null, onFailed = null }) => {
  // Stable refs so callback identity changes don't churn fetch/poll deps
  const onStatusChangeRef = useRef(onStatusChange);
  const onNotFoundRef = useRef(onNotFound);
  const onFailedRef = useRef(onFailed);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { onNotFoundRef.current = onNotFound; }, [onNotFound]);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);
  const safeCall = (fn, ...args) => {
    if (typeof fn !== "function") return;
    try { fn(...args); } catch { /* host handler must not break viewer */ }
  };
  // DOM and state refs
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const retryAttempts = useRef(new Map());
  const retryTimeoutRef = useRef(null);
  const refetchAttempted = useRef(false);
  const iframeSrcdocSetRef = useRef(false); // Track if srcdoc has been set to prevent re-setting
  const refetchTimeoutRef = useRef(null); // Track the refetch timeout for 30-second retry
  const markupsRequestTimeoutRef = useRef(null); // Track timeout for markups request to prevent memory leak
  // FIX: Guard refs to prevent infinite API call loops in negative scenarios
  const fetchInProgressRef = useRef(false); // Prevent duplicate concurrent fetches
  const terminalErrorRef = useRef(false); // Stop retrying after permanent errors (403, 404, validation failure)

  // Unique container ID per viewer instance (sanitized for safe DOM usage)
  const containerId = useMemo(() => {
    const safeInstanceId = sanitizeInstanceId(instanceId, "default");
    return `brava-container-${safeInstanceId}-${Date.now()}`;
  }, [instanceId]);

  const [state, setState] = useState({
    publicationDetails: null,

    isLoading: false,
    viewerError: null,
    viewerInitialized: false,
    accessToken: null,
    isInitializing: false,
  });

  const [lastCheckedPublicationId, setLastCheckedPublicationId] = useState(null);

  const [hasUnsavedMarkups, setHasUnsavedMarkups] = useState(false);
  const unsavedMarkupsRef = useRef(null);
  const markupsRestoredRef = useRef(false);
  // PDF download deduplication is handled by `pdfDownloadHandler`.
  // Track if config has been sent to the iframe (shared across handlers).
  const configSentToIframeRef = useRef(false);
  // Track if LOAD_PUBLICATION was sent to avoid duplicate sends.
  const loadPublicationSentRef = useRef(false);
  // Mutex-style lock to guard LOAD_PUBLICATION sends.
  const loadPublicationLockRef = useRef(false);
  // Track if viewer was initialized (used for crash/reload handling).
  const viewerWasInitializedRef = useRef(false);

  // State helpers
  const updateState = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const logDebug = useCallback(() => {
    // Reserved for verbose debug logging if needed in future.
  }, [instanceId]);

  const handleError = useCallback(
    (error, context) => {
      // Sanitize instanceId before including it in error messages.
      const safeInstanceId = sanitizeInstanceId(instanceId, "default");
      const errorMessage = `Brava Viewer ${safeInstanceId} Error in ${context}: ${error.message || error}`;
      updateState({ viewerError: errorMessage });
    },
    [instanceId, updateState],
  );

  // Encrypt and store unsaved markups in localStorage
  const saveUnsavedMarkupsToStorage = useCallback(async (pubId, markups) => {
    if (!pubId || !markups || markups.length === 0) {
      console.warn("[MARKUP-DEBUG] saveUnsavedMarkupsToStorage early exit - pubId:", pubId, "markups length:", markups?.length);
      return;
    }

    // Validate and sanitize the publication ID before using it in keys.
    if (!validatePublicationId(pubId)) {
      log.error("[IntegratedBravaViewer] Invalid publication ID format", { pubId });
      return;
    }

    // Sanitize markups before encryption to prevent storing unsafe content.
    const sanitizedMarkups = sanitizeMarkups(markups);
    if (!sanitizedMarkups) {
      log.error("[IntegratedBravaViewer] Markups validation failed - not storing", {
        pubId,
        markupCount: markups?.length || 0,
      });
      return;
    }

    try {
      const sanitizedPubId = sanitizePublicationIdForStorage(pubId);
      const storageKey = `brava_unsaved_markups_${sanitizedPubId}`;

      // SECURITY: Encrypt sanitized markups before storing to prevent XSS from reading sensitive data
      // CRITICAL FIX (VULN-005): Use sanitized markups instead of raw markups
      const encryptedMarkups = await encryptMarkups(sanitizedMarkups);

      if (!encryptedMarkups) {
        // If encryption fails, do not fall back to storing plaintext.
        log.warn("[IntegratedBravaViewer] Failed to encrypt markups - not storing", {
          pubId,
          encryptionAvailable: isEncryptionAvailable(),
        });
        return;
      }

      const storageData = {
        publicationId: pubId,
        markups: encryptedMarkups,
        encrypted: true,
        timestamp: Date.now(),
      };

      localStorage.setItem(storageKey, JSON.stringify(storageData));
    } catch (error) {
      log.error("[IntegratedBravaViewer] Error saving markups to localStorage", error);
      // Handle quota exceeded or other storage errors gracefully
    }
  }, []);

  const migrateUnencryptedMarkupsAsync = useCallback((storageKey, pubId, markups) => {
    // One-off migration for old, unencrypted markup payloads.
    encryptMarkups(markups)
      .then((encryptedMarkups) => {
        if (!encryptedMarkups) return;
        try {
          const storageData = {
            publicationId: pubId,
            markups: encryptedMarkups,
            encrypted: true,
            timestamp: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(storageData));
        } catch (err) {
          log.error("[IntegratedBravaViewer] Error re-encrypting markups", err);
        }
      })
      .catch((err) => {
        log.error("[IntegratedBravaViewer] Error re-encrypting markups", err);
      });
  }, []);

  // Decrypt stored markups or migrate old unencrypted format
  const parseStoredMarkups = useCallback(
    async (data, pubId, storageKey) => {
      if (data.encrypted && data.markups) {
        const decryptedMarkups = await decryptMarkups(data.markups);
        if (decryptedMarkups && Array.isArray(decryptedMarkups)) return decryptedMarkups;
        log.warn("[IntegratedBravaViewer] Failed to decrypt markups", {
          pubId,
          encryptionAvailable: isEncryptionAvailable(),
        });
        return null;
      }
      if (data.markups && Array.isArray(data.markups)) {
        log.warn("[IntegratedBravaViewer] Found unencrypted markups - migrating to encrypted format", { pubId });
        migrateUnencryptedMarkupsAsync(storageKey, pubId, data.markups);
        return data.markups;
      }
      return null;
    },
    [migrateUnencryptedMarkupsAsync],
  );

  // Retrieve and decrypt markups from localStorage
  const getUnsavedMarkupsFromStorage = useCallback(
    async (pubId) => {
      if (!pubId) return null;
      if (!validatePublicationId(pubId)) {
        log.error("[IntegratedBravaViewer] Invalid publication ID format", { pubId });
        return null;
      }

      try {
        const sanitizedPubId = sanitizePublicationIdForStorage(pubId);
        const storageKey = `brava_unsaved_markups_${sanitizedPubId}`;
        const stored = localStorage.getItem(storageKey);
        if (!stored) return null;

        const data = JSON.parse(stored);
        if (String(data.publicationId ?? "") !== String(pubId ?? "")) {
          log.warn("[IntegratedBravaViewer] Publication ID mismatch in stored data", {
            expected: pubId,
            stored: data.publicationId,
          });
          return null;
        }

        return await parseStoredMarkups(data, pubId, storageKey);
      } catch (error) {
        log.error("[IntegratedBravaViewer] Error reading markups from localStorage", error);
      }
      return null;
    },
    [parseStoredMarkups],
  );

  // Clear markups from storage after successful save
  const clearUnsavedMarkupsFromStorage = useCallback((pubId) => {
    if (!pubId) {
      return;
    }

    // SECURITY: Validate and sanitize publication ID to prevent injection attacks
    if (!validatePublicationId(pubId)) {
      log.error("[IntegratedBravaViewer] Invalid publication ID format", { pubId });
      return;
    }

    try {
      const sanitizedPubId = sanitizePublicationIdForStorage(pubId);
      const storageKey = `brava_unsaved_markups_${sanitizedPubId}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      log.error("[IntegratedBravaViewer] Error clearing markups from localStorage", error);
    }
  }, []);

  // Send markup restoration message to iframe
  const restoreMarkupsToIframe = useCallback(
    (markups) => {
      if (!iframeRef.current?.contentWindow || !markups || markups.length === 0 || !publicationId) {
        return;
      }

      try {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "RESTORE_MARKUPS",
            publicationId,
            markups: markups,
          },
          getSrcdocIframeTargetOrigin(),
        );
      } catch (error) {
        log.error("[IntegratedBravaViewer] Error sending restore markups message", error);
      }
    },
    [publicationId],
  );

  // Atomic send prevents race condition between viewerInitialized and IFRAME_READY handlers
  const sendLoadPublicationSafely = useCallback((publicationDetails, viewerConfig) => {
    // CRITICAL FIX (P0-3): Atomic lock check MUST happen FIRST, before any other checks
    // This ensures that concurrent calls from different handlers are serialized immediately
    // If lock is already set, return immediately (another handler is sending)
    if (loadPublicationLockRef.current) {
      return false;
    }

    // Second check: if already sent for this publication, skip entirely
    // Note: This check happens AFTER lock check to prevent race condition
    if (loadPublicationSentRef.current) {
      return false;
    }

    // Verify iframe is available (check AFTER lock to avoid unnecessary iframe checks)
    if (!iframeRef.current?.contentWindow) {
      return false;
    }

    // Atomic check-and-set: set lock BEFORE sending (prevents race condition)
    // This must be the last check before sending to ensure atomicity
    loadPublicationLockRef.current = true;
    loadPublicationSentRef.current = true;

    try {
      const message = {
        type: MESSAGE_TYPES.LOAD_PUBLICATION,
        publicationDetails: publicationDetails,
        config: viewerConfig,
      };

      iframeRef.current.contentWindow.postMessage(message, getSrcdocIframeTargetOrigin());
      configSentToIframeRef.current = true;

      // Keep lock set permanently after successful send (don't release)
      // This prevents any retries or duplicate sends
      // Lock will only be reset on error or when publication changes
      return true;
    } catch (error) {
      // Reset on error so it can retry
      loadPublicationLockRef.current = false;
      loadPublicationSentRef.current = false;
      configSentToIframeRef.current = false;
      log.error("[IntegratedBravaViewer] Error sending LOAD_PUBLICATION", error);
      return false;
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    try {
      const token = await ivTokenManager.getToken();
      updateState({ accessToken: token });
      return token;
    } catch (err) {
      log.warn("[IntegratedBravaViewer] Failed to get access token", err);
      return null;
    }
  }, [updateState]);

  const refetchPublicationId = useCallback(async () => {
    if (!caseId || refetchAttempted.current) return null;

    try {
      refetchAttempted.current = true;

      const response = await sentCaseService.getNotesheetId({
        input_folder_path: `/Case/${caseId}`,
      });

      const pubId = response?.entries?.[0]?.content?.properties?.publishing_id;

      // Update if we got a publication ID and it's different from current (or current is null) - S3403: compare as same type
      if (pubId && (String(pubId) !== String(publicationId ?? "") || !publicationId) && onPublicationIdUpdate) {
        onPublicationIdUpdate(pubId);
      }

      return pubId;
    } catch (error) {
      log.warn("[IntegratedBravaViewer] refetchPublicationId failed", error);
      return null;
    }
  }, [caseId, publicationId, onPublicationIdUpdate]);

  // NOTE: fetchLoaderScript function removed - no longer needed with React iframe bundle
  // The Brava script is now loaded directly in the iframe bundle

  const getPublicationById = useCallback(
    async (id, accessToken) => {
      // SECURITY: Validate publication ID to prevent injection attacks
      if (!validatePublicationId(id)) {
        log.error("[IntegratedBravaViewer] Invalid publication ID format", { id });
        updateState({
          viewerError: "Invalid publication ID format",
        });
        return null;
      }

      try {
        // ID is validated, safe to use in URL
        const url = `${bravaconfig.publicationsUrl}/${encodeURIComponent(id)}?embed=page_links`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let response;
        try {
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // CRITICAL: Check for 401 and refresh token automatically
        if (response.status === 401) {
          log.warn("[IntegratedBravaViewer] Token expired (401), refreshing token and retrying...");
          try {
            const newToken = await ivTokenManager.forceRefresh();
            updateState({ accessToken: newToken });

            // Retry the request with new token
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
            let retryResponse;
            try {
              retryResponse = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                  "Content-Type": "application/json",
                },
                signal: retryController.signal,
              });
            } finally {
              clearTimeout(retryTimeoutId);
            }

            if (!retryResponse.ok) {
              if (retryResponse.status === 404) safeCall(onNotFoundRef.current, id);
              // Even after token refresh, request failed
              await refetchPublicationId();
              throw new Error(`Failed to fetch publication details after token refresh: ${retryResponse.status} ${retryResponse.statusText}`);
            }

            const details = await retryResponse.json();
            return details;
          } catch (tokenError) {
            log.error("[IntegratedBravaViewer] Failed to refresh token or retry request", tokenError);
            // If token refresh failed, fall through to error handling
            // If retry failed, the error was already thrown above, so this catch handles token refresh failures
            // In both cases, we want to treat it as a failed request
            throw tokenError;
          }
        }

        if (!response.ok) {
          if (response.status === 404) safeCall(onNotFoundRef.current, id);
          // 403 Forbidden: document/source URL not accessible - show API error message
          if (response.status === 403) {
            let errorMessage = "Forbidden";
            try {
              const body = await response.json();
              if (body?.userMessage) errorMessage = body.userMessage;
              else if (body?.developerMessage) errorMessage = body.developerMessage;
            } catch {
              /* ignore parse failure */
            }
            updateState({ viewerError: errorMessage });
            return null;
          }
          // For other non-401 errors, try refetching publication ID (existing behavior)
          await refetchPublicationId();
          throw new Error(`Failed to fetch publication details: ${response.status} ${response.statusText}`);
        }

        const details = await response.json();
        return details;
      } catch (err) {
        updateState({
          viewerError: `Failed to fetch publication details: ${err.message}`,
        });
        return null;
      }
    },
    [updateState, refetchPublicationId],
  );

  const createModifiedLayout = useCallback((ivTitle, caseStatus) => {
    const modifiedLayout = structuredClone(AnnotationsLayout);

    if (!shouldShowCopyLinkButton(ivTitle, caseStatus) && modifiedLayout.nabardToolbar?.right) {
      modifiedLayout.nabardToolbar.right = modifiedLayout.nabardToolbar.right.filter((item) => item.eventKey !== "copyPageLinkButton");
    }

    return modifiedLayout;
  }, []);

  const handleIframeMessage = useCallback(
    (event) => {
      if (!event.data?.type) return;
      if (!isValidIntegratedViewerMessage(event, iframeRef, instanceId, log)) {
        console.warn("[MARKUP-DEBUG] Message validation FAILED:", event.data?.type, {
          origin: event.origin,
          sourceMatchesIframe: event.source === iframeRef.current?.contentWindow,
        });
        return;
      }

      const type = event.data.type;
      const data = event.data;

      if (handlePdfMessage(type, data)) return;

      const lifecycleCtx = {
        onViewerInitialized: () => {
          viewerWasInitializedRef.current = true;
          updateState({
            viewerInitialized: true,
            isLoading: false,
            isInitializing: false,
            viewerError: null,
          });
          // Use != per S3403; preserves reference comparison behavior for Window objects.
          if (globalThis.parent != globalThis) {
            globalThis.parent.postMessage({ type: "viewerInitialized", instanceId: instanceId || "default" }, getParentTargetOrigin());
          }
          if (loadPublicationSentRef.current) return;
          const currentPubDetails = state.publicationDetails;
          const currentAccessToken = state.accessToken;
          if (currentPubDetails && currentAccessToken) {
            const viewerConfig = {
              instanceId,
              containerId,
              accessToken: currentAccessToken,
              viewerAuthority: bravaconfig.viewerAuthority,
              loaderUrl: `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js`,
              searchHost: import.meta.env.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
              markupHost: import.meta.env.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
              assetsHost: import.meta.env.VITE_BRAVA_ASSETS_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_ASSETS_HOST}` : "",
              publicationDetails: currentPubDetails,
              layout: createModifiedLayout(ivTitle, caseStatus),
              readonly: false,
              ivTitle,
              initialPage: page !== null && page !== undefined ? page : null,
            };
            sendLoadPublicationSafely(currentPubDetails, viewerConfig);
          }
        },
        onViewerLoading: () => {
          const isViewerAlreadyLoaded = iframeRef.current?.srcdoc && configSentToIframeRef.current;
          if (!state.viewerInitialized && !isViewerAlreadyLoaded) {
            updateState({ isLoading: true });
          } else if (isViewerAlreadyLoaded && state.isLoading) {
            updateState({ isLoading: false, isInitializing: false });
          }
        },
        onViewerError: (d) => {
          updateState({
            viewerError: d.error || "Viewer error occurred",
            isLoading: false,
            isInitializing: false,
          });
        },
        onViewerReady: () => {
          updateState({ isInitializing: false });
        },
      };
      if (handleViewerLifecycleMessage(type, data, lifecycleCtx)) return;

      const markupCtx = {
        setDirty: (dirtyCount) => {
          setHasUnsavedMarkups(dirtyCount > 0);
        },
        saveMarkups: (d) => {
          const pubId = d.publicationId;
          if (!pubId || !validatePublicationId(pubId)) {
            console.error("[MARKUP-DEBUG] saveMarkups BLOCKED - invalid publicationId:", pubId);
            log.error("[IntegratedBravaViewer] Invalid publicationId in message", {
              publicationId: pubId,
              type: d.type,
              instanceId,
            });
            return;
          }
          if (d.markups && pubId) {
            saveUnsavedMarkupsToStorage(pubId, d.markups).catch((err) => {
              log.error("[IntegratedBravaViewer] Error saving markups to storage", err);
              showSweetAlert({ title: "Annotation Save Failed", text: "Your annotations could not be saved. Please ensure your browser storage is not full.", icon: "warning" });
            });
          } else {
            console.warn("[MARKUP-DEBUG] saveMarkups skipped - no markups or pubId:", { markups: d.markups, pubId });
          }
        },
        storeMarkups: (d) => {
          const responsePubId = d.publicationId;
          if (!responsePubId || !validatePublicationId(responsePubId)) {
            console.error("[MARKUP-DEBUG] storeMarkups BLOCKED - invalid publicationId:", responsePubId);
            log.error("[IntegratedBravaViewer] Invalid publicationId in GET_ALL_MARKUPS_RESPONSE", {
              publicationId: responsePubId,
              instanceId,
            });
            return;
          }
          if (d.markups && responsePubId) {
            unsavedMarkupsRef.current = d.markups;
          }
        },
        markRestored: (d) => {
          if (d?.success) markupsRestoredRef.current = true;
        },
      };
      if (handleMarkupMessage(type, data, markupCtx)) return;
      handleClickLogOnly(type, data, logDebug);
    },
    [instanceId, state, updateState, createModifiedLayout, ivTitle, caseStatus, page, setHasUnsavedMarkups, sendLoadPublicationSafely, logDebug],
  );

  // Listen for messages from iframe
  useEffect(() => {
    globalThis.addEventListener("message", handleIframeMessage);
    return () => globalThis.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  // CRITICAL: Check if viewer is already loaded and clear loading state if needed
  // This prevents the loading overlay from staying visible when viewer is already loaded
  // Phase 2 - Fix 4: Enhanced with 10-second timeout fallback
  useEffect(() => {
    // Only check if isLoading is true and we have an iframe
    if (!state.isLoading || !iframeRef.current) {
      return;
    }

    // Check if viewer appears to be loaded (srcdoc is set, config was sent, iframe has content)
    const isViewerLoaded = iframeSrcdocSetRef.current && configSentToIframeRef.current && iframeRef.current.srcdoc && iframeRef.current.contentWindow;

    if (isViewerLoaded) {
      // Viewer appears to be loaded - clear loading state to prevent stuck overlay
      // The viewer will send proper initialization messages if needed

      updateState({
        isLoading: false,
        isInitializing: false,
      });
    }

    // REMOVED: 10-second fallback timeout (Phase 1 pattern - same as SplitViewer fix)
    // Loading state is controlled ONLY by viewer lifecycle events:
    // - viewerInitialized → clear loading
    // - viewerError → clear loading
    // - viewerLoading → set loading
    // No blind timeouts - spinner stays until viewer explicitly signals ready or error
    // This prevents false "ready" states and ensures errors are visible
  }, [state.isLoading, state.viewerInitialized, updateState]);

  // NOTE: handleMainClick useEffect removed - was collecting click data but not using it

  // Poll publication status until complete or max retries reached
  const handleStatusCheck = useCallback(
    async (status, details, token) => {
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (status === PUBLICATION_STATUS.COMPLETE) {
        updateState({ publicationDetails: details, isLoading: false, viewerError: null });
        safeCall(onStatusChangeRef.current, status);
      } else if ([PUBLICATION_STATUS.PENDING, PUBLICATION_STATUS.ACTIVE, PUBLICATION_STATUS.PROCESSING].includes(status)) {
        safeCall(onStatusChangeRef.current, status);
        const currentAttempts = retryAttempts.current.get(publicationId) || 0;

        if (currentAttempts < CONSTANTS.MAX_RETRY_ATTEMPTS) {
          retryAttempts.current.set(publicationId, currentAttempts + 1);

          retryTimeoutRef.current = setTimeout(async () => {
            try {
              const refreshedDetails = await getPublicationById(publicationId, token);
              if (refreshedDetails) {
                const refreshedStatus = refreshedDetails.status?.toLowerCase();
                updateState({ publicationDetails: refreshedDetails });
                handleStatusCheck(refreshedStatus, refreshedDetails, token);
              }
            } catch (err) {
              log.warn("[IntegratedBravaViewer] Error fetching publication status", err);
              updateState({ isLoading: false, viewerError: "Error fetching publication status" });
            }
          }, CONSTANTS.RETRY_DELAY);
        } else {
          updateState({
            isLoading: false,
            viewerError:
              "Document is taking longer than expected to process. This may be due to a large file size. Please refresh the page in a few moments or contact support if the issue persists.",
          });
        }
      } else if (status === PUBLICATION_STATUS.FAILED || status === PUBLICATION_STATUS.ERROR) {
        updateState({
          isLoading: false,
          viewerError: `Publication failed: ${details.failureMessage || details.error || "Unknown error"}`,
        });
        retryAttempts.current.delete(publicationId);
        safeCall(onStatusChangeRef.current, status);
        safeCall(onFailedRef.current, { pubId: publicationId, message: details?.failureMessage || details?.error || "Unknown error" });
      } else {
        updateState({
          isLoading: false,
          viewerError: `Unknown publication status: ${status}`,
        });
      }
    },
    [publicationId, logDebug, updateState, getPublicationById],
  );

  // Reset all state and re-initialize without page reload
  const handleRetry = useCallback(() => {
    if (!publicationId) {
      return;
    }

    // Reset retry attempts to allow fresh retry
    retryAttempts.current.set(publicationId, 0);
    refetchAttempted.current = false;

    // Clear any pending timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = null;
    }

    // Reset guard refs so initializePublication can run again after a terminal error
    terminalErrorRef.current = false;
    fetchInProgressRef.current = false;

    // Reset iframe flags to allow re-initialization
    iframeSrcdocSetRef.current = false;
    configSentToIframeRef.current = false;
    loadPublicationSentRef.current = false;
    loadPublicationLockRef.current = false; // Reset lock on retry

    // Clear error and reset viewer state
    updateState({
      viewerError: null,
      publicationDetails: null,
      viewerInitialized: false,
      isInitializing: false,
      isLoading: true,
    });

    // Reset lastCheckedPublicationId to force re-initialization
    // This will cause initializePublication to re-run via useEffect dependency
    setLastCheckedPublicationId(null);
  }, [publicationId, updateState]);

  const initializePublication = useCallback(async () => {
    // FIX: Prevent duplicate concurrent API calls (guards against infinite loop)
    if (fetchInProgressRef.current) {
      return;
    }

    // FIX: Stop retrying after terminal errors (403 Forbidden, 404 Not Found, validation failure)
    if (terminalErrorRef.current) {
      return;
    }

    if (
      await runNoPublicationIdPath({
        publicationId,
        updateState,
        caseId,
        onPublicationIdUpdate,
        refetchAttempted,
        refetchPublicationId,
      })
    ) {
      return;
    }

    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = null;
    }

    runPublicationChangeReset({
      publicationId,
      lastCheckedPublicationId,
      retryTimeoutRef,
      retryAttempts,
      refetchAttempted,
      markupsRestoredRef,
      unsavedMarkupsRef,
      setHasUnsavedMarkups,
      iframeSrcdocSetRef,
      configSentToIframeRef,
      updateState,
      terminalErrorRef, // FIX: Pass terminalErrorRef to reset on publication change
    });

    if (checkAlreadyCompleteAndNotify({ state, publicationId })) {
      return;
    }

    // Already polling for status (processing/pending/active). Skip fetch — handleStatusCheck retries will fetch.
    const status = state.publicationDetails?.status?.toLowerCase();
    if (state.publicationDetails && [PUBLICATION_STATUS.PENDING, PUBLICATION_STATUS.ACTIVE, PUBLICATION_STATUS.PROCESSING].includes(status)) {
      return;
    }

    const isNewPublication = !state.publicationDetails || state.publicationDetails?.id !== publicationId;
    const shouldShowLoading = isNewPublication && !state.viewerInitialized;
    if (shouldShowLoading) {
      globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_LOADING }, getParentTargetOrigin());
    }
    updateState({ isLoading: shouldShowLoading, viewerError: null });

    // FIX: Mark fetch as in progress to prevent duplicate calls
    fetchInProgressRef.current = true;

    try {
      const token = await getAccessToken();
      if (!token) {
        terminalErrorRef.current = true; // FIX: Token failure is terminal
        updateState({ isLoading: false, viewerError: "Failed to get access token" });
        return;
      }
      const details = await getPublicationById(publicationId, token);
      if (!details) {
        // FIX: No details means a terminal error occurred (403, 404, etc.) - don't retry
        terminalErrorRef.current = true;
        updateState({ isLoading: false, viewerError: "Publication details not found" });
        return;
      }
      const status = details.status?.toLowerCase();
      setLastCheckedPublicationId(publicationId);
      await handleStatusCheck(status, details, token);
    } catch (error) {
      log.warn("[IntegratedBravaViewer] initializePublication failed", error);
      terminalErrorRef.current = true; // FIX: Unexpected error is terminal
      updateState({ isLoading: false, viewerError: "Failed to initialize publication" });
    } finally {
      // FIX: Always clear fetch-in-progress flag
      fetchInProgressRef.current = false;
    }
  }, [
    publicationId,
    lastCheckedPublicationId,
    state.publicationDetails,
    state.viewerInitialized,
    updateState,
    getAccessToken,
    getPublicationById,
    handleStatusCheck,
    caseId,
    onPublicationIdUpdate,
    refetchPublicationId,
  ]);

  // Load publication when publicationId changes
  useEffect(() => {
    initializePublication();
  }, [initializePublication]);

  // Auto-refetch publication ID if waiting more than 30 seconds
  useEffect(() => {
    // Clear any existing timeout
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = null;
    }

    // Early returns: no need to refetch if we have publicationId or missing dependencies
    if (publicationId || !caseId || !onPublicationIdUpdate) {
      return;
    }

    // Recursive function to retry every 30 seconds
    const scheduleRetry = () => {
      refetchTimeoutRef.current = setTimeout(async () => {
        // Guard: check if still valid (props might have changed)
        if (!caseId || !onPublicationIdUpdate) {
          return;
        }

        // Reset flag to allow retry (we've waited 30+ seconds)
        refetchAttempted.current = false;

        // Attempt refetch - if successful, onPublicationIdUpdate will trigger effect re-run
        const updatedPubId = await refetchPublicationId();

        // If no publication ID found, schedule another retry after 30 seconds
        if (!updatedPubId) {
          scheduleRetry();
        }
        // If publicationId was found, effect will re-run and cleanup will clear the timeout
      }, 30000);
    };

    // Start the retry cycle
    scheduleRetry();

    // Cleanup: clear timeout on unmount or when dependencies change
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [publicationId, caseId, onPublicationIdUpdate, refetchPublicationId]);

  // NOTE: fetchLoaderScript useEffect removed - no longer needed with React iframe bundle
  // The Brava script is now loaded directly in the iframe bundle

  /**
   * Initialize iframe viewer when all requirements are met
   * PHASE 2: Uses React iframe bundle instead of string template
   */
  const initializeIframeViewer = useCallback(() => {
    // Check if all required data is available
    // Note: loaderScript is no longer needed - script loaded from CDN in iframe
    if (!state.publicationDetails || !bravaconfig.viewerAuthority || !state.accessToken) {
      return;
    }

    // Only initialize if publication is complete
    if (state.publicationDetails?.status?.toLowerCase() !== PUBLICATION_STATUS.COMPLETE) {
      return;
    }

    if (
      runSrcdocAlreadySetPath({
        iframeRef,
        iframeSrcdocSetRef,
        loadPublicationSentRef,
        configSentToIframeRef,
        state,
        instanceId,
        containerId,
        createModifiedLayout,
        ivTitle,
        caseStatus,
        page,
        bravaconfig,
        sendLoadPublicationSafely,
        updateState,
      })
    ) {
      return;
    }

    if (runAlreadyInitializedPath({ state })) {
      return;
    }

    updateState({ isInitializing: true, isLoading: true, viewerError: null });
    globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_LOADING }, getParentTargetOrigin());

    try {
      if (iframeRef.current) {
        const iframe = iframeRef.current;

        // NOTE: We use the shared ref to track config sending across all handlers
        // This prevents duplicate sends from onload and IFRAME_READY handlers
        // Config is sent via sendConfigAndTokenAfterIntegratedIframeReady on IFRAME_READY

        // CRITICAL: Only set srcdoc if it hasn't been set yet (prevents multiple onload events)
        // Setting srcdoc multiple times causes the iframe to reload, triggering onload repeatedly
        if (iframe.srcdoc && iframeSrcdocSetRef.current) {
          // Reset state since we're not actually initializing
          updateState({ isInitializing: false, isLoading: false });
          if (state.viewerInitialized) {
            globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_INITIALIZED }, getParentTargetOrigin());
          }
          return;
        }

        // Set up event handlers before setting src
        iframe.onload = () => {
          // CRITICAL: Detect iframe crash/reload after initialization
          // If viewer was initialized and we get an onload event, the iframe reloaded
          if (viewerWasInitializedRef.current) {
            log.warn("[IntegratedBravaViewer] Iframe reloaded after initialization - resetting viewer state", {
              instanceId,
              publicationId: state.publicationDetails?.id,
            });

            // Reset viewer state
            updateState({
              viewerInitialized: false,
              isInitializing: false,
              isLoading: true,
              viewerError: null,
            });

            // Reset flags to allow re-initialization
            // Note: Don't reset iframeSrcdocSetRef - srcdoc is already set, we just need to re-send config
            // Note: Don't reset initializedPublicationIdRef - publication hasn't changed, just iframe reloaded
            configSentToIframeRef.current = false;
            loadPublicationSentRef.current = false;
            loadPublicationLockRef.current = false;
            viewerWasInitializedRef.current = false;
            // Reset isInitializingRef to allow recovery if needed
            isInitializingRef.current = false;

            // Don't call initializeIframeViewer() again - srcdoc is already set
            // The IFRAME_READY event handler will detect the reset flags and re-send config
            // The IFRAME_READY event will fire when the React bundle reloads inside the iframe
            return;
          }

          // CRITICAL: Do NOT send config from onload - wait for IFRAME_READY instead
          // The React bundle inside the iframe needs to load and set up its message listener first
          // Sending too early means the message is lost
          // The persistent IFRAME_READY listener will handle sending the config

          // NOTE: Don't set viewerInitialized here - wait for actual viewer initialization
          // Setting it too early causes issues with loading state
          updateState({
            isInitializing: false,
          });
        };

        // No cleanup needed here - listener is in separate useEffect above

        iframe.onerror = (error) => {
          handleError(error, "iframe loading");
          updateState({ isLoading: false, isInitializing: false });
          globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_ERROR }, getParentTargetOrigin());
        };

        // PHASE 2: Use srcdoc with React bundle loading (hybrid approach)
        // This avoids 404 issues while still using the React iframe bundle
        // Note: In srcdoc, relative paths don't work - must use absolute URLs
        // In dev: Loads /src/iframe/main.jsx directly (Vite serves it)
        // In prod: Auto-detects base path for single build that works everywhere
        const isDev = import.meta.env.DEV;
        const baseUrl = getBaseUrl(); // Auto-detects base path from URL

        // Use absolute URL for script src since srcdoc uses about:srcdoc origin
        const bundleSrc = isDev ? `${baseUrl}/src/iframe/main.jsx` : `${baseUrl}/iframe/iframeBundle.js`;

        // Create minimal HTML that loads the React bundle
        // Use absolute URL for script to work inside srcdoc iframe
        // NOTE: Fast Refresh is disabled for iframe bundle (configured in vite.config.js)
        // The iframe runs in isolated srcdoc context and doesn't need HMR
        // JSON.stringify properly escapes the URL for safe insertion
        const bundleSrcJson = JSON.stringify(bundleSrc);

        // SECURITY: Sanitize instanceId before inserting into HTML template to prevent XSS
        // Only allow alphanumeric, hyphens, underscores - replace any other characters
        const sanitizedInstanceId = sanitizeInstanceId(instanceId, "default");
        // Double-escape using JSON.stringify for extra safety in template string
        const safeInstanceId = JSON.stringify(sanitizedInstanceId).slice(1, -1); // Remove quotes from JSON.stringify
        const parentOriginForIframe = getParentTargetOrigin();

        const iframeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brava Viewer ${safeInstanceId}</title>
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; background:#f5f5f5; overflow:hidden; font-family: Arial, sans-serif; }
    #root { width:100%; height:100%; position:relative; }
    .brava-iframe-root { width:100%; height:100%; position:relative; background:#f5f5f5; }
    .brava-iframe-viewer-div { width:100%; height:100%; overflow:hidden; }
    .brava-iframe-loading-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.9); z-index:1000; }
    .brava-iframe-error-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.95); z-index:1000; }
    .brava-iframe-message-box { font-size:14px; padding:10px 20px; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); }
    #loading { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); padding:20px; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); text-align:center; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  </style>
</head>
<body>
  <script>globalThis.__parentOriginForPostMessage = ${JSON.stringify(parentOriginForIframe)};</script>
  <div id="root">
  </div>
  <script type="module">
   
    const bundleUrl = ${bundleSrcJson};
   
    // Load the React bundle
    import(bundleUrl)
      .then((module) => {
        // Bundle loaded successfully
      })
      .catch((error) => {
        console.error('[IFRAME HTML] Failed to load bundle', error, { bundleUrl });
        const root = document.getElementById('root');
        if (root) {
          const errorMsg = error.message || String(error);
          // SECURITY: Use safe DOM manipulation instead of innerHTML to prevent XSS
          // Clear existing content safely
          root.textContent = '';
          const errorDiv = document.createElement('div');
          errorDiv.style.padding = '20px';
          errorDiv.style.color = 'red';
          errorDiv.style.fontFamily = 'monospace';
          errorDiv.style.whiteSpace = 'pre-wrap';
          // Use textContent to safely display error message (prevents XSS)
          errorDiv.textContent = 'Error: Failed to load iframe bundle\\n\\nMessage: ' + errorMsg + '\\n\\nURL: ' + bundleUrl + '\\n\\nCheck the Network tab for 404 errors.';
          root.appendChild(errorDiv);
        }
      });
  </script>
</body>
</html>`;

        // CRITICAL: Mark srcdoc as set BEFORE setting it (prevents race conditions)
        // This ensures we don't set it multiple times even if the function is called again
        iframeSrcdocSetRef.current = true;
        iframe.srcdoc = iframeHtml;
      }
    } catch (error) {
      handleError(error, "initializeIframeViewer");
      updateState({ isLoading: false, isInitializing: false });
      globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_ERROR }, getParentTargetOrigin());
    }
  }, [
    state.publicationDetails,
    state.accessToken,
    state.isInitializing,
    state.viewerInitialized,
    instanceId,
    containerId,
    ivTitle,
    caseStatus,
    page,
    createModifiedLayout,
    handleError,
    logDebug,
    updateState,
  ]);

  // Set up persistent message listener for IFRAME_READY signals
  // This is a FALLBACK - primary mechanism is iframe.onload
  // This ensures config is sent even if onload fails or is delayed
  useEffect(() => {
    const handleIframeReady = (event) => {
      if (event.data?.type !== "IFRAME_READY") return;
      if (configSentToIframeRef.current && state.viewerInitialized) return;
      if (configSentToIframeRef.current && !state.viewerInitialized) {
        configSentToIframeRef.current = false;
      }
      if (!isValidIntegratedIframeReadyEvent(event, iframeRef, instanceId)) return;
      if (loadPublicationSentRef.current) return;
      if (!iframeRef.current?.contentWindow || !state.publicationDetails || !state.accessToken || !bravaconfig.viewerAuthority) return;

      sendConfigAndTokenAfterIntegratedIframeReady({
        iframeRef,
        state,
        instanceId,
        containerId,
        createModifiedLayout,
        ivTitle,
        caseStatus,
        page,
        sendLoadPublicationSafely,
        log,
        bravaconfig,
      });
    };

    globalThis.addEventListener("message", handleIframeReady);

    return () => {
      globalThis.removeEventListener("message", handleIframeReady);
    };
  }, [instanceId, containerId, state.accessToken, state.publicationDetails, state.viewerInitialized, ivTitle, caseStatus, page, createModifiedLayout, sendLoadPublicationSafely]);

  // Initialize iframe viewer when all requirements are met
  // BULLETPROOF: Only initialize once per publication, prevent all re-initialization loops
  const initializedPublicationIdRef = useRef(null);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    const currentPublicationId = state.publicationDetails?.id;

    // BULLETPROOF: Reset all flags if publication ID changes (allows re-initialization for new publication) - S3403: compare as same type
    if (currentPublicationId && String(currentPublicationId) !== String(initializedPublicationIdRef.current ?? "")) {
      initializedPublicationIdRef.current = null;
      configSentToIframeRef.current = false;
      loadPublicationSentRef.current = false;
      loadPublicationLockRef.current = false; // Reset lock when publication changes
      viewerWasInitializedRef.current = false; // Reset initialization tracking when publication changes
      iframeSrcdocSetRef.current = false;
      isInitializingRef.current = false;
    }

    // BULLETPROOF: Multiple guards to prevent re-initialization
    const shouldInitialize =
      !initializedPublicationIdRef.current && // Haven't initialized for this publication
      !isInitializingRef.current && // Not currently initializing
      !(iframeRef.current && iframeSrcdocSetRef.current && iframeRef.current.srcdoc) && // Srcdoc not already set
      state.publicationDetails && // Has publication details
      bravaconfig.viewerAuthority && // Has viewer authority
      state.accessToken && // Has access token
      state.publicationDetails?.status?.toLowerCase() === PUBLICATION_STATUS.COMPLETE; // Publication is complete

    if (shouldInitialize) {
      initializedPublicationIdRef.current = currentPublicationId;
      isInitializingRef.current = true;
      initializeIframeViewer();
      // Event-driven: Reset flag will happen when viewerInitialized event fires or error occurs
      // No setTimeout needed - let events control the state
    } else if (iframeRef.current && iframeSrcdocSetRef.current && iframeRef.current.srcdoc && state.viewerInitialized) {
      // Viewer is fully initialized - ensure loading state is cleared
      if (state.isLoading || state.isInitializing) {
        updateState({ isLoading: false, isInitializing: false });
      }
    }
  }, [
    state.publicationDetails?.id,
    state.publicationDetails,
    state.accessToken,
    bravaconfig.viewerAuthority,
    state.viewerInitialized,
    state.isLoading,
    state.isInitializing,
    initializeIframeViewer,
    updateState,
  ]);

  // Update publication in iframe when details change
  // CRITICAL FIX (P0-3): Use atomic sendLoadPublicationSafely to prevent race condition
  useEffect(() => {
    if (!state.viewerInitialized || !state.publicationDetails) return;

    try {
      // Build viewer config for publication update
      const viewerConfig = {
        instanceId,
        containerId,
        accessToken: state.accessToken,
        viewerAuthority: bravaconfig.viewerAuthority,
        loaderUrl: `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js`,
        searchHost: import.meta.env.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
        markupHost: import.meta.env.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
        publicationDetails: state.publicationDetails,
        layout: createModifiedLayout(ivTitle, caseStatus),
        readonly: false,
        ivTitle,
        initialPage: page !== null && page !== undefined ? page : null,
        parentOrigin: getParentTargetOrigin(),
      };

      // Use atomic function to ensure lock is checked before sending
      // This prevents race condition if publication changes while another LOAD_PUBLICATION is in progress
      sendLoadPublicationSafely(state.publicationDetails, viewerConfig);
    } catch (error) {
      log.error("Error updating publication in iframe", error);
    }
  }, [state.viewerInitialized, state.publicationDetails?.id, page, logDebug, sendLoadPublicationSafely, instanceId, containerId, state.accessToken, ivTitle, caseStatus]);

  // Update access token in iframe when it changes
  useEffect(() => {
    if (!state.viewerInitialized || !state.accessToken) return;

    try {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: MESSAGE_TYPES.SET_ACCESS_TOKEN,
          accessToken: state.accessToken,
        },
        getSrcdocIframeTargetOrigin(),
      );
    } catch (error) {
      log.error("Error updating access token in iframe", error);
    }
  }, [state.viewerInitialized, state.accessToken, logDebug]);

  // Backup beforeunload handler (primary save is now periodic in iframe)
  // This is just a safety net in case periodic save didn't run recently
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only save if there are unsaved markups and viewer is ready
      if (!hasUnsavedMarkups || !publicationId || !state.viewerInitialized) {
        return;
      }

      // Request markups from iframe (may not complete before unload, but we try)
      try {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "GET_ALL_MARKUPS_FOR_SAVE",
              publicationId,
              timestamp: Date.now(),
            },
            getSrcdocIframeTargetOrigin(),
          );
        }
      } catch (error) {
        // Silent fail - beforeunload handlers should not throw
        // Log error for debugging but don't throw to prevent blocking unload
        if (import.meta.env.DEV) {
          log.warn("[IntegratedBravaViewer] Error in beforeunload handler", error);
        }
      }
    };

    globalThis.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      globalThis.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedMarkups, publicationId, state.viewerInitialized]);

  // Restore unsaved markups when viewer is initialized and markups are loaded
  useEffect(() => {
    if (!state.viewerInitialized || !publicationId || !state.publicationDetails || markupsRestoredRef.current || !iframeRef.current?.contentWindow) {
      return;
    }

    // Check for unsaved markups in localStorage (async - decrypt if encrypted)
    let isEffectActive = true;
    let fallbackTimeout = null;
    let markupsLoadedEvent = null;
    let handleMarkupsLoaded = null;
    // Primary listener: postMessage bridge from iframe (Brava fires markupsLoaded on the
    // iframe's own window — the parent window cannot receive that event directly).
    let markupsLoadedMessageListener = null;

    (async () => {
      try {
        const unsavedMarkups = await getUnsavedMarkupsFromStorage(publicationId);

        if (!isEffectActive) return; // Effect was cleaned up

        if (!unsavedMarkups || unsavedMarkups.length === 0) {
          // No unsaved markups to restore
          markupsRestoredRef.current = true;
          return;
        }

        // Wait for markupsLoaded signal from viewer before restoring.
        // This prevents duplicates and ensures viewer is ready.
        const viewerName = state.publicationDetails?.viewerName || "BravaViewer";
        markupsLoadedEvent = `${viewerName}-markupsLoaded`;

        let restored = false;
        handleMarkupsLoaded = () => {
          if (restored || markupsRestoredRef.current || !isEffectActive) return;
          restored = true;

          restoreMarkupsToIframe(unsavedMarkups);
          markupsRestoredRef.current = true;

          // Clean up both listeners once restored
          if (markupsLoadedMessageListener) {
            globalThis.removeEventListener("message", markupsLoadedMessageListener);
            markupsLoadedMessageListener = null;
          }
          if (markupsLoadedEvent && handleMarkupsLoaded) {
            globalThis.removeEventListener(markupsLoadedEvent, handleMarkupsLoaded);
          }
        };

        // Primary: postMessage from iframe (fixes cross-window event gap).
        // The iframe's markupHandlers sends MARKUPS_LOADED_IN_VIEWER to parent.postMessage
        // when the Brava viewer fires its native markupsLoaded event.
        markupsLoadedMessageListener = (event) => {
          if (event.data?.type !== "MARKUPS_LOADED_IN_VIEWER") return;
          // Validate message is from our specific iframe to prevent spoofing
          if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
          handleMarkupsLoaded();
        };
        globalThis.addEventListener("message", markupsLoadedMessageListener);

        // Fallback: direct window event (handles same-origin edge cases / future scenarios)
        globalThis.addEventListener(markupsLoadedEvent, handleMarkupsLoaded);

        // Safety timeout: last resort if neither signal arrives
        fallbackTimeout = setTimeout(() => {
          if (!restored && !markupsRestoredRef.current && isEffectActive) {
            log.warn("[IntegratedBravaViewer] markupsLoaded event timeout - using fallback to restore markups");
            restored = true;
            restoreMarkupsToIframe(unsavedMarkups);
            markupsRestoredRef.current = true;
            if (markupsLoadedMessageListener) {
              globalThis.removeEventListener("message", markupsLoadedMessageListener);
              markupsLoadedMessageListener = null;
            }
            if (markupsLoadedEvent && handleMarkupsLoaded) {
              globalThis.removeEventListener(markupsLoadedEvent, handleMarkupsLoaded);
            }
          }
        }, 10000); // 10 second safety fallback - only fires if neither signal arrives
      } catch (error) {
        log.error("[IntegratedBravaViewer] Error restoring unsaved markups", error);
        if (isEffectActive) {
          markupsRestoredRef.current = true; // Mark as attempted to prevent retry loops
        }
      }
    })();

    return () => {
      isEffectActive = false;
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      if (markupsLoadedMessageListener) {
        globalThis.removeEventListener("message", markupsLoadedMessageListener);
      }
      if (markupsLoadedEvent && handleMarkupsLoaded) {
        globalThis.removeEventListener(markupsLoadedEvent, handleMarkupsLoaded);
      }
    };
  }, [state.viewerInitialized, publicationId, state.publicationDetails, getUnsavedMarkupsFromStorage, restoreMarkupsToIframe]);

  // Listen for save completion to clear unsaved markups from storage
  useEffect(() => {
    if (!publicationId) {
      return;
    }

    const handleSaveEvents = (event) => {
      // Listen for markupsDirty count going to 0 (all saved)
      if (event.data?.type === MESSAGE_TYPES.MARKUPS_DIRTY || event.data?.type === "MARKUPS_DIRTY") {
        const dirtyCount = event.data.dirtyCount ?? 0;

        // CRITICAL FIX (VULN-002): Validate publicationId before use to prevent XSS and data corruption
        const eventPubId = event.data.publicationId;
        if (dirtyCount === 0 && eventPubId && validatePublicationId(eventPubId) && String(eventPubId) === String(publicationId ?? "") && hasUnsavedMarkups) {
          // All markups saved - clear from storage
          clearUnsavedMarkupsFromStorage(publicationId);
          setHasUnsavedMarkups(false);
        }
      }
    };

    globalThis.addEventListener("message", handleSaveEvents);

    return () => {
      globalThis.removeEventListener("message", handleSaveEvents);
    };
  }, [publicationId, hasUnsavedMarkups, clearUnsavedMarkupsFromStorage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }

        if (refetchTimeoutRef.current) {
          clearTimeout(refetchTimeoutRef.current);
          refetchTimeoutRef.current = null;
        }

        if (markupsRequestTimeoutRef.current) {
          clearTimeout(markupsRequestTimeoutRef.current);
          markupsRequestTimeoutRef.current = null;
        }

        iframeRef.current?.contentWindow?.postMessage({ type: MESSAGE_TYPES.CLEAR_VIEWER }, getSrcdocIframeTargetOrigin());
        retryAttempts.current.clear();
        refetchAttempted.current = false;
        markupsRestoredRef.current = false;
        unsavedMarkupsRef.current = null;
      } catch (error) {
        log.error("Error clearing viewer", error);
      }
    };
  }, [logDebug]);

  return (
    <div className="App">
      <main>
        {state.publicationDetails ? (
          <div className="brava-viewer-container">
            {state.isLoading && !state.viewerInitialized && (
              <div className="loading-overlay">
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Loading documents...</p>
                </div>
              </div>
            )}
            {state.viewerError && (
              <div className="error-overlay">
                <div className="error-message">
                  <h3>Error Loading Viewer</h3>
                  <p>{state.viewerError}</p>
                  <button onClick={handleRetry}>Try Again</button>
                </div>
              </div>
            )}
            {!state.viewerError && (
              <div ref={containerRef} className="viewer-div">
                {/* CRITICAL FIX (VULN-006): Sandbox permissions - documented security analysis
                  SECURITY: These permissions are REQUIRED for Brava viewer functionality
                  - allow-scripts: REQUIRED - Brava viewer requires JavaScript execution
                  - allow-same-origin: REQUIRED - Enables postMessage communication and localStorage
                  - allow-forms: REQUIRED - Viewer uses forms for user input
                  - allow-popups: REQUIRED - Viewer opens popups for export/download
                  - allow-modals: REQUIRED - Viewer shows modal dialogs

                  RISK MITIGATION (defense-in-depth):
                  VULN-001 FIXED: Strict source window validation prevents malicious messages
                  VULN-002 FIXED: Input validation prevents XSS in message handlers
                  VULN-004 FIXED: Token refresh race condition prevents auth failures
                  Multi-layer postMessage validation with source window checks
                  PublicationId validation in all message handlers
                  Markup encryption and sanitization before storage

                  ACCEPTABLE RISK: We control iframe content (React bundle from our server).
                  Security measures above provide defense-in-depth to mitigate risk.
                  Reducing permissions would break viewer functionality.
              */}
                <iframe
                  ref={iframeRef}
                  title={`Brava Viewer ${sanitizeInstanceId(instanceId, "default")}`}
                  className="viewer-iframe"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              </div>
            )}
          </div>
        ) : state.viewerError ? (
          <div className="error-overlay">
            <div className="error-message">
              <h3>Error Loading Viewer</h3>
              <p>{state.viewerError}</p>
              <button onClick={handleRetry}>Try Again</button>
            </div>
          </div>
        ) : (
          <div className="brava-viewer-container">
            <div className="loading-overlay">
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>{publicationId ? "Loading Document Viewer..." : "No publication ID provided"}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default IntegratedBravaViewer;
