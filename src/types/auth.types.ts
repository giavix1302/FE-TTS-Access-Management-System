export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    full_name: string;
    phone: string;
    email?: string;
    avatar_url?: string;
    roles: string[];
    permissions: string[];
  };
}
