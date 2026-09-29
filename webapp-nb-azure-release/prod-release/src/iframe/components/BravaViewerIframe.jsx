import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "./BravaViewerIframe.css";
import ViewerInitializer from "./ViewerInitializer";
import { createEvent, isValidMessage, postMessageToParent, isValidSrcdocOrigin } from "../utils/postMessageProtocol";
import { MESSAGE_TYPES, TIMING } from "../utils/constants";
import { viewerLinkFromSearchString } from "../../components/iv/utils/bravaViewerUtils";
import { setupHyperlinkInterceptor } from "../../components/iv/utils/bravaApiHelpers";
import { VIEWER_STATE, canTransition, getStateFlags } from "../utils/viewerLifecycle";
import { log } from "../utils/logger";
import {
  handleLoadPublication,
  handleSetAccessToken,
  handleClearViewer,
  handleNavigateToPage,
  handleTriggerSave,
  handleTriggerExportDownload,
  handleTriggerExportButtonClick,
  handleTriggerExportWithDropdown,
  handleGetAllMarkups,
  handleRestoreMarkups,
} from "../utils/messageHandlers";

// Import all handlers
// Critical handlers - keep static (small, always needed immediately)
import { setupSaveHandlers, setupSaveButtonClickDetection, markViewerInitialized, activeSaves } from "../utils/saveHandlers";
import { setupHyperlinkClickDetection, setupDeepLinkingNavigation, setupViewerHyperlinkResolver } from "../utils/hyperlinkHandlers";
import { setupCustomButtonClickDetection } from "../utils/customButtonHandlers";
import { setupSidebarWidthManagement } from "../utils/sidebarHandlers";
import { unregisterViewer } from "../utils/markupHandlers";
import { setupMarkupDirtyListener } from "../utils/markupPersistenceHandlers";
import { viewerEventBus } from "../utils/ViewerEventBus";
import { PANE_IDS } from "../utils/ViewerEventTypes";

// Non-critical handlers - lazy load (large modules, needed after publication ready)
// This reduces initial bundle size by ~50% and improves load time
const loadExportHandlers = () => import("../utils/exportHandlers");
const loadMarkupHandlers = () => import("../utils/markupHandlers");

/**
 * Returns a cleanup function when publication-loaded fallback (event + timeout) is set up;
 * otherwise calls setPublicationLoaded(true) and returns null.
 */
function getPublicationLoadedFallbackCleanup(config, viewerName, setPublicationLoaded, cleanupFunctionsRef, safeSetTimeout, log) {
  if (!config.publicationDetails) {
    setPublicationLoaded(true);
    return null;
  }
  const publicationLoadedEvent = viewerName + "-publicationLoaded";
  const handlePublicationLoadedOnce = () => {
    setPublicationLoaded(true);
    globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedOnce);
  };
  globalThis.addEventListener(publicationLoadedEvent, handlePublicationLoadedOnce);
  const FALLBACK_TIMEOUT_MS = 3000;
  const fallbackTimeoutId = safeSetTimeout(() => {
    log.warn("publicationLoaded event timeout - proceeding anyway to prevent hang");
    setPublicationLoaded(true);
    globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedOnce);
  }, FALLBACK_TIMEOUT_MS);
  cleanupFunctionsRef.current.push(() => {
    clearTimeout(fallbackTimeoutId);
    globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedOnce);
  });
  return () => {
    clearTimeout(fallbackTimeoutId);
    globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedOnce);
  };
}

/**
 * Runs a setup function; pushes returned cleanup to array and logs on error.
 */
function runSetup(description, setupFn, cleanupFunctions, log) {
  try {
    const cleanup = setupFn();
    if (cleanup) cleanupFunctions.push(cleanup);
  } catch (error) {
    log.error(description, error);
  }
}

/**
 * Sets up all event handlers (save, export, hyperlink, markup, etc.) and pushes cleanups to cleanupFunctions.
 */
function setupAllHandlers(opts) {
  const { viewerApi, viewerName, config, viewerLinkRef, cleanupFunctions, instanceId, safeSetTimeout, log } = opts;
  runSetup(
    "Error setting up hyperlink interceptor",
    () => {
      setupHyperlinkInterceptor(config);
      return null;
    },
    cleanupFunctions,
    log,
  );
  runSetup("Error setting up hyperlink resolver", () => setupViewerHyperlinkResolver(viewerApi, instanceId), cleanupFunctions, log);
  runSetup(
    "Error setting up save handlers",
    () => {
      setupSaveHandlers(viewerApi, viewerName, instanceId);
      const cleanupSave = setupSaveButtonClickDetection(viewerApi);
      safeSetTimeout(() => markViewerInitialized(instanceId), 3000);
      return cleanupSave;
    },
    cleanupFunctions,
    log,
  );
  loadExportHandlers()
    .then((exportModule) => {
      try {
        const cleanupExportHandlers = exportModule.setupExportHandlers(viewerName, config);
        if (cleanupExportHandlers) cleanupFunctions.push(cleanupExportHandlers);
        const cleanupExport = exportModule.setupExportButtonClickDetection(viewerApi);
        if (cleanupExport) cleanupFunctions.push(cleanupExport);
      } catch (error) {
        log.error("Error setting up export handlers", error);
      }
    })
    .catch((error) => log.error("Error loading export handlers module", error));
  runSetup("Error setting up hyperlink click detection", () => setupHyperlinkClickDetection(viewerApi), cleanupFunctions, log);
  runSetup("Error setting up custom button handlers", () => setupCustomButtonClickDetection(viewerApi, config, viewerName), cleanupFunctions, log);
  loadMarkupHandlers()
    .then((markupModule) => {
      try {
        const cleanupMarkupEvents = markupModule.setupMarkupEventListeners(viewerName, viewerApi);
        if (cleanupMarkupEvents) cleanupFunctions.push(cleanupMarkupEvents);
        const cleanupMarkup = markupModule.setupMarkupClickDetection(viewerApi, viewerName);
        if (cleanupMarkup) cleanupFunctions.push(cleanupMarkup);
        const cleanupHyperlinkCursor = markupModule.setupHyperlinkCursor(viewerName, viewerApi);
        if (cleanupHyperlinkCursor) cleanupFunctions.push(cleanupHyperlinkCursor);
      } catch (error) {
        log.error("Error setting up markup handlers", error);
      }
    })
    .catch((error) => log.error("Error loading markup handlers module", error));
  if (config.publicationDetails?.id) {
    runSetup("Error setting up markup dirty listener", () => setupMarkupDirtyListener(viewerApi, viewerName, config.publicationDetails.id), cleanupFunctions, log);
  }
  runSetup(
    "Error setting up deep linking",
    () => (viewerLinkRef.current ? setupDeepLinkingNavigation(viewerLinkRef, viewerName, viewerApi, instanceId) : null),
    cleanupFunctions,
    log,
  );
  runSetup("Error setting up sidebar width management", () => setupSidebarWidthManagement(viewerName, viewerApi), cleanupFunctions, log);
}

