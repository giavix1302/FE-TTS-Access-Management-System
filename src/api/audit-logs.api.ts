import axiosInstance from "./axios";
import type {
  AuditLogDetail,
  AuditLogParams,
  AuditLogsResponse,
} from "@/types/auditLog.types";

// Lưu ý: param lọc dùng camelCase, phân trang dùng `page_size`
export const getAuditLogs = (params?: AuditLogParams): Promise<AuditLogsResponse> =>
  axiosInstance.get("/audit-logs", { params }).then((r) => r.data);

export const getAuditLogDetail = (id: number): Promise<AuditLogDetail> =>
  axiosInstance.get(`/audit-logs/${id}`).then((r) => r.data.data);

export const getContractHistory = (
  id: number,
  params?: { page?: number; page_size?: number },
): Promise<AuditLogsResponse> =>
  axiosInstance.get(`/contracts/${id}/history`, { params }).then((r) => r.data);

export const getCustomerHistory = (
  id: number,
  params?: { page?: number; page_size?: number },
): Promise<AuditLogsResponse> =>
  axiosInstance.get(`/customers/${id}/history`, { params }).then((r) => r.data);
