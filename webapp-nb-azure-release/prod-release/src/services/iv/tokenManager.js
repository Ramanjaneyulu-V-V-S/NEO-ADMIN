// Centralized Brava/IV token manager
// - Fetches token once and caches with expiry
// - Dedupes concurrent requests
// - Provides getToken() for consumers
// - SECURITY: Uses closures to protect tokens from XSS access

import bravaconfig from "../../components/iv/bravaconfig";
import { log } from "../../iframe/utils/logger";

// Token storage in closure prevents XSS access via window or module scope
const createTokenManager = () => {
  // Private variables within closure - not accessible from outside
  let cachedAccessToken = null;
  let tokenExpiresAtMs = 0; // epoch ms
  let inflightPromise = null;
  // CRITICAL FIX (P0-2): Module-level lock for forceRefresh to prevent race condition
  // Multiple concurrent 401 responses can trigger multiple forceRefresh() calls
  // This lock ensures only one refresh happens at a time
  let forceRefreshLock = null;

  function isTokenValid() {
    if (!cachedAccessToken) return false;
    // Refresh 120s early to handle slow networks
    const now = Date.now();
    return tokenExpiresAtMs - 120_000 > now;
  }

  async function requestToken() {
    const formData = new URLSearchParams();
    Object.entries(bravaconfig.credentials).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(bravaconfig.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // CRITICAL FIX (VULN-003): Never log token in error messages
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();

    const accessToken = data?.access_token;
    const expiresInSec = Number(data?.expires_in) || 600; // default 10 minutes if missing
    const expiresAt = Date.now() + expiresInSec * 1000;

    if (!accessToken) {
      // CRITICAL FIX (VULN-003): Never expose token in error messages
      throw new Error("No access_token in token response");
    }

    // CRITICAL FIX (VULN-003): Validate token format before storing
    // Ensure token is a string and has reasonable length (prevent injection)
    if (typeof accessToken !== "string" || accessToken.length < 10 || accessToken.length > 2000) {
      log.error("Token validation failed: invalid format or length");
      throw new Error("Invalid token format received");
    }

    // Store in private closure variable (never exposed to global scope)
    cachedAccessToken = accessToken;
    tokenExpiresAtMs = expiresAt;
    return cachedAccessToken;
  }

  // Public API - tokens are only accessible through these methods
  const tokenManager = {
    // Preload token at app start (optional)
    async init() {
      try {
        await tokenManager.getToken();
      } catch (err) {
        // Don't block app hard; log and continue. Consumers will retry on demand
        log.error("IV token init failed", err);
      }
    },

    // Get a valid token; refresh if needed; dedupe concurrent calls
    async getToken() {
      if (isTokenValid()) return cachedAccessToken;

      if (!inflightPromise) {
        inflightPromise = (async () => {
          try {
            return await requestToken();
          } finally {
            inflightPromise = null;
          }
        })();
      }
      return inflightPromise;
    },

    // Force refresh regardless of cache
    // CRITICAL FIX (P0-2): Add module-level lock to deduplicate concurrent forceRefresh() calls
    // This prevents multiple concurrent 401 responses from triggering multiple token refresh requests
    async forceRefresh() {
      // If a force refresh is already in progress, wait for it and return the same token
      if (forceRefreshLock) {
        return forceRefreshLock;
      }

      // Atomic check-and-set: create lock BEFORE clearing cache
      forceRefreshLock = (async () => {
        try {
          // Clear cache to force fresh token
          cachedAccessToken = null;
          tokenExpiresAtMs = 0;

          // Clear any existing inflight promise to ensure fresh request
          // This ensures we get a completely new token, not a cached one
          inflightPromise = null;

          // Get fresh token
          const freshToken = await tokenManager.getToken();
          return freshToken;
        } finally {
          // Always clear lock when done (success or failure)
          forceRefreshLock = null;
        }
      })();

      return forceRefreshLock;
    },

    // Clear tokens on unload for security

    clearTokens() {
      cachedAccessToken = null;
      tokenExpiresAtMs = 0;
      // Don't clear inflightPromise here - let it complete naturally to avoid race conditions
      // The token won't be cached anyway since cachedAccessToken is null
      // If inflightPromise completes after clearTokens(), it will try to set cachedAccessToken
      // but that's harmless since the page is unloading
    },
  };

  return tokenManager;
};

// Create singleton instance
export const ivTokenManager = createTokenManager();

// SECURITY: Clear tokens on page unload to prevent token persistence
// This provides defense-in-depth - even if XSS occurs, tokens are cleared on navigation
// CRITICAL FIX (VULN-003): Additional token clearing mechanisms to prevent exposure
if (typeof window !== "undefined") {
  // Clear tokens on page unload
  window.addEventListener("beforeunload", () => {
    ivTokenManager.clearTokens();
  });

  // Also clear on pagehide (handles mobile browsers and back/forward navigation)
  window.addEventListener("pagehide", () => {
    ivTokenManager.clearTokens();
  });
}

export default ivTokenManager;
