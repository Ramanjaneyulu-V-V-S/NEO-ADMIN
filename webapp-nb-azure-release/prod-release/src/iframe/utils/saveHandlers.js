/**
 * Save Button Handlers
 *
 * Handles save button clicks, save events, and popover management.
 *
 * Key Features:
 * - Prevents activateTool() from being called during initial load
 * - Closes popovers (comment popovers, tool properties) when save button is clicked
 * - Detects save button clicks via DOM event listeners
 * - Handles save events from viewer API
 * - ViewerEventBus integration for event-driven architecture
 * - markViewerInitialized uses publicationLoaded + markupsLoaded events
 * - Error handling: All event handlers wrapped with try-catch to prevent single errors from breaking viewer
 */

import { viewerEventBus } from "./ViewerEventBus";
import { VIEWER_EVENTS } from "./ViewerEventTypes";
import { TIMING } from "./constants";
import { wrapHandler, logError } from "./errorHandling";
import { CleanupManager } from "./CleanupManager";
import { log } from "./logger";

// Track if viewer has finished initial load (prevents activateTool on load)
let viewerInitialized = false;

// Track event-based initialization state per instance
const initializationState = new Map();

// Module-level CleanupManager for save handlers
const saveHandlersCleanup = new CleanupManager('SaveHandlers');

// Track initialization timeouts per instance
const initializationTimeouts = new Map();

/**
 * Mark viewer as initialized
 * Called after initial load completes to allow activateTool() calls
 *
 * Uses publicationLoaded + markupsLoaded events to determine initialization.
 *
 * @param {string} [instanceId] - Optional instance ID for dual-viewer support
 */
export const markViewerInitialized = (instanceId) => {
  const effectiveInstanceId = instanceId || "default";

  // Clear any existing timeout for this instance
  const existingTimeout = initializationTimeouts.get(effectiveInstanceId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    initializationTimeouts.delete(effectiveInstanceId);
  }

  // Initialize state tracking for this instance
  if (!initializationState.has(effectiveInstanceId)) {
    initializationState.set(effectiveInstanceId, {
      publicationLoaded: false,
      markupsLoaded: false,
      subscriptions: [],
    });
  }

  const state = initializationState.get(effectiveInstanceId);

  // Check if already initialized
  if (state.publicationLoaded && state.markupsLoaded) {
    viewerInitialized = true;
    return;
  }

  // Subscribe to publicationLoaded event
  const unsubPub = viewerEventBus.subscribe(
    VIEWER_EVENTS.PUBLICATION_LOADED,
    effectiveInstanceId,
    () => {
      state.publicationLoaded = true;
      checkAndMarkInitialized(effectiveInstanceId);
    }
  );
  state.subscriptions.push(unsubPub);

  // Subscribe to markupsLoaded event
  const unsubMarkups = viewerEventBus.subscribe(
    VIEWER_EVENTS.MARKUPS_LOADED,
    effectiveInstanceId,
    () => {
      state.markupsLoaded = true;
      checkAndMarkInitialized(effectiveInstanceId);
    }
  );
  state.subscriptions.push(unsubMarkups);

  // Event-driven initialization: Rely ONLY on actual events
  // If events don't fire, cleanup happens on component unmount via CleanupManager
};

/**
 * Check if both events have fired and mark as initialized
 * @param {string} instanceId - Instance ID
 */
const checkAndMarkInitialized = (instanceId) => {
  const state = initializationState.get(instanceId);
  if (state && state.publicationLoaded && state.markupsLoaded) {
    viewerInitialized = true;
    cleanupInitializationState(instanceId);
  }
};

/**
 * Cleanup initialization state for an instance
 * @param {string} instanceId - Instance ID
 */
const cleanupInitializationState = (instanceId) => {
  const state = initializationState.get(instanceId);
  if (state) {
    // Unsubscribe from all events
    state.subscriptions.forEach((unsub) => {
      if (typeof unsub === "function") {
        unsub();
      }
    });
    initializationState.delete(instanceId);
  }

  // Clear timeout for this instance
  const timeout = initializationTimeouts.get(instanceId);
  if (timeout) {
    clearTimeout(timeout);
    initializationTimeouts.delete(instanceId);
  }
};

