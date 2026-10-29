import { getApiError, getApiErrorStatus } from "@/utils/apiError";

// Mã lỗi luồng Danh mục → Dòng dịch vụ → Xe (spec service_catalog_fe.md §12)
const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  SERVICE_NOT_FOUND: "Dịch vụ không tồn tại hoặc đã ẩn",
  SERVICE_NAME_EXISTS: "Tên dịch vụ đã tồn tại",
  CONTRACT_NOT_ACTIVE: "Chỉ thao tác được khi hợp đồng đang hiệu lực",
  CONTRACT_NOT_FOUND: "Không tìm thấy hợp đồng",
  LINE_ITEM_NOT_FOUND: "Không tìm thấy dòng dịch vụ",
  LINE_ITEM_HAS_VEHICLES: "Dòng dịch vụ đã có xe, không thể xóa. Hãy gỡ xe trước",
  LINE_ITEM_VEHICLE_ON_SITE:
    "Dòng dịch vụ đã đủ số xe chưa trả theo số lượng đã khai báo",
  LINE_ITEM_QUANTITY_BELOW_VEHICLES: "Số lượng không được nhỏ hơn số xe chưa trả của dòng",
  INVALID_UNIT: "Đơn vị không thuộc danh sách đơn vị của dịch vụ",
  LINE_ITEM_VEHICLE_NOT_ALLOWED: "Dịch vụ này không còn cho phép gán xe",
  VEHICLE_NOT_FOUND: "Không tìm thấy xe",
  CONTRACT_VEHICLE_NOT_FOUND: "Không tìm thấy xe trong hợp đồng",
  INVALID_DATE_RANGE: "Ngày trả phải sau hoặc bằng ngày xuất bãi",
  VEHICLE_ALREADY_DEPLOYED: "Xe đã xuất bãi, không thể gỡ. Muốn kết thúc hãy ghi ngày trả",
  VEHICLE_HAS_INCIDENTS: "Xe đã có sự cố ghi nhận, không thể gỡ",
  VEHICLE_NOT_DEPLOYED: "Chỉ ghi sự cố cho xe đã xuất bãi",
  VEHICLE_NOT_ASSIGNABLE: "Xe hiện không đủ điều kiện để gán vào hợp đồng",
  REPLACEMENT_INVALID: "Xe được thay chưa đủ điều kiện để gán xe thay thế",
  VEHICLE_ALREADY_REPLACED: "Xe cũ đã có xe thay thế",
  CONTRACT_NUMBER_EXISTS: "Số hợp đồng đã tồn tại",
  ADDENDUM_NOT_FOUND: "Không tìm thấy phụ lục của hợp đồng này",
  ADDENDUM_HAS_LINE_ITEMS: "Phụ lục còn dòng dịch vụ, hãy xóa các dòng trước khi xóa phụ lục",
  AMOUNT_MISMATCH: "Tiền trước thuế + VAT lệch quá 1.000₫ so với tổng tiền",
};

// Các mã này phụ thuộc ngữ cảnh → ưu tiên message BE
// (VEHICLE_ALREADY_IN_CONTRACT: xe có thể đang ở dòng khác của chính HĐ này hoặc HĐ khác)
const PREFER_SERVER_MESSAGE = new Set([
  "VALIDATION_ERROR",
  "VEHICLE_ALREADY_IN_CONTRACT",
  "INVALID_UNIT",
  "VEHICLE_NOT_ASSIGNABLE",
  "REPLACEMENT_INVALID",
]);

const STATUS_MESSAGES: Record<number, string> = {
  400: "Dữ liệu gửi lên không hợp lệ",
  403: "Bạn không có quyền thực hiện thao tác này",
  404: "Không tìm thấy dữ liệu",
};

export function getServiceErrorMessage(err: unknown): string {
  const { code, message } = getApiError(err);
  const status = getApiErrorStatus(err);
  if (code && PREFER_SERVER_MESSAGE.has(code) && message) return message;
  return (
    (code ? ERROR_MESSAGES[code] : undefined) ??
    message ??
    (status ? STATUS_MESSAGES[status] : undefined) ??
    "Có lỗi xảy ra"
  );
}
