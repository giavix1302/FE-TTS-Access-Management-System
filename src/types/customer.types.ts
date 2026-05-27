export type CustomerType = "individual" | "business";

// ─── List item (GET /customers) ───────────────────────────────────────────────
export interface CustomerListItem {
  id: number;
  customerType: CustomerType;
  displayName: string;
  shortName?: string | null;
  phone: string;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Detail — cá nhân (GET /customers/:id, customerType = "individual") ──────
export interface IndividualCustomer {
  id: number;
  customerType: "individual";
  isActive: boolean;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
  nationality?: string | null;
  nationalId: string;
  nationalIdIssueDate?: string | null;
  nationalIdIssuePlace?: string | null;
  hometown?: string | null;
  permanentAddress?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Detail — doanh nghiệp (GET /customers/:id, customerType = "business") ───
export interface BusinessCustomer {
  id: number;
  customerType: "business";
  isActive: boolean;
  internationalName: string;
  shortName: string;
  taxCode: string;
  taxAddress?: string | null;
  officeAddress?: string | null;
  representative?: string | null;
  representativeTitle?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomerDetail = IndividualCustomer | BusinessCustomer;

// ─── Contract history item (GET /customers/:id/contracts) ─────────────────────
export interface CustomerContractItem {
  id: number;
  contractNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  createdAt: string;
}
