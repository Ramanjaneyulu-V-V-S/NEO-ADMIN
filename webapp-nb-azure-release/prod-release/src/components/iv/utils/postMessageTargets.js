// PostMessage target origins for same-origin communication


function getBrowserOrigin() {
  if (globalThis.window === undefined || !globalThis.location) {
    return "";
  }
  return globalThis.location.origin;
}

// Target origin for parent → srcdoc iframe messages
export function getSrcdocIframeTargetOrigin() {
  return getBrowserOrigin();
}

// Target origin for child → parent messages
export function getParentTargetOrigin() {
  return getBrowserOrigin();
}
