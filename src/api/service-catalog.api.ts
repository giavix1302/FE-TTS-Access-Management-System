import axiosInstance from "./axios";

export const getServiceCatalog = () =>
  axiosInstance.get("/service-catalog").then((r) => r.data);

export const getServiceCatalogById = (id: number) =>
  axiosInstance.get(`/service-catalog/${id}`).then((r) => r.data);

export const createServiceCatalog = (body: {
  name: string;
  unit: string;
  defaultPrice: number;
}) => axiosInstance.post("/service-catalog", body).then((r) => r.data);

export const updateServiceCatalog = (
  id: number,
  body: { name?: string; unit?: string; defaultPrice?: number }
) => axiosInstance.put(`/service-catalog/${id}`, body).then((r) => r.data);

export const activateServiceCatalog = (id: number) =>
  axiosInstance.put(`/service-catalog/${id}/activate`).then((r) => r.data);

export const deactivateServiceCatalog = (id: number) =>
  axiosInstance.put(`/service-catalog/${id}/deactivate`).then((r) => r.data);
