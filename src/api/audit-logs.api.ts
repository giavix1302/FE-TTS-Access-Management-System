import axiosInstance from "./axios";
import type {
  AuditLogDetail,
  AuditLogGroupsResponse,
  AuditLogParams,
  AuditLogsResponse,
} from "@/types/auditLog.types";

// Lưu ý: param lọc dùng camelCase, phân trang dùng `page_size`
export const getAuditLogs = (params?: AuditLogParams): Promise<AuditLogsResponse> =>
  axiosInstance.get("/audit-logs", { params }).then((r) => r.data);

export const getAuditLogDetail = (id: number): Promise<AuditLogDetail> =>
  axiosInstance.get(`/audit-logs/${id}`).then((r) => r.data.data);

// Các endpoint /groups: BE gộp theo requestId, `page_size` và `meta` tính theo NHÓM (tối đa 100/trang)
export const getAuditLogGroups = (params?: AuditLogParams): Promise<AuditLogGroupsResponse> =>
  axiosInstance.get("/audit-logs/groups", { params }).then((r) => r.data);

export const getContractHistoryGroups = (
  id: number,
  params?: { page?: number; page_size?: number },
): Promise<AuditLogGroupsResponse> =>
  axiosInstance.get(`/contracts/${id}/history/groups`, { params }).then((r) => r.data);

export const getCustomerHistoryGroups = (
  id: number,
  params?: { page?: number; page_size?: number },
): Promise<AuditLogGroupsResponse> =>
  axiosInstance.get(`/customers/${id}/history/groups`, { params }).then((r) => r.data);
