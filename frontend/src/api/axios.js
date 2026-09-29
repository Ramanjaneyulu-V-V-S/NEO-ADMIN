import axios from "axios";

const api = axios.create({
  baseURL: "/neoadminBackend/api", // Spring Boot Backend
  headers: {
    "Content-Type": "application/json",
  },
});

// Add OTDS token to all requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Identify the acting user for the backend audit trail. The backend talks to
  // Documentum as the service account, so these headers are the only record of
  // who actually performed a mutation or export.
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const login = u.user_login_name || u.properties?.user_login_name;
    const role = u.admin_role || u.properties?.admin_role;
    if (login) config.headers['X-Actor-Login'] = login;
    if (role) config.headers['X-Actor-Role'] = role;
  } catch {
    /* stored user unparseable — send the request without actor headers */
  }
  return config;
});

// Auto sign-out on an expired / invalid session: any 401 clears the stored
// credentials and bounces to the login screen. Guarded so concurrent 401s
// don't stack redirects and so it never loops while already on /login.
const LOGIN_PATH = '/neoadmin/login';
let redirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !redirecting) {
      const onLoginPage = window.location.pathname.startsWith(LOGIN_PATH);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!onLoginPage) {
        redirecting = true;
        window.location.assign(LOGIN_PATH);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
