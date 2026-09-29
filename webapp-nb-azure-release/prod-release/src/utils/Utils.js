/**
 * Formats a given date into Indian Standard Time (IST) in the format:
 * YYYY-MM-DDTHH:mm:ss.SSS+0530
 * @param {Date} [date=new Date()] - The date to format.
 * @returns {string} - The formatted IST date string.
 */

export const fromAndToDateFormat = (date) => {
  if (!date) return ""; // or return null / undefined as per your use case
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error("Invalid date provided to formatDateInIST");
  }

  const pad = (num, size = 2) => String(num).padStart(size, "0");

  const IST_OFFSET_MINUTES = 330; // UTC+5:30
  const localTime = date.getTime();
  const localOffset = date.getTimezoneOffset();
  const istTime = new Date(localTime + (IST_OFFSET_MINUTES + localOffset) * 60000);

  const yyyy = istTime.getFullYear();
  const MM = pad(istTime.getMonth() + 1);
  const dd = pad(istTime.getDate());
  const HH = pad(istTime.getHours());
  const mm = pad(istTime.getMinutes());
  const ss = pad(istTime.getSeconds());
  const SSS = pad(istTime.getMilliseconds(), 3);

  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}.${SSS}+0530`;
};

//case priority style
export const getPriorityClass = (priority) => {
  const classMap = {
    Urgent: "priority-immediate",
    Secret: "priority-urgent",
  };
  return classMap[priority] || "priority-default";
};

/**
 * Parses date strings safely — handles both ISO format ("2026-03-16T07:41:43.000Z")
 * and DD/MM/YYYY format ("11/03/2026, 02:38:49 PM") which new Date() cannot parse reliably.
 */
const parseDate = (dateString) => {
  if (!dateString) return null;

  // Try native parsing first (works for ISO strings)
  const native = new Date(dateString);
  if (!isNaN(native.getTime())) return native;

  // Handle "DD/MM/YYYY, HH:MM:SS AM/PM" format
  const match = String(dateString).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const [, dd, mm, yyyy, hh, min, sec, period] = match;
    let hours = parseInt(hh, 10);
    if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    return new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), hours, parseInt(min, 10), parseInt(sec, 10));
  }

  // Handle "DD/MM/YYYY, HH:MM AM/PM" (without seconds)
  const matchNoSec = String(dateString).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchNoSec) {
    const [, dd, mm, yyyy, hh, min, period] = matchNoSec;
    let hours = parseInt(hh, 10);
    if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    return new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), hours, parseInt(min, 10));
  }

  return null;
};

export const formatDateCell = (dateString) => {
  if (!dateString) return "";
  const d = parseDate(dateString);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${min} ${ampm}`;
};

export const formatDateCellWithSec = (dateString) => {
  if (!dateString) return "";
  const d = parseDate(dateString);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${min}:${sec} ${ampm}`;
};

export const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = parseDate(dateString);
  if (!d) return "";
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${String(hours).padStart(2, "0")}:${min}:${sec} ${ampm}`;
};

export const formatDateOnly = (dateString) => {
  if (!dateString) return "";
  const d = parseDate(dateString);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format a date to YYYY-MM-DDTHH:mm:ss string.
 * Used for API date params across the app.
 * @param {Date|string} date
 * @param {boolean} [endOfDay=false] - If true, sets time to 23:59:59 (for to_date params)
 * @returns {string} e.g. "2026-02-20T00:00:00" or "2026-02-20T23:59:59"
 */
export const formatDateTimeParam = (date, endOfDay = false) => {
  if (!date) return "";
  const d = new Date(date);
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const themeColor = ["tertiary", "inverse", "primary", "secondary", "info", "light", "dark", "success", "warning", "error"];

// date format string to kendo dropdown

export const toKendoDate = (str) => {
  if (!str) return null;

  const [day, month, year] = str.split("/").map(Number);

  // validate
  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);
};

export const getValidDueDateForPrefill = (dueDateStr) => {
  const parsedDate = toKendoDate(dueDateStr);

  // if null / invalid → today
  if (!parsedDate) return new Date();

  const today = new Date();

  // normalize time to avoid time comparison bugs
  today.setHours(0, 0, 0, 0);
  parsedDate.setHours(0, 0, 0, 0);

  // if past → today, else → parsed date
  return parsedDate < today ? new Date() : parsedDate;
};

// Get financial year from date
export const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const startYear = month >= 4 ? year : year - 1;
  const endYear = String(startYear + 1).slice(-2);

  return `${startYear}-${endYear}`;
};

// Create options
export const createOptions = (values) => values.map((v) => ({ text: v, value: v }));

export const formatLanguage = (lang) => {
  if (!lang) return "";
  const map = {
    E: "English",
    H: "Hindi",
    B: "Bilingual",
    O: "Others",
  };
  return map[lang] || lang;
};

export const getSecureRandomNumber = () => {
  return window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
};

export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatEndOfDay = (date) => {
  if (!date) return "";
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
