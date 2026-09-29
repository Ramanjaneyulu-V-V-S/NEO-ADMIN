/**
 * Integrated Brava Viewer – iframe message validation and type handlers
 *
 * Pure logic for validating postMessage events and dispatching by type.
 * Used only by IntegratedBravaViewer. No side effects beyond what callers pass in (log, ctx, handlers).
 */

import { MESSAGE_TYPES } from "./bravaConstants";
import { isValidSrcdocOrigin } from "../../../iframe/utils/postMessageProtocol";
import { handlePdfDownload, handlePdfDownloadFailure } from "./pdfDownloadHandler";

/**
 * Validates iframe message (DOM, source, origin, instanceId). Returns true if message should be processed.
 * Preserves same security checks and logging as inline validation.
 *
 * @param {MessageEvent} event - Message event from iframe
 * @param {React.RefObject<HTMLIFrameElement|null>} iframeRef - Ref to the viewer iframe
 * @param {string} instanceId - Current viewer instance id (e.g. "default")
 * @param {Object} log - Logger with .warn (caller passes from "../../iframe/utils/logger")
 * @returns {boolean}
 */
export function isValidIntegratedViewerMessage(event, iframeRef, instanceId, log) {
  if (!iframeRef.current || !document.contains(iframeRef.current)) {
    return false; // No iframe yet or unmounted — ignore silently to avoid log spam
  }
  const ourIframeWindow = iframeRef.current.contentWindow;
  if (!ourIframeWindow) {
    return false; // contentWindow not ready — ignore silently to avoid log spam
  }
  // Silently ignore messages from other sources (extensions, other iframes). No warn to avoid console spam.
  if (event.source !== ourIframeWindow) {
    return false;
  }
  if (!isValidSrcdocOrigin(event.origin, globalThis.location.origin)) {
    log.warn("[IntegratedBravaViewer] Message rejected: invalid origin", {
      instanceId,
      origin: event.origin,
      expectedOrigin: globalThis.location.origin,
    });
    return false;
  }
  const messageInstanceId = event.data?.instanceId;
  if (messageInstanceId && messageInstanceId !== instanceId && instanceId !== "default") {
    log.warn("[IntegratedBravaViewer] Message rejected: instanceId mismatch", {
      instanceId,
      messageInstanceId,
    });
    return false;
  }
  return true;
}

/**
 * Handles PDF export message types. Returns true if type was handled.
 *
 * @param {string} type - event.data.type
 * @param {Object} data - event.data
 * @returns {boolean}
 */
export function handlePdfMessage(type, data) {
  if (type === MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_SUCCESS) {
    handlePdfDownload(data, { showSuccessAlert: false, showErrorAlert: false });
    return true;
  }
  if (type === MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_FAILURE) {
    handlePdfDownloadFailure(data, { showErrorAlert: false });
    return true;
  }
  return false;
}

/**
 * Handles viewer lifecycle message types. Returns true if type was handled.
 * ctx: { onViewerInitialized, onViewerLoading, onViewerError, onViewerReady }
 *
 * @param {string} type - event.data.type
 * @param {Object} data - event.data
 * @param {Object} ctx - Callbacks from IntegratedBravaViewer
 * @returns {boolean}
 */
export function handleViewerLifecycleMessage(type, data, ctx) {
  switch (type) {
    case MESSAGE_TYPES.VIEWER_INITIALIZED:
    case "viewerInitialized":
      ctx.onViewerInitialized();
      return true;
    case MESSAGE_TYPES.VIEWER_LOADING:
    case "viewerLoading":
      ctx.onViewerLoading();
      return true;
    case MESSAGE_TYPES.VIEWER_ERROR:
    case "viewerError":
      ctx.onViewerError(data);
      return true;
    case "viewerReady":
    case "VIEWER_READY":
      ctx.onViewerReady();
      return true;
    default:
      return false;
  }
}

/**
 * Handles markup message types. Returns true if type was handled.
 * ctx: { setDirty, saveMarkups, storeMarkups, markRestored } — markRestored(data) sets ref when data.success
 *
 * @param {string} type - event.data.type
 * @param {Object} data - event.data
 * @param {Object} ctx - Callbacks from IntegratedBravaViewer
 * @returns {boolean}
 */
export function handleMarkupMessage(type, data, ctx) {
  switch (type) {
    case MESSAGE_TYPES.MARKUPS_DIRTY:
    case "MARKUPS_DIRTY":
      ctx.setDirty(data.dirtyCount ?? 0);
      return true;
    case "SAVE_UNSAVED_MARKUPS":
    case "SAVE_UNSAVED_MARKUPS_BEFORE_UNLOAD":
      ctx.saveMarkups(data);
      return true;
    case MESSAGE_TYPES.GET_ALL_MARKUPS_RESPONSE:
    case "GET_ALL_MARKUPS_RESPONSE":
      ctx.storeMarkups(data);
      return true;
    case "RESTORE_MARKUPS_RESPONSE":
      ctx.markRestored(data);
      return true;
    default:
      return false;
  }
}

/**
 * Logs click-related message types (no state change). Returns true if type was one of these.
 *
 * @param {string} type - event.data.type
 * @param {Object} data - event.data
 * @param {function} logDebug - Debug logger (caller passes from component)
 * @returns {boolean}
 */
export function handleClickLogOnly(type, data, logDebug) {
  switch (type) {
    case "IFRAME_CLICK_EVENT":
      logDebug("Received Click Event from Iframe:", data?.clickInfo);
      return true;
    case "PDF_EXPORT_CLICK_EVENT":
      logDebug("PDF Export Click Event from Iframe:", data?.clickInfo);
      return true;
    case "EXPORT_PDF_BUTTON_CLICKED":
      logDebug("Export PDF Button Clicked from Iframe:", data?.buttonDetails);
      return true;
    case "EXPORT_PDF_BUTTON_ERROR":
      logDebug("Export PDF Button Error from Iframe:", data?.error);
      return true;
    default:
      return false;
  }
}
