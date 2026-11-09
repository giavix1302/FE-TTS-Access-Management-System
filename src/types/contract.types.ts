import type { VehicleStatus } from '@/types/vehicle.types'

export type ContractStatus = 'not_started' | 'active' | 'completed' | 'cancelled'
// breakdown: chỉ còn ở dữ liệu cũ (BE sẽ đổi sang repair_onsite bằng SQL) → giữ để hiển thị, không tạo mới được
export type IncidentType = 'breakdown' | 'replacement' | 'repair_onsite'
export type CreatableIncidentType = Exclude<IncidentType, 'breakdown'>
export type ChargedTo = 'customer' | 'company'

export interface CreateContractInput {
  customerId: number
  startDate: string
  siteAddress: string
  contractNumber?: string
  /** ≥ 0, không gửi = 0. Chỉ để hiển thị, không ảnh hưởng công nợ */
  depositAmount?: number
  documentId?: number
  lineItems?: CreateContractLineItemInput[]
}

export interface CreateContractLineItemInput {
  serviceId: number
  unitPrice: number
  quantity: number
  unit?: string
  duration?: number
  sortOrder?: number
  note?: string
  vehicles?: CreateContractVehicleInput[]
}

// Không có deployDate: BE tự ghi khi xe chuyển sang renting (gửi có giá trị → 400)
export interface CreateContractVehicleInput {
  vehicleId: number
  workDays?: number
  note?: string
}

export interface UpdateContractInput {
  contractNumber?: string
  startDate?: string
  siteAddress?: string
  /** Không gửi = không đổi */
  depositAmount?: number
  documentId?: number
}

export interface ChangeContractStatusInput {
  status: ContractStatus
  reason?: string
  reopenReason?: string
}

export interface CreateLineItemInput {
  serviceId: number
  unitPrice: number
  quantity: number
  unit?: string
  duration?: number
  sortOrder?: number
  /** Có = dòng thuộc phụ lục này (phụ lục không thuộc HĐ → 404 ADDENDUM_NOT_FOUND) */
  addendumId?: number
  /** ≤ 500 */
  note?: string
}

export interface UpdateLineItemInput {
  unitPrice?: number
  quantity?: number
  unit?: string
  /** 0 = bỏ thời gian; bỏ key = giữ nguyên. */
  duration?: number
  sortOrder?: number
  /** Không gửi = không đổi, "" = xóa */
  note?: string
}

// Không có deployDate: BE tự ghi khi xe chuyển sang renting (gửi có giá trị → 400)
export interface AddContractVehicleInput {
  lineItemId: number
  vehicleId: number
  workDays?: number
  note?: string
  replacesContractVehicleId?: number
}

// BE không nhận returnDate ở đây — ngày trả chỉ ghi qua PATCH /vehicles/{id}/status
export interface UpdateContractVehicleInput {
  /** Chỉ sửa được khi HĐ active và xe đã xuất bãi / đang renting (ngược lại 400 VEHICLE_NOT_DEPLOYED) */
  deployDate?: string
  /** Số ngày làm của riêng xe này, 0–3650 (0 = chưa nhập). HĐ đã đóng → 400 CONTRACT_NOT_ACTIVE */
  workDays?: number
  /** Không gửi = không đổi; chuỗi rỗng = xóa. */
  note?: string
  /** Chỉ dùng để đổi xe còn ở bãi. */
  vehicleId?: number
}

// Tiền phụ lục BE tự tính từ các dòng của phụ lục → body không có tiền / ngày kết thúc mới.
// Không còn addendumType (BE bỏ 04/11 — gửi lên là thừa)
export interface CreateAddendumInput {
  addendumNumber: string
  /** Bắt buộc khi tạo (thiếu → 400 VALIDATION_ERROR field startDate); PUT thì tùy chọn, không xóa về trống được.
   *  Trước ngày bắt đầu HĐ → 400 ADDENDUM_START_BEFORE_CONTRACT */
  startDate: string
  content?: string
  documentId?: number
  /** Cùng dạng với POST /contracts (mỗi dòng kèm `vehicles[]` được). Lưu 1 lượt: một dòng lỗi → không tạo gì */
  lineItems?: CreateContractLineItemInput[]
}

/** PUT phụ lục chỉ sửa 4 field này — KHÔNG nhận lineItems (thêm/sửa/xóa dòng dùng /line-items kèm addendumId) */
export type UpdateAddendumInput = Partial<Omit<CreateAddendumInput, 'lineItems'>>

export interface CreateAcceptanceRecordInput {
  recordNumber: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  /** Số tiền đã cọc, ≥ 0 */
  depositAmount?: number
  /** Số ngày trừ, số nguyên ≥ 0 */
  excludedDays?: number
  /** ≤ 500; PUT "" = xóa */
  excludedReason?: string
  documentId?: number
}

