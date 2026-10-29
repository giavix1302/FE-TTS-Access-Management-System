export type CustomerType = "individual" | "business";
export type CustomerGender = "male" | "female" | "other";
export type CustomerContractStatus = "active" | "completed" | "cancelled";

// ─── List item (GET /customers) ───────────────────────────────────────────────
export interface CustomerListItem {
  id: number;
  customerType: CustomerType;
  displayName: string;
  shortName?: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Detail — cá nhân (GET /customers/:id, customerType = "individual") ──────
export interface IndividualCustomer {
  id: number;
  customerType: "individual";
  isActive: boolean;
  fullName: string;
  dateOfBirth?: string;
  gender?: CustomerGender;
  nationality?: string;
  nationalId: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  hometown?: string;
  permanentAddress?: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
  contacts?: CustomerContact[];
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
  taxAddress?: string;
  officeAddress?: string;
  representative?: string;
  representativeTitle?: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
  contacts?: CustomerContact[];
  createdAt: string;
  updatedAt: string;
}

export type CustomerDetail = IndividualCustomer | BusinessCustomer;

// ─── Contact (available for individual and business customers) ───────────────
export interface CustomerContact {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  title?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Contact độc lập (/contacts) ────────────────────────────────────────────
export interface Contact {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListItem extends Contact {
  customerCount: number;
}

export interface ContactCustomer {
  customerId: number;
  customerType: CustomerType;
  displayName: string;
  customerIsActive: boolean;
  title?: string;
  isPrimary: boolean;
}

export interface ContactDetail extends Contact {
  customers?: ContactCustomer[];
}

// ─── Contract history item (GET /customers/:id/contracts) ─────────────────────
export interface CustomerContractItem {
  id: number;
  contractNumber?: string;
  status: CustomerContractStatus;
  startDate: string;
  /** Không có khi HĐ chưa gán xe */
  endDate?: string;
  totalAmount: number;
  createdAt: string;
}
