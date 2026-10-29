// Format tiền VNĐ: 50000000 → "50.000.000 ₫"
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

// Đảm bảo parse đúng UTC — BE trả ISO không có Z suffix
const parseUtc = (date: string): Date => {
  const s = date.endsWith("Z") || date.includes("+") ? date : date + "Z";
  return new Date(s);
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Format ngày: "2026-01-05" → "05/01/2026" (giờ VN UTC+7)
// Chuỗi DateOnly (yyyy-MM-dd) không có giờ → format thẳng, không đổi múi giờ
export const formatDate = (date: string | null | undefined): string => {
  if (!date) return "—";
  const m = DATE_ONLY.exec(date);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return parseUtc(date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
};

// Ngày thuần BE trả dạng "2026-10-20T00:00:00" (có thể kèm Z) → cắt 10 ký tự đầu, KHÔNG qua Date
// (tránh lệch 1 ngày theo múi giờ). Dùng trước formatDate() và khi gửi lại lên BE (cần yyyy-MM-dd)
export const toDateOnly = (value: string | null | undefined): string | undefined =>
  value ? value.slice(0, 10) : undefined;

// Format datetime: ISO → "05/01/2026 08:00" (giờ VN UTC+7)
export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return "—";
  return parseUtc(date).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Tính số ngày còn lại đến hạn
export const daysUntil = (date: string): number => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Xác định trạng thái hết hạn
export const getExpiryStatus = (date: string): "valid" | "expiring" | "expired" => {
  const days = daysUntil(date);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
};
