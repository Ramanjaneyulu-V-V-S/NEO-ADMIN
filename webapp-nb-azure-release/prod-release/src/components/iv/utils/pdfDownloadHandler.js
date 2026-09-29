/**
 * Centralized PDF Download Handler
 * 
 * Single source of truth for PDF download logic across all viewer components.
 * Prevents duplicate downloads and provides consistent download behavior.
 * 
 * Features:
 * - Global deduplication using multiple checks
 * - Thread-safe processing with Set tracking
 * - Automatic cleanup of download links
 * - Error handling with fallback options
 * - Support for success/error callbacks
 */

import { log } from '../../../iframe/utils/logger';

// Global state for deduplication
const processedDownloads = new Set();
const processingDownloads = new Set();
let globalFuse = false;
let cleanupIntervalId = null;

// Cleanup old entries periodically
const startCleanupInterval = () => {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(() => {
    // Clean up processed downloads older than 10 seconds
    if (processedDownloads.size > 100) {
      processedDownloads.clear();
    }
    if (processingDownloads.size > 100) {
      processingDownloads.clear();
    }
  }, 30000);
};

// Start cleanup interval on module load
if (typeof globalThis !== 'undefined') {
  startCleanupInterval();
}

/**
 * Generate unique download ID from message data
 * @param {Object} data - Download message data
 * @returns {string} Unique download ID
 */
const generateDownloadId = (data) => {
  const messageId = data.messageId || `${data.filename}-${Date.now()}`;
  const downloadUrl = data.downloadUrl || '';
  const dataHash = data.fileData ? data.fileData.substring(0, 200) : '';
  return messageId || `${data.filename}-${downloadUrl}-${dataHash}`;
};

/**
 * Check if download should be processed
 * @param {string} downloadId - Unique download ID
 * @returns {boolean} True if download should proceed
 */
const shouldProcessDownload = (downloadId) => {
  // Check 1: Already processed
  if (processedDownloads.has(downloadId)) {

    return false;
  }

  // Check 2: Global fuse (prevents concurrent downloads)
  if (globalFuse) {

    return false;
  }

  // Check 3: Currently processing
  if (processingDownloads.has(downloadId)) {

    return false;
  }

  return true;
};

/**
 * Check if download link already exists in DOM
 * @param {string} filename - Filename to check
 * @returns {boolean} True if link exists
 */
const hasExistingDownloadLink = (filename) => {
  const safeFilename = CSS.escape(filename || 'export.pdf');
  const existingLink = document.querySelector(`a[download="${safeFilename}"]`);
  return !!existingLink;
};

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  'image/tiff',
  'image/tif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Validate and parse download data into blob and sanitized filename. Throws on invalid data.
 * @param {Object} data - Download message data
 * @returns {{ blob: Blob, sanitizedFilename: string }}
 */
const validateAndParseDownloadData = (data) => {
  if (typeof data.fileData !== 'string' || data.fileData.trim().length === 0) {
    throw new Error('Invalid base64 file data');
  }
  const controlCharClass = Array.from({ length: 0x20 }, (_, i) => '\\x' + i.toString(16).padStart(2, '0')).join('');
  const sanitizedFilename = data.filename?.replaceAll(new RegExp('[<>:"/\\\\|?*' + controlCharClass + ']', 'g'), '_') || 'export.pdf';
  let binaryString;
  try {
    binaryString = atob(data.fileData);
  } catch (base64Error) {
    throw new Error('Invalid base64 encoding: ' + base64Error.message);
  }
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    const codePoint = binaryString.codePointAt(i);
    bytes[i] = codePoint === undefined ? 0 : codePoint;
  }
  const mimeType = ALLOWED_MIME_TYPES.has(data.mimeType) ? data.mimeType : 'application/pdf';
  const blob = new Blob([bytes], { type: mimeType });
  return { blob, sanitizedFilename };
};

/**
 * Create link, trigger download, remove link, schedule URL revoke. Throws on click failure.
 * @param {Blob} blob - Blob to download
 * @param {string} sanitizedFilename - Safe filename
 */
const triggerDownloadLink = (blob, sanitizedFilename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizedFilename;
  link.style.display = 'none';
  link.setAttribute('aria-hidden', 'true');
  document.body.appendChild(link);
  try {
    link.click();
  } catch (clickError) {
    if (link.parentNode) link.remove();
    URL.revokeObjectURL(url);
    throw clickError;
  }
  if (link.parentNode) link.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (revokeError) {
      log.warn('[PdfDownloadHandler] Failed to revoke object URL', { error: revokeError });
    }
  }, 100);
};

/**
 * Schedule post-download cleanup (fuse, processedDownloads) and run success callbacks.
 * @param {string} downloadId - Download ID
 * @param {Object} data - Original message data
 * @param {Object} options - onSuccess, showSuccessAlert
 */
