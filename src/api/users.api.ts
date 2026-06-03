import axiosInstance from "./axios";

export const getUsers = (params?: Record<string, unknown>) =>
  axiosInstance.get("/users", { params }).then((r) => r.data);

export const getUserById = (id: number) =>
  axiosInstance.get(`/users/${id}`).then((r) => r.data);

export const createUser = (body: unknown) =>
  axiosInstance.post("/users", body).then((r) => r.data);

export const updateUser = (id: number, body: unknown) =>
  axiosInstance.put(`/users/${id}`, body).then((r) => r.data);

export const activateUser = (id: number) =>
  axiosInstance.put(`/users/${id}/activate`).then((r) => r.data);

export const deactivateUser = (id: number) =>
  axiosInstance.put(`/users/${id}/deactivate`).then((r) => r.data);

export const resetPassword = (id: number) =>
  axiosInstance.post(`/users/${id}/reset-password`).then((r) => r.data);

export const updateUserRoles = (id: number, roleIds: number[]) =>
  axiosInstance.put(`/users/${id}/roles`, { roleIds }).then((r) => r.data);

export const uploadAvatar = (id: number, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return axiosInstance.post(`/users/${id}/avatar`, fd).then((r) => r.data);
};
