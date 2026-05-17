export type UserRole = "admin" | "manager" | "accountant" | "staff";

export interface User {
  id: number;
  full_name: string;
  phone: string;
  email?: string | null;
  avatar_url?: string | null;
  roles: UserRole[];
  permissions: string[];
  is_active: boolean;
  created_at: string;
}
