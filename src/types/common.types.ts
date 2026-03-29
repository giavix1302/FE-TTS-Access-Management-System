export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export type StatusBadgeType =
  | "at_yard"       // Tại bãi
  | "renting"       // Đang thuê
  | "maintenance"   // Bảo trì
  | "active"        // Active
  | "completed"     // Hoàn thành
  | "cancelled"     // Hủy
  | "valid"         // Còn hạn
  | "expiring"      // Sắp hết hạn
  | "expired";      // Quá hạn
