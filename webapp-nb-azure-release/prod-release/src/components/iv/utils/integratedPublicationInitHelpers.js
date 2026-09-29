/**
 * Integrated Brava Viewer – initializePublication helpers
 *
 * Extracted logic to keep initializePublication cognitive complexity ≤15.
 * No side effects beyond what ctx provides.
 */

import { MESSAGE_TYPES, PUBLICATION_STATUS } from "./bravaConstants";
import { getParentTargetOrigin } from "./postMessageTargets";

/**
 * Handles the "no publicationId" path. Returns true if caller should return.
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
export async function runNoPublicationIdPath(ctx) {
  const { publicationId, updateState, caseId, onPublicationIdUpdate, refetchAttempted, refetchPublicationId } = ctx;
  if (publicationId) return false;
  updateState({
    isLoading: false,
    viewerError: "No publication ID provided. Please wait for publication to be ready.",
  });
  if (caseId && onPublicationIdUpdate && !refetchAttempted.current) {
    refetchAttempted.current = true; // FIX: Was FALSE, must be TRUE to prevent infinite refetch
    const updatedPubId = await refetchPublicationId();
    if (updatedPubId) return true;
  }
  return true;
}

/**
 * Applies reset when publicationId has changed. No return.
 * @param {Object} ctx
 */
export function runPublicationChangeReset(ctx) {
  const {
    publicationId,
    lastCheckedPublicationId,
    retryTimeoutRef,
    retryAttempts,
    refetchAttempted,
    markupsRestoredRef,
    unsavedMarkupsRef,
    setHasUnsavedMarkups,
    iframeSrcdocSetRef,
    configSentToIframeRef,
    updateState,
    terminalErrorRef, // FIX: Added to reset terminal error on publication change
  } = ctx;
  if (lastCheckedPublicationId === publicationId) return;

  if (retryTimeoutRef.current) {
    clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = null;
  }
  retryAttempts.current.set(publicationId, 0);
  refetchAttempted.current = false;
  markupsRestoredRef.current = false;
  unsavedMarkupsRef.current = null;
  setHasUnsavedMarkups(false);
  iframeSrcdocSetRef.current = false;
  configSentToIframeRef.current = false;
  // FIX: Reset terminal error flag for new publication (allows fresh fetch)
  if (terminalErrorRef) {
    terminalErrorRef.current = false;
  }
  updateState({
    publicationDetails: null,
    viewerInitialized: false,
    isInitializing: false,
    viewerError: null,
  });
}

/**
 * If already loaded and complete, notifies parent and returns true so caller returns.
 * @param {Object} ctx - { state, publicationId }
 * @returns {boolean}
 */
export function checkAlreadyCompleteAndNotify(ctx) {
  const { state, publicationId } = ctx;
  const isComplete =
    state.publicationDetails?.id === publicationId &&
    state.publicationDetails?.status?.toLowerCase() === PUBLICATION_STATUS.COMPLETE;
  if (!isComplete) return false;
  if (state.viewerInitialized) {
    globalThis.parent.postMessage({ type: MESSAGE_TYPES.VIEWER_INITIALIZED }, getParentTargetOrigin());
  }
  return true;
}
