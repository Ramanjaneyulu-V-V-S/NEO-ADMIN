/**
 * Base Viewer Helpers - Shared utilities for BaseReadOnlyViewer
 *
 * Extracted from BaseReadOnlyViewer.jsx to reduce code duplication.
 * These are slightly different from IntegratedBravaViewer helpers due to
 * different viewer requirements (readonly vs editable).
 */

import { MESSAGE_TYPES } from "./bravaConstants";
import { isValidSrcdocOrigin } from "../../../iframe/utils/postMessageProtocol";
import { getSrcdocIframeTargetOrigin, getParentTargetOrigin } from "./postMessageTargets";

/**
 * Validate IFRAME_READY message origin and source
 * @param {MessageEvent} event - Message event
 * @param {React.RefObject} iframeRef - Ref to iframe element
 * @param {string} instanceId - Viewer instance ID
 * @param {string} viewerName - Name for logging
 * @param {Object} log - Logger object
 * @returns {boolean} - True if event is valid
 */
export function isValidIframeReadyEvent(event, iframeRef, instanceId, viewerName, log) {
    const isFromOurIframe = iframeRef.current?.contentWindow === event.source;
    if (!isFromOurIframe && iframeRef.current?.contentWindow) {
        log.warn(`[${viewerName}] IFRAME_READY rejected: not from our iframe`, {
            instanceId,
            hasContentWindow: !!iframeRef.current?.contentWindow,
        });
        return false;
    }
    if (!isFromOurIframe && !isValidSrcdocOrigin(event.origin, globalThis.location.origin)) {
        log.warn(`[${viewerName}] IFRAME_READY rejected: invalid origin`, {
            instanceId,
            origin: event.origin,
            expectedOrigin: globalThis.location.origin,
        });
        return false;
    }
    const messageInstanceId = event.data?.instanceId;
    if (messageInstanceId && messageInstanceId !== instanceId && instanceId !== "readonly" && instanceId !== "default") {
        log.warn(`[${viewerName}] IFRAME_READY rejected: instanceId mismatch`, {
            instanceId,
            messageInstanceId,
        });
        return false;
    }
    return true;
}

/**
 * Send publication and token to iframe after IFRAME_READY
 * @param {Object} ctx - Context with all required dependencies
 */
export function sendConfigAndTokenAfterIframeReady(ctx) {
    const {
        iframeRef,
        configSentRef,
        state,
        instanceId,
        containerId,
        createLayout,
        bravaconfig,
        ivTitle,
        page,
        viewerName,
        log,
    } = ctx;

    const readonlyLayout = createLayout();
    const viewerConfig = {
        instanceId,
        containerId,
        accessToken: state.accessToken,
        viewerAuthority: bravaconfig.viewerAuthority,
        loaderUrl: `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js`,
        searchHost: import.meta.env.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
        markupHost: import.meta.env.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
        publicationDetails: state.publicationDetails,
        layout: readonlyLayout,
        readonly: true,
        ivTitle,
        initialPage: page !== null && page !== undefined ? page : null,
        parentOrigin: getParentTargetOrigin(),
    };
    const message = {
        type: MESSAGE_TYPES.LOAD_PUBLICATION,
        publicationDetails: viewerConfig.publicationDetails,
        config: viewerConfig,
    };
    try {
        iframeRef.current.contentWindow.postMessage(message, getSrcdocIframeTargetOrigin());
    } catch (error) {
        log.error(`[${viewerName}] Error sending config after IFRAME_READY`, error);
        configSentRef.current = false;
        throw error;
    }
    const tokenMessage = { type: MESSAGE_TYPES.SET_ACCESS_TOKEN, accessToken: state.accessToken };
    try {
        iframeRef.current.contentWindow.postMessage(tokenMessage, getSrcdocIframeTargetOrigin());
    } catch (error) {
        log.error(`[${viewerName}] Error sending access token after IFRAME_READY`, error);
    }
}

/**
 * Validate iframe message origin, source, and instance ID
 * @param {MessageEvent} event - Message event
 * @param {React.RefObject} iframeRef - Ref to iframe element
 * @param {string} instanceId - Viewer instance ID
 * @param {string} viewerName - Name for logging
 * @param {Object} log - Logger object
 * @returns {boolean} - True if event is valid
 */
