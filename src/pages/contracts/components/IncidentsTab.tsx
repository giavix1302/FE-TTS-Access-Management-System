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
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from '@/components/shared/MobileSheet'
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
import { formatCurrency, formatDate } from '@/utils/format'
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
  contractVehicleId: z.number({ error: 'Bắt buộc' }).min(1, 'Bắt buộc'),
  incidentDate: z.string().min(1, 'Bắt buộc'),
  incidentType: z.enum(['breakdown', 'replacement', 'repair_onsite']),
  description: z.string().min(1, 'Bắt buộc').max(1000),
  downtimeDays: z.number().nullable().optional(),
  costAmount: z.number().nullable().optional(),
  chargedTo: z.enum(['customer', 'company']).nullable().optional(),
  replacementContractVehicleId: z.number().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
})
  .refine(
    (d) => d.incidentType !== 'replacement' || !!d.replacementContractVehicleId,
    { message: 'Bắt buộc chọn xe thay thế khi loại sự cố là Đổi xe', path: ['replacementContractVehicleId'] }
  )
  .refine(
    (d) => !d.replacementContractVehicleId || d.replacementContractVehicleId !== d.contractVehicleId,
    { message: 'Xe thay thế không được trùng với xe sự cố', path: ['replacementContractVehicleId'] }
  )