/**
 * Applies zoom and viewer settings (title, navigation, deep link) and pushes cleanups to cleanupFunctions.
 */
function applyZoomAndSettings(opts) {
  const { viewerApi, viewerName, config, publicationLoaded, cleanupFunctions, safeSetTimeout, log, viewerLinkRef, TIMING } = opts;
  try {
    if (typeof viewerApi.zoomToWidth === "function") {
      let zoomApplied = false;
      const applyZoomToWidth = () => {
        if (zoomApplied) return;
        try {
          const activePub = viewerApi.getActivePublication?.();
          if (!activePub) return;
        } catch {
          // continue with zoomToWidth attempt
        }
        try {
          viewerApi.zoomToWidth();
          zoomApplied = true;
        } catch (zoomError) {
          const errorMessage = zoomError?.message || String(zoomError);
          const isAlreadyAtWidth = errorMessage.toLowerCase().includes("width") || errorMessage.toLowerCase().includes("zoom") || errorMessage.toLowerCase().includes("already");
          if (isAlreadyAtWidth) {
            zoomApplied = true;
          } else {
            log.warn("Failed to apply zoomToWidth", { error: zoomError });
          }
        }
      };
      const pageRenderEvent = viewerName + "-pageRender";
      const applyZoomOnPageRender = () => applyZoomToWidth();
      globalThis.addEventListener(pageRenderEvent, applyZoomOnPageRender);
      const publicationLoadedEvent = viewerName + "-publicationLoaded";
      const handlePublicationLoadedForZoom = () => {
        applyZoomToWidth();
        globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedForZoom);
      };
      globalThis.addEventListener(publicationLoadedEvent, handlePublicationLoadedForZoom);
      if (publicationLoaded) applyZoomToWidth();
      cleanupFunctions.push(() => {
        globalThis.removeEventListener(pageRenderEvent, applyZoomOnPageRender);
        globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedForZoom);
      });
      const zoomTimeout = safeSetTimeout(() => {
        if (!zoomApplied) {
          log.warn("[BravaViewerIframe] Zoom events didn't fire - using safety fallback");
          applyZoomToWidth();
        }
      }, 3000);
      cleanupFunctions.push(() => clearTimeout(zoomTimeout));
    }
    const applySettings = () => {
      try {
        if (config.ivTitle && typeof viewerApi.setTitle === "function") {
          const activePub = viewerApi.getActivePublication?.();
          if (activePub) viewerApi.setTitle(activePub, config.ivTitle);
        }
        if (config.initialPage !== undefined && config.initialPage !== null && config.initialPage > 0) {
          const pageIndex = config.initialPage - 1;
          const navigateToPage = () => {
            try {
              if (typeof viewerApi.setCurrentPage === "function") viewerApi.setCurrentPage(pageIndex);
            } catch (e) {
              log.warn("Failed to navigate to initial page", { error: e, page: config.initialPage });
            }
          };
          const markupsLoadedEvent = viewerName + "-markupsLoaded";
          let handled = false;
          const handleMarkupsLoaded = () => {
            if (handled) return;
            handled = true;
            navigateToPage();
            globalThis.removeEventListener(markupsLoadedEvent, handleMarkupsLoaded);
          };
          globalThis.addEventListener(markupsLoadedEvent, handleMarkupsLoaded);
          safeSetTimeout(() => {
            if (!handled) {
              navigateToPage();
              globalThis.removeEventListener(markupsLoadedEvent, handleMarkupsLoaded);
            }
          }, TIMING.MARKUPS_LOADED_TIMEOUT);
        }
        if (viewerLinkRef.current?.type === "page") {
          try {
            if (typeof viewerApi.setCurrentLocation === "function") {
              viewerApi.setCurrentLocation(viewerLinkRef.current);
              viewerLinkRef.current = null;
            }
          } catch (e) {
            log.warn("Failed to apply deep link", { error: e });
          }
        }
      } catch (e) {
        log.warn("Error applying viewer settings (non-critical)", { error: e });
      }
    };
    if (publicationLoaded) applySettings();
    const publicationLoadedEvent = viewerName + "-publicationLoaded";
    const handlePublicationLoadedForSettings = () => {
      applySettings();
      globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedForSettings);
    };
    globalThis.addEventListener(publicationLoadedEvent, handlePublicationLoadedForSettings);
    cleanupFunctions.push(() => globalThis.removeEventListener(publicationLoadedEvent, handlePublicationLoadedForSettings));
  } catch (error) {
    log.error("Error applying viewer settings", error);
  }
}

