// not_started: ngày bắt đầu ở tương lai. BE tự đặt và tự chuyển sang active khi tới ngày — FE KHÔNG gửi giá trị này
export type ContractStatus = 'not_started' | 'active' | 'completed' | 'cancelled'

interface StatusConfig {
  label: string
  className: string
}

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, StatusConfig> = {
  not_started: { label: 'Chưa bắt đầu', className: 'bg-gray-100 text-gray-600' },
  active:    { label: 'Đang thực hiện', className: 'bg-primary-light text-primary' },
  completed: { label: 'Hoàn thành',     className: 'bg-success-light text-success' },
  cancelled: { label: 'Đã hủy',         className: 'bg-error-light text-error' },
}

export const CONTRACT_STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_CONFIG).map(
  ([value, { label }]) => ({ value: value as ContractStatus, label })
)

// HĐ còn "mở": thao tác như nhau (sửa, thêm dịch vụ, phụ lục, gán xe, sự cố). Chỉ khác nút đổi trạng thái
export function isContractOpen(status: string) {
  return status === 'active' || status === 'not_started'
}

export function getContractStatusBadge(status: string) {
  const config = CONTRACT_STATUS_CONFIG[status as ContractStatus]
  return config ?? { label: status, className: 'bg-bg-page text-text-secondary' }
}
