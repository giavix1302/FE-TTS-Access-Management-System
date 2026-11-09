import axios from "axios";
import { getApiError, getApiErrorStatus } from "@/utils/apiError";
import { buildLoginUrl, setLoginNotice } from "@/utils/loginRedirect";
import { useAuthStore } from "@/stores/authStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5062/api/v1";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // gửi HttpOnly cookie theo mọi request
});

// Request interceptor — đính accessToken từ Zustand in-memory
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh token state — tránh race condition khi nhiều request 401 cùng lúc
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

// Hết phiên → về login, trang login hiện message của BE ("Phiên đăng nhập đã hết hạn…")
function redirectToLogin(error: unknown) {
  setLoginNotice(getApiError(error).message);
  useAuthStore.getState().clearAuth();
  window.location.href = buildLoginUrl();
}

// Response interceptor — 401 → gọi POST /auth/refresh (cookie tự đính kèm)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry)
      return Promise.reject(error);

    // Các endpoint auth public → trả lỗi thẳng, không refresh
    const url = originalRequest.url ?? "";
    if (url.includes("/auth/login") || url.includes("/auth/logout")) {
      return Promise.reject(error);
    }

    // Chính /auth/refresh bị 401 → cookie hết hạn, logout hẳn
    if (url.includes("/auth/refresh")) {
      redirectToLogin(error);
      return Promise.reject(error);
    }

    // Đang refresh → xếp hàng chờ
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Cookie refresh_token tự đính kèm nhờ withCredentials
      const { refreshTokenApi } = await import("./auth.api");
      const res = await refreshTokenApi();

      if (res.success && res.data?.accessToken) {
        const newToken = res.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      }

      processQueue(error, null);
      redirectToLogin(error);
      return Promise.reject(error);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // 429: phiên vẫn còn, chỉ bị giới hạn tần suất → không đăng xuất, trả lỗi để màn hình báo thời gian chờ
      if (getApiErrorStatus(refreshError) !== 429) redirectToLogin(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
