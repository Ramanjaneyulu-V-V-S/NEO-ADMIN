import axios from "axios";
import { ServiceUrl } from "../serviceUrl";
import axiosInstance from "../axiosConfig";
import { tokenManager, validateJwt } from "../auth/tokenManager";
import { TOKEN_ENDPOINT, REFRESH_ENDPOINT } from "../auth/otdsConfig";
import { resetRefreshState } from "../auth/authInterceptor";
import { setInitConfig, clearInitConfig } from "../auth/initConfig";
import { ivTokenManager } from "../iv/tokenManager";

// guard — prevents recursive/concurrent logout calls
// (e.g. 401 interceptor → onRefreshFailure → logout → loop)
let _isLoggingOut = false;

export const loginService = {
  /**
   * Authenticate with OTDS OAuth2 (password grant) to get JWT tokens,
   * then fetch the user profile from xCP using the Bearer token.
   */
  loginAndGetProfile: async ({ username, password, captchaId = "dev-no-captcha", captchaAnswer = 0, page = 1, start = 0, itemsPerPage = 50 }) => {
    try {
      // Step 1: Get JWT tokens via proxy
      const tokenResponse = await axios.post(
        TOKEN_ENDPOINT,
        new URLSearchParams({
          username,
          password,
          captcha_id: captchaId,
          captcha_answer: captchaAnswer,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      const { access_token, refresh_token, expires_in, init_config } = tokenResponse.data;

      // Decode and store init_config (contains Brava/IV credentials)
      if (init_config) {
        setInitConfig(init_config);
      }

      // Validate JWT structure and expiry before trusting it
      const validation = validateJwt(access_token, username);
      if (!validation.valid) {
        throw new Error(`Invalid token received from OTDS: ${validation.error}`);
      }

      // Store tokens via centralized manager (in-memory + sessionStorage)
      tokenManager.setTokens(access_token, refresh_token, expires_in);

      // Step 2: Initialize IV/Brava token (credentials now available from init_config)
      ivTokenManager.init();

      // Step 3: Fetch user profile from xCP using Bearer token
      const response = await axiosInstance.get(ServiceUrl.userProfile, {
        params: {
          inline: true,
          input_user_login_name: username,
          page,
          start,
          "items-per-page": itemsPerPage,
        },
      });

      return response.data;
    } catch (error) {
      // Clean up tokens on failure
      tokenManager.clear();
      // Strip request config (contains password) before propagating
      const safeError = new Error(error?.message || "Authentication failed");
      if (error?.response) {
        safeError.response = {
          status: error.response.status,
          data: error.response.data,
        };
      }
      throw safeError;
    }
  },

  /**
   * Refresh the access token using the refresh token.
   * Returns the new access_token or throws on failure.
   */
  refreshAccessToken: async () => {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await axios.post(
      REFRESH_ENDPOINT,
      new URLSearchParams({
        refresh_token: refreshToken,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Validate refreshed JWT before trusting it
    const validation = validateJwt(access_token);
    if (!validation.valid) {
      tokenManager.clear();
      throw new Error(`Invalid token received from OTDS: ${validation.error}`);
    }

    tokenManager.setTokens(access_token, refresh_token || null, expires_in);

    return access_token;
  },

  /**
   * Full logout: revoke OTDS tokens server-side, clear cookies, clear tokens.
   * Guarded against re-entrancy to prevent recursive loops
   * (e.g. 401 interceptor → onRefreshFailure → logout → loop).
   */
  logout: async () => {
    if (_isLoggingOut) return;
    _isLoggingOut = true;

    try {
      // Step 1: Drain any queued refresh promises before revoking tokens
      resetRefreshState();

      // Step 2: Invalidate xCP server session (best-effort).
      // Hits Spring Security's logout endpoint which:
      //  - Calls HttpSession.invalidate() (kills JSESSIONID server-side)
      //  - Flushes DFC sessions (releases Content Server connection)
      //  - Removes JSESSIONID, x-csrf-token, loggedin cookies via Set-Cookie
      // Uses axiosInstance (withCredentials) so the JSESSIONID cookie is sent
      // and the server knows which session to destroy.
      try {
        await axiosInstance.get("/j_spring_security_logout", { timeout: 5000 });
      } catch (err) {
        // Best-effort — session may already be expired or server unreachable.
        // Surface the failure so a missing /service proxy or a 404 doesn't go silent
        // (which is what previously left HttpOnly JSESSIONID stuck in the browser).
        console.warn("[logout] j_spring_security_logout failed; JSESSIONID may not have been cleared server-side:", err?.message || err);
      }

      // Step 4: Clear all cookies that can auto-authenticate.
      // Uses both expires and max-age for cross-browser reliability.
      const cookieNames = ["DOCUMENTUM-CLIENT-TOKEN", "JSESSIONID", "x-csrf-token", "loggedin", "otds_access_token", "otds_username"];
      const paths = [import.meta.env.VITE_BASE_PATH || "/Case_Management_System", import.meta.env.VITE_API_BASE_PATH || "/service", "/"];

      cookieNames.forEach((name) => {
        paths.forEach((path) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}`;
        });
      });

      // Step 5: Clear tokens and init config from memory + storage
      tokenManager.clear();
      clearInitConfig();
    } finally {
      _isLoggingOut = false;
    }
  },

  /**
   * Clear all auth state — tokens, cookies, legacy storage keys.
   * Prefer logout() for full server-side + client-side cleanup.
   */
  clearTokens: () => {
    tokenManager.clear();
  },

  getUserProfile: async (params) => {
    const defaultParams = {
      inline: true,
      page: 1,
      start: 0,
      "items-per-page": 50,
    };

    const response = await axiosInstance.get(ServiceUrl.userProfile, {
      params: {
        ...defaultParams,
        ...params,
      },
    });
    return response.data;
  },

  updateUserProfile: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.updateUserProfile, payload);
    return response.data;
  },

  fetchButtonCondition: async (payload) => {
    const response = await axiosInstance.post(ServiceUrl.buttonCondition, payload);
    return response.data;
  },
};
