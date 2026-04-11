export type ContractStatus = 'active' | 'completed' | 'cancelled'

interface StatusConfig {
  label: string
  className: string
}

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, StatusConfig> = {
  active:    { label: 'Đang thực hiện', className: 'bg-success-light text-success' },
  completed: { label: 'Hoàn thành',     className: 'bg-primary-light text-primary' },
  cancelled: { label: 'Đã hủy',         className: 'bg-error-light text-error' },
}

export const CONTRACT_STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_CONFIG).map(
  ([value, { label }]) => ({ value: value as ContractStatus, label })
)

export function getContractStatusBadge(status: string) {
  const config = CONTRACT_STATUS_CONFIG[status as ContractStatus]
  return config ?? { label: status, className: 'bg-bg-page text-text-secondary' }
}
