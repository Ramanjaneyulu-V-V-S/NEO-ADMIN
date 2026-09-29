/**
 * ViewerEventTypes.js
 *
 * Central definition of all viewer event types used in the application.
 * These events are fired by the OpenText Brava viewer and routed through
 * the ViewerEventBus for proper instance isolation.
 *
 * Event Naming Convention:
 * - Native Brava events: {viewerName}-{eventType} (e.g., "BravaViewer-markupsLoaded")
 * - Event Bus uses just the eventType without prefix for simplicity
 *
 * @module ViewerEventTypes
 */

/**
 * Viewer event types
 * These map to native Brava events that are fired by the OpenText IV viewer.
 * Each event is verified from actual codebase usage.
 */
export const VIEWER_EVENTS = {
  // ============================================
  // Markup Events (Verified)
  // ============================================

  /**
   * Fired when markups are loaded from server
   * Source: markupHandlers.js:576, 866; BravaViewerIframe.jsx:858
   */
  MARKUPS_LOADED: "markupsLoaded",

  /**
   * Fired when a markup is added (either loaded or newly created)
   * Source: markupHandlers.js:588, 841, 1103
   * Detail: { markup: { id, type, ... } }
   */
  MARKUP_ADDED: "markupAdded",

  /**
   * Fired when markups are saved to server
   * Source: markupHandlers.js:615, 1106; saveHandlers.js:127
   */
  MARKUPS_SAVED: "markupsSaved",

  /**
   * Fired when a markup is selected by user
   * Source: markupHandlers.js:829
   * Detail: { markup: { id, ... } }
   */
  MARKUP_SELECTED: "markupSelected",

  /**
   * Fired when a markup is clicked
   * Source: markupHandlers.js:830
   * Detail: { markup: { id, ... } }
   */
  MARKUP_CLICKED: "markupClicked",

  /**
   * Fired when a markup becomes active
   * Source: markupHandlers.js:831
   */
  MARKUP_ACTIVATED: "markupActivated",

  /**
   * Fired when markups have unsaved changes
   * Source: markupPersistenceHandlers.js:35, 338
   */
  MARKUPS_DIRTY: "markupsDirty",

  // ============================================
  // Tool Events (Verified)
  // ============================================

  /**
   * Fired when a tool is activated (select, openSketch, etc.)
   * Source: markupHandlers.js:911
   * Detail: { tool: "toolName" }
   */
  TOOL_ACTIVATED: "toolActivated",

  // ============================================
  // Viewer/Publication Events (Verified)
  // ============================================

  /**
   * Fired when a publication (document) is loaded
   * Source: BravaViewerIframe.jsx:601, 809, 904; markupHandlers.js:637
   */
  PUBLICATION_LOADED: "publicationLoaded",

  /**
   * Fired when a page finishes rendering
   * Source: markupHandlers.js:625; hyperlinkHandlers.js:243
   * Detail: { pageNumber, ... }
   */
  PAGE_RENDER: "pageRender",

  /**
   * Fired when viewer is fully initialized and ready
   * This is a custom event we fire after Brava viewer is ready
   */
  VIEWER_INITIALIZED: "viewerInitialized",

  // ============================================
  // Save Events (Verified)
  // ============================================

  /**
   * Fired when save operation starts
   * Source: saveHandlers.js:126
   */
  SAVE: "save",

  /**
   * Fired when save operation completes successfully
   * Source: saveHandlers.js:128, 254, 368
   */
  SAVE_COMPLETE: "saveComplete",

  // ============================================
  // Custom Events (Application-specific)
  // ============================================

  /**
   * Fired when a hyperlink is clicked in a markup
   * This is a custom event dispatched by our code
   */
  HYPERLINK_CLICK: "hyperlinkClick",

  /**
   * Fired when navigation to a specific page is requested
   * This is a custom event for inter-viewer communication
   */
  NAVIGATE_TO_PAGE: "navigateToPage",
};

/**
 * Instance IDs for viewer panes
 * Used to identify which viewer instance an event belongs to
 */
export const INSTANCE_IDS = {
  /** Left pane viewer in split view */
  LEFT: "left-viewer",

  /** Right pane viewer in split view */
  RIGHT: "right-viewer",

  /** Single viewer (non-split view) */
  SINGLE: "single-viewer",

  /** Broadcast to all instances */
  BROADCAST: "*",

  /** Default instance ID before proper ID is assigned */
  DEFAULT: "default",
};

/**
 * Pane IDs used by SplitViewer
 */
export const PANE_IDS = {
  LEFT: "left",
  RIGHT: "right",
};

/**
 * Helper function to construct native Brava event name
 * @param {string} viewerName - The Brava viewer name (e.g., "BravaViewer")
 * @param {string} eventType - Event type from VIEWER_EVENTS
 * @returns {string} Full event name (e.g., "BravaViewer-markupsLoaded")
 */
export const getNativeEventName = (viewerName, eventType) => {
  return `${viewerName}-${eventType}`;
};

/**
 * Helper function to construct instanceId from paneId
 * @param {string} paneId - Pane ID ("left" or "right")
 * @returns {string} Instance ID (e.g., "left-viewer")
 */
export const getInstanceIdFromPane = (paneId) => {
  if (paneId === PANE_IDS.LEFT) return INSTANCE_IDS.LEFT;
  if (paneId === PANE_IDS.RIGHT) return INSTANCE_IDS.RIGHT;
  return INSTANCE_IDS.SINGLE;
};

/**
 * Helper function to extract paneId from instanceId
 * @param {string} instanceId - Instance ID (e.g., "left-viewer")
 * @returns {string|null} Pane ID ("left", "right") or null
 */
export const getPaneIdFromInstance = (instanceId) => {
  if (!instanceId || typeof instanceId !== "string") return null;
  if (instanceId.startsWith("left")) return PANE_IDS.LEFT;
  if (instanceId.startsWith("right")) return PANE_IDS.RIGHT;
  return null;
};

export default VIEWER_EVENTS;