/**
 * Close popovers using documented Brava API methods
 *
 * Steps:
 * 1. Deselect all markups (closes comment popovers and tool properties)
 * 2. Activate select tool (deactivates active tool, closes tool properties popover)
 *
 * Only activates tool if viewer is initialized (prevents activation on initial load)
 *
 * @param {Object} api - Brava viewer API instance
 * @param {boolean} forceActivate - If true, activate tool even on initial load (for user actions)
 */
export const closePopovers = (api, forceActivate = false) => {
  if (!api) return;

  try {
    // Step 1: Deselect all markups (closes comment popovers and tool properties for selected markups)
    if (typeof api.setSelection === "function") {
      api.setSelection([]);
    }

    // Step 2: Activate select tool (deactivates active tool, closes tool properties popover)
    // Only activate if viewer is initialized OR explicitly forced (user action)
    if (
      (viewerInitialized || forceActivate) &&
      typeof api.activateTool === "function"
    ) {
      api.activateTool();
    }
  } catch (error) {
    // Silent error handling - popovers may already be closed
  }
};

/**
 * Close popovers after save operation completes
 * Force activate tool since this is a user-initiated save action
 * @param {Object} api - Brava viewer API instance
 */
export const closePopoversAfterSave = (api) => {
  // Force activate since this is a user-initiated save
  closePopovers(api, true);
};

/**
 * Handle save button click
 * Closes popovers when save button is clicked
 * Force activate tool since this is a user-initiated action
 * @param {Object} api - Brava viewer API instance
 * @param {string} context - Optional context string for logging
 */
export const handleSaveButtonClick = (api, context = "") => {
  try {
    const currentApi =
      api ||
      window.viewerApi ||
      window.currentViewerApi ||
      (window.viewerName && window[window.viewerName]);

    if (currentApi) {
      // Force activate since this is a user-initiated click
      closePopovers(currentApi, true);
    }
  } catch (error) {
    logError('SaveHandlers', 'handleSaveButtonClick', error, { context });
  }
};

/**
 * Setup save button click handlers
 *
 * Listens for save events from the viewer API and handles popover closing.
 * Distinguishes between initial load events and user-initiated save actions.
 *
 * Uses ViewerEventBus for event subscription.
 * Closes popovers immediately on saveComplete (no delay needed with proper event handling).
 *
 * @param {Object} api - Brava viewer API instance
 * @param {string} viewerName - Name of the viewer (e.g., "BravaViewer")
 * @param {string} [instanceId] - Optional instance ID for dual-viewer support
 */
export const setupSaveHandlers = (api, viewerName, instanceId) => {
  // Store handleSaveButtonClick locally - no global exposure needed
  const localHandleSaveButtonClick = (context) =>
    handleSaveButtonClick(api, context);

  // Track if this is the first save event (to distinguish initial load from user actions)
  let firstSaveEventFired = false;
  const markFirstSaveEvent = () => {
    if (!firstSaveEventFired) {
      firstSaveEventFired = true;
      // Mark viewer as initialized after first save event
      markViewerInitialized(instanceId);
    }
  };

  // Event-driven approach using ViewerEventBus
  const effectiveInstanceId = instanceId || viewerName || "default";

  // Subscribe to SAVE_COMPLETE via event bus
  viewerEventBus.subscribe(
    VIEWER_EVENTS.SAVE_COMPLETE,
    effectiveInstanceId,
    () => {
      const isInitialLoad = !firstSaveEventFired;
      markFirstSaveEvent();

      // CRITICAL FIX: Only call activateTool() after save completes (not during save)
      // With event-driven approach, we can respond immediately to saveComplete
      if (!isInitialLoad) {
        // The saveComplete event guarantees the save is done
        // We can close popovers immediately without delay
        closePopoversAfterSave(api);
      }
    }
  );

  // Also subscribe to MARKUPS_SAVED for tracking
  viewerEventBus.subscribe(
    VIEWER_EVENTS.MARKUPS_SAVED,
    effectiveInstanceId,
    () => {
      markFirstSaveEvent();
    }
  );

  // Subscribe to SAVE event for tracking
  viewerEventBus.subscribe(
    VIEWER_EVENTS.SAVE,
    effectiveInstanceId,
    () => {
      markFirstSaveEvent();
    }
  );
};

/**
 * Detect and handle save button clicks via DOM event listeners
 *
 * Uses capture phase to catch clicks early, before other handlers.
 * Detects save button by data-testid, aria-label, and className.
 * Also handles SVG children of save buttons.
 *
 * @param {Object} api - Brava viewer API instance
 * @returns {Function} Cleanup function to remove event listeners
 */
