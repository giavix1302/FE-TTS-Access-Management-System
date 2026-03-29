import axiosInstance from "./axios";

export const getUsers = (params?: Record<string, unknown>) =>
  axiosInstance.get("/users", { params }).then((r) => r.data);

export const getUserById = (id: number) =>
  axiosInstance.get(`/users/${id}`).then((r) => r.data);

export const createUser = (body: unknown) =>
  axiosInstance.post("/users", body).then((r) => r.data);

export const updateUser = (id: number, body: unknown) =>
  axiosInstance.put(`/users/${id}`, body).then((r) => r.data);

export const deleteUser = (id: number) =>
  axiosInstance.delete(`/users/${id}`).then((r) => r.data);
