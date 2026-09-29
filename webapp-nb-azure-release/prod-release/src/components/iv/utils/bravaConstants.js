// Constants and initial state for Brava viewers


// Constants for better maintainability
export const CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 20, // Increased from 5 to 20 to handle large file processing (up to ~120 seconds)
  RETRY_DELAY: 6000, // Increased from 5000ms to 6000ms (6 seconds) for better server load management
  INITIALIZATION_TIMEOUT: 2000,
  SIDEBAR_WIDTH: 200,
  POLLING_INTERVAL: 500,
  VIEWER_READY_TIMEOUT: 120,
  VIEWER_CHECK_INTERVAL: 500,
};

// Publication status constants
export const PUBLICATION_STATUS = {
  COMPLETE: "complete",
  PENDING: "pending",
  ACTIVE: "active",
  PROCESSING: "processing",
  FAILED: "failed",
  ERROR: "error",
};

// Case status constants
export const CASE_STATUS = {
  NOTESHEET_ALLOWED: ["cancelled", "closed"],
  DOCUMENT_ALLOWED: true,
};

// Message types for postMessage communication
export const MESSAGE_TYPES = {
  HYPERLINK_CLICK: "HYPERLINK_CLICK",
  NAVIGATE_TO_PAGE: "NAVIGATE_TO_PAGE",
  PDF_EXPORT_DOWNLOAD_SUCCESS: "PDF_EXPORT_DOWNLOAD_SUCCESS",
  PDF_EXPORT_DOWNLOAD_FAILURE: "PDF_EXPORT_DOWNLOAD_FAILURE",
  VIEWER_INITIALIZED: "viewerInitialized",
  VIEWER_ERROR: "viewerError",
  VIEWER_LOADING: "viewerLoading",
  LOAD_PUBLICATION: "LOAD_PUBLICATION",
  SET_ACCESS_TOKEN: "SET_ACCESS_TOKEN",
  CLEAR_VIEWER: "CLEAR_VIEWER",
  IFRAME_CLICK_EVENT: "IFRAME_CLICK_EVENT",
  PDF_EXPORT_CLICK_EVENT: "PDF_EXPORT_CLICK_EVENT",
  TRIGGER_SAVE_BUTTON_CLICK: "TRIGGER_SAVE_BUTTON_CLICK",
  TRIGGER_EXPORT_BUTTON_CLICK: "TRIGGER_EXPORT_BUTTON_CLICK",
  TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK: "TRIGGER_EXPORT_BUTTON_CLICK_WITH_DROPDOWN_FALLBACK",
  TRIGGER_EXPORT_DOWNLOAD: "TRIGGER_EXPORT_DOWNLOAD",
  IFRAME_READY: "IFRAME_READY",
  // Markup persistence messages
  MARKUPS_DIRTY: "MARKUPS_DIRTY",
  GET_ALL_MARKUPS: "GET_ALL_MARKUPS",
  GET_ALL_MARKUPS_RESPONSE: "GET_ALL_MARKUPS_RESPONSE",
  RESTORE_MARKUPS: "RESTORE_MARKUPS",
  SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD: "SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD",
};

// Shared toolbar button and layout styles for Brava viewer layout configs
export const TOOLBAR_BTN_BASE = { border: "none", borderRadius: "6px", padding: "8px 12px" };
export const TITLE_TEXT_STYLE = { marginLeft: "1em", fontSize: "14px", fontWeight: "600" };
export const TAB_PANE_STYLE = { backgroundColor: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "6px" };

// Shared pageLink config used by all viewer layout configurations
export const PAGE_LINK_CONFIG = {
  label: "🔗",
  svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
  toolTip: "Copy page reference",
  disabled: false,
  eventKey: "copyPageLinkButton",
};

// Business rule: Notesheet and documents have different copy link permissions
export const shouldShowCopyLinkButton = (ivTitle, caseStatus) => {
  if (!caseStatus) return false;

  const isNotesheet = ivTitle === "Notesheet";
  const allowedStatuses = isNotesheet ? CASE_STATUS.NOTESHEET_ALLOWED : CASE_STATUS.DOCUMENT_ALLOWED;

  if (typeof allowedStatuses === "boolean") {
    return allowedStatuses;
  }

  return allowedStatuses.includes(caseStatus.toLowerCase());
};

// Builds the right toolbar array for readonly viewers
// showCopyLink=true includes the copy page link button, false omits it
export const buildRightToolbar = (showCopyLink) => {
  const base = [
    { component: "SearchTextInput" },
    { component: "SearchToggleButton", style: { ...TOOLBAR_BTN_BASE, marginLeft: "4px" } },
  ];

  if (!showCopyLink) return base;

  return [
    ...base,
    {
      component: "CustomButton",
      layoutKey: "pageLink",
      eventKey: "copyPageLinkButton",
      buttonClasses: "ot-iv-hoverButtonFilledLight",
      style: { ...TOOLBAR_BTN_BASE, marginLeft: "4px", color: "white" },
    },
  ];
};

// Initial state for viewer components
export const INITIAL_STATE = {
  publicationDetails: null,

  isLoading: false,
  viewerError: null,
  viewerInitialized: false,
  accessToken: null,
  loaderScript: null,
  isInitializing: false,
};