export const setupSaveButtonClickDetection = (api) => {
  const handleDocumentClickUnsafe = (e) => {
    // Check for save button by data-testid
    const saveButton = e.target.closest('button[data-testid="saveButton"]');
    if (saveButton) {
      const testId = saveButton.getAttribute("data-testid");
      const ariaLabel = saveButton.getAttribute("aria-label");
      const className = saveButton.className || "";

      // Check if this is the save button with unsaved markups
      if (
        testId === "saveButton" &&
        ariaLabel &&
        ariaLabel.startsWith("Save") &&
        className.includes("ot-SaveButton-dirty")
      ) {
        handleSaveButtonClick(api, "with unsaved markups");
      }
    }

    // Check for save menu button
    const saveMenuButton = e.target.closest(
      'button[data-testid="saveMenuButton"], a[data-testid="saveMenuButton"]'
    );
    if (saveMenuButton) {
      handleSaveButtonClick(api, "save menu button");
    }

    // Check for save button via SVG (children of save button)
    const svgElement = e.target.closest("svg");
    if (svgElement) {
      const parentSaveButton = svgElement.closest(
        'button[data-testid="saveButton"]'
      );
      if (parentSaveButton) {
        const saveTestId = parentSaveButton.getAttribute("data-testid");
        const saveAriaLabel = parentSaveButton.getAttribute("aria-label");
        const saveClassName = parentSaveButton.className || "";

        if (
          saveTestId === "saveButton" &&
          saveAriaLabel &&
          saveAriaLabel.startsWith("Save") &&
          saveClassName.includes("ot-SaveButton-dirty")
        ) {
          handleSaveButtonClick(api, "via SVG, with unsaved markups");
        }
      }

      const parentSaveMenuButton = svgElement.closest(
        'button[data-testid="saveMenuButton"], a[data-testid="saveMenuButton"]'
      );
      if (parentSaveMenuButton) {
        handleSaveButtonClick(api, "via SVG, save menu button");
      }
    }
  };

  // Wrap handler with error handling to prevent errors from breaking save functionality
  const handleDocumentClick = wrapHandler(handleDocumentClickUnsafe, 'SaveHandlers', 'handleDocumentClick');

  // Use capture phase to catch events early
  document.addEventListener("click", handleDocumentClick, true);

  // Return cleanup function
  return () => {
    document.removeEventListener("click", handleDocumentClick, true);
  };
};

/**
 * Handle TRIGGER_SAVE_BUTTON_CLICK message from parent
 * @param {Object} api - Brava viewer API instance
 */
// Mutex to prevent multiple concurrent saves per viewer instance
const activeSaves = new Set();

// Export activeSaves for cleanup in unmount scenarios (module-scoped, not global)
export { activeSaves };

/**
 * Handle fallback save path (More Options menu)
 *
 * Uses MutationObserver to detect when menu opens.
 *
 * @param {string} lockKey - Lock key for mutex
 * @param {string} viewerName - Name of the viewer instance
 * @param {string} _instanceId - Instance ID for proper scoping (unused but kept for API consistency)
 */