const incidentEditSchema = z.object({
  description: z.string().min(1, 'Bắt buộc').max(1000),
  downtimeDays: z.number().nullable().optional(),
  costAmount: z.number().nullable().optional(),
  chargedTo: z.enum(['customer', 'company']).nullable().optional(),
  replacementContractVehicleId: z.number().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
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
    defaultValues: { chargedTo: null, replacementContractVehicleId: null, resolvedAt: null },
  })

  // Edit form
  const editForm = useForm<IncidentEditForm>({
    resolver: zodResolver(incidentEditSchema),
    defaultValues: isEdit
      ? {
          description: editItem.description,
          downtimeDays: editItem.downtimeDays,
          costAmount: editItem.costAmount,
          chargedTo: editItem.chargedTo,
          replacementContractVehicleId: editItem.replacementContractVehicle?.id ?? null,
          resolvedAt: editItem.resolvedAt ?? null,
        }
      : {},
  })

  const incidentType = createForm.watch('incidentType')
  const contractVehicleId = createForm.watch('contractVehicleId')

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
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent mobileVariant="sheet" className="sm:max-w-lg">
        <MobileSheetHeader>
          <MobileSheetTitle>{isEdit ? 'Chỉnh sửa sự cố' : 'Ghi nhận sự cố'}</MobileSheetTitle>
        </MobileSheetHeader>

        {isEdit ? (
          <form onSubmit={handleEdit}>
            <MobileSheetBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-md p-3 text-sm">
                <div>
                  <p className="text-xs text-text-secondary">Xe</p>
                  <p className="font-medium text-text-primary">
                    {editItem.contractVehicle.vehicle.model} · {editItem.contractVehicle.vehicle.serialNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Ngày sự cố</p>
                  <p className="font-medium text-text-primary">{formatDate(editItem.incidentDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Loại sự cố</p>
                  <p className="font-medium text-text-primary">{INCIDENT_TYPE_LABELS[editItem.incidentType]}</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Số ngày dừng hoạt động</Label>
                  <Input type="number" step="0.1" min={0} {...editForm.register('downtimeDays', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
                </div>
                <div className="space-y-1">
                  <Label>Chi phí (₫)</Label>
                  <Input type="number" min={0} {...editForm.register('costAmount', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Bên chịu chi phí</Label>
                <Controller
                  control={editForm.control}
                  name="chargedTo"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                      <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Không xác định" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không xác định</SelectItem>
                        {CHARGED_TO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {editItem.incidentType === 'replacement' && (
                <div className="space-y-1">
                  <Label>Xe thay thế</Label>
                  <Controller
                    control={editForm.control}
                    name="replacementContractVehicleId"
                    render={({ field }) => (
                      <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}>
                        <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn xe thay thế" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Không có</SelectItem>
                          {contractVehicles.filter((cv) => cv.id !== editItem.contractVehicle.id).map((cv) => (
                            <SelectItem key={cv.id} value={cv.id.toString()}>{cv.vehicle.model} · {cv.vehicle.serialNumber}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {editForm.formState.errors.replacementContractVehicleId && (
                    <p className="text-xs text-error">{editForm.formState.errors.replacementContractVehicleId.message}</p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Label>Thời điểm xử lý xong</Label>
                <Controller
                  control={editForm.control}
                  name="resolvedAt"
                  render={({ field }) => (
                    <DatePicker value={field.value ?? undefined} onChange={field.onChange} placeholder="Chưa xử lý" />
                  )}
                />
              </div>
            </MobileSheetBody>
            <MobileSheetFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Hủy</Button>
              <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </MobileSheetFooter>
          </form>
        ) : (
          <form onSubmit={handleCreate}>
            <MobileSheetBody className="space-y-4">
              <div className="space-y-1">
                <Label>Xe <span className="text-error">*</span></Label>
                <Controller
                  control={createForm.control}
                  name="contractVehicleId"
                  render={({ field }) => (
                    <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn xe" /></SelectTrigger>
                      <SelectContent>
                        {contractVehicles.map((cv) => (
                          <SelectItem key={cv.id} value={cv.id.toString()}>{cv.vehicle.model} · {cv.vehicle.serialNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {createForm.formState.errors.contractVehicleId && (
                  <p className="text-xs text-error">{createForm.formState.errors.contractVehicleId.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Ngày sự cố <span className="text-error">*</span></Label>
                  <Controller
                    control={createForm.control}
                    name="incidentDate"
                    render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />}
                  />
                  {createForm.formState.errors.incidentDate && (
                    <p className="text-xs text-error">{createForm.formState.errors.incidentDate.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Loại sự cố <span className="text-error">*</span></Label>
                  <Controller
                    control={createForm.control}
                    name="incidentType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                        <SelectContent>
                          {INCIDENT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {createForm.formState.errors.incidentType && (
                    <p className="text-xs text-error">{createForm.formState.errors.incidentType.message}</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Số ngày dừng hoạt động</Label>
                  <Input type="number" step="0.1" min={0} {...createForm.register('downtimeDays', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
                </div>
                <div className="space-y-1">
                  <Label>Chi phí (₫)</Label>
                  <Input type="number" min={0} {...createForm.register('costAmount', { valueAsNumber: true, setValueAs: (v) => v === '' ? null : Number(v) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Bên chịu chi phí</Label>
                <Controller
                  control={createForm.control}
                  name="chargedTo"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                      <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Không xác định" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không xác định</SelectItem>
                        {CHARGED_TO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
                    name="replacementContractVehicleId"
                    render={({ field }) => (
                      <Select value={field.value?.toString() ?? ''} onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))}>
                        <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Chọn xe thay thế" /></SelectTrigger>
                        <SelectContent>
                          {contractVehicles.filter((cv) => cv.id !== contractVehicleId).map((cv) => (
                            <SelectItem key={cv.id} value={cv.id.toString()}>{cv.vehicle.model} · {cv.vehicle.serialNumber}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {createForm.formState.errors.replacementContractVehicleId && (
                    <p className="text-xs text-error">{createForm.formState.errors.replacementContractVehicleId.message}</p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Label>Thời điểm xử lý xong</Label>
                <Controller
                  control={createForm.control}
                  name="resolvedAt"
                  render={({ field }) => (
                    <DatePicker value={field.value ?? undefined} onChange={field.onChange} placeholder="Chưa xử lý" />
                  )}
                />
              </div>
            </MobileSheetBody>
            <MobileSheetFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Hủy</Button>
              <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
                {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </MobileSheetFooter>
          </form>
        )}
      </MobileSheetContent>
    </MobileSheetDialog>
  )
}

// ─── IncidentsTab ─────────────────────────────────────────────────────────────
interface IncidentsTabProps {
  contractId: number
  contractStatus: ContractStatus
  contractVehicles: ContractVehicle[]
  canEdit: boolean
}

export function IncidentsTab({ contractId, contractStatus, contractVehicles, canEdit }: IncidentsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Incident | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'incidents'],
    queryFn: () => getIncidents(contractId),
  })
  const incidents: Incident[] = data?.data ?? []

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
        <EmptyState description="Chưa có sự cố nào" />
      ) : (
        incidents.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 flex gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary text-sm">
                {item.contractVehicle.vehicle.model} · {item.contractVehicle.vehicle.serialNumber}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-full ${INCIDENT_TYPE_CHIP[item.incidentType]}`}>
                  {INCIDENT_TYPE_LABELS[item.incidentType]}
                </span>
                <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CalendarIcon size={10} />
                  {formatDate(item.incidentDate)}
                </span>
                {item.downtimeDays !== null && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                    {item.downtimeDays} ngày
                  </span>
                )}
                {item.costAmount !== null && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.costAmount)}
                  </span>
                )}
                {item.chargedTo === 'company' && (
                  <span className="bg-error-light text-error text-xs px-2.5 py-1 rounded-full">Công ty chịu</span>
                )}
                {item.chargedTo === 'customer' && (
                  <span className="bg-accent-light text-accent text-xs px-2.5 py-1 rounded-full">Khách hàng chịu</span>
                )}
                {item.resolvedAt ? (
                  <span className="bg-success-light text-success text-xs px-2.5 py-1 rounded-full">
                    ✅ Đã xử lý: {formatDate(item.resolvedAt)}
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
              {item.replacementContractVehicle && (
                <p className="text-sm text-text-secondary mt-1">
                  Xe thay thế: {item.replacementContractVehicle.vehicle.model} · {item.replacementContractVehicle.vehicle.serialNumber}
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
