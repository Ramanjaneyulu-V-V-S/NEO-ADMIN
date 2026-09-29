/**
 * Integrated Brava Viewer – initializeIframeViewer helpers
 *
 * Extracted logic to keep initializeIframeViewer cognitive complexity ≤15.
 * No side effects beyond what ctx provides.
 */

import { MESSAGE_TYPES } from "./bravaConstants";
import { getParentTargetOrigin } from "./postMessageTargets";

function buildViewerConfig(ctx) {
  const { instanceId, containerId, state, createModifiedLayout, ivTitle, caseStatus, page, bravaconfig } = ctx;
  return {
    instanceId,
    containerId,
    accessToken: state.accessToken,
    viewerAuthority: bravaconfig.viewerAuthority,
    loaderUrl: `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js`,
    searchHost: import.meta.env.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
    markupHost: import.meta.env.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
    publicationDetails: state.publicationDetails,
    layout: createModifiedLayout(ivTitle, caseStatus),
    readonly: false,
    ivTitle,
    initialPage: page !== null && page !== undefined ? page : null,
  };
}

/**
 * Handles "srcdoc already set" path: send config if needed, clear loading, return.
 * Returns true if caller should return.
 */
export function runSrcdocAlreadySetPath(ctx) {
  const {
    iframeRef,
    iframeSrcdocSetRef,
    loadPublicationSentRef,
    configSentToIframeRef,
    state,
    instanceId,
    containerId,
    createModifiedLayout,
    ivTitle,
    caseStatus,
    page,
    bravaconfig,
    sendLoadPublicationSafely,
    updateState,
  } = ctx;

  if (!iframeRef.current || !iframeSrcdocSetRef.current || !iframeRef.current.srcdoc) {
    return false;
  }

  if (loadPublicationSentRef.current) return true;

  if (
    !configSentToIframeRef.current &&
    iframeRef.current.contentWindow &&
    state.publicationDetails &&
    state.accessToken
  ) {
    const viewerConfig = buildViewerConfig({
      instanceId,
      containerId,
      state,
      createModifiedLayout,
      ivTitle,
      caseStatus,
      page,
      bravaconfig,
    });
    sendLoadPublicationSafely(state.publicationDetails, viewerConfig);
  }

  if (
    iframeRef.current.contentWindow &&
    (state.viewerInitialized || configSentToIframeRef.current)
  ) {
    updateState({ isInitializing: false, isLoading: false });
  }

  return true;
}

/**
 * Handles "already initializing or initialized" path: notify parent if initialized, return.
 * Returns true if caller should return.
 */
export function runAlreadyInitializedPath(ctx) {
  const { state } = ctx;
  if (!state.isInitializing && !state.viewerInitialized) return false;
  if (state.viewerInitialized) {
    globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_INITIALIZED }, getParentTargetOrigin());
  }
  return true;
}
