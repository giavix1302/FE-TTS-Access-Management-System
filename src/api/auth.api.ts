import axiosInstance from "./axios";

export const login = (body: { phone: string; password: string }) =>
  axiosInstance.post("/auth/login", body).then((r) => r.data);

export const logout = () =>
  axiosInstance.post("/auth/logout").then((r) => r.data);

export const refreshToken = (refreshToken: string) =>
  axiosInstance.post("/auth/refresh", { refreshToken }).then((r) => r.data);
