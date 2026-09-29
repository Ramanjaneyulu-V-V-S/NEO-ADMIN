/**
 * Build API filter params from a Kendo grid filter descriptor.
 * Shared between Cases.jsx and useServerSideGrid.js.
 *
 * @param {Object} filter - Kendo filter descriptor ({ filters: [...] })
 * @param {Object} filterFieldMap - Maps grid column field names to API parameter names
 * @param {Set} [dateFilterFields] - Fields that need date formatting (optional)
 * @returns {Object|null} - API filter params or null if none
 */
export const buildActiveFilters = (filter, filterFieldMap, dateFilterFields) => {
  if (!filter?.filters) return null;
  const result = {};
  filter.filters.forEach((f) => {
    const apiKey = filterFieldMap[f.field];
    if (apiKey && f.value) {
      if (dateFilterFields?.has(f.field)) {
        const d = new Date(f.value);
        const pad = (n) => String(n).padStart(2, "0");
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        result[apiKey] = formatted;
        result[`${apiKey}_`] = formatted;
      } else if (Array.isArray(apiKey)) {
        apiKey.forEach((k) => {
          result[k] = f.value;
        });
      } else {
        result[apiKey] = f.value;
      }
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};
