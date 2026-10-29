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
