/** Các ký tự phone mà BE hỗ trợ trước bước normalize. */
export const PHONE_INPUT_PATTERN = "[0-9+ ().-]*";

/** Đồng bộ quy tắc normalize của BE để validation phía client cho kết quả giống server. */
export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  return compact.startsWith("+84") ? `0${compact.slice(3)}` : compact;
}

export function isValidPhone(value: string, required: boolean): boolean {
  const raw = value.trim();
  if (!raw) return !required;
  if (!/^[0-9+\s().-]+$/.test(raw)) return false;
  return /^\d{10,11}$/.test(normalizePhone(raw));
}

export const PHONE_VALIDATION_MESSAGE = "Số điện thoại phải gồm 10–11 chữ số";
