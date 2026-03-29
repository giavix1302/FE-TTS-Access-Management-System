export type ContractStatus = "active" | "completed" | "cancelled";

export interface Contract {
  id: number;
  contract_number: string;
  customer_id: number;
  status: ContractStatus;
  start_date: string;
  end_date: string;
  total_value: number;
  created_at: string;
  updated_at: string;
}
