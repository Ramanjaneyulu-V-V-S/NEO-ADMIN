// Centralized constants for iframe handlers (message types, timing, selectors)


// Message Types for postMessage communication
export const MESSAGE_TYPES = {
  // Requests (parent -> iframe)
  REQUEST: 'request',

  // Responses (iframe -> parent)
  RESPONSE: 'response',

  // Events (bidirectional, unsolicited)
  EVENT: 'event',

  // Specific event types
  VIEWER_READY: 'viewerReady',
  VIEWER_ERROR: 'viewerError',
  VIEWER_LOADING: 'viewerLoading',
  HYPERLINK_CLICK: 'HYPERLINK_CLICK',
  PDF_EXPORT_DOWNLOAD_SUCCESS: 'PDF_EXPORT_DOWNLOAD_SUCCESS',
  PDF_EXPORT_DOWNLOAD_FAILURE: 'PDF_EXPORT_DOWNLOAD_FAILURE',

  // Request actions
  LOAD_PUBLICATION: 'LOAD_PUBLICATION',
  SET_ACCESS_TOKEN: 'SET_ACCESS_TOKEN',
  CLEAR_VIEWER: 'CLEAR_VIEWER',
  NAVIGATE_TO_PAGE: 'NAVIGATE_TO_PAGE',
};

// Timing constants (in milliseconds)
export const TIMING = {
  // Export dialog delays
  EXPORT_DIALOG_DELAY: 500,
  EXPORT_MENU_DELAY: 600,
  EXPORT_DIALOG_LONG_DELAY: 800,

  // Sidebar delays
  SIDEBAR_WIDTH_DELAY: 100,
  SIDEBAR_CHECK_DELAY: 150,

  // Navigation delays
  NAVIGATION_DELAY: 100,

  // Polling intervals (for element waiting)
  POLLING_INTERVAL: 100, // Base polling interval
  POLLING_MAX_ATTEMPTS: 30, // Default timeout (3 seconds at 100ms)
  POLLING_MAX_ATTEMPTS_LONG: 50, // Longer timeout for primary paths (5 seconds at 100ms)

  // Publication loading delays
  PUBLICATION_LOADED_TIMEOUT: 2000,
  MARKUPS_LOADED_TIMEOUT: 2000,

  // Save handler timeouts
  SAVE_INITIALIZATION_TIMEOUT: 5000, // Timeout for viewer initialization (5 seconds)
  SAVE_MENU_OBSERVER_TIMEOUT: 5000, // MutationObserver timeout for menu detection (5 seconds)
  SAVE_ULTIMATE_SAFETY_TIMEOUT: 10000, // Ultimate safety timeout for fallback save path (10 seconds, reduced from 20)
  SAVE_LOCK_RELEASE_TIMEOUT: 15000, // Timeout to release save lock if event doesn't fire (15 seconds)
};

// Sidebar configuration
export const SIDEBAR = {
  DEFAULT_WIDTH: 200,
  MIN_VISIBLE_WIDTH: 5,
  SIDEBAR_NAMES: ['tabContainerWithMarkups', 'leftTabContainer'],
};

// Export button selectors (consolidated)
export const EXPORT_SELECTORS = {
  EXPORT_BUTTON: [
    'button[id="exportButton"]',
    'button[data-testid="exportButton"]',
    'button.exportButton',
    '#exportButton'
  ],
  EXPORT_SUBMIT: [
    'button[id="exportSubmit"]',
    'button[data-testid="exportSubmit"]',
    'button.exportSubmit',
    '#exportSubmit'
  ],
  MENU_OPTIONS: [
    'button[id="menuOptions"]',
    'button[id="MenuOptions"]',
    'button[data-testid="menuOptions"]',
    'button.menuOptions',
    '#menuOptions',
    'button[id="MoreOptions.toggle"]'
  ],
  MENU_EXPORT: [
    'button[id="menuExport"]',
    'a[id="menuExport"]',
    'button[id="MenuExport"]',
    'a[id="MenuExport"]',
    'button[data-testid="menuExport"]',
    'a[data-testid="menuExport"]'
  ]
};

// Sidebar selectors
export const SIDEBAR_SELECTORS = [
  '.Pane.vertical.Pane1',
  '[data-sidebar-name="tabContainerWithMarkups"]',
  '[data-sidebar-name="leftTabContainer"]'
];

