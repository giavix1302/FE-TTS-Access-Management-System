import type { AuditAction, AuditLogListItem } from "@/types/auditLog.types";
import { CONTRACT_STATUS_CONFIG } from "@/constants/contractStatus";
import { VEHICLE_STATUS_CONFIG } from "@/constants/vehicleStatus";
import { VEHICLE_TYPE_LABELS } from "@/constants/vehicleType";
import { CUSTOMER_TYPE_CONFIG } from "@/constants/customerType";
import { formatCurrency, formatDateTime } from "@/utils/format";

// ─── Action ───────────────────────────────────────────────────────────────────

export const AUDIT_ACTION_CONFIG: Record<AuditAction, { label: string; className: string }> = {
  insert:      { label: "Tạo mới",       className: "bg-success-light text-success" },
  update:      { label: "Cập nhật",      className: "bg-primary-light text-primary" },
  delete:      { label: "Xóa",           className: "bg-error-light text-error" },
  soft_delete: { label: "Xóa (lưu trữ)", className: "bg-warning-light text-warning" },
};

export function getAuditActionBadge(action: string) {
  return (
    AUDIT_ACTION_CONFIG[action as AuditAction] ?? {
      label: action,
      className: "bg-bg-page text-text-secondary",
    }
  );
}

// ─── Entity type (tên bảng) ───────────────────────────────────────────────────

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  contracts: "Hợp đồng",
  contract_line_items: "Hạng mục hợp đồng",
  contract_vehicles: "Xe trong hợp đồng",
  contract_incidents: "Sự cố",
  contract_addendums: "Phụ lục",
  contract_acceptance_records: "Biên bản nghiệm thu",
  contract_invoices: "Hóa đơn",
  contract_documents: "Tài liệu hợp đồng",
  contract_status_logs: "Đổi trạng thái hợp đồng",
  customers: "Khách hàng",
  customer_contacts: "Người liên hệ",
  customer_documents: "Tài liệu khách hàng",
  vehicles: "Xe",
  vehicle_insurances: "Bảo hiểm xe",
  vehicle_inspections: "Kiểm định xe",
  vehicle_status_logs: "Đổi trạng thái xe",
  users: "Người dùng",
  user_roles: "Vai trò của người dùng",
  roles: "Vai trò",
  role_permissions: "Quyền của vai trò",
  permissions: "Quyền",
  service_catalog: "Danh mục dịch vụ",
  documents: "Tệp đính kèm",
  bank_accounts: "Tài khoản ngân hàng",
  company_settings: "Thông tin công ty",
  ai_extract_logs: "Trích xuất AI",
};

