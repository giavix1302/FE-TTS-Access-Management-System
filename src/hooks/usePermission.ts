import { useAuthStore } from "@/stores/authStore";

export const usePermission = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  const hasAnyRole = (...roles: string[]): boolean => {
    return user?.roles?.some((r) => roles.includes(r)) ?? false;
  };

  return { hasPermission, hasRole, hasAnyRole };
};
