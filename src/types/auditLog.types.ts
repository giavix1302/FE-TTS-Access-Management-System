export type AuditAction = "insert" | "update" | "delete" | "soft_delete";

// "old" / "new" có thể vắng mặt (insert không có old, delete không có new)
// → kiểm tra bằng `"old" in change`, không so với null
export interface AuditFieldChange {
  old?: unknown;
  new?: unknown;
}

interface AuditLogBase {
  id: number;
  occurredAt: string;
  userId: number | null;
  userName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  rootType: string | null;
  rootId: number | string | null;
  requestId: string | null;
}

// Item trong list — chỉ có tên cột bị đổi, không kèm giá trị
export interface AuditLogListItem extends AuditLogBase {
  changedFields: string[];
}

// GET /audit-logs/{id} — có giá trị old/new
export interface AuditLogDetail extends AuditLogBase {
  changes: Record<string, AuditFieldChange>;
  ipAddress: string | null;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLogListItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface AuditLogParams {
  entityType?: string;
  entityId?: string;
  userId?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD — BE tính trọn ngày
  page?: number;
  page_size?: number;
}
