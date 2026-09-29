/**
 * Modular Message Handlers
 *
 * Separates message handling logic into focused, testable functions.
 * Each handler is responsible for a specific message type or category.
 */

import { MESSAGE_TYPES } from "./constants";
import { log } from "./logger";
import { setParentTargetOrigin, getParentTargetOriginForPostMessage } from "./postMessageProtocol";
import { triggerSaveButtonClick } from "./saveHandlers";
// Remove static imports to enable lazy loading and prevent circular dependencies
// import {
//   triggerExportDownload,
//   triggerExportButtonClick,
//   triggerExportButtonClickWithDropdown,
// } from "./exportHandlers";

import { getAllMarkups, restoreMarkups } from "./markupPersistenceHandlers";
import { TIMING } from "./constants";

/**
 * Handle LOAD_PUBLICATION message
 * Updates config and triggers publication loading
 */
export const handleLoadPublication = (
  data,
  configRef,
  setConfig,
  setViewerState,
  VIEWER_STATE,
  loadPublication
) => {
  // ... (unchanged)
  log.info("Received LOAD_PUBLICATION message", {
    hasConfig: !!data.config,
    hasPublicationDetails: !!data.publicationDetails,
    configKeys: data.config ? Object.keys(data.config) : [],
  });

  if (data.config) {
    // Full config sent - update entire config
    const newConfig = { ...configRef.current, ...data.config };
    configRef.current = newConfig;

    // Use parent's origin for postMessage target (satisfies "specify target origin" in iframe)
    if (data.config.parentOrigin) {
      setParentTargetOrigin(data.config.parentOrigin);
    }

    // Update React state (single source of truth - no window.viewerConfig mutation)
    setConfig((prevConfig) => {
      const mergedConfig = { ...prevConfig, ...data.config };
      return mergedConfig;
    });

    // Update state machine
    if (newConfig.viewerAuthority) {
      setViewerState(VIEWER_STATE.CONFIG_READY);
    }

    // Dispatch custom event for ViewerInitializer (if needed)
    try {
      window.dispatchEvent(
        new CustomEvent("viewerConfigUpdated", {
          detail: { config: newConfig },
        })
      );
    } catch (e) {
      log.warn("Failed to dispatch config update event", { error: e });
    }
  }

  if (data.publicationDetails) {
    // Update publication details
    const newConfig = {
      ...configRef.current,
      publicationDetails: data.publicationDetails,
    };
    configRef.current = newConfig;
    setConfig(newConfig);

    // BULLETPROOF: Only trigger load if viewer is ready and publication hasn't been loaded yet
    // The useEffect in BravaViewerIframe will handle loading when viewer is ready
    // This prevents duplicate loads from postMessage handler
    // Note: loadPublication will be called by the useEffect when viewerState transitions to VIEWER_READY
  }
};

/**
 * Handle SET_ACCESS_TOKEN message
 */
export const handleSetAccessToken = (data, viewerApiRef, setConfig) => {
  if (data.accessToken && viewerApiRef.current) {
    viewerApiRef.current.setHttpHeaders?.({
      Authorization: `Bearer ${data.accessToken}`,
    });
    setConfig((prev) => ({ ...prev, accessToken: data.accessToken }));
  }
};

/**
 * Handle CLEAR_VIEWER message
 */
export const handleClearViewer = (viewerApiRef) => {
  if (viewerApiRef.current) {
    viewerApiRef.current.clearViewer?.();
  }
};

/**
 * Handle NAVIGATE_TO_PAGE message
 * @param {Object} data - Message data containing page, instanceId, etc.
 * @param {Object} viewerApiRef - Ref to viewer API
 * @param {Object} configRef - Ref to viewer config (for instanceId check)
 */
export const handleNavigateToPage = (data, viewerApiRef, configRef) => {
  // CRITICAL: Filter by instanceId to prevent cross-instance navigation
  // If instanceId is provided in message, it must match this viewer's instanceId
  if (data.instanceId && configRef?.current?.instanceId && data.instanceId !== configRef.current.instanceId) {
    return; // This message is for a different viewer instance — ignore silently to avoid log spam
  }

  if (data.page !== undefined && data.page !== null && viewerApiRef.current) {
    const pageIndex = data.page - 1;
    // Event-driven: Execute immediately when message received (viewer is already ready)
    try {
      if (typeof viewerApiRef.current.setCurrentPage === "function") {
        viewerApiRef.current.setCurrentPage(pageIndex);
      }
    } catch (error) {
      log.error("Error navigating to page", error, { page: data.page });
    }
  }
};

/**
 * Handle TRIGGER_SAVE_BUTTON_CLICK message
 * @param {Object} viewerApiRef - Ref to viewer API
 * @param {string} viewerName - Name of the viewer
 * @param {string} instanceId - Instance ID for proper mutex scoping
 */