const schedulePostDownloadCleanupAndCallbacks = (downloadId, data, options) => {
  processedDownloads.add(downloadId);
  processingDownloads.delete(downloadId);
  setTimeout(() => {
    globalFuse = false;
  }, 3000);
  setTimeout(() => {
    processedDownloads.delete(downloadId);
  }, 10000);
  if (options.onSuccess) options.onSuccess(data);
  if (options.showSuccessAlert && typeof globalThis !== 'undefined' && typeof globalThis.showSweetAlert === 'function') {
    try {
      globalThis.showSweetAlert({ icon: 'success', title: 'Success', text: 'PDF exported successfully!' });
    } catch (alertError) {
      log.warn('[PdfDownloadHandler] Failed to show success alert', alertError);
    }
  }
};

/**
 * Clean up on error, run error callbacks, optionally try fallback URL.
 * @param {Error} error - Error that occurred
 * @param {string} downloadId - Download ID
 * @param {Object} data - Original message data (may have downloadUrl)
 * @param {Object} options - onError, showErrorAlert
 */
const handleDownloadFailure = (error, downloadId, data, options) => {
  processedDownloads.delete(downloadId);
  globalFuse = false;
  if (options.onError) options.onError(error);
  if (options.showErrorAlert) {
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.showSweetAlert === 'function') {
        globalThis.showSweetAlert({
          icon: 'error',
          title: 'Download Failed',
          text: 'Failed to download the exported PDF. Please try again.',
        });
      } else {
        log.error('[PdfDownloadHandler] Failed to download PDF', error);
      }
    } catch (alertError) {
      log.warn('[PdfDownloadHandler] Failed to show error alert', alertError);
      log.error('[PdfDownloadHandler] Failed to download PDF', error);
    }
  }
  if (data.downloadUrl) {
    try {
      const urlObj = new URL(data.downloadUrl, globalThis.location.origin);
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        globalThis.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        log.warn('[PdfDownloadHandler] Invalid URL protocol', { protocol: urlObj.protocol });
      }
    } catch (openError) {
      log.error('[PdfDownloadHandler] Failed to open fallback URL', openError);
    }
  }
};

/**
 * Centralized PDF download handler
 *
 * @param {Object} data - Download message data
 * @param {Object} options - Optional configuration
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @param {boolean} options.showSuccessAlert - Show success alert (default: false)
 * @param {boolean} options.showErrorAlert - Show error alert (default: false)
 * @returns {Promise<boolean>} True if download was processed, false if skipped
 */
export const handlePdfDownload = async (data, options = {}) => {
  const { onSuccess, onError, showSuccessAlert = false, showErrorAlert = false } = options;

  if (!data.fileData || !data.filename) {
    log.warn('[PdfDownloadHandler] Missing required data (fileData or filename)');
    if (onError) onError(new Error('Missing required download data'));
    return false;
  }

  const downloadId = generateDownloadId(data);
  if (!shouldProcessDownload(downloadId) || hasExistingDownloadLink(data.filename)) {
    return false;
  }

  globalFuse = true;
  processingDownloads.add(downloadId);

  try {
    const { blob, sanitizedFilename } = validateAndParseDownloadData(data);
    if (processedDownloads.has(downloadId)) {
      globalFuse = false;
      processingDownloads.delete(downloadId);
      return false;
    }

    triggerDownloadLink(blob, sanitizedFilename);
    schedulePostDownloadCleanupAndCallbacks(downloadId, data, { onSuccess, showSuccessAlert });
    return true;
  } catch (error) {
    log.error('[PdfDownloadHandler] Error downloading PDF', error);
    handleDownloadFailure(error, downloadId, data, { onError, showErrorAlert });
    return false;
  }
};

/**
 * Handle PDF export failure
 * 
 * @param {Object} data - Error message data
 * @param {Object} options - Optional configuration
 * @param {Function} options.onError - Error callback
 * @param {boolean} options.showErrorAlert - Show error alert (default: false)
 */
export const handlePdfDownloadFailure = (data, options = {}) => {
  const {
    onError,
    showErrorAlert = false,
  } = options;

  const errorMessage = data.error || 'Unknown export error';
  log.error('[PdfDownloadHandler] PDF export failed', new Error(errorMessage));

  // Release fuse on failure
  globalFuse = false;

  // Call error callback
  if (onError) {
    onError(new Error(errorMessage));
  }

  // Show error alert if requested
  // Note: Alerts should be handled by the calling component via onError callback
  // This avoids import issues and keeps the handler decoupled
  if (showErrorAlert) {
    // Try to use showSweetAlert if available globally (set by calling component)
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.showSweetAlert === 'function') {
        globalThis.showSweetAlert({
          icon: 'error',
          title: 'Export Failed',
          text: errorMessage || 'Failed to export PDF. Please try again.',
        });
      } else {
        // Fallback: just log to console if alert not available
        log.error('[PdfDownloadHandler] PDF export failed', new Error(errorMessage));
      }
    } catch (alertError) {
      // Alert is optional; log both the alert error and original error context
      log.error('[PdfDownloadHandler] Failed to show error alert', alertError);
      log.error('[PdfDownloadHandler] PDF export failed', new Error(errorMessage));
    }
  }
};
