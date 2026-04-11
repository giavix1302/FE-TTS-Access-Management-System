import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { DatePicker } from '@/components/shared/DatePicker'
import { getIncidents, createIncident, updateIncident } from '@/api/contracts.api'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import type { ContractStatus, ContractVehicle, Incident, IncidentType, ChargedTo } from '@/types/contract.types'

// ─── Constants ────────────────────────────────────────────────────────────────
const INCIDENT_TYPE_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: 'breakdown', label: 'Hư hỏng' },
  { value: 'replacement', label: 'Đổi xe' },
  { value: 'repair_onsite', label: 'Sửa tại chỗ' },
]

const INCIDENT_TYPE_CHIP: Record<IncidentType, string> = {
  breakdown: 'bg-error-light text-error',
  replacement: 'bg-accent-light text-accent',
  repair_onsite: 'bg-info-light text-info',
}

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  breakdown: 'Hư hỏng',
  replacement: 'Đổi xe',
  repair_onsite: 'Sửa tại chỗ',
}

const CHARGED_TO_OPTIONS: { value: ChargedTo; label: string }[] = [
  { value: 'company', label: 'Công ty chịu' },
  { value: 'customer', label: 'Khách hàng chịu' },
]

// ─── IncidentDialog ───────────────────────────────────────────────────────────
const incidentCreateSchema = z.object({
  contract_vehicle_id: z.number({ invalid_type_error: 'Bắt buộc' }).min(1, 'Bắt buộc'),
  incident_date: z.string().min(1, 'Bắt buộc'),
  incident_type: z.enum(['breakdown', 'replacement', 'repair_onsite']),
  description: z.string().min(1, 'Bắt buộc').max(1000),
  downtime_days: z.number().nullable().optional(),
  cost_amount: z.number().nullable().optional(),
  charged_to: z.enum(['customer', 'company']).nullable().optional(),
  replacement_contract_vehicle_id: z.number().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})
  .refine(
    (d) => d.incident_type !== 'replacement' || !!d.replacement_contract_vehicle_id,
    { message: 'Bắt buộc chọn xe thay thế khi loại sự cố là Đổi xe', path: ['replacement_contract_vehicle_id'] }
  )
  .refine(
    (d) => !d.replacement_contract_vehicle_id || d.replacement_contract_vehicle_id !== d.contract_vehicle_id,
    { message: 'Xe thay thế không được trùng với xe sự cố', path: ['replacement_contract_vehicle_id'] }
  )

const incidentEditSchema = z.object({
  description: z.string().min(1, 'Bắt buộc').max(1000),
  downtime_days: z.number().nullable().optional(),
  cost_amount: z.number().nullable().optional(),
  charged_to: z.enum(['customer', 'company']).nullable().optional(),
  replacement_contract_vehicle_id: z.number().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})

type IncidentCreateForm = z.infer<typeof incidentCreateSchema>
type IncidentEditForm = z.infer<typeof incidentEditSchema>

