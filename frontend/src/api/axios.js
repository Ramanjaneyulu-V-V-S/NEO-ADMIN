import axios from "axios";

const api = axios.create({
  baseURL: "/neoadminBackend/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