export function isValidIframeMessageEvent(event, iframeRef, instanceId, viewerName, log) {
    const isFromOurIframe = iframeRef.current?.contentWindow
        ? event.source === iframeRef.current.contentWindow
        : false;
    // Silently ignore messages from other sources (extensions, other iframes). No warn to avoid console spam.
    if (!isFromOurIframe) return false;
    if (!isValidSrcdocOrigin(event.origin, globalThis.location.origin)) {
        log.warn(`[${viewerName}] Message rejected: invalid origin`, {
            instanceId,
            origin: event.origin,
            expectedOrigin: globalThis.location.origin,
        });
        return false;
    }
    const messageInstanceId = event.data?.instanceId;
    if (messageInstanceId && messageInstanceId !== instanceId && instanceId !== "readonly" && instanceId !== "default") {
        log.warn(`[${viewerName}] Message rejected: instanceId mismatch`, {
            instanceId,
            messageInstanceId,
        });
        return false;
    }
    return true;
}

/**
 * Handle PDF and viewer lifecycle messages
 * @param {MessageEvent} event - Message event
 * @param {Object} ctx - Context with updateState, logDebug, viewerName, log
 */
export function handlePdfExportAndViewerMessages(event, ctx) {
    const { updateState, logDebug, viewerName, log } = ctx;
    const type = event.data.type;

    if (type === MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_SUCCESS) {
        logDebug("PDF export download success - using centralized handler");
        import("./pdfDownloadHandler")
            .then(({ handlePdfDownload }) => {
                handlePdfDownload(event.data, {
                    showSuccessAlert: false,
                    showErrorAlert: false,
                    onError: (err) => {
                        updateState({ viewerError: `Failed to download PDF: ${err.message}` });
                    },
                });
            })
            .catch((importError) => {
                log.error(`[${viewerName}] Failed to import pdfDownloadHandler`, importError);
                updateState({ viewerError: "Failed to download PDF" });
            });
        return;
    }
    if (type === MESSAGE_TYPES.PDF_EXPORT_DOWNLOAD_FAILURE) {
        logDebug("PDF export failed - using centralized handler");
        import("./pdfDownloadHandler")
            .then(({ handlePdfDownloadFailure }) => {
                handlePdfDownloadFailure(event.data, {
                    showErrorAlert: false,
                    onError: (err) => {
                        updateState({ viewerError: `PDF export failed: ${err.message}` });
                    },
                });
            })
            .catch((importError) => {
                log.error(`[${viewerName}] Failed to import pdfDownloadHandler`, importError);
                updateState({ viewerError: "PDF export failed" });
            });
        return;
    }
    if (type === MESSAGE_TYPES.VIEWER_ERROR) {
        logDebug("Viewer error:", event.data.error);
        updateState({ viewerError: event.data.error });
        return;
    }
    if (type === MESSAGE_TYPES.VIEWER_INITIALIZED) {
        logDebug("Viewer initialized successfully");
        updateState({ viewerInitialized: true, isLoading: false, isInitializing: false });
    }
}

/**
 * Retry iframe script loading when enabled
 * @param {MessageEvent} event - Message event
 * @param {Object} ctx - Context with enableScriptRetry, updateState, etc.
 */
export function handleIframeScriptLoadFailure(event, ctx) {
    const {
        enableScriptRetry,
        updateState,
        initializationAttemptedRef,
        configSentRef,
        logDebug,
        viewerName,
    } = ctx;

    if (!enableScriptRetry) return;
    logDebug("Script load failure in iframe:", {
        retryAttempt: event.data.retryAttempt,
        maxRetries: event.data.maxRetries,
        error: event.data.error,
        finalFailure: event.data.finalFailure,
    });
    if (event.data.finalFailure) {
        initializationAttemptedRef.current = false;
        configSentRef.current = false;
        updateState({
            viewerError: `Failed to load viewer scripts after ${event.data.maxRetries} attempts: ${event.data.error || "Unknown error"}`,
            viewerInitialized: false,
            isInitializing: false,
        });
        globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_ERROR }, getParentTargetOrigin());
    } else {
        initializationAttemptedRef.current = false;
        configSentRef.current = false;
        updateState({
            isLoading: true,
            viewerError: null,
            viewerInitialized: false,
            isInitializing: false,
        });
        logDebug(`Script load retry attempt ${event.data.retryAttempt} of ${event.data.maxRetries}`);
    }
}
