// IFRAME_READY validation and config transmission for IntegratedBravaViewer


import { MESSAGE_TYPES } from "./bravaConstants";
import { getSrcdocIframeTargetOrigin, getParentTargetOrigin } from "./postMessageTargets";


export function isValidIntegratedIframeReadyEvent(event, iframeRef, instanceId) {
  if (iframeRef.current?.contentWindow) {
    if (event.source !== iframeRef.current.contentWindow) return false;
  } else {
    if (
      event.origin !== globalThis.location?.origin &&
      event.origin !== "null" &&
      !event.origin?.startsWith("about:")
    ) {
      return false;
    }
  }
  const messageInstanceId = event.data?.instanceId;
  if (!messageInstanceId || messageInstanceId === "default") return true;
  return messageInstanceId === instanceId || instanceId === "default";
}


export function sendConfigAndTokenAfterIntegratedIframeReady(ctx) {
  const {
    iframeRef,
    state,
    instanceId,
    containerId,
    createModifiedLayout,
    ivTitle,
    caseStatus,
    page,
    sendLoadPublicationSafely,
    log,
    bravaconfig,
  } = ctx;

  const viewerConfig = {
    instanceId,
    containerId,
    accessToken: state?.accessToken,
    viewerAuthority: bravaconfig?.viewerAuthority,
    loaderUrl: bravaconfig?.viewerAuthority ? `${bravaconfig.viewerAuthority}/viewer/BravaViewerLoader.js` : "",
    searchHost: import.meta.env?.VITE_BRAVA_SEARCH_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_SEARCH_HOST}` : "",
    markupHost: import.meta.env?.VITE_BRAVA_MARKUP_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_MARKUP_HOST}` : "",
    assetsHost: import.meta.env?.VITE_BRAVA_ASSETS_HOST ? `${globalThis.location.origin}${import.meta.env.VITE_BRAVA_ASSETS_HOST}` : "",
    publicationDetails: state?.publicationDetails,
    layout: createModifiedLayout?.(ivTitle, caseStatus),
    readonly: false,
    ivTitle,
    initialPage: page !== null && page !== undefined ? page : null,
    parentOrigin: getParentTargetOrigin(),
  };

  sendLoadPublicationSafely?.(state?.publicationDetails, viewerConfig);

  const tokenMessage = { type: MESSAGE_TYPES.SET_ACCESS_TOKEN, accessToken: state?.accessToken };
  try {
    iframeRef?.current?.contentWindow?.postMessage(tokenMessage, getSrcdocIframeTargetOrigin());
  } catch (error) {
    log?.error?.("[IntegratedBravaViewer] Error sending access token after IFRAME_READY", error);
  }
}
