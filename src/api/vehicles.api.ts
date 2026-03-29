import axiosInstance from "./axios";

export const getVehicles = (params?: Record<string, unknown>) =>
  axiosInstance.get("/vehicles", { params }).then((r) => r.data);

export const getVehicleById = (id: number) =>
  axiosInstance.get(`/vehicles/${id}`).then((r) => r.data);

export const createVehicle = (body: unknown) =>
  axiosInstance.post("/vehicles", body).then((r) => r.data);

export const updateVehicle = (id: number, body: unknown) =>
  axiosInstance.put(`/vehicles/${id}`, body).then((r) => r.data);

export const deleteVehicle = (id: number) =>
  axiosInstance.delete(`/vehicles/${id}`).then((r) => r.data);
