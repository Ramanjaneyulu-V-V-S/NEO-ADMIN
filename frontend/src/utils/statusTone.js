/**
 * Shared color mapping for the case-status domain (STATUS_OPTIONS:
 * In-Progress, Approved, Closed, Cancelled) used across ReportsPage,
 * CaseInbox2Page, and InboxPage. Without this, every status value rendered
 * the same `canopy` tone regardless of which value it was.
 */
const CASE_STATUS_TONE = {
    'in-progress': 'harvest',
    approved: 'canopy',
    closed: 'neutral',
    cancelled: 'danger',
};

// Badge `tone` prop value for a case status string.
export const caseStatusTone = (status) =>
    CASE_STATUS_TONE[(status || '').toString().toLowerCase()] || 'neutral';

// Tailwind class fragment (`bg-x text-x`) for hand-rolled pills that don't
// go through the shared `Badge` component.
const TONE_CLASSES = {
    neutral: 'bg-slate-100 text-slate-600',
    canopy: 'bg-canopy-tint text-canopy',
    harvest: 'bg-harvest/15 text-harvest',
    danger: 'bg-danger-tint text-danger',
};

export const caseStatusPillCls = (status) => TONE_CLASSES[caseStatusTone(status)];
