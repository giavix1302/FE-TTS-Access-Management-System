import axiosInstance from "./axios";

export const getCompanySettings = () =>
  axiosInstance.get("/company").then((r) => r.data);

export const updateCompanySettings = (body: unknown) =>
  axiosInstance.put("/company", body).then((r) => r.data);