export const handleTriggerSave = (viewerApiRef, viewerName, instanceId) => {
  if (viewerApiRef.current) {
    triggerSaveButtonClick(viewerApiRef.current, viewerName, instanceId);
  }
};

/**
 * Handle TRIGGER_EXPORT_DOWNLOAD message
 */
export const handleTriggerExportDownload = (data, configRef) => {
  if (data.publicationData) {
    import("./exportHandlers")
      .then(({ triggerExportDownload }) => {
        triggerExportDownload(data.publicationData, configRef.current);
      })
      .catch((err) => log.error("Failed to load exportHandlers", err));
  }
};

/**
 * Handle TRIGGER_EXPORT_BUTTON_CLICK message
 */
export const handleTriggerExportButtonClick = () => {
  import("./exportHandlers")
    .then(({ triggerExportButtonClick }) => {
      triggerExportButtonClick();
    })
    .catch((err) => log.error("Failed to load exportHandlers", err));
};

/**
 * Handle TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK message
 */
export const handleTriggerExportWithDropdown = () => {
  import("./exportHandlers")
    .then(({ triggerExportButtonClickWithDropdown }) => {
      triggerExportButtonClickWithDropdown();
    })
    .catch((err) => log.error("Failed to load exportHandlers", err));
};

/**
 * Handle GET_ALL_MARKUPS message
 */
export const handleGetAllMarkups = (data, viewerApiRef) => {
  if (!viewerApiRef.current) {
    log.warn("Cannot get markups - viewer API not available");
    return;
  }

  try {
    const allMarkups = getAllMarkups(viewerApiRef.current);

    if (
      data.type === "GET_ALL_MARKUPS_FOR_SAVE" &&
      allMarkups &&
      allMarkups.length > 0
    ) {
      // Save directly via beforeunload message
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD",
            publicationId: data.publicationId,
            markups: allMarkups,
            timestamp: Date.now(),
          },
          getParentTargetOriginForPostMessage()
        );
      }
    } else if (data.requestId) {
      // Regular request with requestId - send response
      window.parent.postMessage(
        {
          type: "GET_ALL_MARKUPS_RESPONSE",
          requestId: data.requestId,
          publicationId: data.publicationId,
          markups: allMarkups,
          timestamp: Date.now(),
        },
        getParentTargetOriginForPostMessage()
      );
    }
  } catch (error) {
    log.error("Error getting all markups", error);
    if (data.requestId && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "GET_ALL_MARKUPS_RESPONSE",
          requestId: data.requestId,
          publicationId: data.publicationId,
          error: error.message,
          timestamp: Date.now(),
        },
        getParentTargetOriginForPostMessage()
      );
    }
  }
};

/**
 * Handle RESTORE_MARKUPS message
 */
export const handleRestoreMarkups = (data, viewerApiRef) => {
  log.info("Received RESTORE_MARKUPS message", {
    hasViewerApi: !!viewerApiRef.current,
    hasMarkups: !!data.markups,
    markupsCount: data.markups?.length || 0,
    publicationId: data.publicationId,
  });

  if (!viewerApiRef.current) {
    log.warn("Cannot restore markups - viewer API not available");
    window.parent.postMessage(
      {
        type: "RESTORE_MARKUPS_RESPONSE",
        publicationId: data.publicationId,
        success: false,
        error: "Viewer API not available",
        timestamp: Date.now(),
      },
      getParentTargetOriginForPostMessage()
    );
    return;
  }

  if (
    !data.markups ||
    !Array.isArray(data.markups) ||
    data.markups.length === 0
  ) {
    log.warn("Cannot restore markups - invalid markups data", {
      hasMarkups: !!data.markups,
      isArray: Array.isArray(data.markups),
      length: data.markups?.length,
    });
    window.parent.postMessage(
      {
        type: "RESTORE_MARKUPS_RESPONSE",
        publicationId: data.publicationId,
        success: false,
        error: "Invalid markups data",
        timestamp: Date.now(),
      },
      getParentTargetOriginForPostMessage()
    );
    return;
  }

  try {
    const success = restoreMarkups(viewerApiRef.current, data.markups);

    window.parent.postMessage(
      {
        type: "RESTORE_MARKUPS_RESPONSE",
        publicationId: data.publicationId,
        success,
        restoredCount: success ? data.markups.length : 0,
        timestamp: Date.now(),
      },
      getParentTargetOriginForPostMessage()
    );
  } catch (error) {
    log.error("Error restoring markups", error, {
      publicationId: data.publicationId,
      markupsCount: data.markups?.length,
    });
    window.parent.postMessage(
      {
        type: "RESTORE_MARKUPS_RESPONSE",
        publicationId: data.publicationId,
        success: false,
        error: error.message || String(error),
        timestamp: Date.now(),
      },
      getParentTargetOriginForPostMessage()
    );
  }
};
