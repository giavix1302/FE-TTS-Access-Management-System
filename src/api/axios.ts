import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — tự động gắn token từ Zustand persist store
axiosInstance.interceptors.request.use(
  (config) => {
    const authData = localStorage.getItem("tts-auth");
    const token = authData ? JSON.parse(authData)?.state?.accessToken : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — xử lý 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("tts-auth");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
