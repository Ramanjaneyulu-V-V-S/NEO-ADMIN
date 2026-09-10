// Shared date/time formatting for user-facing timestamps.
//
// The Documentum REST API returns ISO-8601 UTC strings (e.g.
// "2026-09-02T14:13:56.000+00:00"). These helpers render them in the browser's
// local timezone (every user is IST) as "DD/MM/YYYY hh:mm:ss AM/PM" — matching
// the legacy CMS app's formatDateCellWithSec / formatDateOnly.

// Parse an ISO string (or Date) safely. Returns a valid Date or null.
const parse = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const pad = (n) => String(n).padStart(2, '0');

// "19/08/2026 10:02:57 AM" — local timezone. Falsy/invalid -> placeholder.
export const formatDateTime = (value, placeholder = '—') => {
    const d = parse(value);
    if (!d) return placeholder;
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} `
         + `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
};

// "19/08/2026" — local timezone. Falsy/invalid -> placeholder.
export const formatDate = (value, placeholder = '—') => {
    const d = parse(value);
    if (!d) return placeholder;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
