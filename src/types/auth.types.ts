export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    fullName: string;
    phone: string;
    email?: string;
    avatarUrl?: string;
    roles: string[];
    permissions: string[];
  };
}
