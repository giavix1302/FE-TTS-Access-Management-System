import { toast } from "sonner";

export interface ApiErrorDetail {
  field: string;
  message: string;
  contactId?: number;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: ApiErrorDetail[];
}

// Đọc `error` trong envelope lỗi của BE: { success: false, error: { code, message, details[] } }
export const getApiError = (err: unknown): ApiErrorBody =>
  (err as { response?: { data?: { error?: ApiErrorBody } } })?.response?.data?.error ?? {};

export const getApiErrorMessage = (err: unknown, fallback = "Có lỗi xảy ra"): string =>
  getApiError(err).message ?? fallback;

// HTTP status — dùng khi BE trả lỗi không theo envelope (vd. lỗi bind JSON, routing 404)
export const getApiErrorStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

// 409: hai request ghi cùng một dòng cùng lúc → main.tsx tải lại dữ liệu; dialog phải đóng để mở lại với
// dữ liệu mới, không gửi lại payload cũ. FE không gửi version — BE tự xử lý (docs-02112026.md §7)
export const isConcurrentUpdateError = (err: unknown): boolean =>
  getApiError(err).code === "CONCURRENT_UPDATE";

// Số giây phải chờ của 429. BE chưa expose `Retry-After` qua CORS nên khác origin trình duyệt không đọc được
// header → dự phòng bằng thời gian ghi trong message ("…thử lại sau 5 phút" / "…sau 20 giây")
export function getRetryAfterSeconds(err: unknown): number | undefined {
  const header = (err as { response?: { headers?: Record<string, unknown> } })?.response?.headers?.[
    "retry-after"
  ];
  const seconds = Number(header);
  if (header != null && Number.isFinite(seconds) && seconds > 0) return seconds;
  const match = /(\d+)\s*(phút|giây)/.exec(getApiError(err).message ?? "");
  if (!match) return undefined;
  return match[2] === "phút" ? Number(match[1]) * 60 : Number(match[1]);
}

// Ô nhận lỗi của form: danh sách tên (trùng tên field BE), map { fieldBE: ôForm }, hoặc hàm tự quyết định
export type ApiErrorFields =
  | readonly string[]
  | Readonly<Record<string, string>>
  | ((field: string) => string | undefined);

const resolveField = (fields: ApiErrorFields, field: string): string | undefined => {
  if (typeof fields === "function") return fields(field);
  if (Array.isArray(fields)) return fields.includes(field) ? field : undefined;
  return (fields as Readonly<Record<string, string>>)[field];
};

// Xử lý lỗi dùng chung cho form tạo/sửa (docs-02112026.md §6.1) — map theo `details[].field`, KHÔNG theo HTTP status:
// - details khớp ô đang hiển thị → setError vào ô đó
// - details không khớp ô nào → toast message, không nuốt lỗi
// - không có details → toast `fallback` hoặc message của BE
// Trả về true nếu có ít nhất một lỗi đã gắn vào ô.
export function applyApiErrors(
  err: unknown,
  setError: (name: never, error: { type: string; message: string }) => void,
  fields: ApiErrorFields,
  fallback?: string,
): boolean {
  const { message, details } = getApiError(err);
  if (!details?.length) {
    toast.error(fallback ?? message ?? "Có lỗi xảy ra");
    return false;
  }
  let mapped = false;
  const unmatched = new Set<string>();
  details.forEach((detail) => {
    const name = detail.field.charAt(0).toLowerCase() + detail.field.slice(1);
    const target = resolveField(fields, name);
    if (target) {
      setError(target as never, { type: "server", message: detail.message });
      mapped = true;
    } else {
      unmatched.add(detail.message);
    }
  });
  unmatched.forEach((text) => toast.error(text));
  return mapped;
}
