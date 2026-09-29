/**
 * Centralized session cleanup.
 * Orchestrates auth cleanup and app-specific cached data removal.
 * Lives outside services/auth/ because it spans auth + domain concerns.
 */
import { tokenManager } from "./auth/tokenManager";
import { resetRefreshState } from "./auth/authInterceptor";
import { ivTokenManager } from "./iv/tokenManager";

/**
 * Clear all authentication state and app-specific cached data.
 * Call this from any logout or cleanup path for consistent behavior.
 */
export function clearAuthSession() {
  resetRefreshState();
  tokenManager.clear();
  ivTokenManager.clearTokens();

  // Nuke all sessionStorage to prevent any stale user data from persisting
  sessionStorage.clear();

  // Clear all app-specific localStorage keys
  localStorage.removeItem("case_comments_latest");
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("brava_unsaved_markups_")) {
      localStorage.removeItem(key);
    }
  });
}
