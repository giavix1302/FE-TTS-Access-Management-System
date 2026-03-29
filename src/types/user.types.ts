export type UserRole = "admin" | "manager" | "accountant" | "staff";

export interface User {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  roles: UserRole[];
  permissions: string[];
  is_active: boolean;
  created_at: string;
}
