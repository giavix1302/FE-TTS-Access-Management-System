import { useAuthStore } from "@/stores/authStore";

export const usePermission = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  return { hasPermission, hasRole };
};
