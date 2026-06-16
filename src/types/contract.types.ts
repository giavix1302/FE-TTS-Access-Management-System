export type ContractStatus = 'active' | 'completed' | 'cancelled'
export type AddendumType = 'extension' | 'price_change' | 'add_service' | 'mixed'
export type IncidentType = 'breakdown' | 'replacement' | 'repair_onsite'
export type ChargedTo = 'customer' | 'company'

export interface ContractCustomerBusiness {
  id: number
  customerType: 'business'
  displayName: string
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
  displayName: string
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

export interface ContractListItem {
  id: number
  contractNumber: string
  status: ContractStatus
  customer: ContractCustomer
  startDate: string
  plannedDays: number
  endDate: string
  totalAmount: number
  createdAt: string
}

export interface ContractDetail extends ContractListItem {
  siteAddress: string
  subtotal: number
  taxAmount: number
  excludedDays: number
  excludedReason: string | null
  document: ContractDocument | null
  lineItems: LineItem[]
  vehicles: ContractVehicle[]
  createdBy: { id: number; fullName: string } | null
}

export interface ContractSummary {
  contractId: number
  startDate: string
  actualEndDate: string | null
  totalDays: number | null
  amountPayable: number
  amountPaid: number
  amountRemaining: number
  totalAddendums: number
  acceptanceRecordCount: number
  addendumCount: number
  invoiceCount: number
}

export interface LineItem {
  id: number
  service: { id: number; name: string; unit: string }
  vehicleId: number | null
  unitPrice: number
  quantity: number
  lineTotal: number
  sortOrder: number
}

export interface ContractVehicle {
  id: number
  vehicle: { id: number; model: string; serialNumber: string; status: string }
  deployDate: string | null
  returnDate: string | null
  extraDays: number
}

export interface ContractDocument {
  id: number
  docType: string
  fileName: string
  mimeType: string
  fileSizeKb: number
  note: string | null
  uploadedAt: string
  sasUrl: string
  sasExpiresAt: string
}

export interface Addendum {
  id: number
  addendumNumber: string
  addendumType: AddendumType
  startDate: string | null
  newEndDate: string | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  content: string | null
  document: ContractDocument | null
  createdAt: string
  createdBy: { id: number; fullName: string }
}

export interface AcceptanceRecord {
  id: number
  recordNumber: string
  recordDate: string
  actualStartDate: string
  actualEndDate: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  document: ContractDocument | null
  createdAt: string
  createdBy: { id: number; fullName: string }
}

export interface Invoice {
  id: number
  invoiceNumber: string | null
  invoiceDate: string
  amount: number
  note: string | null
  document: ContractDocument | null
  createdAt: string
  createdBy: { id: number; fullName: string }
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
  downtimeDays: number | null
  costAmount: number | null
  chargedTo: ChargedTo | null
  replacementContractVehicle: {
    id: number
    vehicle: { id: number; model: string; serialNumber: string }
  } | null
  resolvedAt: string | null
  createdAt: string
  createdBy: { id: number; fullName: string }
}
