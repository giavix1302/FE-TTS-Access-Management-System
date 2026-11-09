import axiosInstance from "./axios";
import type { LoginRequest } from "@/types/auth.types";

export const login = (body: LoginRequest) =>
  axiosInstance.post("/auth/login", body).then((r) => r.data);

// Cookie refresh_token tự đính kèm nhờ withCredentials — không cần truyền tham số
export const refreshTokenApi = () =>
  axiosInstance.post("/auth/refresh").then((r) => r.data);

// Cookie bị xóa phía BE — không cần truyền token
export const logout = () =>
  axiosInstance.post("/auth/logout").then((r) => r.data);

export const getMe = () =>
  axiosInstance.get("/auth/me").then((r) => r.data);

export const changePassword = (body: {
  currentPassword: string;
  newPassword: string;
}) => axiosInstance.put("/auth/change-password", body).then((r) => r.data);
