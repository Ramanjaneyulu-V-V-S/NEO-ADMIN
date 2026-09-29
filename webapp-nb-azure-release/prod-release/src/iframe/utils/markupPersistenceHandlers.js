import { postMessageToParent, getParentTargetOriginForPostMessage } from "./postMessageProtocol";
import { log } from "./logger";

/**
 * Markup Persistence Handlers
 *
 * Handles client-side persistence of unsaved markups to prevent data loss.
 *
 * Features:
 * - markupsDirty events: Listens for and forwards dirty count to parent
 * - Periodic save: Saves unsaved markups every 30 seconds (more reliable than beforeunload)
 * - beforeunload backup: Also saves on page unload as backup
 * - visibilitychange: Saves when page becomes hidden
 * - Markup restoration: Provides functions to restore markups from storage
 *
 * Strategy: Periodic save is primary mechanism (beforeunload may not execute).
 */

/**
 * Setup markup dirty event listener
 * Listens for markupsDirty events from the viewer and forwards to parent
 * @param {Object} api - Brava viewer API instance
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {string} publicationId - Publication ID for tracking
 */
export const setupMarkupDirtyListener = (api, viewerName, publicationId) => {
  if (!api || !viewerName || !publicationId) {
    log.warn("[MarkupPersistence] Missing required parameters for setupMarkupDirtyListener");
    return null;
  }

  // Listen for markupsDirty event from viewer
  // Format: {viewerName}-markupsDirty
  const markupsDirtyEvent = viewerName + "-markupsDirty";

  const handleMarkupsDirty = (event) => {
    try {
      // Extract dirty count from event detail
      // The markupsDirty event detail contains: { detail: { count: number } }
      const dirtyCount = event.detail?.count ?? event.detail ?? 0;

      // Forward to parent window
      postMessageToParent({
        type: "MARKUPS_DIRTY",
        publicationId,
        dirtyCount,
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error("[MarkupPersistence] Error handling markupsDirty event", error);
    }
  };

  globalThis.addEventListener(markupsDirtyEvent, handleMarkupsDirty);

  // Return cleanup function
  return () => {
    globalThis.removeEventListener(markupsDirtyEvent, handleMarkupsDirty);
  };
};

/**
 * Get all loaded markups (including unsaved) from the viewer API
 * @param {Object} api - Brava viewer API instance
 * @returns {Array|null} Array of markups in JSON format or null if error
 */
export const getAllMarkups = (api) => {
  if (!api) {
    log.warn("[MarkupPersistence] API not available");
    return null;
  }

  try {
    // Use getAllLoadedMarkups() API to get all markups including unsaved
    if (typeof api.getAllLoadedMarkups === "function") {
      const allMarkups = api.getAllLoadedMarkups();

      if (allMarkups) {
        // Convert to JSON array format
        // getAllLoadedMarkups returns an object keyed by markup ID
        // Convert to array for easier storage/restoration
        const markupsArray = Object.values(allMarkups);

        return markupsArray;
      }
    } else {
      log.warn("[MarkupPersistence] getAllLoadedMarkups API not available");
    }
  } catch (error) {
    log.error("[MarkupPersistence] Error getting all markups", error);
  }

  return null;
};

const tryRestoreWithAddMarkups = (api, markups) => {
  if (typeof api.addMarkups !== "function") {
    return 0;
  }

  try {
    api.addMarkups(markups);
    return markups.length;
  } catch (addMarkupsError) {
    log.warn("[MarkupPersistence] addMarkups failed, trying individual addMarkup", {
      error: addMarkupsError,
    });
    return 0;
  }
};

/**
 * Restore markups to the viewer
 * @param {Object} api - Brava viewer API instance
 * @param {Array} markups - Array of markup objects to restore
 * @returns {boolean} True if restoration was successful
 */
export const restoreMarkups = (api, markups) => {
  if (!api || !markups || !Array.isArray(markups) || markups.length === 0) {
    log.warn("[MarkupPersistence] Cannot restore markups - invalid parameters", {
      hasApi: !!api,
      markupsType: typeof markups,
      markupsLength: markups?.length,
    });
    return false;
  }

  try {
    let restoredCount = tryRestoreWithAddMarkups(api, markups);

    if (restoredCount > 0) {
      return true;
    }

    // Strategy 2: Try addMarkup (singular) for each markup
    if (typeof api.addMarkup === "function") {
      markups.forEach((markup, index) => {
        try {
          // Ensure markup has required properties
          if (!markup || typeof markup !== "object") {
            log.warn("[MarkupPersistence] Invalid markup object at index", { index });
            return;
          }

          // Add markup one by one
          api.addMarkup(markup);
          restoredCount++;
        } catch (markupError) {
          log.warn("[MarkupPersistence] Error restoring individual markup", {
            index,
            error: markupError,
            markupId: markup?.id || "no-id",
          });
        }
      });

      if (restoredCount > 0) {
        return true;
      }
    }

    // Strategy 3: Try updateMarkups if markups already exist (update existing)
    if (typeof api.updateMarkups === "function" && !restoredCount) {
      try {
        // Get existing markups to see if any match
        const existingMarkups = api.getAllLoadedMarkups?.() || {};
        const existingIds = Object.keys(existingMarkups);

        // Try to update existing markups or add new ones
        markups.forEach((markup) => {
          try {
            if (markup.id && existingIds.includes(markup.id)) {
              // Update existing markup
              api.updateMarkups([markup.id], markup);
              restoredCount++;
            } else {
              // Try to add as new markup using updateMarkups with create flag
              // This might not work, but worth trying
            }
          } catch (updateError) {
            log.warn("[MarkupPersistence] Error updating markup", {
              error: updateError,
              markupId: markup?.id,
            });
          }
        });
      } catch (updateError) {
        log.warn("[MarkupPersistence] updateMarkups strategy failed", {
          error: updateError,
        });
      }
    }

    // Strategy 4: Try loadMarkups if available
    if (!restoredCount && typeof api.loadMarkups === "function") {
      try {
        api.loadMarkups(markups);
        restoredCount = markups.length;
        return restoredCount > 0;
      } catch (loadError) {
        log.warn("[MarkupPersistence] loadMarkups failed", {
          error: loadError,
        });
      }
    }

    if (!restoredCount) {
      log.error("[MarkupPersistence] No restoration method worked. Available APIs", null, {
        addMarkup: typeof api.addMarkup,
        addMarkups: typeof api.addMarkups,
        updateMarkups: typeof api.updateMarkups,
        setMarkups: typeof api.setMarkups,
        loadMarkups: typeof api.loadMarkups,
        getAllLoadedMarkups: typeof api.getAllLoadedMarkups,
      });
      return false;
    }

    return restoredCount > 0;
  } catch (error) {
    log.error("[MarkupPersistence] Error restoring markups", error);
    return false;
  }
};

/**
 * Setup periodic save of unsaved markups (debounced)
 * This is more reliable than beforeunload which may not execute
 * @param {Object} api - Brava viewer API instance
 * @param {string} publicationId - Publication ID for storage key
 * @param {number} interval - Save interval in milliseconds (default: 30000 = 30 seconds)
 */

export const saveUnsavedMarkups = (api, publicationId, viewerName) => {
  if (!api || !publicationId) return;

  try {
    const markups = api.getAllLoadedMarkups();
    if (markups) {
      if (globalThis.parent && globalThis.parent != globalThis) {
        globalThis.parent.postMessage(
          {
            type: "SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD",
            publicationId,
            markups,
            timestamp: Date.now(),
          },
          getParentTargetOriginForPostMessage(),
        );
      }
    }
  } catch (e) {
    log.error("[MarkupPersistence] Error saving markups", e);
  }
};

export const handleBeforeUnload = (api, publicationId, viewerName) => {
  saveUnsavedMarkups(api, publicationId, viewerName);
};

export const cleanupMarkupPersistence = () => {
  // No-op for now, but exported for API consistency
};

/**
 * Setup periodic save of unsaved markups (debounced)
 * This is more reliable than beforeunload which may not execute
 * @param {Object} api - Brava viewer API instance
 * @param {string} publicationId - Publication ID for storage key
 * @param {number} interval - Save interval in milliseconds (default: 30000 = 30 seconds)
 */
export const setupPeriodicSave = (api, publicationId, viewerName, interval = 30000) => {
  if (!api || !publicationId || !viewerName) {
    return null;
  }

  let saveIntervalId = null;
  let lastDirtyCount = 0;

  const saveUnsavedMarkups = () => {
    try {
      // Check if we have unsaved markups by tracking dirty count
      // Only save if dirty count > 0 (has unsaved markups)
      if (!lastDirtyCount) {
        return; // No unsaved markups, skip save
      }

      // Get all markups (includes unsaved ones when dirty count > 0)
      const allMarkups = getAllMarkups(api);
      const hasMarkups = allMarkups && allMarkups.length > 0;
      if (!hasMarkups) {
        return;
      }

      const hasParentWindow = globalThis.parent && globalThis.parent != globalThis;
      if (hasParentWindow) {
        postMessageToParent({
          type: "SAVE_UNSAVED_MARKUPS",
          publicationId,
          markups: allMarkups,
          timestamp: Date.now(),
        });
        return;
      }

      // Fallback: Save directly if same origin
      try {
        const safePublicationId = encodeURIComponent(publicationId);
        const storageKey = `brava_unsaved_markups_${safePublicationId}`;
        const storageData = {
          publicationId,
          markups: allMarkups,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(storageData));
      } catch (storageError) {
        log.error("[MarkupPersistence] Error saving to localStorage", storageError);
      }
    } catch (error) {
      log.error("[MarkupPersistence] Error in periodic save", error);
    }
  };

  // Track dirty count changes from markupsDirty events
  const markupsDirtyEvent = viewerName + "-markupsDirty";
  const handleMarkupsDirty = (event) => {
    lastDirtyCount = event.detail?.count ?? event.detail ?? 0;
  };
  globalThis.addEventListener(markupsDirtyEvent, handleMarkupsDirty);

  // Set up periodic save
  saveIntervalId = setInterval(saveUnsavedMarkups, interval);

  // Also save on beforeunload as backup
  const handleBeforeUnload = () => {
    try {
      const allMarkups = getAllMarkups(api);
      const hasMarkups = allMarkups && allMarkups.length > 0;
      const hasParentWindow = globalThis.parent && globalThis.parent != globalThis;
      if (hasMarkups && hasParentWindow) {
        // Post message to parent (may not complete before unload, but periodic save handles it)
        postMessageToParent({
          type: "SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD",
          publicationId,
          markups: allMarkups,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      // beforeunload is a best-effort backup; log and continue
      log.warn("[MarkupPersistence] Error in beforeunload backup save", error);
    }
  };

  // Also save on visibilitychange for better reliability
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden" && lastDirtyCount > 0) {
      saveUnsavedMarkups();
    }
  };

  globalThis.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Return cleanup function
  return () => {
    if (saveIntervalId) {
      clearInterval(saveIntervalId);
    }
    globalThis.removeEventListener("beforeunload", handleBeforeUnload);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    globalThis.removeEventListener(markupsDirtyEvent, handleMarkupsDirty);
  };
};
