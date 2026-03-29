import axiosInstance from "./axios";

export const getContracts = (params?: Record<string, unknown>) =>
  axiosInstance.get("/contracts", { params }).then((r) => r.data);

export const getContractById = (id: number) =>
  axiosInstance.get(`/contracts/${id}`).then((r) => r.data);

export const createContract = (body: unknown) =>
  axiosInstance.post("/contracts", body).then((r) => r.data);

export const updateContract = (id: number, body: unknown) =>
  axiosInstance.put(`/contracts/${id}`, body).then((r) => r.data);

export const deleteContract = (id: number) =>
  axiosInstance.delete(`/contracts/${id}`).then((r) => r.data);
