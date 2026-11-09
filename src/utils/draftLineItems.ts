import type { QueryClient } from "@tanstack/react-query";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { applyApiErrors, getApiError } from "@/utils/apiError";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { CreateContractLineItemInput, ExtractedLineItem } from "@/types/contract.types";

// Nháp dòng dịch vụ + xe, dùng chung cho form Tạo hợp đồng và form Thêm phụ lục
// (cả hai gửi `lineItems[]` cùng dạng, BE trả cùng mã lỗi + field `lineItems[i]...`).
// Phần giao diện: pages/contracts/components/DraftLineItems.tsx

export interface VehicleDraft {
  vehicle_id: number;
  work_days: number;
  note: string;
}

export interface LineItemDraft {
  _key: string; // local unique key
  service_id: number | null;
  service_name: string;
  unit: string;
  // Dịch vụ cho phép gán xe (allowVehicle) — chỉ dòng này mới chọn được xe
  allow_vehicle: boolean;
  unit_price: number | undefined;
  quantity: number | undefined;
  duration: number | undefined;
  // Dòng thuê xe chọn tối đa quantity xe; AI không tự chọn xe.
  vehicles: VehicleDraft[];
  // Ghi chú dòng (BE `note`, ≤ 500) — BE không có field description riêng cho dòng
  note: string;
}

/** _key của dòng → { "unit" | "vehicles[0].vehicleId"… → message } */
export type LineErrors = Record<string, Record<string, string>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Lỗi BE theo dòng: `lineItems[1].unit`, `lineItems[0].vehicles[1].vehicleId`
const LINE_ERROR_FIELD =
  /^lineItems\[(\d+)\]\.(serviceId|unit|unitPrice|quantity|duration|note|vehicles\[\d+\]\.vehicleId)$/;

export function createEmptyLineDraft(): LineItemDraft {
  return {
    _key: crypto.randomUUID(),
    service_id: null,
    service_name: "",
    unit: "",
    allow_vehicle: false,
    unit_price: undefined,
    quantity: 1,
    duration: undefined,
    vehicles: [],
    note: "",
  };
}

/** Dòng AI đọc được (đã khớp danh mục, chưa có xe) → nháp để người dùng chỉnh + gán xe */
export function draftsFromExtract(items: ExtractedLineItem[]): LineItemDraft[] {
  return items.map((item) => ({
    _key: crypto.randomUUID(),
    service_id: item.serviceId,
    service_name: item.serviceName,
    unit: item.unit,
    allow_vehicle: item.allowVehicle,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    duration: item.duration,
    vehicles: [],
    note: item.note ?? "",
  }));
}

export function getDraftTotal(lines: LineItemDraft[]): number {
  return lines.reduce(
    (sum, li) => sum + (li.unit_price ?? 0) * (li.quantity ?? 0) * (li.duration ?? 1),
    0,
  );
}

/** Trả message lỗi đầu tiên (để toast) hoặc null nếu hợp lệ */
export function validateLineDrafts(lines: LineItemDraft[]): string | null {
  // Dòng chưa chọn dịch vụ sẽ bị bỏ qua khi gửi → chặn để không mất dữ liệu âm thầm
  if (lines.some((li) => li.service_id === null)) {
    return "Vui lòng chọn dịch vụ cho mọi dòng hoặc xóa dòng trống";
  }
  // BE: unitPrice > 0, quantity > 0
  if (lines.some((li) => !((li.unit_price ?? 0) > 0) || !((li.quantity ?? 0) > 0))) {
    return "Đơn giá và số lượng của dòng dịch vụ phải lớn hơn 0";
  }
  if (lines.some((li) => li.allow_vehicle && !Number.isInteger(li.quantity))) {
    return "Số lượng của dòng thuê xe phải là số nguyên";
  }
  if (lines.some((li) => li.vehicles.length > (li.quantity ?? 0))) {
    return "Số xe được chọn không được vượt quá số lượng của dòng";
  }
  if (
    lines.some((li) =>
      li.vehicles.some(
        (v) => !Number.isInteger(v.work_days) || v.work_days < 0 || v.work_days > 3650,
      ),
    )
  ) {
    return "Số ngày làm của xe phải là số nguyên từ 0 đến 3650";
  }
  return null;
}

/** Nháp → `lineItems[]` của POST /contracts và POST /contracts/{id}/addendums */
export function buildLineItemsPayload(lines: LineItemDraft[]): CreateContractLineItemInput[] {
  return lines.map((li, index) => ({
    serviceId: li.service_id!,
    unitPrice: li.unit_price!,
    quantity: li.quantity!,
    unit: li.unit,
    ...(li.duration != null ? { duration: li.duration } : {}),
    sortOrder: index,
    ...(li.note.trim() ? { note: li.note.trim() } : {}),
    ...(li.allow_vehicle && li.vehicles.length > 0
      ? {
          vehicles: li.vehicles.map((vehicle) => ({
            vehicleId: vehicle.vehicle_id,
            workDays: vehicle.work_days,
            ...(vehicle.note.trim() ? { note: vehicle.note.trim() } : {}),
          })),
        }
      : {}),
  }));
}

/**
 * Lỗi BE của form có dòng dịch vụ: `lineItems[i].…` gắn vào đúng dòng, field khác vào ô form qua `formFields`.
 * Map theo `details[].field`, không theo HTTP status. Xe vừa chọn không còn gán được → làm mới danh sách xe.
 * `setFormError` nhận tên ô form (đã map).
 */
export function applyLineItemApiErrors(
  err: unknown,
  lineItems: LineItemDraft[],
  setFormError: (name: string, error: { type: string; message: string }) => void,
  formFields: readonly string[] | Readonly<Record<string, string>>,
  queryClient: QueryClient,
): { lineErrors: LineErrors; mapped: boolean } {
  const lineErrors: LineErrors = {};
  const mapped = applyApiErrors(
    err,
    (name: string, { message }) => {
      const line = LINE_ERROR_FIELD.exec(name);
      if (!line) {
        setFormError(name, { type: "server", message });
        return;
      }
      const key = lineItems[Number(line[1])]._key;
      lineErrors[key] = { ...lineErrors[key], [line[2]]: message };
    },
    (field) => {
      const line = LINE_ERROR_FIELD.exec(field);
      if (line) return lineItems[Number(line[1])] ? field : undefined;
      if (Array.isArray(formFields)) return formFields.includes(field) ? field : undefined;
      return (formFields as Readonly<Record<string, string>>)[field];
    },
    getServiceErrorMessage(err),
  );
  // Xe vừa chọn không còn gán được → làm mới dropdown để chọn xe khác
  const { code } = getApiError(err);
  if (code === "VEHICLE_NOT_ASSIGNABLE" || code === "VEHICLE_ALREADY_IN_CONTRACT") {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
  }
  return { lineErrors, mapped };
}

