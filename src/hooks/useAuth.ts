import { useAuthStore } from "@/stores/authStore";

export const useAuth = () => {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();

  return {
    user,
    isAuthenticated: !!accessToken,
    setAuth,
    clearAuth,
  };
};
