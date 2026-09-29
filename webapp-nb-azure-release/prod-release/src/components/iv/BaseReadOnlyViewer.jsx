import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "./IntegratedBravaViewer.css";
import bravaconfig from "./bravaconfig";
import { ivTokenManager } from "../../services/iv/tokenManager";
import { CONSTANTS, PUBLICATION_STATUS, MESSAGE_TYPES, INITIAL_STATE } from "./utils/bravaConstants";
import { getBaseUrl } from "./utils/getBasePath";
import { validatePublicationId } from "./utils/bravaViewerUtils";
import { log } from "../../iframe/utils/logger";
import { getSrcdocIframeTargetOrigin, getParentTargetOrigin } from "./utils/postMessageTargets";
import {
  isValidIframeReadyEvent,
  sendConfigAndTokenAfterIframeReady,
  isValidIframeMessageEvent,
  handlePdfExportAndViewerMessages,
  handleIframeScriptLoadFailure,
} from "./utils/baseViewerHelpers";

// Reusable base viewer with publication fetching, iframe management, and error handling
const BaseReadOnlyViewer = ({
  publicationId,
  ivTitle,
  instanceId = "readonly",
  page = null,
  caseStatus = null,
  caseId = null,
  onPublicationIdUpdate = null,
  layoutConfig,
  createLayout,
  enableScriptRetry = false,
  maxRetryAttempts = 3,
  retryDelayMs = 2000,
  onCustomMessage = null,
  viewerName = "ReadOnly Viewer",
  refetchPublicationId: customRefetchPublicationId = null,
  onStatusChange = null,
  onNotFound = null,
  onFailed = null,
}) => {
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
  // Refs for DOM elements and state tracking
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const retryAttempts = useRef(new Map());
  const retryTimeoutRef = useRef(null);
  const refetchAttempted = useRef(false);
  const initializationAttemptedRef = useRef(false); // Prevent duplicate initialization attempts
  const configSentRef = useRef(false); // Track if config has been sent to prevent duplicate sends
  const isMountedRef = useRef(true); // Track mount state to prevent state updates after unmount
  // FIX: Guard refs to prevent infinite API call loops in negative scenarios
  const fetchInProgressRef = useRef(false); // Prevent duplicate concurrent fetches
  const terminalErrorRef = useRef(false); // Stop retrying after permanent errors (403, 404, validation failure)

  // Generate unique container ID for this viewer instance
  const containerId = useMemo(() => `brava-container-${instanceId}-${Date.now()}`, [instanceId]);

  // Consolidated state management
  const [state, setState] = useState(INITIAL_STATE);
  const [lastCheckedPublicationId, setLastCheckedPublicationId] = useState(null);

  // Utility functions
  const updateState = useCallback((updates) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const logDebug = useCallback(
    (message, data = null) => {
      // Disabled for production - uncomment for debugging
    },
    [instanceId],
  );

  const handleError = useCallback(
    (error, context) => {
      const errorMessage = `${viewerName} ${instanceId} Error in ${context}: ${error.message || error}`;
      updateState({ viewerError: errorMessage });
    },
    [instanceId, updateState, viewerName],
  );

  const getAccessToken = useCallback(async () => {
    try {
      const token = await ivTokenManager.getToken();
      if (!isMountedRef.current) return null;
      updateState({ accessToken: token });
      return token;
    } catch (err) {
      return null;
    }
  }, [updateState]);

  const refetchPublicationId = useCallback(async () => {
    if (customRefetchPublicationId) {
      return await customRefetchPublicationId();
    }
    return null;
  }, [customRefetchPublicationId]);

  const getPublicationById = useCallback(
    async (id, accessToken) => {
      // SECURITY: Validate publication ID to prevent injection attacks
      if (!validatePublicationId(id)) {
        log.error("[BaseReadOnlyViewer] Invalid publication ID format", { id });
        updateState({
          viewerError: "Invalid publication ID format",
        });
        return null;
      }

      let currentToken = accessToken;
      let hasRetried = false;

      try {
        if (!isMountedRef.current) return null;
        // ID is validated, safe to use in URL
        const url = `${bravaconfig.publicationsUrl}/${encodeURIComponent(id)}?embed=page_links`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let response;
        try {
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${currentToken}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!isMountedRef.current) return null;

        // CRITICAL: Check for 401 and refresh token automatically
        if (response.status === 401 && !hasRetried) {
          log.warn("[BaseReadOnlyViewer] Token expired (401), refreshing token and retrying...");
          try {
            const newToken = await ivTokenManager.forceRefresh();
            if (!isMountedRef.current) return null;
            updateState({ accessToken: newToken });
            hasRetried = true;

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

            if (!isMountedRef.current) return null;

            if (!retryResponse.ok) {
              if (retryResponse.status === 404) safeCall(onNotFoundRef.current, id);
              // Even after token refresh, request failed
              // Try to refetch publication ID if callback provided
              if (onPublicationIdUpdate) {
                await refetchPublicationId();
              }
              throw new Error(`Failed to fetch publication details after token refresh: ${retryResponse.status} ${retryResponse.statusText}`);
            }

            const details = await retryResponse.json();
            return details;
          } catch (tokenError) {
            log.error("[BaseReadOnlyViewer] Failed to refresh token or retry request", tokenError);
            // If token refresh failed, fall through to error handling
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
            } catch (_) {
              /* ignore parse failure */
            }
            if (isMountedRef.current) {
              updateState({ viewerError: errorMessage });
            }
            return null;
          }
          // For other non-401 errors, try refetching publication ID (existing behavior)
          if (!hasRetried && onPublicationIdUpdate) {
            await refetchPublicationId();
          }
          throw new Error(`Failed to fetch publication details: ${response.status} ${response.statusText}`);
        }

        const details = await response.json();
        return details;
      } catch (err) {
        if (isMountedRef.current) {
          updateState({
            viewerError: `Failed to fetch publication details: ${err.message}`,
          });
        }
        return null;
      }
    },
    [updateState, refetchPublicationId, onPublicationIdUpdate],
  );

  // Poll publication status with retry logic
  const handleStatusCheck = useCallback(
    async (status, details, token) => {
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (status === PUBLICATION_STATUS.COMPLETE) {
        logDebug("Publication complete, loading viewer...");
        if (isMountedRef.current) {
          updateState({ publicationDetails: details, isLoading: false, viewerError: null });
        }
        safeCall(onStatusChangeRef.current, status);
      } else if ([PUBLICATION_STATUS.PENDING, PUBLICATION_STATUS.ACTIVE, PUBLICATION_STATUS.PROCESSING].includes(status)) {
        safeCall(onStatusChangeRef.current, status);
        const currentAttempts = retryAttempts.current.get(publicationId) || 0;

        if (currentAttempts < CONSTANTS.MAX_RETRY_ATTEMPTS) {
          retryAttempts.current.set(publicationId, currentAttempts + 1);
          logDebug(`Publication still processing (attempt ${currentAttempts + 1})... retrying`);

          retryTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            try {
              const refreshedDetails = await getPublicationById(publicationId, token);
              if (!isMountedRef.current) return;
              if (refreshedDetails) {
                const refreshedStatus = refreshedDetails.status?.toLowerCase();
                updateState({ publicationDetails: refreshedDetails });
                handleStatusCheck(refreshedStatus, refreshedDetails, token);
              }
            } catch (err) {
              logDebug("Error while retrying publication check:", err);
              if (isMountedRef.current) {
                updateState({ isLoading: false, viewerError: "Error fetching publication status" });
              }
            }
          }, CONSTANTS.RETRY_DELAY);
        } else {
          logDebug("Max retry attempts reached, stopping");
          if (isMountedRef.current) {
            updateState({
              isLoading: false,
              viewerError:
                "Document is taking longer than expected to process. This may be due to a large file size. Please refresh the page in a few moments or contact support if the issue persists.",
            });
          }
        }
      } else if (status === PUBLICATION_STATUS.FAILED || status === PUBLICATION_STATUS.ERROR) {
        logDebug("Publication failed, stopping retries");
        if (isMountedRef.current) {
          updateState({
            isLoading: false,
            viewerError: `Publication failed: ${details.failureMessage || details.error || "Unknown error"}`,
          });
        }
        retryAttempts.current.delete(publicationId);
        safeCall(onStatusChangeRef.current, status);
        safeCall(onFailedRef.current, { pubId: publicationId, message: details?.failureMessage || details?.error || "Unknown error" });
      } else {
        logDebug(`Unhandled publication status: ${status}`);
        if (isMountedRef.current) {
          updateState({
            isLoading: false,
            viewerError: `Unknown publication status: ${status}`,
          });
        }
      }
    },
    [publicationId, logDebug, updateState, getPublicationById],
  );

  // Generate iframe HTML with script retry support
  const generateIframeHtml = useCallback(() => {
    const isDev = import.meta.env.DEV;
    const baseUrl = getBaseUrl();
    const parentOriginForIframe = getParentTargetOrigin();
    const bundleSrc = isDev ? `${baseUrl}/src/iframe/main.jsx` : `${baseUrl}/iframe/iframeBundle.js`;
    const bundleSrcJson = JSON.stringify(bundleSrc);

    // Script loading logic with optional retry
    const scriptLoadingCode = enableScriptRetry
      ? `
    const bundleUrl = ${bundleSrcJson};
    const MAX_RETRY_ATTEMPTS = ${maxRetryAttempts};
    const RETRY_DELAY_MS = ${retryDelayMs};
    
    // Get retry count from sessionStorage (persists across reloads)
    const retryKey = 'brava_iframe_retry_count_' + '${instanceId}';
    let retryCount = parseInt(sessionStorage.getItem(retryKey) || '0', 10);
    
    // Load the React bundle
    import(bundleUrl)
      .then((module) => {
        // Success - clear retry count
        sessionStorage.removeItem(retryKey);
      })
      .catch((error) => {
        // Error is handled via UI display and postMessage to parent
        const root = document.getElementById('root');
        if (root) {
          const errorMsg = error.message || String(error);
          
          // Check if we should retry
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            // Increment retry count
            retryCount++;
            sessionStorage.setItem(retryKey, retryCount.toString());
            
            // Notify parent window about reload attempt
            try {
              globalThis.parent.postMessage({
                type: 'IFRAME_SCRIPT_LOAD_FAILURE',
                instanceId: '${instanceId}',
                retryAttempt: retryCount,
                maxRetries: MAX_RETRY_ATTEMPTS,
                error: errorMsg,
                bundleUrl: bundleUrl
              }, globalThis.__parentOriginForPostMessage || "");
            } catch (e) {
              // Error notifying parent - already handled via UI display
            }
            
            // Show retry message
            // SECURITY: Use safe DOM manipulation instead of innerHTML to prevent XSS
            // Clear existing content safely
            root.textContent = '';
            const retryDiv = document.createElement('div');
            retryDiv.style.padding = '20px';
            retryDiv.style.color = '#ff9800';
            retryDiv.style.fontFamily = 'monospace';
            retryDiv.style.whiteSpace = 'pre-wrap';
            retryDiv.style.textAlign = 'center';
            // Use textContent to safely display error message (prevents XSS)
            retryDiv.textContent = 'Script loading failed. Retrying... (Attempt ' + retryCount + ' of ' + MAX_RETRY_ATTEMPTS + ')\\n\\nError: ' + errorMsg + '\\n\\nReloading in ' + (RETRY_DELAY_MS / 1000) + ' seconds...';
            root.appendChild(retryDiv);
            
            // Reload the iframe after delay
            setTimeout(() => {
              globalThis.location.reload();
            }, RETRY_DELAY_MS);
          } else {
            // Max retries reached - show final error
            sessionStorage.removeItem(retryKey);
            
            // Notify parent window about final failure
            try {
              globalThis.parent.postMessage({
                type: 'IFRAME_SCRIPT_LOAD_FAILURE',
                instanceId: '${instanceId}',
                retryAttempt: retryCount,
                maxRetries: MAX_RETRY_ATTEMPTS,
                error: errorMsg,
                bundleUrl: bundleUrl,
                finalFailure: true
              }, globalThis.__parentOriginForPostMessage || "");
            } catch (e) {
              // Error notifying parent - already handled via UI display
            }
            
            // SECURITY: Use safe DOM manipulation instead of innerHTML to prevent XSS
            // Clear existing content safely
            root.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.style.padding = '20px';
            errorDiv.style.color = 'red';
            errorDiv.style.fontFamily = 'monospace';
            errorDiv.style.whiteSpace = 'pre-wrap';
            // Use textContent to safely display error message (prevents XSS)
            errorDiv.textContent = 'Error: Failed to load iframe bundle after ' + MAX_RETRY_ATTEMPTS + ' attempts\\n\\nMessage: ' + errorMsg + '\\n\\nURL: ' + bundleUrl + '\\n\\nCheck the Network tab for 404 errors.';
            root.appendChild(errorDiv);
          }
        }
      });`
      : `
    const bundleUrl = ${bundleSrcJson};
    // Load the React bundle
    import(bundleUrl)
      .then((module) => {
        // Bundle loaded successfully
      })
      .catch((error) => {
        // Error is handled via UI display
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
      });`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brava Viewer ${instanceId}</title>
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
  <script>window.viewerConfig = window.viewerConfig || {}; window.viewerConfig.instanceId = ${JSON.stringify(instanceId)};</script>
  <div id="root">
  </div>
  <script type="module">
    ${scriptLoadingCode}
  </script>
</body>
</html>`;
  }, [enableScriptRetry, maxRetryAttempts, retryDelayMs, instanceId]);

  const initializeIframeViewer = useCallback(() => {
    // Check if all required data is available
    if (!state.publicationDetails || !bravaconfig.viewerAuthority || !state.accessToken) {
      return;
    }

    // Only initialize if publication is complete
    if (state.publicationDetails?.status?.toLowerCase() !== PUBLICATION_STATUS.COMPLETE) {
      return;
    }

    // Prevent duplicate initializations - use ref to prevent race conditions
    if (state.isInitializing || state.viewerInitialized || initializationAttemptedRef.current) {
      return;
    }

    // Mark as attempting initialization
    initializationAttemptedRef.current = true;
    configSentRef.current = false;

    updateState({ isInitializing: true, isLoading: true, viewerError: null });
    globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_LOADING }, getParentTargetOrigin());

    try {
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const readonlyLayout = createLayout();
        const targetOrigin = getSrcdocIframeTargetOrigin();

        // Function to send config to iframe
        const sendConfigToIframe = () => {
          if (!iframe.contentWindow) {
            return;
          }

          try {
            const viewerConfig = {
              instanceId,
              containerId,
              accessToken: state.accessToken,
              viewerAuthority: bravaconfig.viewerAuthority,
              loaderUrl: `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js`,
              searchHost: import.meta.env.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
              markupHost: import.meta.env.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
              assetsHost: import.meta.env.VITE_BRAVA_ASSETS_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_ASSETS_HOST}` : "",
              publicationDetails: state.publicationDetails,
              layout: readonlyLayout,
              readonly: true,
              ivTitle,
              initialPage: page !== null && page !== undefined ? page : null,
              parentOrigin: getParentTargetOrigin(),
            };

            // Send config to iframe
            const message = {
              type: MESSAGE_TYPES.LOAD_PUBLICATION,
              publicationDetails: viewerConfig.publicationDetails,
              config: viewerConfig,
            };

            try {
              iframe.contentWindow.postMessage(message, targetOrigin);
            } catch (error) {
              log.error(`[${viewerName}] ERROR sending message`, error);
            }

            // Also set access token
            const tokenMessage = {
              type: MESSAGE_TYPES.SET_ACCESS_TOKEN,
              accessToken: state.accessToken,
            };

            try {
              iframe.contentWindow.postMessage(tokenMessage, targetOrigin);
            } catch (error) {
              log.error(`[${viewerName}] ERROR sending access token`, error);
            }
          } catch (error) {
            log.error(`[${viewerName}] Error sending config`, error);
          }
        };

        // Set up event handlers before setting src
        iframe.onload = () => {
          // Event-driven: IFRAME_READY message will trigger config sending
          // CRITICAL: Never set viewerInitialized here - always wait for IFRAME_READY
          // This ensures the script has actually loaded before we mark as initialized
          // Setting it here causes infinite loops because the script might not be ready yet
          updateState({
            isLoading: false,
            isInitializing: false,
            // viewerInitialized will be set by IFRAME_READY handler when script actually loads
          });

          // Safety fallback: If IFRAME_READY never fires (e.g., script loading fails silently),
          // attempt to send config after a reasonable delay to prevent viewer from hanging
          // This is a last resort - IFRAME_READY is the primary mechanism
          setTimeout(() => {
            if (!configSentRef.current && iframeRef.current?.contentWindow && state.publicationDetails && state.accessToken) {
              log.warn("[BaseReadOnlyViewer] IFRAME_READY not received after 5 seconds - using safety fallback");
              // Try to send config anyway (viewer might be ready but didn't send IFRAME_READY)
              try {
                sendConfigToIframe();
              } catch (error) {
                log.error("[BaseReadOnlyViewer] Safety fallback config send failed", error);
              }
            }
          }, 5000); // 5 second safety fallback
        };

        iframe.onerror = (error) => {
          handleError(error, "iframe loading");
          updateState({ isLoading: false, isInitializing: false });
          globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_ERROR }, getParentTargetOrigin());
        };

        // Set iframe HTML
        iframe.srcdoc = generateIframeHtml();
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
    page,
    createLayout,
    handleError,
    logDebug,
    updateState,
    enableScriptRetry,
    generateIframeHtml,
    viewerName,
  ]);

  // Set up persistent message listener for IFRAME_READY signals
  useEffect(() => {
    const handleIframeReady = (event) => {
      if (event.data?.type !== "IFRAME_READY") return;
      if (!isValidIframeReadyEvent(event, iframeRef, instanceId, viewerName, log)) return;
      if (!iframeRef.current?.contentWindow || state.viewerInitialized || configSentRef.current) return;

      configSentRef.current = true;
      try {
        sendConfigAndTokenAfterIframeReady({
          iframeRef,
          configSentRef,
          state,
          instanceId,
          containerId,
          createLayout,
          bravaconfig,
          ivTitle,
          page,
          updateState,
          viewerName,
          log,
        });
      } catch {
        return;
      }
      updateState({
        viewerInitialized: true,
        isLoading: false,
        isInitializing: false,
      });
    };

    globalThis.addEventListener("message", handleIframeReady);

    return () => {
      globalThis.removeEventListener("message", handleIframeReady);
    };
  }, [instanceId, containerId, state.accessToken, state.publicationDetails, state.viewerInitialized, ivTitle, page, createLayout, updateState, viewerName]);

  /**
   * Handle messages from iframe viewer
   * @param {MessageEvent} event - Message event from iframe
   */
  const handleIframeMessage = useCallback(
    (event) => {
      if (!event.data?.type) return;
      if (!isValidIframeMessageEvent(event, iframeRef, instanceId, viewerName, log)) return;

      const type = event.data.type;
      switch (type) {
        case MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_SUCCESS:
        case MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_FAILURE:
        case MESSAGE_TYPES.VIEWER_INITIALIZED:
        case MESSAGE_TYPES.VIEWER_ERROR:
        case MESSAGE_TYPES.VIEWER_LOADING:
          handlePdfExportAndViewerMessages(event, { updateState, logDebug, viewerName, log });
          break;
        case "IFRAME_SCRIPT_LOAD_FAILURE":
          handleIframeScriptLoadFailure(event, {
            enableScriptRetry,
            updateState,
            initializationAttemptedRef,
            configSentRef,
            logDebug,
            viewerName,
          });
          break;
        case "IFRAME_CLICK_EVENT":
        case "PDF_EXPORT_CLICK_EVENT":
        case "EXPORT_PDF_BUTTON_CLICKED":
        case "EXPORT_PDF_BUTTON_ERROR":
          if (onCustomMessage) onCustomMessage(event);
          break;
        default:
          if (onCustomMessage) onCustomMessage(event);
          break;
      }
    },
    [logDebug, updateState, enableScriptRetry, onCustomMessage, viewerName, instanceId],
  );

  // Listen for messages from iframe
  useEffect(() => {
    globalThis.addEventListener("message", handleIframeMessage);
    return () => globalThis.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  /**
   * Initialize publication loading when publicationId changes
   */
  const initializePublication = useCallback(async () => {
    logDebug("initializePublication called with publicationId:", publicationId);

    // FIX: Prevent duplicate concurrent API calls (guards against infinite loop)
    if (fetchInProgressRef.current) {
      logDebug("Fetch already in progress, skipping duplicate call");
      return;
    }

    // FIX: Stop retrying after terminal errors (403 Forbidden, 404 Not Found, validation failure)
    if (terminalErrorRef.current) {
      logDebug("Terminal error occurred, not retrying");
      return;
    }

    if (!publicationId) {
      logDebug("No publication ID provided, skipping publication fetch");
      updateState({
        isLoading: false,
        viewerError: "No publication ID provided. Please wait for publication to be ready.",
      });
      return;
    }

    // Reset state for new publication
    if (lastCheckedPublicationId !== publicationId) {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      retryAttempts.current.set(publicationId, 0);
      refetchAttempted.current = false;
      initializationAttemptedRef.current = false; // Reset initialization flag for new publication
      configSentRef.current = false; // Reset config sent flag for new publication
      terminalErrorRef.current = false; // FIX: Reset terminal error flag for new publication

      updateState({
        publicationDetails: null,
        viewerInitialized: false,
        isInitializing: false,
        viewerError: null,
      });
    }

    // Skip if already loaded and complete - check BEFORE setting isLoading to prevent overlay from showing
    if (state.publicationDetails?.id === publicationId && state.publicationDetails?.status?.toLowerCase() === PUBLICATION_STATUS.COMPLETE) {
      logDebug("Publication already loaded and complete, skipping fetch");
      // Ensure isLoading is false if viewer is already initialized
      if (state.viewerInitialized && state.isLoading) {
        updateState({ isLoading: false });
      }
      return;
    }

    // Only set loading state if viewer is not already initialized
    // This prevents the overlay from showing when publication is re-checked after viewer is ready
    if (!state.viewerInitialized) {
      globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_LOADING }, getParentTargetOrigin());
      updateState({ isLoading: true, viewerError: null });
    }

    // FIX: Mark fetch as in progress to prevent duplicate calls
    fetchInProgressRef.current = true;

    try {
      const token = await getAccessToken();
      if (!isMountedRef.current) return;
      if (!token) {
        terminalErrorRef.current = true; // FIX: Token failure is terminal
        updateState({ isLoading: false, viewerError: "Failed to get access token" });
        return;
      }

      const details = await getPublicationById(publicationId, token);
      if (!isMountedRef.current) return;
      if (!details) {
        // FIX: No details means a terminal error occurred (403, 404, etc.) - don't retry
        terminalErrorRef.current = true;
        return; // Error message already set by getPublicationById
      }

      const status = details.status?.toLowerCase();
      setLastCheckedPublicationId(publicationId);
      await handleStatusCheck(status, details, token);
    } catch (error) {
      logDebug("Error initializing publication:", error);
      terminalErrorRef.current = true; // FIX: Unexpected error is terminal
      if (isMountedRef.current) {
        updateState({ isLoading: false, viewerError: "Failed to initialize publication" });
      }
    } finally {
      // FIX: Always clear fetch-in-progress flag
      fetchInProgressRef.current = false;
    }
  }, [
    publicationId,
    lastCheckedPublicationId,
    state.publicationDetails,
    state.viewerInitialized,
    state.isLoading,
    logDebug,
    updateState,
    getAccessToken,
    getPublicationById,
    handleStatusCheck,
  ]);

  // Load publication when publicationId changes
  useEffect(() => {
    initializePublication();
  }, [initializePublication]);

  // Initialize iframe viewer when all requirements are met
  useEffect(() => {
    initializeIframeViewer();
  }, [initializeIframeViewer]);

  // Update publication in iframe when details change
  useEffect(() => {
    if (!state.viewerInitialized || !state.publicationDetails) return;

    try {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: MESSAGE_TYPES.LOAD_PUBLICATION,
          publicationDetails: state.publicationDetails,
        },
        getSrcdocIframeTargetOrigin(),
      );
    } catch (error) {
      logDebug("Failed to send publication update to iframe:", error);
    }
  }, [state.viewerInitialized, state.publicationDetails?.id, logDebug]);

  // Handle page navigation when viewer is already initialized (e.g., from hyperlink)
  // This prevents re-initialization when only the page prop changes
  const lastPageRef = useRef(page);
  useEffect(() => {
    // Only handle page changes if viewer is already initialized
    if (!state.viewerInitialized || page === null || page === undefined) {
      lastPageRef.current = page;
      return;
    }

    // Only navigate if page actually changed
    if (lastPageRef.current !== page && page > 0) {
      try {
        // Send page navigation message to iframe
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: MESSAGE_TYPES.NAVIGATE_TO_PAGE,
            page: page - 1, // Brava uses 0-based indexing
            instanceId,
          },
          getSrcdocIframeTargetOrigin(),
        );
        lastPageRef.current = page;
        logDebug(`Navigating to page ${page} (hyperlink navigation)`);
      } catch (error) {
        logDebug("Failed to send page navigation to iframe:", error);
      }
    }
  }, [state.viewerInitialized, page, instanceId, logDebug]);

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
      logDebug("Failed to send token update to iframe:", error);
    }
  }, [state.viewerInitialized, state.accessToken, logDebug]);

  // CRITICAL: Safety mechanism - ensure isLoading is always false when viewer is initialized
  // This prevents the loading overlay from persisting in edge cases (e.g., hyperlink navigation, race conditions)
  useEffect(() => {
    if (state.viewerInitialized && state.isLoading) {
      logDebug("Safety: Clearing isLoading state for initialized viewer");
      updateState({ isLoading: false });
    }
  }, [state.viewerInitialized, state.isLoading, logDebug, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }

        iframeRef.current?.contentWindow?.postMessage({ type: MESSAGE_TYPES.CLEAR_VIEWER }, getSrcdocIframeTargetOrigin());
        retryAttempts.current.clear();
        refetchAttempted.current = false;
        initializationAttemptedRef.current = false;
        configSentRef.current = false;
      } catch (error) {
        logDebug("Error during cleanup:", error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="App">
      <main>
        {state.publicationDetails ? (
          <div className="brava-viewer-container">
            {/* CRITICAL: Only show loading overlay if viewer is not initialized AND isLoading is true
                Also check configSentRef to prevent overlay after config is sent */}
            {state.isLoading && !state.viewerInitialized && !configSentRef.current && (
              <div className="loading-overlay">
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Loading Document Viewer...</p>
                </div>
              </div>
            )}
            {state.viewerError && (
              <div className="d-flex justify-content-center align-items-center viewer-error-inline">
                <div className="text-center">
                  <h5 className="text-danger mb-3">Error Loading Viewer</h5>
                  <p className="text-muted mb-0">{state.viewerError}</p>
                </div>
              </div>
            )}
            {!state.viewerError && (
              <div ref={containerRef} className="viewer-div">
                <iframe ref={iframeRef} title={`Brava Viewer ${instanceId}`} className="viewer-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </div>
            )}
          </div>
        ) : state.viewerError ? (
          <div className="d-flex justify-content-center align-items-center viewer-error-inline">
            <div className="text-center">
              <h5 className="text-danger mb-3">Error Loading Viewer</h5>
              <p className="text-muted mb-0">{state.viewerError}</p>
            </div>
          </div>
        ) : (
          <div className="brava-viewer-container">
            <div className="loading-overlay">
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading Document Viewer...</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BaseReadOnlyViewer;
