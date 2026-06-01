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

export const changeVehicleStatus = (
  id: number,
  body: { newStatus: string; reason?: string }
) => axiosInstance.patch(`/vehicles/${id}/status`, body).then((r) => r.data);

export const getVehicleStatusLogs = (
  id: number,
  params?: { page?: number; pageSize?: number }
) =>
  axiosInstance
    .get(`/vehicles/${id}/status-logs`, { params })
    .then((r) => r.data);

// --- Insurance ---
export const getVehicleInsurance = (id: number) =>
  axiosInstance.get(`/vehicles/${id}/insurance`).then((r) => r.data);

export const createVehicleInsurance = (
  id: number,
  body: {
    insuranceNumber?: string;
    provider?: string;
    issueDate?: string;
    expiryDate: string;
    documentId?: number;
  }
) => axiosInstance.post(`/vehicles/${id}/insurance`, body).then((r) => r.data);

export const deleteVehicleInsurance = (vehicleId: number, insId: number) =>
  axiosInstance.delete(`/vehicles/${vehicleId}/insurance/${insId}`).then((r) => r.data);

// --- Inspection ---
export const getVehicleInspection = (id: number) =>
  axiosInstance.get(`/vehicles/${id}/inspection`).then((r) => r.data);

export const createVehicleInspection = (
  id: number,
  body: {
    inspectionNumber?: string;
    inspectionDate?: string;
    expiryDate: string;
    result?: "passed" | "failed";
    documentId?: number;
  }
) => axiosInstance.post(`/vehicles/${id}/inspection`, body).then((r) => r.data);

export const deleteVehicleInspection = (vehicleId: number, insId: number) =>
  axiosInstance.delete(`/vehicles/${vehicleId}/inspection/${insId}`).then((r) => r.data);

// --- Images ---
export const getVehicleImages = (id: number) =>
  axiosInstance.get(`/vehicles/${id}/images`).then((r) => r.data);

export const setPrimaryImage = (vehicleId: number, documentId: number) =>
  axiosInstance
    .put(`/vehicles/${vehicleId}/primary-image`, { documentId })
    .then((r) => r.data);

export const deleteDocument = (docId: number) =>
  axiosInstance.delete(`/documents/${docId}`).then((r) => r.data);

export const uploadDocuments = (formData: FormData) =>
  axiosInstance.post("/documents", formData).then((r) => r.data);

// --- Profile ---
export const getVehicleProfile = (id: number) =>
  axiosInstance.get(`/vehicles/${id}/profile`).then((r) => r.data);

export const upsertVehicleProfile = (id: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return axiosInstance.put(`/vehicles/${id}/profile`, formData).then((r) => r.data);
};

export const deleteVehicleProfile = (id: number) =>
  axiosInstance.delete(`/vehicles/${id}/profile`).then((r) => r.data);
