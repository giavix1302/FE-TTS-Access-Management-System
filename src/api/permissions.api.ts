import axiosInstance from "./axios";

export const getPermissions = () =>
  axiosInstance.get("/permissions").then((r) => r.data);
