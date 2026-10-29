// Spec: docs/docs-be/vehicle_fe.md — field null bị BE bỏ khỏi response → khai báo optional, đọc bằng `?.` / `??`.

export type VehicleStatus = "at_yard" | "renting" | "maintenance" | "broken" | "sold";
export type EngineType = "Fuel" | "Electric";
export type InspectionResult = "passed" | "failed";
export type VehicleType =
  | "telescopic_boom"
  | "articulating_boom"
  | "scissor"
  | "vertical_mast"
  | "spider";

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// GET /vehicles — item danh sách
export interface VehicleListItem {
  id: number;
  serialNumber: string;
  model: string;
  manufacturer: string;
  manufactureYear: number;
  engineType: EngineType;
  /** Xe cũ chưa có loại → không có field */
  vehicleType?: VehicleType | null;
  status: VehicleStatus;
  workHeight?: number | null;
  primaryImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lat?: number | null;
  lng?: number | null;
  locationUpdatedAt?: string | null;
}

export interface VehicleListResponse {
  success: boolean;
  data: VehicleListItem[];
  meta: PageMeta;
}

export interface VehicleListParams {
  search?: string;
  status?: VehicleStatus;
  vehicle_type?: VehicleType;
  min_work_height?: number;
  max_work_height?: number;
  page?: number;
  page_size?: number;
}

// GET /vehicles/{id} và GET /vehicles/by-qr/{qrCode}
export interface VehicleDetail extends VehicleListItem {
  capacity?: number | null;
  occupancy?: number | null;
  platformHeight?: number | null;
  liftingSpeed?: number | null;
  travelingSpeed?: number | null;
  note?: string | null;
  qrCode: string;
}

// POST /vehicles — PUT dùng cùng body trừ serialNumber
export interface VehicleUpsertBody {
  model: string;
  manufacturer: string;
  manufactureYear: number;
  engineType: EngineType;
  // POST bắt buộc; PUT không gửi = giữ loại cũ
  vehicleType?: VehicleType;
  capacity: number | null;
  occupancy: number | null;
  platformHeight: number | null;
  workHeight: number | null;
  liftingSpeed: number | null;
  travelingSpeed: number | null;
  note: string | null;
  // Đi theo cặp. PUT không gửi → BE giữ vị trí cũ
  lat?: number;
  lng?: number;
}

export interface CreateVehicleBody extends VehicleUpsertBody {
  serialNumber: string;
  vehicleType: VehicleType;
}

export interface VehicleLocation {
  lat: number;
  lng: number;
  locationUpdatedAt: string;
}

export interface VehicleStatusLog {
  id: number;
  fromStatus: VehicleStatus;
  toStatus: VehicleStatus;
  reason?: string | null;
  changedAt: string;
  changedBy: number;
  changedByName: string;
}

export interface VehicleStatusLogsResponse {
  success: boolean;
  data: VehicleStatusLog[];
  meta: PageMeta;
}

// File private (bảo hiểm / kiểm định) — sasUrl hết hạn ~1 giờ
export interface VehicleDocumentRef {
  id: number;
  docType: string;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  note?: string | null;
  uploadedAt: string;
  sasUrl: string;
  sasExpiresAt: string;
}

export interface InsuranceRecord {
  id: number;
  insuranceNumber?: string | null;
  provider?: string | null;
  issueDate?: string | null; // yyyy-MM-dd
  expiryDate: string; // yyyy-MM-dd
  document?: VehicleDocumentRef | null;
  createdAt: string;
  createdById?: number | null;
  createdByName?: string | null;
}

export interface CreateInsuranceBody {
  insuranceNumber?: string;
  provider?: string;
  issueDate?: string;
  expiryDate: string;
  documentId?: number;
}

export interface InspectionRecord {
  id: number;
  inspectionNumber?: string | null;
  inspectionDate?: string | null; // yyyy-MM-dd
  expiryDate: string; // yyyy-MM-dd
  result?: InspectionResult | null;
  document?: VehicleDocumentRef | null;
  createdAt: string;
  createdById?: number | null;
  createdByName?: string | null;
}

export interface CreateInspectionBody {
  inspectionNumber?: string;
  inspectionDate?: string;
  expiryDate: string;
  result?: InspectionResult;
  documentId?: number;
}

// Ảnh xe ở vùng public — sasUrl cố định, không hết hạn
export interface VehicleImage {
  id: number;
  fileName: string;
  sasUrl: string;
  sasExpiresAt: string;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface VehicleImagesData {
  primaryImageId?: number | null;
  images: VehicleImage[];
  total: number;
  remainingSlots: number;
}

export interface VehicleProfile {
  id: number;
  fileName: string;
  sasUrl: string;
  sasExpiresAt: string;
  fileSizeKb: number;
  uploadedAt: string;
  uploadedById?: number | null;
  uploadedByName?: string | null;
}
