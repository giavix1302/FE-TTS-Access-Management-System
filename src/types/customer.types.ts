export type CustomerType = "individual" | "business";

export interface Customer {
  id: number;
  type: CustomerType;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tax_code?: string;
  created_at: string;
  updated_at: string;
}
