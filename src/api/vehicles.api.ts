import axiosInstance from "./axios";
import type {
  CreateInspectionBody,
  CreateInsuranceBody,
  CreateVehicleBody,
  InspectionRecord,
  InsuranceRecord,
  VehicleDetail,
  VehicleImagesData,
  VehicleListParams,
  VehicleListResponse,
  VehicleLocation,
  VehicleProfile,
  VehicleStatus,
  VehicleStatusLogsResponse,
  VehicleUpsertBody,
} from "@/types/vehicle.types";

// Spec: docs/docs-be/vehicle_fe.md — query string snake_case, body camelCase

export const getVehicles = (params?: VehicleListParams): Promise<VehicleListResponse> =>
  axiosInstance.get("/vehicles", { params }).then((r) => r.data);

export const getVehicleById = (id: number): Promise<{ data: VehicleDetail }> =>
  axiosInstance.get(`/vehicles/${id}`).then((r) => r.data);

// Không phân biệt hoa thường — mã sai / đã sinh lại / xe đã xóa → 404 VEHICLE_NOT_FOUND
export const getVehicleByQr = (qrCode: string): Promise<{ data: VehicleDetail }> =>
  axiosInstance.get(`/vehicles/by-qr/${encodeURIComponent(qrCode)}`).then((r) => r.data);

export const createVehicle = (body: CreateVehicleBody): Promise<{ data: { id: number } }> =>
  axiosInstance.post("/vehicles", body).then((r) => r.data);

// PUT ghi đè toàn bộ — field thông số null = xóa giá trị; bỏ lat/lng = giữ vị trí cũ
export const updateVehicle = (id: number, body: VehicleUpsertBody) =>
  axiosInstance.put(`/vehicles/${id}`, body).then((r) => r.data);

export const deleteVehicle = (id: number) =>
  axiosInstance.delete(`/vehicles/${id}`).then((r) => r.data);

export const changeVehicleStatus = (
  id: number,
  body: { newStatus: VehicleStatus; reason?: string }
) => axiosInstance.patch(`/vehicles/${id}/status`, body).then((r) => r.data);

export const getVehicleStatusLogs = (
  id: number,
  params?: { page?: number; page_size?: number }
): Promise<VehicleStatusLogsResponse> =>
  axiosInstance
    .get(`/vehicles/${id}/status-logs`, { params })
    .then((r) => r.data);

// Quyền vehicles.status — staff dùng được
export const updateVehicleLocation = (
  id: number,
  body: { lat: number; lng: number }
): Promise<{ data: VehicleLocation }> =>
  axiosInstance.put(`/vehicles/${id}/location`, body).then((r) => r.data);

// Mã cũ hết hiệu lực ngay
export const regenerateVehicleQrCode = (id: number): Promise<{ data: { qrCode: string } }> =>
  axiosInstance.post(`/vehicles/${id}/qr-code/regenerate`).then((r) => r.data);

// --- Insurance (không có PUT — sai thì xóa rồi tạo lại) ---
export const getVehicleInsurance = (id: number): Promise<{ data: InsuranceRecord[] }> =>
  axiosInstance.get(`/vehicles/${id}/insurance`).then((r) => r.data);

export const createVehicleInsurance = (id: number, body: CreateInsuranceBody) =>
  axiosInstance.post(`/vehicles/${id}/insurance`, body).then((r) => r.data);

export const deleteVehicleInsurance = (vehicleId: number, insId: number) =>
  axiosInstance.delete(`/vehicles/${vehicleId}/insurance/${insId}`).then((r) => r.data);

// --- Inspection (không có PUT) ---
export const getVehicleInspection = (id: number): Promise<{ data: InspectionRecord[] }> =>
  axiosInstance.get(`/vehicles/${id}/inspection`).then((r) => r.data);

export const createVehicleInspection = (id: number, body: CreateInspectionBody) =>
  axiosInstance.post(`/vehicles/${id}/inspection`, body).then((r) => r.data);

export const deleteVehicleInspection = (vehicleId: number, insId: number) =>
  axiosInstance.delete(`/vehicles/${vehicleId}/inspection/${insId}`).then((r) => r.data);

// --- Images ---
export const getVehicleImages = (id: number): Promise<{ data: VehicleImagesData }> =>
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
// GET trả mảng 0 hoặc 1 phần tử
export const getVehicleProfile = (id: number): Promise<{ data: VehicleProfile[] }> =>
  axiosInstance.get(`/vehicles/${id}/profile`).then((r) => r.data);

export const upsertVehicleProfile = (id: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return axiosInstance.put(`/vehicles/${id}/profile`, formData).then((r) => r.data);
};

export const deleteVehicleProfile = (id: number) =>
  axiosInstance.delete(`/vehicles/${id}/profile`).then((r) => r.data);