export interface CreateInvoiceInput {
  /** Bắt buộc, ≤ 20 (vd 1C26TTS) */
  invoiceSymbol: string
  invoiceNumber?: string
  invoiceDate: string
  subtotal: number
  taxAmount: number
  /** > 0; |subtotal + taxAmount − totalAmount| > 1.000đ → 400 AMOUNT_MISMATCH */
  totalAmount: number
  note?: string
  documentId?: number
}

export interface CreateIncidentInput {
  contractVehicleId: number
  incidentDate: string
  incidentType: CreatableIncidentType
  description: string
  downtimeDays?: number | null
  costAmount?: number | null
  chargedTo?: ChargedTo | null
  resolvedAt?: string | null
}

export interface UpdateIncidentInput {
  description?: string
  downtimeDays?: number | null
  costAmount?: number | null
  chargedTo?: ChargedTo | null
  /** BE yêu cầu luôn gửi field này; null nghĩa là chủ động đánh dấu chưa xử lý. */
  resolvedAt: string | null
}

// Customer trong GET /contracts/{id} — BE KHÔNG trả displayName (chỉ list có).
// Tên hiển thị: business = internationalName (CompanyName), individual = fullName
export interface ContractCustomerBusiness {
  id: number
  customerType: 'business'
  isActive?: boolean
  internationalName?: string
  shortName?: string
  taxCode?: string
  taxAddress?: string
  officeAddress?: string
  representative?: string
  phone?: string
  email?: string
}

export interface ContractCustomerIndividual {
  id: number
  customerType: 'individual'
  isActive?: boolean
  fullName?: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  cccd?: string
  cccdIssueDate?: string
  cccdIssuePlace?: string
  hometown?: string
  phone?: string
  email?: string
  permanentAddress?: string
}

export type ContractCustomer = ContractCustomerBusiness | ContractCustomerIndividual

/** Customer trong list GET /contracts (BE ContractCustomerBrief) — chỉ có id/type/displayName */
export interface ContractCustomerBrief {
  id: number
  customerType: 'business' | 'individual'
  displayName: string
}

export interface ContractListItem {
  id: number
  contractNumber?: string
  status: ContractStatus
  customer: ContractCustomerBrief
  startDate: string
  /** startDate + tổng workDays của chuỗi thay xe dài nhất − 1 (kể cả dòng phụ lục).
   *  Chưa có xe hoặc mọi xe workDays = 0 → không có */
  endDate?: string
  /** BE tính (HĐ active và endDate < hôm nay giờ VN). Chỉ là chip phụ — status vẫn là active. FE KHÔNG tự tính lại */
  isExpired: boolean
  /** Chỉ để hiển thị, không ảnh hưởng công nợ */
  depositAmount: number
  /** Chỉ cộng dòng HĐ gốc */
  totalAmount: number
  /** Chỉ có ở list. Số xe đã gán vào dòng dịch vụ (kể cả dòng phụ lục), tính cả xe đã trả; xe được thay vẫn chỉ tính 1. ≥ 0 */
  vehicleCount: number
  createdAt: string
}

export interface ContractDetail extends Omit<ContractListItem, 'customer' | 'vehicleCount'> {
  customer: ContractCustomer
  siteAddress: string
  subtotal: number
  taxAmount: number
  document?: ContractDocument
  /** Cả dòng HĐ gốc lẫn dòng phụ lục (dòng gốc trước, rồi theo phụ lục) — nhóm theo addendumId */
  lineItems: LineItem[]
  vehicles: ContractVehicle[]
  createdBy?: { id: number; fullName: string }
}

export interface ContractSummary {
  contractId: number
  startDate: string
  /** Chưa có BBNT: tổng HĐ gốc + tổng các phụ lục */
  amountPayable: number
  /** Tổng totalAmount của hóa đơn */
  amountPaid: number
  amountRemaining: number
  totalAddendums: number
  acceptanceRecordCount: number
  addendumCount: number
  invoiceCount: number
}

// name/unit/allowVehicle đều LIVE theo danh mục hiện tại (đổi tên dịch vụ → mọi HĐ hiển thị tên mới).
// Có sẵn trong GET /contracts/{id} nên staff không xem được danh mục vẫn biết dòng nào gán được xe
export interface ServiceBrief {
  id: number
  name: string
  units: string[]
  allowVehicle: boolean
}

export interface LineItem {
  id: number
  service: ServiceBrief
  /** Đơn vị chốt trên dòng; không lấy đơn vị hiển thị từ service. */
  unit: string
  unitPrice: number
  quantity: number
  duration?: number
  lineTotal: number
  sortOrder: number
  /** Không có = dòng HĐ gốc */
  addendumId?: number
  note?: string
}

