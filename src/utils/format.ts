// Format tiền VNĐ: 50000000 → "50.000.000 ₫"
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

// Format ngày: "2026-01-05" → "05/01/2026"
export const formatDate = (date: string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("vi-VN");
};

// Format datetime: ISO → "05/01/2026 08:00"
export const formatDateTime = (date: string | null): string => {
  if (!date) return "—";
  return new Date(date).toLocaleString("vi-VN");
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
