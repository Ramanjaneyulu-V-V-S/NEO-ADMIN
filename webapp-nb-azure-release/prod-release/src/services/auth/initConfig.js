/**
 * Stores init_config from the token API response.
 * The token API returns an `init_config` field (base64-encoded JWT)
 * containing runtime configuration like Brava/IV credentials.
 *
 * Stored in sessionStorage in encoded (raw JWT) format for security.
 * Decoded only when accessed via getInitConfig().
 */

const STORAGE_KEY = "nabard_init_config";

/**
 * Decode the JWT payload (second segment) from init_config.
 */
function decodeJwtPayload(token) {
  const parts = token.split(".");
  const payload = parts.length === 3 ? parts[1] : parts[0];
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

/**
 * Store the raw init_config JWT in sessionStorage.
 * @param {string} initConfigToken - The raw init_config string from token response
 */
export function setInitConfig(initConfigToken) {
  if (!initConfigToken) return;
  try {
    // Validate it can be decoded before storing
    decodeJwtPayload(initConfigToken);
    sessionStorage.setItem(STORAGE_KEY, initConfigToken);
  } catch {
    console.error("Failed to decode init_config from token response");
  }
}

/**
 * Get the decoded init_config object.
 * Reads encoded JWT from sessionStorage and decodes on the fly.
 * @returns {object|null}
 */
export function getInitConfig() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return decodeJwtPayload(raw);
  } catch {
    return null;
  }
}

/**
 * Clear stored config (on logout).
 */
export function clearInitConfig() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