export const AUDIT_ENTITY_OPTIONS = Object.entries(AUDIT_ENTITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const getAuditEntityLabel = (entityType: string) =>
  AUDIT_ENTITY_LABELS[entityType] ?? entityType;

// Link tới trang chi tiết của bản ghi gốc (nếu FE có trang đó)
const ROOT_ROUTES: Record<string, string> = {
  contracts: "/contracts",
  customers: "/customers",
  vehicles: "/vehicles",
};

export const getAuditRootLink = (rootType: string | null, rootId: number | string | null) =>
  rootType && rootId != null && ROOT_ROUTES[rootType] ? `${ROOT_ROUTES[rootType]}/${rootId}` : null;

// ─── Field labels (tên cột DB snake_case) ─────────────────────────────────────

const AMOUNT_LABELS = {
  subtotal: "Tạm tính",
  tax_amount: "Thuế",
  total_amount: "Tổng tiền",
};

const DOCUMENT_LINK_LABELS = {
  document_type: "Loại tài liệu",
  label: "Nhãn",
  document_id: "Tệp (id)",
  is_active: "Còn hiệu lực",
};

export const AUDIT_FIELD_LABELS: Record<string, Record<string, string>> = {
  contracts: {
    contract_number: "Số hợp đồng",
    customer_id: "Khách hàng (id)",
    status: "Trạng thái",
    status_reason: "Lý do trạng thái",
    start_date: "Ngày bắt đầu",
    // planned_days / excluded_*: cột cũ (đã bỏ 27/10) — giữ nhãn cho log lịch sử
    planned_days: "Số ngày dự kiến",
    excluded_days: "Số ngày trừ",
    excluded_reason: "Lý do trừ ngày",
    deposit_amount: "Tiền cọc",
    site_address: "Địa chỉ công trình",
    ...AMOUNT_LABELS,
    note: "Ghi chú",
  },
  contract_line_items: {
    service_id: "Dịch vụ (id)",
    description: "Mô tả",
    quantity: "Số lượng",
    unit: "Đơn vị",
    unit_price: "Đơn giá",
    line_total: "Thành tiền",
    sort_order: "Thứ tự",
    contract_id: "Hợp đồng (id)",
    addendum_id: "Phụ lục (id)",
    note: "Ghi chú",
  },
  contract_vehicles: {
    vehicle_id: "Xe (id)",
    line_item_id: "Hạng mục (id)",
    deploy_date: "Ngày triển khai",
    return_date: "Ngày trả",
    extra_days: "Ngày phát sinh",
    work_days: "Số ngày làm",
    note: "Ghi chú",
  },
  contract_incidents: {
    incident_type: "Loại sự cố",
    incident_date: "Ngày xảy ra",
    description: "Mô tả",
    downtime_days: "Số ngày dừng",
    cost_amount: "Chi phí",
    charged_to: "Bên chịu phí",
    resolved_at: "Ngày khắc phục",
  },
  contract_addendums: {
    addendum_number: "Số phụ lục",
    addendum_type: "Loại phụ lục",
    content: "Nội dung",
    start_date: "Ngày hiệu lực",
    new_end_date: "Ngày kết thúc mới",
    ...AMOUNT_LABELS,
    document_id: "Tệp (id)",
    note: "Ghi chú",
  },
  contract_acceptance_records: {
    record_number: "Số biên bản",
    record_date: "Ngày lập",
    actual_start_date: "Ngày bắt đầu thực tế",
    actual_end_date: "Ngày kết thúc thực tế",
    ...AMOUNT_LABELS,
    deposit_amount: "Số tiền đã cọc",
    excluded_days: "Số ngày trừ",
    excluded_reason: "Lý do trừ ngày",
    document_id: "Tệp (id)",
    note: "Ghi chú",
  },
  contract_invoices: {
    invoice_symbol: "Ký hiệu hóa đơn",
    invoice_number: "Số hóa đơn",
    invoice_date: "Ngày hóa đơn",
    amount: "Số tiền",
    ...AMOUNT_LABELS,
    document_id: "Tệp (id)",
    note: "Ghi chú",
  },
  contract_status_logs: {
    from_status: "Từ trạng thái",
    to_status: "Sang trạng thái",
    reason: "Lý do",
    changed_at: "Thời điểm",
    changed_by: "Người đổi (id)",
  },
  contract_documents: DOCUMENT_LINK_LABELS,
  customers: {
    customer_type: "Loại khách hàng",
    company_name: "Tên công ty",
    short_name: "Tên viết tắt",
    tax_code: "Mã số thuế",
    tax_address: "Địa chỉ xuất hóa đơn",
    office_address: "Địa chỉ văn phòng",
    representative_name: "Người đại diện",
    representative_title: "Chức vụ người đại diện",
    full_name: "Họ tên",
    gender: "Giới tính",
    date_of_birth: "Ngày sinh",
    national_id: "Số CCCD",
    national_id_issue_date: "Ngày cấp",
    national_id_issue_place: "Nơi cấp",
    nationality: "Quốc tịch",
    hometown: "Quê quán",
    permanent_address: "Địa chỉ thường trú",
    address: "Địa chỉ",
    phone: "Số điện thoại",
    email: "Email",
    is_active: "Đang hoạt động",
    note: "Ghi chú",
  },
  customer_contacts: {
    full_name: "Họ tên",
    title: "Chức vụ",
    phone: "Số điện thoại",
    email: "Email",
    is_active: "Đang hoạt động",
    customer_id: "Khách hàng (id)",
  },
  customer_documents: DOCUMENT_LINK_LABELS,
  vehicles: {
    serial_number: "Số serial",
    model: "Model",
    manufacturer: "Hãng",
    manufacture_year: "Năm SX",
    engine_type: "Loại động cơ",
    vehicle_type: "Loại xe",
    capacity: "Tải trọng",
    occupancy: "Số người",
    work_height: "Chiều cao làm việc",
    platform_height: "Chiều cao sàn",
    lifting_speed: "Tốc độ nâng",
    traveling_speed: "Tốc độ di chuyển",
    status: "Trạng thái",
    lat: "Vĩ độ",
    lng: "Kinh độ",
    location_updated_at: "Cập nhật vị trí lúc",
    qr_code: "Mã QR",
    primary_image_document_id: "Ảnh đại diện (id)",
    is_deleted: "Đã xóa",
    deleted_at: "Xóa lúc",
    note: "Ghi chú",
  },
  users: {
    password_hash: "Mật khẩu",
  },
};

// Nhãn chung cho cột trùng tên ở nhiều bảng (fallback khi bảng chưa có map riêng)
const COMMON_FIELD_LABELS: Record<string, string> = {
  name: "Tên",
  code: "Mã",
  full_name: "Họ tên",
  phone: "Số điện thoại",
  email: "Email",
  title: "Chức vụ",
  description: "Mô tả",
  is_active: "Đang hoạt động",
  is_default: "Mặc định",
  is_deleted: "Đã xóa",
  deleted_at: "Xóa lúc",
  note: "Ghi chú",
  status: "Trạng thái",
  unit: "Đơn vị",
  unit_price: "Đơn giá",
  expiry_date: "Ngày hết hạn",
  document_id: "Tệp (id)",
  avatar_document_id: "Ảnh đại diện (id)",
  logo_document_id: "Logo (id)",
  vehicle_id: "Xe (id)",
  user_id: "Người dùng (id)",
  role_id: "Vai trò (id)",
  permission_id: "Quyền (id)",
  bank_name: "Ngân hàng",
  bank_account_number: "Số tài khoản",
  account_holder: "Chủ tài khoản",
  address: "Địa chỉ",
  tax_code: "Mã số thuế",
};

export const getAuditFieldLabel = (entityType: string, column: string) =>
  AUDIT_FIELD_LABELS[entityType]?.[column] ?? COMMON_FIELD_LABELS[column] ?? column;

// ─── Value formatting ─────────────────────────────────────────────────────────

const MONEY_COLUMNS = new Set([
  "subtotal",
  "tax_amount",
  "total_amount",
  "line_total",
  "unit_price",
  "amount",
  "cost_amount",
  "deposit_amount",
]);

// Giá trị enum lưu thô trong DB → map nhãn theo module tương ứng
const toLabels = (config: Record<string, { label: string }>) =>
  Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v.label]));