/**
 * Transitions state to READY and sends viewerInitialized to parent when appropriate.
 */
function doStateTransitionAndNotify(opts) {
  const { viewerStateRef, setViewerState, publicationLoaded, VIEWER_STATE, viewerApiRef, viewerName, config, containerIdRef, postMessageToParent, log } = opts;
  const currentState = viewerStateRef.current;
  if (canTransition(currentState, VIEWER_STATE.READY)) {
    setViewerState(VIEWER_STATE.READY);
  } else if (currentState === VIEWER_STATE.VIEWER_READY && publicationLoaded) {
    setViewerState(VIEWER_STATE.READY);
  } else {
    log.warn("Cannot transition to READY", {
      currentState,
      publicationLoaded,
      canTransition: canTransition(currentState, VIEWER_STATE.READY),
      hasViewerApi: !!viewerApiRef.current,
      hasViewerName: !!viewerName,
    });
    if (publicationLoaded) {
      log.warn("Forced transition to READY (publication loaded)", { from: currentState });
      setViewerState(VIEWER_STATE.READY);
    }
  }
  const hasViewerApi = !!viewerApiRef.current;
  const hasViewerName = !!viewerName;
  if (hasViewerApi && hasViewerName) {
    try {
      postMessageToParent({
        type: "viewerInitialized",
        instanceId: config.instanceId || "default",
        containerId: containerIdRef.current,
      });
    } catch (error) {
      log.error("Failed to send viewerInitialized", error);
    }
  } else {
    log.warn("Cannot send viewerInitialized - no viewer API", { hasViewerApi, hasViewerName, viewerState: viewerStateRef.current });
  }
}

/**
 * Routes a validated postMessage payload to the appropriate handler by type.
 */
function routeMessageByType(data, ctx) {
  const { containerIdRef, configRef, setConfig, setViewerState, VIEWER_STATE, loadPublication, viewerApiRef, config, viewerName } = ctx;
  if (data.type === MESSAGE_TYPES.LOAD_PUBLICATION || data.type === "LOAD_PUBLICATION") {
    handleLoadPublication(data, configRef, setConfig, setViewerState, VIEWER_STATE, loadPublication);
    if (data.config?.containerId) containerIdRef.current = data.config.containerId;
  } else if (data.type === MESSAGE_TYPES.SET_ACCESS_TOKEN || data.type === "SET_ACCESS_TOKEN") {
    handleSetAccessToken(data, viewerApiRef, setConfig);
  } else if (data.type === MESSAGE_TYPES.CLEAR_VIEWER || data.type === "CLEAR_VIEWER") {
    handleClearViewer(viewerApiRef);
  } else if (data.type === MESSAGE_TYPES.NAVIGATE_TO_PAGE || data.type === "NAVIGATE_TO_PAGE") {
    handleNavigateToPage(data, viewerApiRef, configRef);
  } else if (data.type === MESSAGE_TYPES.TRIGGER_SAVE_BUTTON_CLICK || data.type === "TRIGGER_SAVE_BUTTON_CLICK") {
    handleTriggerSave(viewerApiRef, viewerName, config.instanceId);
  } else if (data.type === MESSAGE_TYPES.TRIGGER_EXPORT_DOWNLOAD || data.type === "TRIGGER_EXPORT_DOWNLOAD") {
    handleTriggerExportDownload(data, configRef);
  } else if (data.type === MESSAGE_TYPES.TRIGGER_EXPORT_BUTTON_CLICK || data.type === "TRIGGER_EXPORT_BUTTON_CLICK") {
    handleTriggerExportButtonClick();
  } else if (data.type === MESSAGE_TYPES.TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK || data.type === "TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK") {
    handleTriggerExportWithDropdown();
  } else if (data.type === MESSAGE_TYPES.GET_ALL_MARKUPS || data.type === "GET_ALL_MARKUPS" || data.type === "GET_ALL_MARKUPS_FOR_SAVE") {
    handleGetAllMarkups(data, viewerApiRef);
  } else if (data.type === MESSAGE_TYPES.RESTORE_MARKUPS || data.type === "RESTORE_MARKUPS") {
    handleRestoreMarkups(data, viewerApiRef);
  }
  // MESSAGE_TYPES.REQUEST: no-op for future use
}

/**
 * BravaViewerIframe Component
 *
 * Purpose: Main orchestrator component for the Brava viewer iframe.
 *
 * Responsibilities:
 * 1. Receives configuration from parent window (via postMessage - single source of truth)
 * 2. Initializes the viewer API via ViewerInitializer component
 * 3. Manages viewer lifecycle using state machine (prevents race conditions)
 * 4. Sets up all event handlers after publication loads (prevents race conditions)
 * 5. Loads publications when viewer is ready
 * 6. Handles bidirectional postMessage communication with parent window (modular handlers)
 * 7. Manages error states and loading indicators
 *
 * State Management:
 * - Uses lifecycle state machine (VIEWER_STATE) instead of multiple boolean flags
 * - States: BOOT → CONFIG_READY → VIEWER_READY → PUBLICATION_LOADING → READY
 * - publicationLoaded: Publication has loaded (DOM ready for handlers) - separate tracking for handler setup timing
 * - error: Viewer initialization or critical operation errors
 *
 * Event Handler Setup Strategy:
 * - Waits for publication to load before setting up handlers (ensures DOM is ready)
 * - Uses 3-second timeout fallback to prevent first-load hanging
 * - Handlers are set up only once publication is loaded or timeout expires
 */

