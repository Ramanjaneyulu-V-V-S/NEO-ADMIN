import api from '../api/axios';

/**
 * Record a client-side action the backend never sees as a mutation — chiefly
 * XLSX/CSV exports built in the browser via exceljs. Best-effort: failures are
 * swallowed so a logging hiccup never blocks or alerts the user.
 *
 * @param {Object}  event
 * @param {string}  event.action      human-readable label, e.g. "Export User Directory"
 * @param {string} [event.target]     what was exported (report name, filter summary)
 * @param {string} [event.targetType] coarse category, e.g. "report" | "user" | "metadata"
 * @param {number} [event.count]      row/record count where meaningful
 * @param {string} [event.detail]     free-text extra context
 */
export async function recordExport({ action, target, targetType, count, detail } = {}) {
  try {
    await api.post('/audit/event', { action, target, targetType, count, detail });
  } catch {
    /* best-effort audit — ignore */
  }
}
