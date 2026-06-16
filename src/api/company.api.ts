import axiosInstance from "./axios";

export const getCompanySettings = () =>
  axiosInstance.get("/company-settings").then((r) => r.data);

export const updateCompanySettings = (body: unknown) =>
  axiosInstance.put("/company-settings", body).then((r) => r.data);

export const createBankAccount = (body: unknown) =>
  axiosInstance.post("/company-settings/bank-accounts", body).then((r) => r.data);

export const updateBankAccount = (id: number, body: unknown) =>
  axiosInstance.put(`/company-settings/bank-accounts/${id}`, body).then((r) => r.data);
