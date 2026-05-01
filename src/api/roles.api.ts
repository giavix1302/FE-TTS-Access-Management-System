import axiosInstance from "./axios";

export const getRoles = () =>
  axiosInstance.get("/roles").then((r) => r.data);

export const getRoleDetail = (id: number) =>
  axiosInstance.get(`/roles/${id}`).then((r) => r.data);

export const updateRolePermissions = (id: number, permission_ids: number[]) =>
  axiosInstance.put(`/roles/${id}/permissions`, { permission_ids }).then((r) => r.data);
