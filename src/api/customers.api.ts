import axiosInstance from "./axios";

export const getCustomers = (params?: Record<string, unknown>) =>
  axiosInstance.get("/customers", { params }).then((r) => r.data);

export const getCustomerById = (id: number) =>
  axiosInstance.get(`/customers/${id}`).then((r) => r.data);

export const createCustomer = (body: unknown) =>
  axiosInstance.post("/customers", body).then((r) => r.data);

export const updateCustomer = (id: number, body: unknown) =>
  axiosInstance.put(`/customers/${id}`, body).then((r) => r.data);

export const deleteCustomer = (id: number) =>
  axiosInstance.delete(`/customers/${id}`).then((r) => r.data);
