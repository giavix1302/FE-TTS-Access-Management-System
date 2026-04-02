export type VehicleStatus = 'at_yard' | 'renting' | 'maintenance' | 'broken' | 'sold'

interface StatusConfig {
  label: string
  className: string
}

export const VEHICLE_STATUS_CONFIG: Record<VehicleStatus, StatusConfig> = {
  at_yard:     { label: 'Trong bãi',     className: 'bg-success-light text-success' },
  renting:     { label: 'Đang cho thuê', className: 'bg-primary-light text-primary' },
  maintenance: { label: 'Bảo dưỡng',    className: 'bg-warning-light text-warning' },
  broken:      { label: 'Hỏng',         className: 'bg-error-light text-error' },
  sold:        { label: 'Đã bán',       className: 'bg-bg-page text-text-secondary' },
}

export const VEHICLE_STATUS_OPTIONS = Object.entries(VEHICLE_STATUS_CONFIG).map(
  ([value, { label }]) => ({ value: value as VehicleStatus, label })
)

export function getVehicleStatusBadge(status: string) {
  const config = VEHICLE_STATUS_CONFIG[status as VehicleStatus]
  return config ?? { label: status, className: 'bg-bg-page text-text-secondary' }
}
