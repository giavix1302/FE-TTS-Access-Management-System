export const QUERY_KEYS = {
  vehicles: {
    all: ["vehicles"] as const,
    detail: (id: number) => ["vehicles", id] as const,
    insurance: (id: number) => ["vehicles", id, "insurance"] as const,
    inspection: (id: number) => ["vehicles", id, "inspection"] as const,
    images: (id: number) => ["vehicles", id, "images"] as const,
    profile: (id: number) => ["vehicles", id, "profile"] as const,
    statusLogs: (id: number) => ["vehicles", id, "status-logs"] as const,
  },
  contracts: {
    all: ["contracts"] as const,
    detail: (id: number) => ["contracts", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    detail: (id: number) => ["customers", id] as const,
    contracts: (id: number) => ["customers", id, "contracts"] as const,
  },
  users: {
    all: ["users"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: ["dashboard", "summary"] as const,
    charts: ["dashboard", "charts"] as const,
    alerts: ["dashboard", "alerts"] as const,
  },
  companySettings: ["company-settings"] as const,
  serviceCatalog: {
    all: ["service-catalog"] as const,
  },
  roles: {
    all: ["roles"] as const,
    detail: (id: number) => ["roles", id] as const,
  },
  permissions: {
    all: ["permissions"] as const,
  },
};