const CONTRACT_STATUS_LABELS = toLabels(CONTRACT_STATUS_CONFIG);
const VEHICLE_STATUS_LABELS = toLabels(VEHICLE_STATUS_CONFIG);

const ENUM_LABELS: Record<string, Record<string, Record<string, string>>> = {
  contracts: { status: CONTRACT_STATUS_LABELS },
  contract_status_logs: { from_status: CONTRACT_STATUS_LABELS, to_status: CONTRACT_STATUS_LABELS },
  vehicles: { status: VEHICLE_STATUS_LABELS, vehicle_type: VEHICLE_TYPE_LABELS },
  vehicle_status_logs: { from_status: VEHICLE_STATUS_LABELS, to_status: VEHICLE_STATUS_LABELS },
  customers: {
    customer_type: toLabels(CUSTOMER_TYPE_CONFIG),
    gender: { male: "Nam", female: "Nữ", other: "Khác" },
  },
  contract_incidents: {
    incident_type: { breakdown: "Hư hỏng", replacement: "Đổi xe", repair_onsite: "Sửa tại chỗ" },
    charged_to: { company: "Công ty chịu", customer: "Khách hàng chịu" },
  },
  contract_addendums: {
    addendum_type: {
      extension: "Gia hạn",
      price_change: "Thay đổi giá",
      add_service: "Bổ sung dịch vụ",
      mixed: "Hỗn hợp",
    },
  },
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const EMPTY_VALUE = "(trống)";

export function formatAuditValue(entityType: string, column: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;

  if (typeof value === "boolean") return value ? "Có" : "Không";

  if (typeof value === "number") {
    if (MONEY_COLUMNS.has(column)) return formatCurrency(value);
    if (column.endsWith("_id") || column === "changed_by") return `#${value}`;
    return value.toLocaleString("vi-VN");
  }

  if (typeof value === "string") {
    const enumLabel = ENUM_LABELS[entityType]?.[column]?.[value];
    if (enumLabel) return enumLabel;
    // Cột *_date là ngày thuần nhưng BE có thể lưu DateTime "…T00:00:00" → bỏ giờ giả.
    // Cột *_at (changed_at, resolved_at…) là thời điểm thật → giữ giờ
    const dateOnly =
      column.endsWith("_date") && DATE_TIME_RE.test(value) ? value.slice(0, 10) : value;
    // Ngày thuần không có giờ → không convert múi giờ
    if (DATE_ONLY_RE.test(dateOnly)) {
      const [y, m, d] = dateOnly.split("-");
      return `${d}/${m}/${y}`;
    }
    if (DATE_TIME_RE.test(value)) return formatDateTime(value);
    return value;
  }

  return JSON.stringify(value);
}

// Cột không hiển thị trong phần chi tiết
export const HIDDEN_AUDIT_COLUMNS = new Set(["id"]);

export const getAuditActorName = (log: { userId: number | null; userName: string | null }) => {
  if (log.userId == null) return "Hệ thống";
  return log.userName ?? `Người dùng #${log.userId}`;
};

// Tóm tắt các cột bị đổi. insert/delete chứa mọi cột → không liệt kê (nhãn action đã nói rõ)
export function summarizeAuditChange(
  log: { action: AuditAction; entityType: string; changedFields: string[] },
  maxFields = 3,
): string | null {
  if (log.action !== "update") return null;
  const labels = (log.changedFields ?? [])
    .filter((c) => !HIDDEN_AUDIT_COLUMNS.has(c))
    .map((c) => getAuditFieldLabel(log.entityType, c));
  if (labels.length === 0) return null;
  const shown = labels.slice(0, maxFields).join(", ");
  const rest = labels.length - maxFields;
  return rest > 0 ? `Đổi: ${shown} +${rest}` : `Đổi: ${shown}`;
}

// Cột bị BE che giá trị → hiện thông điệp thay vì giá trị
const MASKED_AUDIT_COLUMNS: Record<string, Record<string, { insert: string; other: string }>> = {
  users: { password_hash: { insert: "Đã đặt mật khẩu", other: "Đã đổi mật khẩu" } },
};

export function getAuditMaskedText(entityType: string, column: string, action: AuditAction) {
  const masked = MASKED_AUDIT_COLUMNS[entityType]?.[column];
  if (!masked) return null;
  return action === "insert" ? masked.insert : masked.other;
}

// Các dòng liền nhau cùng requestId = 1 thao tác trên UI
export function groupByRequest(logs: AuditLogListItem[]): AuditLogListItem[][] {
  const groups: AuditLogListItem[][] = [];
  for (const log of logs) {
    const last = groups[groups.length - 1];
    if (last && log.requestId && last[0].requestId === log.requestId) {
      last.push(log);
    } else {
      groups.push([log]);
    }
  }
  return groups;
}

