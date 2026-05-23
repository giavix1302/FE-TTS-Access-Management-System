export type UserRole = "admin" | "manager" | "accountant" | "staff";

export interface User {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  roles: UserRole[];
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}