const BravaViewerIframe = React.memo(function BravaViewerIframe({ config: initialConfig }) {
  // Initialize config from props (single source of truth)
  // Config can be updated later via postMessage, but initial value comes from props
  const initialConfigValue = initialConfig || {};

  // State Machine: Manages viewer lifecycle to prevent race conditions
  // State transitions: BOOT → CONFIG_READY → VIEWER_READY → PUBLICATION_LOADING → READY
  // Start in CONFIG_READY if viewerAuthority is provided, otherwise BOOT
  const [viewerState, setViewerState] = useState(initialConfigValue.viewerAuthority ? VIEWER_STATE.CONFIG_READY : VIEWER_STATE.BOOT);

  // Core State: Configuration, API references, and error state
  const [config, setConfig] = useState(initialConfigValue); // Current configuration (can be updated via postMessage)
  const [viewerApi, setViewerApi] = useState(null); // Brava viewer API object
  const [viewerName, setViewerName] = useState(null); // Name of the viewer API object (e.g., "BravaViewer")
  const [error, setError] = useState(null); // Error state for initialization or critical operations

  // Derived State: Get boolean flags from state machine for easier conditional checks
  const stateFlags = getStateFlags(viewerState);
  const { isViewerReady } = stateFlags;

  // Publication State: Tracks when publication DOM is ready (separate from state machine)
  // This is needed because handler setup must wait for DOM to be ready, not just state transitions
  const [publicationLoaded, setPublicationLoaded] = useState(false);

  // Log when document has finished loading in IV viewer
  useEffect(() => {
    if (publicationLoaded) {
      console.log("[IV Load] Step 11: Document loaded in IV viewer", { instanceId: config.instanceId, publicationId: config.publicationDetails?.id });
    }
  }, [publicationLoaded, config.instanceId, config.publicationDetails?.id]);

  // Refs: Stable references that don't change on re-render
  // Used in callbacks and message handlers to avoid stale closure issues
  const containerIdRef = useRef(initialConfigValue.containerId || `brava-container-${Date.now()}`);
  const viewerLinkRef = useRef(viewerLinkFromSearchString(globalThis.location?.search ?? "")); // Deep link from URL
  const viewerApiRef = useRef(viewerApi); // Current viewer API (updated via useEffect)
  const configRef = useRef(config); // Current config (updated via useEffect)
  const viewerStateRef = useRef(viewerState); // Current viewer state (updated via useEffect)

  // Sync refs with state: Keep refs up-to-date for message handlers and callbacks
  // This ensures handlers always have access to the latest state values
  useEffect(() => {
    viewerApiRef.current = viewerApi;
    configRef.current = config;
    viewerStateRef.current = viewerState;
  }, [viewerApi, config, viewerState]);

  // Debug Logging: Log state transitions for troubleshooting
  useEffect(() => {
    // Safety Check: If viewerApi exists but state is still CONFIG_READY, force transition
    // This handles cases where handleViewerReady was called but state transition failed
    if (viewerApi && viewerName && viewerState === VIEWER_STATE.CONFIG_READY) {
      log.warn("Viewer API exists but state is CONFIG_READY - forcing transition to VIEWER_READY", {
        viewerName,
        instanceId: config.instanceId,
      });
      setViewerState(VIEWER_STATE.VIEWER_READY);
    }
  }, [viewerState, viewerApi, viewerName, config.viewerAuthority, publicationLoaded, config.publicationDetails?.id, config.instanceId, VIEWER_STATE]);

  // Refs for Cleanup
  const cleanupFunctionsRef = useRef([]);

  // Timeout Management: Track all timeouts to prevent memory leaks on unmount
  const timeoutsRef = useRef(new Set());

  // Interval Management: Track all intervals to prevent memory leaks on unmount
  const intervalsRef = useRef(new Set());

  // Safe setTimeout wrapper that ensures cleanup on unmount
  const safeSetTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      callback();
    }, delay);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  // Cleanup all timeouts and intervals on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current.clear();

      intervalsRef.current.forEach((id) => clearInterval(id));
      intervalsRef.current.clear();

      // Also run cleanup functions
      cleanupFunctionsRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (e) {
          log.error("Error during cleanup", e);
        }
      });

      // Clean up any pending save locks for this instance
      const instanceId = config.instanceId || "default";
      const lockKey = `${instanceId}:${viewerName || "default"}`;

      // Access activeSaves from module export
      // This is a safety net in case component unmounts during save

      if (activeSaves && activeSaves.has(lockKey)) {
        activeSaves.delete(lockKey);
      }

      // Fix 8: Clean up instance-scoped state
      unregisterViewer(instanceId);
      if (globalThis.__bravaViewerInstances__?.[instanceId]) {
        delete globalThis.__bravaViewerInstances__[instanceId];
      }

      // Unregister from ViewerEventBus
      viewerEventBus.unregisterInstance(instanceId);
    };
  }, [config.instanceId, viewerName]); // Add viewerName dependency

  /**
   * Handles successful viewer API initialization.
   *
   * Called by ViewerInitializer when the Brava viewer API is ready.
   * This function:
   * 1. Stores the API reference in state and refs
   * 2. Stores API globally for backward compatibility (with instance isolation)
   * 3. Resets error and publication state
   * 4. Transitions state machine to VIEWER_READY
   * 5. Notifies parent window that viewer is ready
   *
   * @param {Object} api - The Brava viewer API object
   * @param {string} name - The name of the API object (e.g., "BravaViewer")
   */
  const handleViewerReady = useCallback(
    (api, name) => {
      // Update ref immediately to prevent stale references in callbacks
      viewerApiRef.current = api;

      // Update state
      setViewerApi(api);
      setViewerName(name);

      // Store API globally for backward compatibility
      // Use instanceId to support multiple viewer instances without conflicts
      const instanceId = config.instanceId || "default";
      if (globalThis.window !== undefined) {
        if (!globalThis.__bravaViewerInstances__) {
          globalThis.__bravaViewerInstances__ = {};
        }
        globalThis.__bravaViewerInstances__[instanceId] = {
          api,
          name,
          instanceId,
        };

        // REMOVED: window.viewerApi assignment (Fix 5: Remove Shared Globals)
        // Access should be via globalThis.__bravaViewerInstances__[id] or passed explicitly
      }

      // Register with ViewerEventBus for event-driven architecture
      // This enables proper event routing for dual-viewer scenarios
      let paneId = config.paneId ?? null;
      if (paneId === null && instanceId.includes("left")) paneId = PANE_IDS.LEFT;
      else if (paneId === null && instanceId.includes("right")) paneId = PANE_IDS.RIGHT;
      viewerEventBus.registerInstance(instanceId, {
        api,
        viewerName: name,
        paneId,
      });

      // Clear any previous errors
      setError(null);

      // Reset publication state (viewer was reinitialized, publication needs to reload)
      setPublicationLoaded(false);

      // State Machine: Transition to VIEWER_READY
      // This allows publication loading to proceed
      const currentState = viewerStateRef.current;
      if (canTransition(currentState, VIEWER_STATE.VIEWER_READY)) {
        setViewerState(VIEWER_STATE.VIEWER_READY);
      } else {
        log.warn("Invalid state transition to VIEWER_READY", {
          from: currentState,
          to: VIEWER_STATE.VIEWER_READY,
          canTransition: canTransition(currentState, VIEWER_STATE.VIEWER_READY),
        });
      }

      // Notify parent window that viewer API is ready
      // Parent can now send publication details to load
      // Notify parent window that viewer API is ready
      // Parent can now send publication details to load
      postMessageToParent(
        createEvent(MESSAGE_TYPES.VIEWER_READY, {
          instanceId: config.instanceId,
          containerId: containerIdRef.current,
        }),
      );
    },
    [config.instanceId],
  );

  /**
   * Handles viewer initialization errors.
   *
   * Called by ViewerInitializer when initialization fails.
   * This function:
   * 1. Sets error state (displays error overlay)
   * 2. Transitions state machine to ERROR
   * 3. Notifies parent window of the error (both legacy and structured formats)
   *
   * @param {Error} err - The error that occurred during initialization
   */
  const handleViewerError = useCallback(
    (err) => {
      // Set error state (triggers error overlay display)
      setError(err);

      // State Machine: Transition to ERROR state
      const currentState = viewerStateRef.current;
      if (canTransition(currentState, VIEWER_STATE.ERROR)) {
        log.error("Transitioning to ERROR state", {
          from: currentState,
          to: VIEWER_STATE.ERROR,
          error: err.message || String(err),
          instanceId: config.instanceId,
        });
        setViewerState(VIEWER_STATE.ERROR);
      } else {
        log.warn("Cannot transition to ERROR state", {
          from: currentState,
          to: VIEWER_STATE.ERROR,
          canTransition: canTransition(currentState, VIEWER_STATE.ERROR),
        });
      }

      // Notify parent window of error
      // Send both legacy format (for backward compatibility) and structured format
      const errorMessage = {
        type: MESSAGE_TYPES.VIEWER_ERROR,
        instanceId: config.instanceId || "default",
        error: err.message || String(err),
      };
      postMessageToParent(errorMessage);

      // Also send structured event format
      postMessageToParent(
        createEvent(MESSAGE_TYPES.VIEWER_ERROR, {
          instanceId: config.instanceId || "default",
          error: err.message || String(err),
        }),
      );

      log.error("Viewer initialization error", err);
    },
    [config.instanceId],
  );

  /**
   * Load publication into viewer
   *
   * Error Handling Strategy:
   * - Critical errors (container not found, publication load failure): Stop viewer, show error
   * - Non-critical errors (settings, navigation, title): Log warning, continue operation
   *
   * This prevents the viewer from stopping due to non-critical operation failures.
   *
   * @param {Object} publicationDetails - Publication details object from API
   */
  const loadPublication = useCallback(
    async (publicationDetails) => {
      if (!viewerApi || !publicationDetails) {
        return;
      }

      // BULLETPROOF: Prevent duplicate loads of same publication
      if (lastLoadedPublicationIdRef.current === publicationDetails.id && publicationLoaded) {
        return;
      }

      // CRITICAL: Only throw errors for critical failures that should stop the viewer
      // Non-critical errors (settings, navigation, etc.) should be warnings only

      // Container Detection: Retry logic handles React DOM not yet painted
      // The container element may not exist immediately after component mount
      const containerId = containerIdRef.current;
      let container = null;
      let tries = 0;
      const MAX_RETRIES = 10; // Maximum retry attempts
      const RETRY_DELAY_MS = 100; // Delay between retries (100ms)

      // Retry until container is found or max retries reached
      while (!container && tries < MAX_RETRIES) {
        container = document.getElementById(containerId);
        if (!container) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          tries++;
        }
      }

      // Critical Error: Container not found after retries
      if (!container) {
        const error = new Error(`Container element not found after ${tries} attempts: ${containerId}`);
        log.error("Error loading publication", error);
        handleViewerError(error);
        return;
      }

      // Layout Configuration: Non-critical operation (warn only if fails)
      // Layout can fail without breaking the viewer
      if (config.layout) {
        try {
          viewerApi.setLayout?.(config.layout);
          viewerApi.setActiveTab?.("tabContainerWithMarkups");
        } catch (e) {
          log.warn("Failed to set layout", { error: e });
        }
      }

      // Publication Loading: Critical operation that must succeed
      try {
        // State Machine: Transition to PUBLICATION_LOADING before loading
        // This ensures proper state flow: VIEWER_READY → PUBLICATION_LOADING → READY
        const currentState = viewerStateRef.current;
        if (canTransition(currentState, VIEWER_STATE.PUBLICATION_LOADING)) {
          setViewerState(VIEWER_STATE.PUBLICATION_LOADING);
        } else {
          log.warn("Cannot transition to PUBLICATION_LOADING", {
            from: currentState,
            to: VIEWER_STATE.PUBLICATION_LOADING,
            canTransition: canTransition(currentState, VIEWER_STATE.PUBLICATION_LOADING),
          });
        }

        // Load publication into viewer
        viewerApi.clearViewer?.(); // Clear any existing publication
        viewerApi.addPublication?.(publicationDetails, true); // Add new publication
        viewerApi.render?.(containerId); // Render to container

        // Publication Readiness Detection: DOM polling (more reliable than events)
        // The Brava viewer doesn't always fire publicationLoaded events reliably,
        // so we poll the DOM for indicators that the publication has rendered

        /**
         * Checks if publication is ready by examining DOM indicators.
         * Uses multiple lenient checks to handle various rendering scenarios.
         *
         * @returns {boolean} True if publication appears ready, false otherwise
         */
        const checkPublicationReady = () => {
          const container = document.getElementById(containerId);
          if (!container) return false;

          // Multiple indicators of publication readiness
          const hasCanvas = !!container.querySelector("canvas"); // Canvas-based rendering
          const hasIframe = !!container.querySelector("iframe"); // Iframe-based rendering
          const hasContent = container.children.length > 0; // Has child elements
          const containerHasSize = container.offsetWidth > 0 && container.offsetHeight > 0; // Has dimensions
          const hasRenderedContent = container.innerHTML.trim().length > 50; // Has HTML content

          // Primary Check: Rendering element exists AND container has content/size
          // This is the most reliable indicator
          if ((hasCanvas || hasIframe) && (hasContent || containerHasSize || hasRenderedContent)) {
            return true;
          }

          // Fallback 1: Substantial content with size
          if (hasRenderedContent && containerHasSize) {
            return true;
          }

          // Fallback 2: Any content with size (very lenient)
          if (hasContent && containerHasSize) {
            return true;
          }

          // Fallback 3: Ultra-lenient - any content exists
          // Catches edge cases where viewer renders but our checks miss it
          if (hasContent && container.innerHTML.trim().length > 0) {
            return true;
          }

          return false;
        };

        // Polling Strategy: Aggressive initial polling, then slower extended polling
        const startTime = Date.now();
        let pollCount = 0;
        const INITIAL_POLL_INTERVAL_MS = 100; // Poll every 100ms initially
        const EXTENDED_POLL_INTERVAL_MS = 500; // Poll every 500ms after initial period
        const INITIAL_POLL_DURATION_MS = 2000; // Initial polling period (2 seconds)
        const MAX_POLL_DURATION_MS = 5000; // Maximum total polling duration (5 seconds)
        const maxPolls = INITIAL_POLL_DURATION_MS / INITIAL_POLL_INTERVAL_MS; // 20 polls

        // Initial Polling: Fast polling for first 2 seconds
        const pollInterval = setInterval(() => {
          pollCount++;

          // Check if publication is ready
          if (checkPublicationReady()) {
            clearInterval(pollInterval);
            intervalsRef.current.delete(pollInterval); // Remove from tracking
            setPublicationLoaded(true);
          } else if (pollCount >= maxPolls) {
            // After initial polling period, switch to slower extended polling
            clearInterval(pollInterval);
            intervalsRef.current.delete(pollInterval); // Remove from tracking

            // Extended Polling: Slower polling for remaining time (up to 5 seconds total)
            const finalCheckInterval = setInterval(() => {
              if (checkPublicationReady()) {
                clearInterval(finalCheckInterval);
                intervalsRef.current.delete(finalCheckInterval); // Remove from tracking
                setPublicationLoaded(true);
              } else if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
                // Timeout: After 5 seconds total, assume ready to prevent infinite hang
                // The viewer is likely working even if our checks don't detect it
                clearInterval(finalCheckInterval);
                intervalsRef.current.delete(finalCheckInterval); // Remove from tracking
                const elapsedMs = Date.now() - startTime;
                const container = document.getElementById(containerId);
                log.warn("Publication ready timeout - assuming ready", {
                  elapsedMs,
                });
                if (container) {
                  setPublicationLoaded(true);
                } else {
                  log.error("Container missing at timeout - publicationLoaded remains false", { containerId, elapsedMs });
                }
              }
            }, EXTENDED_POLL_INTERVAL_MS);
            intervalsRef.current.add(finalCheckInterval); // Track extended interval
          }
        }, INITIAL_POLL_INTERVAL_MS);
        intervalsRef.current.add(pollInterval); // Track initial interval for cleanup
      } catch (error) {
        // Only critical errors in publication loading should stop the viewer
        // Clean up any intervals that were created before the error
        intervalsRef.current.forEach((id) => {
          clearInterval(id);
        });
        intervalsRef.current.clear();
        log.error("Error loading publication (critical)", error);
        handleViewerError(error);
        return;
      }

      // Note: Viewer settings (zoom, title, navigation, etc.) are applied in the handler setup useEffect
      // This ensures they're applied when the viewer is ready and publication is loaded
    },
    [viewerApi, viewerName, config, handleViewerError],
  );

  /**
   * Setup all event handlers when viewer is ready AND publication is loaded
   *
   * Strategy:
   * 1. Wait for viewer to be ready (API available)
   * 2. Wait for publication to load (DOM ready) OR 3-second timeout
   * 3. Set up all event handlers (save, export, hyperlink, markup, etc.)
   * 4. Mark handlers as ready (hides loader)
   *
   * This prevents race conditions where handlers are set up before DOM is ready,
   * which causes issues like: save not working, hyperlinks failing first click,
   * hand movement dialog not opening, etc.
   */
  useEffect(() => {
    if (!isViewerReady || !viewerApi || !viewerName) return;

    if (!publicationLoaded) {
      const fallbackCleanup = getPublicationLoadedFallbackCleanup(config, viewerName, setPublicationLoaded, cleanupFunctionsRef, safeSetTimeout, log);
      if (fallbackCleanup) return fallbackCleanup;
    }

    if (!publicationLoaded) return;

    const cleanupFunctions = [];
    const instanceId = config.instanceId || "default";
    setupAllHandlers({
      viewerApi,
      viewerName,
      config,
      viewerLinkRef,
      cleanupFunctions,
      instanceId,
      safeSetTimeout,
      log,
    });
    applyZoomAndSettings({
      viewerApi,
      viewerName,
      config,
      publicationLoaded,
      cleanupFunctions,
      safeSetTimeout,
      log,
      viewerLinkRef,
      TIMING,
    });
    doStateTransitionAndNotify({
      viewerStateRef,
      setViewerState,
      publicationLoaded,
      VIEWER_STATE,
      viewerApiRef,
      viewerName,
      config,
      containerIdRef,
      postMessageToParent,
      log,
    });

    return () => {
      cleanupFunctions.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          log.error("Error during cleanup", error);
        }
      });
    };
  }, [isViewerReady, viewerApi, viewerName, config, publicationLoaded, VIEWER_STATE]);

  /**
   * Publication Loading Effect: Automatically loads publication when viewer is ready.
   *
   * This effect monitors the viewer state and publication details, then triggers
   * publication loading when all conditions are met.
   *
   * Loading Conditions (all must be true):
   * 1. Viewer is in VIEWER_READY state (not READY - prevents infinite loop)
   * 2. Viewer API is available
   * 3. Publication details exist
   * 4. Not already loading (prevents concurrent loads)
   * 5. Different publication than last loaded (prevents reloading same publication)
   * 6. Load hasn't been attempted for this publication (prevents retry loops)
   *
   * Protection Mechanisms:
   * - loadAttemptedRef: Prevents retry loops for the same publication
   * - lastLoadedPublicationIdRef: Prevents reloading the same publication
   * - isLoadingRef: Prevents concurrent load operations
   */
  const lastLoadedPublicationIdRef = useRef(null); // Track last loaded publication ID
  const isLoadingRef = useRef(false); // Track if publication is currently loading
  const loadAttemptedRef = useRef(false); // Track if load was attempted for current publication

  useEffect(() => {
    const publicationId = config.publicationDetails?.id;
    const isDifferentPublication = publicationId && publicationId !== lastLoadedPublicationIdRef.current;

    // Check all loading conditions
    const shouldLoad =
      viewerState === VIEWER_STATE.VIEWER_READY && // CRITICAL: Only load when VIEWER_READY, not READY
      viewerApi && // Viewer API must be available
      config.publicationDetails && // Publication details must exist
      !isLoadingRef.current && // Prevent concurrent loads
      isDifferentPublication && // Only load if it's a different publication
      !loadAttemptedRef.current; // Prevent retry loops

    if (shouldLoad) {
      // Mark as loading and track publication
      isLoadingRef.current = true;
      lastLoadedPublicationIdRef.current = publicationId;
      loadAttemptedRef.current = true; // Mark that we've attempted to load this publication

      // Reset publication loaded state (new publication needs to load)
      setPublicationLoaded(false);

      // Event-driven: Load publication immediately - config state is already updated
      // No setTimeout(0) needed - React ensures state is updated before effect runs
      loadPublication(config.publicationDetails).finally(() => {
        // Clear loading flag after load completes (success or failure)
        isLoadingRef.current = false;
      });

      return () => {
        isLoadingRef.current = false;
      };
    }

    // Reset flags when publication ID changes (new publication detected)
    if (publicationId && publicationId !== lastLoadedPublicationIdRef.current) {
      isLoadingRef.current = false;
      loadAttemptedRef.current = false; // Allow loading new publication
    }
  }, [viewerState, viewerApi, config.publicationDetails, loadPublication, VIEWER_STATE]);

  /**
   * Message Handler: Handles postMessage communication from parent window.
   *
   * This function routes incoming messages to appropriate handler functions
   * based on message type. Supports both legacy and structured message formats.
   *
   * Message Types Handled:
   * - LOAD_PUBLICATION: Load a publication into the viewer
   * - SET_ACCESS_TOKEN: Update authentication token
   * - CLEAR_VIEWER: Clear current publication
   * - NAVIGATE_TO_PAGE: Navigate to specific page
   * - TRIGGER_SAVE_BUTTON_CLICK: Trigger save button programmatically
   * - TRIGGER_EXPORT_*: Various export operations
   * - GET_ALL_MARKUPS: Retrieve all markups
   * - RESTORE_MARKUPS: Restore markups from data
   *
   * @param {MessageEvent} event - The postMessage event from parent window
   */
  const handleMessage = useCallback(
    (event) => {
      // SECURITY: Multi-layer validation for srcdoc iframe architecture
      // Layer 1: Validate origin (for srcdoc iframes, origin is "null" or parent origin)
      // In iframe context, we validate against parent origin
      let parentOrigin = null;
      try {
        parentOrigin = globalThis.parent.location.origin;
      } catch (error) {
        log.warn("[BravaViewerIframe] Parent origin not accessible (cross-origin)", error);
        parentOrigin = "null";
      }

      if (!isValidSrcdocOrigin(event.origin, parentOrigin || "null")) {
        return; // Invalid origin — likely from extensions/other frames; ignore silently to avoid log spam
      }

      const data = event.data || {};

      // Layer 2: Validate message has required type field
      if (!data.type || typeof data.type !== "string") {
        return; // Not our protocol; ignore silently to avoid log spam
      }

      // Layer 3: Validate instanceId if provided in message (prevents cross-viewer interference)
      const messageInstanceId = data.instanceId || data.config?.instanceId;
      const currentInstanceId = config.instanceId || configRef.current?.instanceId || "default";

      if (messageInstanceId && messageInstanceId !== currentInstanceId && currentInstanceId !== "default") {
        log.debug("[BravaViewerIframe] Ignoring message - instanceId mismatch", {
          instanceId: currentInstanceId,
          messageInstanceId,
          messageType: data.type,
        });
        return;
      }

      // Layer 4: Message structure validation
      // Support both legacy and structured formats
      // Legacy format: No version field (backward compatibility)
      // New format: Has version field (validate structure)
      if (data.version && !isValidMessage(data)) {
        log.debug("[BravaViewerIframe] Ignoring message - invalid format", {
          instanceId: currentInstanceId,
          messageType: data.type,
          hasVersion: !!data.version,
        });
        return;
      }

      try {
        routeMessageByType(data, {
          containerIdRef,
          configRef,
          setConfig,
          setViewerState,
          VIEWER_STATE,
          loadPublication,
          viewerApiRef,
          config,
          viewerName,
        });
      } catch (error) {
        log.error("[BravaViewerIframe] Error handling message", error, {
          instanceId: config.instanceId || configRef.current?.instanceId,
          messageType: data.type,
          origin: event.origin,
        });
      }
    },
    [loadPublication, VIEWER_STATE, config.instanceId, configRef, viewerName],
  );

  /**
   * Message Listener Setup: Sets up postMessage communication with parent window.
   *
   * This effect:
   * 1. Registers message listener for parent communication
   * 2. Sends IFRAME_READY signal to parent (prevents race conditions)
   * 3. Sets up debug message logging (development only)
   *
   * The IFRAME_READY signal tells the parent that the iframe is ready to receive
   * configuration. This prevents the parent from sending messages before the
   * listener is set up.
   */
  useEffect(() => {
    globalThis.addEventListener("message", handleMessage);

    // Send Ready Signal: Notify parent that iframe is ready to receive config
    // This prevents race condition where parent sends before listener is ready
    try {
      // In iframe, parent is different from self; in top-level window, parent === self. Use != per S3403.
      if (globalThis.parent != null && globalThis.parent != globalThis) {
        const instanceIdToSend = configRef.current.instanceId || config.instanceId || "default";
        postMessageToParent({
          type: "IFRAME_READY",
          instanceId: instanceIdToSend,
        });
      } else {
        log.warn("Cannot send ready signal - no parent window or same window");
      }
    } catch (error) {
      log.error("Error sending ready signal", error);
    }

    // Cleanup: Remove event listeners on unmount
    return () => {
      globalThis.removeEventListener("message", handleMessage);
    };
  }, [handleMessage]);

  // Render viewer container and initializer
  return (
    <div className="brava-iframe-root">
      {/* Loading overlay - show until viewer is ready AND handlers are set up */}
      {/* BULLETPROOF: Use state directly, not derived flag, to avoid stale closure issues */}
      {viewerState !== VIEWER_STATE.READY && !error && (
        <div className="brava-iframe-loading-overlay">
          <div className="brava-iframe-message-box">
            Loading documents...
          </div>
        </div>
      )}
      {/* Error overlay */}
      {error && (
        <div className="brava-iframe-error-overlay">
          <div className="brava-iframe-message-box">
            <h3>Error Loading Viewer</h3>
            <p>{error.message || String(error)}</p>
          </div>
        </div>
      )}
      {/* Viewer container */}
      <div id={containerIdRef.current} className="brava-iframe-viewer-div" />
      {/* REFACTOR: Viewer initializer - single source of truth for config */}
      {/* Render if viewerAuthority exists in config (no window.viewerConfig fallback) */}
      {(() => {
        const viewerAuthority = config.viewerAuthority;
        const shouldRender = !viewerApi && !!viewerAuthority;

        return shouldRender;
      })() && <ViewerInitializer key={`viewer-init-${config.viewerAuthority || "none"}`} config={config} onViewerReady={handleViewerReady} onViewerError={handleViewerError} />}
    </div>
  );
});

BravaViewerIframe.propTypes = {
  config: PropTypes.shape({
    instanceId: PropTypes.string,
    containerId: PropTypes.string,
    accessToken: PropTypes.string,
    viewerAuthority: PropTypes.string.isRequired,
    loaderUrl: PropTypes.string,
    searchHost: PropTypes.string,
    markupHost: PropTypes.string,
    publicationDetails: PropTypes.object,
    layout: PropTypes.object,
    readonly: PropTypes.bool,
    ivTitle: PropTypes.string,
    initialPage: PropTypes.number,
  }),
};

BravaViewerIframe.defaultProps = {
  config: {},
};

export default BravaViewerIframe;
