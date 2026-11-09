export interface LoginRequest {
  /** SĐT hoặc email */
  identifier: string;
  password: string;
  /** true = refresh token 90 ngày */
  rememberMe?: boolean;
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
