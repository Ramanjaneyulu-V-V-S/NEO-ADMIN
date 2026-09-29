import axios from "axios";
import { loginService } from "./login/loginService";
import { setupAuthInterceptors } from "./auth/authInterceptor";
import { clearAuthSession } from "./sessionCleanup";

const basePath = import.meta.env.VITE_API_BASE_PATH || import.meta.env.VITE_BASE_PATH || "";
const normalizedBasePath = basePath.startsWith("/") ? basePath : `/${basePath}`;
const baseURL = normalizedBasePath;

const axiosInstance = axios.create({
  baseURL,
  // Required for production (cross-origin): allows browser to store and send
  // x-csrf-token cookies from xCP responses. Without this, POST/PUT/DELETE
  // fail with 403 (CSRF validation). Session mixing is prevented separately
  // by stripping JSESSIONID from Vite proxy responses in dev mode.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Wire up JWT auth interceptors (injected deps avoid circular imports)
setupAuthInterceptors(axiosInstance, {
  refreshAccessToken: () => loginService.refreshAccessToken(),
  onRefreshFailure: async () => {
    await loginService.logout();
    clearAuthSession();
    // Safe redirect — validate path is relative
    const basePath = import.meta.env.VITE_BASE_PATH || "";
    const safePath = basePath && basePath.startsWith("/") ? `${basePath}/` : "/";
    window.location.href = safePath;
  },
});

export default axiosInstance;
