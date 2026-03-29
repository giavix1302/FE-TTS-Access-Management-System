export const QUERY_KEYS = {
  vehicles: {
    all: ["vehicles"] as const,
    detail: (id: number) => ["vehicles", id] as const,
    insurance: (id: number) => ["vehicles", id, "insurance"] as const,
    inspection: (id: number) => ["vehicles", id, "inspection"] as const,
  },
  contracts: {
    all: ["contracts"] as const,
    detail: (id: number) => ["contracts", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    detail: (id: number) => ["customers", id] as const,
  },
  users: {
    all: ["users"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  companySettings: ["company-settings"] as const,
};