const handleFallbackSavePath = (lockKey, viewerName, _instanceId) => {
  const moreOptionsButton = document.querySelector('button[id="MoreOptions.toggle"]');

  if (moreOptionsButton) {
    try {
      // Set mutex lock for fallback path
      activeSaves.add(lockKey);

      // Set up event-based lock release for fallback path
      const saveCompleteEvent = viewerName + "-saveComplete";
      let lockReleased = false;
      let menuObserverTimeoutId = null; // Timeout for MutationObserver
      let ultimateSafetyTimeoutId = null; // Ultimate safety timeout
      let menuObserver = null;

      const releaseLock = (reason) => {
        if (!lockReleased) {
          lockReleased = true;
          activeSaves.delete(lockKey);
          // Clear both timeouts properly
          if (menuObserverTimeoutId) {
            clearTimeout(menuObserverTimeoutId);
            menuObserverTimeoutId = null;
          }
          if (ultimateSafetyTimeoutId) {
            clearTimeout(ultimateSafetyTimeoutId);
            ultimateSafetyTimeoutId = null;
          }
          window.removeEventListener(saveCompleteEvent, handleSaveComplete);
          if (menuObserver) {
            menuObserver.disconnect();
            menuObserver = null;
          }
        }
      };

      const handleSaveComplete = () => {
        releaseLock("fallback, event-based");
      };

      window.addEventListener(saveCompleteEvent, handleSaveComplete);

      // Click More Options
      moreOptionsButton.click();

      // Function to find and click save menu button
      const findAndClickSaveButton = () => {
        // Check if lock still held (component might have unmounted)
        if (!activeSaves.has(lockKey)) {
          releaseLock("component unmounted");
          return true; // Indicates we should stop looking
        }

        const saveMenuButton =
          document.querySelector('button[data-testid="saveMenuButton"]') ||
          document.querySelector('a[data-testid="saveMenuButton"]');

        if (saveMenuButton) {
          try {
            saveMenuButton.click();
            return true; // Found and clicked
          } catch (clickError) {
            log.error("[SaveHandlers] Error clicking save menu button", clickError);
            releaseLock("click error");
            return true; // Stop looking
          }
        }
        return false; // Not found yet
      };

      // Use MutationObserver to detect when save menu button appears
      menuObserver = new MutationObserver((mutations, observer) => {
        if (findAndClickSaveButton()) {
          observer.disconnect();
          menuObserver = null;
        }
      });

      // Observe document body for menu additions
      menuObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Track observer for cleanup - will auto-disconnect on component destroy
      saveHandlersCleanup.addObserver(menuObserver);

      // Also try immediately in case menu is already open
      if (findAndClickSaveButton()) {
        if (menuObserver) {
          menuObserver.disconnect();
          menuObserver = null;
        }
      }

      // Event-driven: Observer will keep watching until save button appears
      // Cleanup happens automatically via CleanupManager on component destroy

    } catch (err) {
      log.error("[SaveHandlers] Error in fallback save", err);
      activeSaves.delete(lockKey);
    }
  } else {
    log.warn("[SaveHandlers] No save button or fallback options found");
  }
};

/**
 * Trigger save button click with event-based mutex protection
 * @param {Object} api - Brava viewer API instance
 * @param {string} viewerName - Name of the viewer instance (required for event names)
 * @param {string} instanceId - Instance ID for proper scoping (prevents cross-instance locking)
 */
export const triggerSaveButtonClick = (api, viewerName, instanceId) => {
  // Use instanceId:viewerName for proper scoping (fixes cross-instance locking)
  const lockKey = instanceId ? `${instanceId}:${viewerName || "default"}` : (viewerName || "default");

  // MUTEX: Check if save is already in progress for this viewer
  if (activeSaves.has(lockKey)) {
    log.warn(`[SaveHandlers] Save in progress for ${lockKey}, skipping concurrent request`);
    return;
  }

  // Find save button using multiple selectors
  const saveButtonSelectors = [
    'button[data-testid="saveButton"]',
    'button[aria-label*="All markups saved"]',
    "button.ot-SaveButton",
    ".ot-SaveButton",
  ];

  let saveButton = null;
  for (const selector of saveButtonSelectors) {
    saveButton = document.querySelector(selector);
    if (saveButton) break;
  }

  if (saveButton) {
    try {
      // Set mutex lock
      activeSaves.add(lockKey);

      // Set up event-based lock release
      const saveCompleteEvent = viewerName + "-saveComplete";
      let lockReleased = false;
      let safetyTimeoutId = null;

      // Handler to release lock on save completion
      const handleSaveComplete = () => {
        if (!lockReleased) {
          lockReleased = true;
          activeSaves.delete(lockKey);
          clearTimeout(safetyTimeoutId);
          window.removeEventListener(saveCompleteEvent, handleSaveComplete);
        }
      };

      // Listen for saveComplete event from OpenText IV
      window.addEventListener(saveCompleteEvent, handleSaveComplete);

      // Click save button
      saveButton.click();

      // Event-driven: Rely on saveComplete event to release lock
      // Cleanup happens automatically via CleanupManager on component destroy
      // Track event listener for cleanup
      saveHandlersCleanup.addEventListener(window, saveCompleteEvent, handleSaveComplete);

    } catch (error) {
      log.error("[SaveHandlers] Error clicking save button", error);
      activeSaves.delete(lockKey); // Release lock on error
    }
  } else {
    // Fallback path: More Options → Save Menu Button
    handleFallbackSavePath(lockKey, viewerName, instanceId);
  }
};
