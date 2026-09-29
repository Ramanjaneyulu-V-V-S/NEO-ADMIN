/**
 * Viewer Lifecycle State Machine
 *
 * Replaces multiple boolean flags with a single deterministic state machine.
 * This prevents race conditions and makes the viewer lifecycle easier to reason about.
 *
 * States:
 * - BOOT: Initial state, waiting for config
 * - CONFIG_READY: Config received, waiting for viewer initialization
 * - VIEWER_READY: Viewer API initialized, waiting for publication
 * - PUBLICATION_LOADING: Publication is being loaded
 * - READY: Fully initialized and ready for interaction
 * - ERROR: Error state, viewer failed to initialize
 */

export const VIEWER_STATE = {
  BOOT: "BOOT",
  CONFIG_READY: "CONFIG_READY",
  VIEWER_READY: "VIEWER_READY",
  PUBLICATION_LOADING: "PUBLICATION_LOADING",
  READY: "READY",
  ERROR: "ERROR",
};

/**
 * State transition helper
 * Validates state transitions and provides type safety
 */
export const canTransition = (from, to) => {
  const validTransitions = {
    [VIEWER_STATE.BOOT]: [VIEWER_STATE.CONFIG_READY, VIEWER_STATE.ERROR],
    [VIEWER_STATE.CONFIG_READY]: [VIEWER_STATE.VIEWER_READY, VIEWER_STATE.ERROR],
    [VIEWER_STATE.VIEWER_READY]: [VIEWER_STATE.PUBLICATION_LOADING, VIEWER_STATE.ERROR],
    [VIEWER_STATE.PUBLICATION_LOADING]: [VIEWER_STATE.READY, VIEWER_STATE.ERROR],
    [VIEWER_STATE.READY]: [VIEWER_STATE.PUBLICATION_LOADING, VIEWER_STATE.ERROR], // Can reload publication
    [VIEWER_STATE.ERROR]: [VIEWER_STATE.BOOT, VIEWER_STATE.CONFIG_READY], // Can recover from error
  };

  return validTransitions[from]?.includes(to) ?? false;
};

/**
 * Get derived state flags from lifecycle state
 * This provides backward compatibility for code that checks individual flags
 */
export const getStateFlags = (state) => {
  return {
    isReady: state === VIEWER_STATE.READY,
    isViewerReady: state === VIEWER_STATE.VIEWER_READY || state === VIEWER_STATE.PUBLICATION_LOADING || state === VIEWER_STATE.READY,
    isPublicationLoading: state === VIEWER_STATE.PUBLICATION_LOADING,
    isError: state === VIEWER_STATE.ERROR,
    canLoadPublication: state === VIEWER_STATE.VIEWER_READY || state === VIEWER_STATE.READY,
    canSetupHandlers: state === VIEWER_STATE.READY,
  };
};