function IncidentDialog({
  open,
  onOpenChange,
  contractId,
  contractVehicles,
  editItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  contractVehicles: ContractVehicle[]
  editItem?: Incident
}) {
  const queryClient = useQueryClient()
  const isEdit = !!editItem

  // Create form
  const createForm = useForm<IncidentCreateForm>({
    resolver: zodResolver(incidentCreateSchema),
    defaultValues: { charged_to: null, replacement_contract_vehicle_id: null, resolved_at: null },
  })

  // Edit form
  const editForm = useForm<IncidentEditForm>({
    resolver: zodResolver(incidentEditSchema),
    defaultValues: isEdit
      ? {
          description: editItem.description,
          downtime_days: editItem.downtime_days,
          cost_amount: editItem.cost_amount,
          charged_to: editItem.charged_to,
          replacement_contract_vehicle_id: editItem.replacement_contract_vehicle?.id ?? null,
          resolved_at: editItem.resolved_at ?? null,
        }
      : {},
  })

  const incidentType = createForm.watch('incident_type')
  const contractVehicleId = createForm.watch('contract_vehicle_id')

  const mutation = useMutation({
    mutationFn: (body: IncidentCreateForm | IncidentEditForm) =>
      isEdit
        ? updateIncident(contractId, editItem!.id, body)
        : createIncident(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'incidents'] })
      toast.success(isEdit ? 'Đã cập nhật sự cố' : 'Đã ghi nhận sự cố')
      onOpenChange(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const handleCreate = createForm.handleSubmit((d) => mutation.mutate(d))
  const handleEdit = editForm.handleSubmit((d) => mutation.mutate(d))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa sự cố' : 'Ghi nhận sự cố'}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          // ─── Edit form ─────────────────────────────────────────────────────
          <form onSubmit={handleEdit} className="space-y-4">
            {/* Read-only fields */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-md p-3 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Xe</p>
                <p className="font-medium text-text-primary">
                  {editItem.contract_vehicle.vehicle.model} · {editItem.contract_vehicle.vehicle.serial_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Ngày sự cố</p>
                <p className="font-medium text-text-primary">{formatDate(editItem.incident_date)}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Loại sự cố</p>
                <p className="font-medium text-text-primary">{INCIDENT_TYPE_LABELS[editItem.incident_type]}</p>
              </div>
            </div>
            <Separator />

            <div className="space-y-1">
              <Label>Mô tả <span className="text-error">*</span></Label>
              <Textarea rows={3} maxLength={1000} {...editForm.register('description')} />
              {editForm.formState.errors.description && (
                <p className="text-xs text-error">{editForm.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Số ngày dừng hoạt động</Label>
                <Input type="number" step="0.1" min={0} {...editForm.register('downtime_days', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
              </div>
              <div className="space-y-1">
                <Label>Chi phí (₫)</Label>
                <Input type="number" min={0} {...editForm.register('cost_amount', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Bên chịu chi phí</Label>
              <Controller
                control={editForm.control}
                name="charged_to"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Không xác định" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không xác định</SelectItem>
                      {CHARGED_TO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {editItem.incident_type === 'replacement' && (
              <div className="space-y-1">
                <Label>Xe thay thế</Label>
                <Controller
                  control={editForm.control}
                  name="replacement_contract_vehicle_id"
                  render={({ field }) => (
                    <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Chọn xe thay thế" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không có</SelectItem>
                        {contractVehicles
                          .filter((cv) => cv.id !== editItem.contract_vehicle.id)
                          .map((cv) => (
                            <SelectItem key={cv.id} value={cv.id.toString()}>
                              {cv.vehicle.model} · {cv.vehicle.serial_number}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  )}
                />
                {editForm.formState.errors.replacement_contract_vehicle_id && (
                  <p className="text-xs text-error">{editForm.formState.errors.replacement_contract_vehicle_id.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Thời điểm xử lý xong</Label>
              <Controller
                control={editForm.control}
                name="resolved_at"
                render={({ field }) => (
                  <DatePicker value={field.value ?? undefined} onChange={field.onChange} placeholder="Chưa xử lý" />
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Hủy</Button>
              <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // ─── Create form ───────────────────────────────────────────────────
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label>Xe <span className="text-error">*</span></Label>
              <Controller
                control={createForm.control}
                name="contract_vehicle_id"
                render={({ field }) => (
                  <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Chọn xe" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractVehicles.map((cv) => (
                        <SelectItem key={cv.id} value={cv.id.toString()}>
                          {cv.vehicle.model} · {cv.vehicle.serial_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {createForm.formState.errors.contract_vehicle_id && (
                <p className="text-xs text-error">{createForm.formState.errors.contract_vehicle_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ngày sự cố <span className="text-error">*</span></Label>
                <Controller
                  control={createForm.control}
                  name="incident_date"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} />
                  )}
                />
                {createForm.formState.errors.incident_date && (
                  <p className="text-xs text-error">{createForm.formState.errors.incident_date.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Loại sự cố <span className="text-error">*</span></Label>
                <Controller
                  control={createForm.control}
                  name="incident_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Chọn loại" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCIDENT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {createForm.formState.errors.incident_type && (
                  <p className="text-xs text-error">{createForm.formState.errors.incident_type.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Mô tả <span className="text-error">*</span></Label>
              <Textarea rows={3} maxLength={1000} {...createForm.register('description')} />
              {createForm.formState.errors.description && (
                <p className="text-xs text-error">{createForm.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Số ngày dừng hoạt động</Label>
                <Input type="number" step="0.1" min={0} {...createForm.register('downtime_days', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
              </div>
              <div className="space-y-1">
                <Label>Chi phí (₫)</Label>
                <Input type="number" min={0} {...createForm.register('cost_amount', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Bên chịu chi phí</Label>
              <Controller
                control={createForm.control}
                name="charged_to"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Không xác định" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không xác định</SelectItem>
                      {CHARGED_TO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {incidentType === 'replacement' && (
              <div className="space-y-1">
                <Label>Xe thay thế <span className="text-error">*</span></Label>
                <Controller
                  control={createForm.control}
                  name="replacement_contract_vehicle_id"
                  render={({ field }) => (
                    <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue placeholder="Chọn xe thay thế" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractVehicles
                          .filter((cv) => cv.id !== contractVehicleId)
                          .map((cv) => (
                            <SelectItem key={cv.id} value={cv.id.toString()}>
                              {cv.vehicle.model} · {cv.vehicle.serial_number}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  )}
                />
                {createForm.formState.errors.replacement_contract_vehicle_id && (
                  <p className="text-xs text-error">{createForm.formState.errors.replacement_contract_vehicle_id.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Thời điểm xử lý xong</Label>
              <Controller
                control={createForm.control}
                name="resolved_at"
                render={({ field }) => (
                  <DatePicker value={field.value ?? undefined} onChange={field.onChange} placeholder="Chưa xử lý" />
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Hủy</Button>
              <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── IncidentsTab ─────────────────────────────────────────────────────────────
interface IncidentsTabProps {
  contractId: number
  contractStatus: ContractStatus
  contractVehicles: ContractVehicle[]
  canEdit: boolean
  initialData?: Incident[]
}

export function IncidentsTab({ contractId, contractStatus, contractVehicles, canEdit, initialData }: IncidentsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Incident | undefined>()

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'incidents'],
    queryFn: () => getIncidents(contractId),
    initialData,
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Incident) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-text-primary">Sự cố</span>
        {canEdit && contractStatus === 'active' && (
          <Button variant="outline" size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus size={14} />
            Ghi nhận sự cố
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : !incidents || incidents.length === 0 ? (
        <EmptyState message="Chưa có sự cố nào" />
      ) : (
        incidents.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 flex gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary text-sm">
                {item.contract_vehicle.vehicle.model} · {item.contract_vehicle.vehicle.serial_number}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-full ${INCIDENT_TYPE_CHIP[item.incident_type]}`}>
                  {INCIDENT_TYPE_LABELS[item.incident_type]}
                </span>
                <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CalendarIcon size={10} />
                  {formatDate(item.incident_date)}
                </span>
                {item.downtime_days !== null && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                    {item.downtime_days} ngày
                  </span>
                )}
                {item.cost_amount !== null && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.cost_amount)}
                  </span>
                )}
                {item.charged_to === 'company' && (
                  <span className="bg-error-light text-error text-xs px-2.5 py-1 rounded-full">Công ty chịu</span>
                )}
                {item.charged_to === 'customer' && (
                  <span className="bg-accent-light text-accent text-xs px-2.5 py-1 rounded-full">Khách hàng chịu</span>
                )}
                {item.resolved_at ? (
                  <span className="bg-success-light text-success text-xs px-2.5 py-1 rounded-full">
                    ✅ Đã xử lý: {formatDate(item.resolved_at)}
                  </span>
                ) : (
                  <span className="bg-warning-light text-warning text-xs px-2.5 py-1 rounded-full">
                    ⏳ Chưa xử lý
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-text-secondary mt-2">{item.description}</p>
              )}
              {item.replacement_contract_vehicle && (
                <p className="text-sm text-text-secondary mt-1">
                  Xe thay thế: {item.replacement_contract_vehicle.vehicle.model} · {item.replacement_contract_vehicle.vehicle.serial_number}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-col gap-1 flex-none">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(item)}
                  className="cursor-pointer h-8 w-8 p-0"
                >
                  <Pencil size={14} />
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      <IncidentDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingItem(undefined) }}
        contractId={contractId}
        contractVehicles={contractVehicles}
        editItem={editingItem}
      />
    </div>
  )
}
