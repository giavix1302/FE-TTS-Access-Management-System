export interface Permission {
  id: number;
  module: string;
  action: string;
  description: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}
