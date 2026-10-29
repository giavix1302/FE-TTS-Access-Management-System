// Danh mục dịch vụ — spec: docs/docs-be/service_catalog_fe.md
// Danh mục chỉ có tên, đơn vị, trạng thái, cờ gán xe. KHÔNG có giá / mã / mô tả / nhóm dịch vụ.
export interface ServiceCatalogItem {
  id: number
  name: string
  /** Danh sách đơn vị được phép; phần tử đầu là mặc định. */
  units: string[]
  isActive: boolean
  /** Dòng HĐ thuộc dịch vụ này có gán xe được không (dịch vụ thuê xe = true). Đổi cờ có hiệu lực ngay cho mọi HĐ */
  allowVehicle: boolean
}

export interface CreateServiceInput {
  name: string
  units: string[]
  /** Không gửi = false */
  allowVehicle?: boolean
}

// Bỏ key / null = giữ nguyên (gồm cả allowVehicle). Chuỗi rỗng bị 400 (không xóa được)
export interface UpdateServiceInput {
  name?: string
  /** Gửi là thay toàn bộ danh sách; bỏ key = giữ nguyên. */
  units?: string[]
  allowVehicle?: boolean
}
