import axiosInstance from "./axios";

export const login = (body: { phone: string; password: string }) =>
  axiosInstance.post("/auth/login", body).then((r) => r.data);

export const logout = (refreshToken: string) =>
  axiosInstance.post("/auth/logout", { refresh_token: refreshToken }).then((r) => r.data);

export const refreshTokenApi = (refreshToken: string) =>
  axiosInstance.post("/auth/refresh", { refreshToken }).then((r) => r.data);

export const getMe = () =>
  axiosInstance.get("/auth/me").then((r) => r.data);
