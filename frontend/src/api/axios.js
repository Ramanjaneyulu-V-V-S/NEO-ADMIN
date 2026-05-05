import axios from "axios";

const api = axios.create({
  baseURL: "/neoadminBackend/api", // Spring Boot Backend
  headers: {
    "Content-Type": "application/json",
  },
});

// Cache username in memory so we don't hit synchronous localStorage on every single API request
let cachedUsername = null;

api.interceptors.request.use((config) => {
  if (!cachedUsername) {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // The user object from documentum stores the name inside properties.user_name
        const extractedName = user?.properties?.user_name || user?.user_name || user?.username;
        if (extractedName) {
          cachedUsername = extractedName;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  if (cachedUsername) {
    config.headers['X-User-Name'] = cachedUsername;
  }
  
  return config;
});

export default api;
