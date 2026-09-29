/**
 * Centralized token manager.
 *
 * Security design:
 *  - access_token and refresh_token are stored in sessionStorage for persistence
 *    across page refreshes. sessionStorage is tab-scoped and cleared when the
 *    browser tab is closed, providing reasonable security.
 *  - In-memory variables serve as cache to avoid repeated sessionStorage reads.
 *  - All cookie cleanup (x-csrf-token, refreshToken) is centralized here.
 */

// ---- In-memory cache (synced with sessionStorage) ----
let _accessToken = null;
let _refreshToken = null;
let _tokenExpiry = null;

// ---- Storage key constants ----
const STORAGE_KEYS = {
  // sessionStorage keys for token persistence
  ACCESS_TOKEN: "nabard_access_token",
  REFRESH_TOKEN: "nabard_refresh_token",
  TOKEN_EXPIRY: "nabard_token_expiry",
  // Legacy sessionStorage key (cleanup only)
  REFRESH_TOKEN_SESSION: "refresh_token",
  // Legacy localStorage keys (cleanup only, from old implementation)
  LEGACY_TOKEN: "Token",
  LEGACY_ACCESS_TOKEN: "access_token",
  LEGACY_REFRESH_TOKEN: "refresh_token",
  LEGACY_TOKEN_EXPIRY: "token_expiry",
};

const EARLY_EXPIRY_BUFFER_MS = 30_000;

/**
 * Validate that a string looks like a JWT and has not expired.
 * Does NOT verify the cryptographic signature (that is the server's job).
 *
 * @param {string} token - The JWT string to validate
 * @param {string|null} expectedUsername - If provided, verify the `unm` claim matches
 * @returns {{ valid: boolean, payload: object|null, error: string|null }}
 */
export function validateJwt(token, expectedUsername = null) {
  if (!token || typeof token !== "string") {
    return { valid: false, payload: null, error: "Token is empty or not a string" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: "Token does not have 3 segments" };
  }

  let payload;
  try {
    // base64url -> base64 -> decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    payload = JSON.parse(atob(base64));
  } catch {
    return { valid: false, payload: null, error: "Cannot decode token payload" };
  }

  // Check expiration
  if (typeof payload.exp !== "number") {
    return { valid: false, payload, error: "Token has no exp claim" };
  }
  if (payload.exp * 1000 < Date.now()) {
    return { valid: false, payload, error: "Token is expired" };
  }

  // Optional username check
  if (expectedUsername && payload.unm !== expectedUsername) {
    return {
      valid: false,
      payload,
      error: "Token username does not match expected user",
    };
  }

  return { valid: true, payload, error: null };
}

/**
 * Initialize in-memory cache from sessionStorage.
 * Called on app startup to restore session after page refresh.
 */
function initializeFromStorage() {
  try {
    const storedAccessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const storedRefreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const storedExpiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

    // Validate stored access token before restoring
    if (storedAccessToken) {
      const validation = validateJwt(storedAccessToken);
      if (validation.valid) {
        _accessToken = storedAccessToken;
      } else {
        // Token is expired or invalid, clear it
        sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
    }

    // Restore refresh token (used for getting new access tokens)
    if (storedRefreshToken) {
      _refreshToken = storedRefreshToken;
    }

    // Restore expiry
    if (storedExpiry) {
      const expiry = parseInt(storedExpiry, 10);
      if (!isNaN(expiry) && expiry > Date.now()) {
        _tokenExpiry = expiry;
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
      }
    }
  } catch (error) {
    // sessionStorage might not be available (private browsing, etc.)
    console.warn("Failed to restore tokens from sessionStorage:", error);
  }
}

// Initialize on module load
initializeFromStorage();

export const tokenManager = {
  // ---- Access token ----

  getAccessToken: () => _accessToken,

  /**
   * Store tokens after successful login or refresh.
   *
   * @param {string} accessToken - JWT access token
   * @param {string|null} refreshToken - Refresh token (null to keep existing)
   * @param {number|null} expiresIn - Token lifetime in seconds
   */
  setTokens: (accessToken, refreshToken, expiresIn) => {
    _accessToken = accessToken;

    // Persist access token to sessionStorage
    if (accessToken) {
      sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    }

    if (refreshToken !== null && refreshToken !== undefined) {
      _refreshToken = refreshToken;
      // Persist refresh token to sessionStorage
      sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    const expiry = expiresIn != null ? Date.now() + expiresIn * 1000 : null;
    _tokenExpiry = expiry;

    if (expiry) {
      sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiry));
    }
  },

  // ---- Refresh token ----

  getRefreshToken: () => _refreshToken,

  // ---- State checks ----

  /** True if an access token exists (in memory or restorable from storage). */
  isAuthenticated: () => !!_accessToken,

  /** True if the access token is expired or missing. */
  isTokenExpired: () => {
    if (!_tokenExpiry) return true;
    return Date.now() > _tokenExpiry - EARLY_EXPIRY_BUFFER_MS;
  },

  /**
   * True if the user has a viable session — either a current access token
   * or a refresh token that can be exchanged.
   */
  hasSession: () => !!_accessToken || !!_refreshToken,

  /**
   * Re-initialize tokens from sessionStorage.
   * Useful after PersistGate rehydration completes.
   */
  rehydrate: () => {
    initializeFromStorage();
  },

  // ---- Cleanup ----

  /**
   * Clear ALL auth state: in-memory tokens, sessionStorage, cookies,
   * and any legacy localStorage keys from the old implementation.
   */
  clear: () => {
    // In-memory
    _accessToken = null;
    _refreshToken = null;
    _tokenExpiry = null;

    // Current sessionStorage keys
    sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);

    // Legacy sessionStorage cleanup
    sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_SESSION);

    // Legacy localStorage keys (from old implementation, for clean migration)
    localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN_EXPIRY);

    // Stale session / auth cookies
    const basePath = import.meta.env.VITE_BASE_PATH || "/";
    document.cookie = "JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = `JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${basePath};`;
    document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "x-csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = `x-csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${basePath};`;
  },
};
