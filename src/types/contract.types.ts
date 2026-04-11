export type ContractStatus = 'active' | 'completed' | 'cancelled'
export type AddendumType = 'extension' | 'price_change' | 'add_service' | 'mixed'
export type IncidentType = 'breakdown' | 'replacement' | 'repair_onsite'
export type ChargedTo = 'customer' | 'company'

export interface ContractCustomerBusiness {
  id: number
  customer_type: 'business'
  display_name: string
  international_name?: string
  short_name?: string
  tax_code?: string
  tax_address?: string
  office_address?: string
  representative?: string
  phone?: string
  email?: string
}

export interface ContractCustomerIndividual {
  id: number
  customer_type: 'individual'
  display_name: string
  full_name?: string
  cccd?: string
  phone?: string
  email?: string
  permanent_address?: string
}

export type ContractCustomer = ContractCustomerBusiness | ContractCustomerIndividual

export interface ContractListItem {
  id: number
  contract_number: string
  status: ContractStatus
  customer: ContractCustomer
  start_date: string
  planned_days: number
  end_date: string
  total_amount: number
  created_at: string
}

export interface ContractDetail extends ContractListItem {
  site_address: string
  subtotal: number
  tax_amount: number
  excluded_days: number
  excluded_reason: string | null
  document: ContractDocument | null
  line_items: LineItem[]
  vehicles: ContractVehicle[]
  created_by: { id: number; full_name: string }
}

export interface ContractSummary {
  contract_id: number
  start_date: string
  actual_end_date: string | null
  total_days: number | null
  amount_payable: number
  amount_paid: number
  amount_remaining: number
  total_addendums: number
  acceptance_record_count: number
  addendum_count: number
  invoice_count: number
}

export interface LineItem {
  id: number
  service: { id: number; name: string; unit: string }
  vehicle_id: number | null
  unit_price: number
  quantity: number
  line_total: number
  sort_order: number
}

export interface ContractVehicle {
  id: number
  vehicle: { id: number; model: string; serial_number: string; status: string }
  deploy_date: string | null
  return_date: string | null
  extra_days: number
}

export interface ContractDocument {
  id: number
  doc_type: string
  file_name: string
  mime_type: string
  file_size_kb: number
  note: string | null
  uploaded_at: string
  sas_url: string
  sas_expires_at: string
}

export interface Addendum {
  id: number
  addendum_number: string
  addendum_type: AddendumType
  start_date: string | null
  new_end_date: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  content: string | null
  document: ContractDocument | null
  created_at: string
  created_by: { id: number; full_name: string }
}

export interface AcceptanceRecord {
  id: number
  record_number: string
  record_date: string
  actual_start_date: string
  actual_end_date: string
  subtotal: number
  tax_amount: number
  total_amount: number
  document: ContractDocument | null
  created_at: string
  created_by: { id: number; full_name: string }
}

export interface Invoice {
  id: number
  invoice_number: string | null
  invoice_date: string
  amount: number
  note: string | null
  document: ContractDocument | null
  created_at: string
  created_by: { id: number; full_name: string }
}

export interface Incident {
  id: number
  contract_vehicle: {
    id: number
    vehicle: { id: number; model: string; serial_number: string }
  }
  incident_date: string
  incident_type: IncidentType
  description: string
  downtime_days: number | null
  cost_amount: number | null
  charged_to: ChargedTo | null
  replacement_contract_vehicle: {
    id: number
    vehicle: { id: number; model: string; serial_number: string }
  } | null
  resolved_at: string | null
  created_at: string
  created_by: { id: number; full_name: string }
}
