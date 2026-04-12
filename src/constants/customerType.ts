import type { CustomerType } from "@/types/customer.types";

export const CUSTOMER_TYPE_CONFIG: Record<
  CustomerType,
  { label: string; className: string }
> = {
  individual: {
    label: "Cá nhân",
    className: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  business: {
    label: "Doanh nghiệp",
    className: "bg-[#FFF7ED] text-[#C2410C]",
  },
};

export const CUSTOMER_TYPE_OPTIONS = Object.entries(CUSTOMER_TYPE_CONFIG).map(
  ([value, { label }]) => ({ value: value as CustomerType, label }),
);

export function getCustomerTypeBadge(type: string) {
  const config = CUSTOMER_TYPE_CONFIG[type as CustomerType];
  return config ?? { label: type, className: "bg-bg-page text-text-secondary" };
}

export const CUSTOMER_ACTIVE_CONFIG = {
  active: {
    label: "Hoạt động",
    className: "bg-success-light text-success",
  },
  inactive: {
    label: "Vô hiệu",
    className: "bg-bg-page text-text-secondary",
  },
};

export function getCustomerActiveBadge(is_active: boolean) {
  return is_active
    ? CUSTOMER_ACTIVE_CONFIG.active
    : CUSTOMER_ACTIVE_CONFIG.inactive;
}
