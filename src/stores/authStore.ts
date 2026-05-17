import { create } from "zustand";

interface User {
  id: number;
  full_name: string;
  phone: string;
  email?: string | null;
  avatar_url?: string | null;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

// Không persist gì vào localStorage:
// - accessToken: in-memory (mất khi reload → tự refresh qua HttpOnly cookie)
// - refreshToken: HttpOnly cookie, JS không đọc được
// - user: lấy lại từ GET /auth/me sau mỗi lần reload
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
