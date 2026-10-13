import axios from "axios";

// Change this if your backend ever runs somewhere other than localhost:8000
const API_BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Automatically attach the JWT token (if we have one) to EVERY request.
// This means individual screens never need to worry about auth headers -
// they just call api.get(...) or api.post(...) and this handles it.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend ever responds with 401 (expired/invalid token), automatically
// log the user out and send them back to the login screen, instead of leaving
// them stuck on a broken page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
