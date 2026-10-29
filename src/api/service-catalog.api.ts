import axiosInstance from "./axios";
import type { ApiResponse } from "@/types/common.types";
import type {
  CreateServiceInput,
  ServiceCatalogItem,
  UpdateServiceInput,
} from "@/types/serviceCatalog.types";

// Trả toàn bộ dịch vụ (cả đã ẩn), không phân trang, không meta → tìm/lọc phía FE
export const getServiceCatalog = (): Promise<ApiResponse<ServiceCatalogItem[]>> =>
  axiosInstance.get("/service-catalog").then((r) => r.data);

export const getServiceCatalogById = (id: number): Promise<ApiResponse<ServiceCatalogItem>> =>
  axiosInstance.get(`/service-catalog/${id}`).then((r) => r.data);

// 201 — data là cả object vừa tạo
export const createServiceCatalog = (body: CreateServiceInput): Promise<ApiResponse<ServiceCatalogItem>> =>
  axiosInstance.post("/service-catalog", body).then((r) => r.data);

// 200 — data là object sau khi sửa
export const updateServiceCatalog = (
  id: number,
  body: UpdateServiceInput,
): Promise<ApiResponse<ServiceCatalogItem>> =>
  axiosInstance.put(`/service-catalog/${id}`, body).then((r) => r.data);

// Ẩn/hiện: 204 No Content, idempotent. Quyền service_catalog.delete (KHÔNG phải update)
export const activateServiceCatalog = (id: number): Promise<void> =>
  axiosInstance.put(`/service-catalog/${id}/activate`).then(() => undefined);

export const deactivateServiceCatalog = (id: number): Promise<void> =>
  axiosInstance.put(`/service-catalog/${id}/deactivate`).then(() => undefined);
