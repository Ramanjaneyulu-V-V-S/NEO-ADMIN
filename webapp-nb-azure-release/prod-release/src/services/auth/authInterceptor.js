/**
 * Axios auth interceptors for JWT Bearer token authentication.
 *
 * Responsibilities:
 *  - Attach Bearer token to outgoing requests
 *  - Proactive token refresh while session is active in current tab
 *  - Automatic 401 retry with token refresh
 *  - Request queuing during token refresh (bounded to MAX_QUEUE_SIZE)
 *  - CSRF token forwarding
 *
 * Dependencies are injected via setupAuthInterceptors() to avoid
 * circular imports between axiosConfig and loginService.
 */
import { tokenManager } from "./tokenManager";

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts?.length === 2) return parts.pop()?.split(";")?.shift();
  return null;
}

// ---- Shared refresh state ----
let isRefreshing = false;
let failedQueue = [];
const MAX_QUEUE_SIZE = 50;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Reset refresh state — call on logout to avoid leaked promises. */
export const resetRefreshState = () => {
  processQueue(new Error("Session cleared"), null);
  isRefreshing = false;
};

let _initialized = false;

/**
 * Attach JWT auth interceptors to an axios instance.
 * Calling this more than once is a no-op (guards against HMR double-init).
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {Object} deps - Injected dependencies
 * @param {() => Promise<string>} deps.refreshAccessToken - Refresh the access token
 * @param {() => void} deps.onRefreshFailure - Called when token refresh fails permanently
 */
export function setupAuthInterceptors(axiosInstance, { refreshAccessToken, onRefreshFailure }) {
  if (_initialized) return;
  _initialized = true;

  // ---- Proactive token refresh ----
  let refreshPromise = null;

  async function ensureAccessToken() {
    const current = tokenManager.getAccessToken();
    // Return current token only if it's not expired
    if (current && !tokenManager.isTokenExpired()) return current;

    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) return null;

    // Coalesce concurrent refresh calls into a single request
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken()
        .then((token) => {
          refreshPromise = null;
          return token;
        })
        .catch((err) => {
          refreshPromise = null;
          throw err;
        });
    }

    return refreshPromise;
  }

  // ---- Request interceptor: attach Bearer token + CSRF ----
  axiosInstance.interceptors.request.use(
    async (config) => {
      let accessToken;
      try {
        accessToken = await ensureAccessToken();
      } catch {
        // Refresh failed — force logout and redirect
        onRefreshFailure();
        return Promise.reject(new Error("Session expired"));
      }

      if (accessToken) {
        config.headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const csrfToken = getCookie("x-csrf-token");
      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      } else if (["post", "put", "delete", "patch"].includes(config.method?.toLowerCase())) {
        console.warn(`[Auth] CSRF token missing for ${config.method?.toUpperCase()} ${config.url}`);
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  // ---- Response interceptor: auto-refresh on 401 ----
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Only attempt refresh on 401 and if we haven't already retried
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Prevent unbounded memory growth
          if (failedQueue.length >= MAX_QUEUE_SIZE) {
            return Promise.reject(new Error("Too many queued requests during token refresh"));
          }
          // Queue this request until the token is refreshed (30s timeout)
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error("Token refresh queue timeout (30s)")), 30_000);
            failedQueue.push({
              resolve: (token) => { clearTimeout(timeoutId); resolve(token); },
              reject: (err) => { clearTimeout(timeoutId); reject(err); },
            });
          })
            .then((token) => {
              originalRequest.headers["Authorization"] = `Bearer ${token}`;
              return axiosInstance(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken();
          processQueue(null, newToken);
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          onRefreshFailure();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
}
