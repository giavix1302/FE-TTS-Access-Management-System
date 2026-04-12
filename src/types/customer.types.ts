export type CustomerType = "individual" | "business";

// ─── List item (GET /customers) ───────────────────────────────────────────────
export interface CustomerListItem {
  id: number;
  customer_type: CustomerType;
  display_name: string;
  short_name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Detail — cá nhân (GET /customers/:id, customer_type = "individual") ──────
export interface IndividualCustomer {
  id: number;
  customer_type: "individual";
  is_active: boolean;
  full_name: string;
  date_of_birth?: string | null;
  gender?: "male" | "female" | "other" | null;
  nationality?: string | null;
  cccd: string;
  cccd_issue_date?: string | null;
  cccd_issue_place?: string | null;
  hometown?: string | null;
  permanent_address?: string | null;
  phone: string;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Detail — doanh nghiệp (GET /customers/:id, customer_type = "business") ───
export interface BusinessCustomer {
  id: number;
  customer_type: "business";
  is_active: boolean;
  international_name: string;
  short_name: string;
  tax_code: string;
  tax_address?: string | null;
  office_address?: string | null;
  representative?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerDetail = IndividualCustomer | BusinessCustomer;

// ─── Contract history item (GET /customers/:id/contracts) ─────────────────────
export interface CustomerContractItem {
  id: number;
  contract_number: string;
  status: "active" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  total_amount: number;
  created_at: string;
}
