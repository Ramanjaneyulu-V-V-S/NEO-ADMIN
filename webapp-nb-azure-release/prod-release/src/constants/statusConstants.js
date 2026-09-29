// ============================================================
// Centralized Status Constants
// ============================================================
// Single source of truth for all status string values used in
// comparisons across the codebase. Prevents typo-induced bugs.
// ============================================================

// --- Case Management Statuses ---
export const CASE_STATUS = Object.freeze({
  DRAFT: "Draft",
  OPEN: "Open",
  IN_PROGRESS: "In-Progress",
  APPROVED: "Approved",
  CLOSED: "Closed",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
});

// --- Digidak Correspondence Statuses ---
export const DIGIDAK_STATUS = Object.freeze({
  UNREAD: "Unread",
  OPENED: "Opened",
  ASSIGNED: "Assigned",
  ASSIGNED_HEAD: "Assigned Head",
  REASSIGNED: "Reassigned",
  REASSIGN_HEAD: "Reassign Head",
  INPROCESS: "Inprocess",
  RESPONDED: "Responded",
  CLOSED: "Closed",
  PUSHBACK: "Pushback",
  FOLLOW_UP: "Follow-Up",
  FOLLOW_UP_ALT: "Follow Up",
  SAVED: "Saved",
  RESPONSE_CLOSE: "Response Close",
});

// --- Decision / Action Values (Movement Register & Workflow) ---
export const DECISION = Object.freeze({
  PUSH_BACK: "Push Back",
  FORWARD: "Forward",
  ROUTING: "Routing",
  DELEGATE: "Delegate",
  APPROVED: "Approved",
});

// --- Digidak Entry Direction ---
export const ENTRY_DIRECTION = Object.freeze({
  INWARD: "Inward",
  OUTWARD: "Outward",
});

// --- Category Values ---
export const CATEGORY = Object.freeze({
  ACTIONABLE: "Actionable",
  INFORMATION: "Information",
  SECRET: "Secret",
});

// --- Document Tab / Category ---
export const DOC_CATEGORY = Object.freeze({
  DRAFT: "Draft",
  SUPPORTING: "Supporting",
  FINAL: "Final",
});

// --- Notification Preference Types ---
export const NOTIFICATION_TYPES = Object.freeze({
  ALL: "All",
  APPROVED: "Approved",
  CANCELLED: "cancelled",
  DELEGATE: "Delegate",
  PUSH_BACK: "Push Back",
  FORWARD: "Forward",
});

// --- Screen Names ---
export const SCREEN = Object.freeze({
  INBOX: "inboxScreen",
  OUTBOX: "outboxScreen",
  CASE: "caseScreen",
});

// --- Task Names ---
export const TASK_NAME = Object.freeze({
  EA: "EA",
  REVIEW: "Review",
  ROUTING: "Routing",
});