// Xe thuộc hợp đồng qua dòng dịch vụ (contract_vehicles.line_item_id).
// id là contractVehicleId — KHÁC vehicle.id. Mỗi dòng có tối đa `quantity` lần giao chưa trả.
// Ngày null bị BE bỏ key → optional, KHÔNG so sánh `=== null`
export interface ContractVehicle {
  id: number
  lineItemId: number
  vehicle: { id: number; model: string; serialNumber: string; status: VehicleStatus }
  deployDate?: string
  returnDate?: string
  /** Số ngày xe này làm, không cộng dồn với xe trước — BE cộng theo chuỗi thay xe để ra endDate */
  workDays: number
  note?: string
  replacesContractVehicleId?: number
}

export interface ContractDocument {
  id: number
  docType: string
  fileName: string
  mimeType: string
  fileSizeKb: number
  note?: string
  uploadedAt: string
  sasUrl: string
  sasExpiresAt: string
}

export interface Addendum {
  id: number
  addendumNumber?: string
  startDate?: string
  /** Tự tính từ lineItems của phụ lục (cùng VAT công ty) — chỉ đọc */
  subtotal: number
  taxAmount: number
  totalAmount: number
  lineItems: LineItem[]
  content?: string
  document?: ContractDocument
  createdAt: string
  createdBy?: { id: number; fullName: string }
}

export interface AcceptanceRecord {
  id: number
  recordNumber: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  depositAmount: number
  excludedDays: number
  excludedReason?: string
  document?: ContractDocument
  createdAt: string
  createdBy?: { id: number; fullName: string }
}

export interface Invoice {
  id: number
  /** Hóa đơn tạo trước 27/10 trên DB dev: rỗng, 3 khoản tiền = 0 */
  invoiceSymbol?: string
  invoiceNumber?: string
  invoiceDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  note?: string
  document?: ContractDocument
  createdAt: string
  createdBy?: { id: number; fullName: string }
}

export interface Incident {
  id: number
  contractVehicle: {
    id: number
    vehicle: { id: number; model: string; serialNumber: string }
  }
  incidentDate: string
  incidentType: IncidentType
  description: string
  downtimeDays?: number
  costAmount?: number
  chargedTo?: ChargedTo
  replacementContractVehicle?: {
    id: number
    vehicle: { id: number; model: string; serialNumber: string }
  }
  resolvedAt?: string
  createdAt: string
  createdBy?: { id: number; fullName: string }
}

export type ExtractDocumentType =
  | 'contract'
  | 'addendum'
  | 'acceptance'
  | 'invoice'
  | 'insurance'
  | 'inspection'

export interface ExtractMetadata {
  characterCount: number
  sectionCount: number
  sources: string[]
  warnings: string[]
}

export interface ExtractAiMetadata {
  model: string
  durationMs: number
  clientRequestId: string
  providerRequestId?: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
}

export interface ExtractResponse<TFields> {
  success: true
  data: {
    documentId: number
    docType: ExtractDocumentType
    fields: TFields
    extraction: ExtractMetadata
    ai: ExtractAiMetadata
  }
}

export interface ExtractedCustomerFields {
  customerType?: 'business' | 'individual'
  companyName?: string
  fullName?: string
  taxCode?: string
  nationalId?: string
  address?: string
  phone?: string
  email?: string
  representativeName?: string
  representativeTitle?: string
}

export interface ContractAutofillFields {
  documentId: number
  contractNumber?: string
  startDate?: string
  siteAddress?: string
  depositAmount?: number
  customer: {
    status: 'matched' | 'new' | 'not_found'
    customerId?: number
    customerName?: string
    extracted?: ExtractedCustomerFields
  }
  lineItems: ExtractedLineItem[]
  fileTotals: ExtractedFileTotals
}

/** Dòng AI đọc được: chỉ gồm dòng khớp danh mục dịch vụ, không có xe (người dùng tự gán) */
export interface ExtractedLineItem {
  serviceId: number
  serviceName: string
  allowVehicle: boolean
  unit: string
  quantity?: number
  duration?: number
  unitPrice?: number
  lineTotal?: number
  note?: string
}

/** Tổng tiền ghi trong file — chỉ để đối chiếu, BE tự tính lại khi lưu. Không có bảng giá → các tổng là null */
export interface ExtractedFileTotals {
  subtotal?: number | null
  vatRate?: number | null
  taxAmount?: number | null
  totalAmount?: number | null
}

// Extract phụ lục: cùng phần dòng dịch vụ + fileTotals như extract hợp đồng (không còn addendumType).
// Không có bảng giá → lineItems = []
export interface AddendumAutofillFields {
  documentId: number
  addendumNumber?: string
  startDate?: string
  content?: string
  lineItems?: ExtractedLineItem[]
  fileTotals?: ExtractedFileTotals
}

export interface AcceptanceAutofillFields {
  documentId: number
  recordNumber?: string
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  depositAmount?: number
  excludedDays?: number
  excludedReason?: string
}

export interface InvoiceAutofillFields {
  documentId: number
  invoiceSymbol?: string
  invoiceNumber?: string
  invoiceDate?: string
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  note?: string
}
