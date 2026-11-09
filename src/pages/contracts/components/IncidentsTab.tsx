import { useEffect, useState, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Pencil, Plus } from 'lucide-react'
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
import { AppTooltip } from '@/components/shared/AppTooltip'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { DatePicker } from '@/components/shared/DatePicker'
import { getIncidents, createIncident, updateIncident } from '@/api/contracts.api'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate, formatDateTime, toDateOnly } from '@/utils/format'
import { getServiceErrorMessage } from '@/constants/serviceErrors'
import { isContractOpen } from '@/constants/contractStatus'
import { applyApiErrors, getApiError, getApiErrorMessage, isConcurrentUpdateError } from '@/utils/apiError'
import type { ContractStatus, ContractVehicle, CreatableIncidentType, Incident, IncidentType, ChargedTo } from '@/types/contract.types'

// ─── Constants ────────────────────────────────────────────────────────────────
const INCIDENT_TYPE_OPTIONS: { value: CreatableIncidentType; label: string }[] = [
  { value: 'replacement', label: 'Thay xe' },
  { value: 'repair_onsite', label: 'Sửa tại công trường' },
]

const INCIDENT_TYPE_CHIP: Record<IncidentType, string> = {
  breakdown: 'bg-error-light text-error',
  replacement: 'bg-accent-light text-accent',
  repair_onsite: 'bg-info-light text-info',
}

// Giữ nhãn breakdown cho dữ liệu cũ cho đến khi BE xác nhận đã đổi xong
const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  breakdown: 'Hư hỏng',
  replacement: 'Thay xe',
  repair_onsite: 'Sửa tại công trường',
}

// BE chỉ nhận sự cố trên lần giao đã xuất bãi và chưa trả
const canReportIncident = (cv: ContractVehicle) => !!cv.deployDate && !cv.returnDate

const CHARGED_TO_OPTIONS: { value: ChargedTo; label: string }[] = [
  { value: 'company', label: 'Công ty chịu' },
  { value: 'customer', label: 'Khách hàng chịu' },
]

// ─── IncidentDialog ───────────────────────────────────────────────────────────
// Ô số để trống = null. Không dùng kèm valueAsNumber: RHF ưu tiên nó, bỏ qua setValueAs → ô trống thành NaN, Zod chặn
const emptyToNull = (v: unknown) => (v === '' || v == null ? null : Number(v))

const incidentCreateSchema = z.object({
  contractVehicleId: z.number({ error: 'Bắt buộc chọn xe' }).min(1, 'Bắt buộc chọn xe'),
  incidentDate: z.string({ error: 'Bắt buộc chọn ngày sự cố' }).min(1, 'Bắt buộc chọn ngày sự cố'),
  incidentType: z.enum(['replacement', 'repair_onsite'], { error: 'Bắt buộc chọn loại sự cố' }),
  description: z.string({ error: 'Bắt buộc nhập mô tả' }).min(1, 'Bắt buộc nhập mô tả').max(1000),
  downtimeDays: z.number().nullable().optional(),
  costAmount: z.number().nullable().optional(),
  chargedTo: z.enum(['customer', 'company']).nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
})

const incidentEditSchema = z.object({
  description: z.string({ error: 'Bắt buộc nhập mô tả' }).min(1, 'Bắt buộc nhập mô tả').max(1000),
  downtimeDays: z.number().nullable().optional(),
  costAmount: z.number().nullable().optional(),
  chargedTo: z.enum(['customer', 'company']).nullable().optional(),
  resolvedAt: z.string().nullable(),
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
    defaultValues: { chargedTo: null, resolvedAt: null },
  })

  // Edit form
  const editForm = useForm<IncidentEditForm>({
    resolver: zodResolver(incidentEditSchema),
  })

  // Dialog không unmount giữa các lần mở → nạp lại giá trị đang sửa, nhất là resolvedAt:
  // PUT luôn ghi đè resolvedAt, thiếu là mất đánh dấu đã xử lý
  const resetEditForm = editForm.reset
  const resetCreateForm = createForm.reset
  useEffect(() => {
    if (!open) return
    // Ghi nhận mới: dialog không unmount nên giá trị lần trước (xe, mô tả, loại, chi phí) còn nguyên → xóa sạch mỗi lần mở
    if (!editItem) {
      resetCreateForm({ chargedTo: null, resolvedAt: null })
      return
    }
    resetEditForm({
      description: editItem.description,
      downtimeDays: editItem.downtimeDays,
      costAmount: editItem.costAmount,
      chargedTo: editItem.chargedTo,
      resolvedAt: editItem.resolvedAt ?? null,
    })
  }, [open, editItem, resetEditForm, resetCreateForm])

  const mutation = useMutation({
    mutationFn: (body: IncidentCreateForm | IncidentEditForm) => {
      if (isEdit) {
        const editBody = body as IncidentEditForm
        return updateIncident(contractId, editItem!.id, {
          ...editBody,
          resolvedAt: editBody.resolvedAt ?? null,
        })
      }
      return createIncident(contractId, body as IncidentCreateForm)
    },
    onSuccess: (_, body) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'incidents'] })
      const isReplacement = !isEdit && (body as IncidentCreateForm).incidentType === 'replacement'
      toast.success(isEdit ? 'Đã cập nhật sự cố' : 'Đã ghi nhận sự cố', {
        ...(isReplacement ? { description: 'Vào mục Dịch vụ & xe, bấm Gán xe thay thế ở xe này để gán xe mới.' } : {}),
      })
      onOpenChange(false)
    },
    onError: (error) => {
      // HĐ bị đóng giữa chừng (tạo + sửa sự cố đều chặn): toast message BE, đóng form, tải lại HĐ để ẩn nút
      if (getApiError(error).code === 'CONTRACT_NOT_ACTIVE') {
        toast.error(getApiErrorMessage(error))
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
        onOpenChange(false)
        return
      }
      const fallback = getServiceErrorMessage(error)
      if (isEdit) applyApiErrors(error, editForm.setError, ['description'], fallback)
      else {
        applyApiErrors(
          error,
          createForm.setError,
          ['contractVehicleId', 'incidentDate', 'incidentType', 'description'],
          fallback,
        )
      }
      const { code } = getApiError(error)
      // Danh sách xe / sự cố trên màn hình đã cũ → đồng bộ lại để chọn xe khác
      if (code === 'VEHICLE_ALREADY_RETURNED' || code === 'VEHICLE_NOT_DEPLOYED' || code === 'REPLACEMENT_INCIDENT_EXISTS') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) })
      }
      if (isConcurrentUpdateError(error)) onOpenChange(false)
    },
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
                  <p className="font-medium text-text-primary">{formatDate(toDateOnly(editItem.incidentDate))}</p>
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
                  <Input type="number" step="0.1" min={0} {...editForm.register('downtimeDays', { setValueAs: emptyToNull })} />
                  {editForm.formState.errors.downtimeDays && (
                    <p className="text-xs text-error">{editForm.formState.errors.downtimeDays.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Chi phí (₫)</Label>
                  <Input type="number" min={0} {...editForm.register('costAmount', { setValueAs: emptyToNull })} />
                  {editForm.formState.errors.costAmount && (
                    <p className="text-xs text-error">{editForm.formState.errors.costAmount.message}</p>
                  )}
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
              {editItem.incidentType === 'replacement' && editItem.replacementContractVehicle && (
                <div className="space-y-1">
                  <Label>Xe thay thế (BE tự xác định)</Label>
                  <p className="rounded-md bg-gray-50 p-3 text-sm font-medium text-text-primary">
                    {editItem.replacementContractVehicle.vehicle.model} · {editItem.replacementContractVehicle.vehicle.serialNumber}
                  </p>
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
                        {contractVehicles.filter(canReportIncident).map((cv) => (
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
                  <Input type="number" step="0.1" min={0} {...createForm.register('downtimeDays', { setValueAs: emptyToNull })} />
                  {createForm.formState.errors.downtimeDays && (
                    <p className="text-xs text-error">{createForm.formState.errors.downtimeDays.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Chi phí (₫)</Label>
                  <Input type="number" min={0} {...createForm.register('costAmount', { setValueAs: emptyToNull })} />
                  {createForm.formState.errors.costAmount && (
                    <p className="text-xs text-error">{createForm.formState.errors.costAmount.message}</p>
                  )}
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
const BADGE = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'

const vehicleLabel = (vehicle: { model: string; serialNumber: string }) =>
  `${vehicle.model} · ${vehicle.serialNumber}`

function IncidentTypeBadge({ type }: { type: IncidentType }) {
  return <span className={`${BADGE} ${INCIDENT_TYPE_CHIP[type]}`}>{INCIDENT_TYPE_LABELS[type]}</span>
}

function IncidentStatusBadge({ resolvedAt }: { resolvedAt?: string }) {
  return resolvedAt ? (
    <span className={`${BADGE} bg-success-light text-success`}>
      <CheckCircle2 size={12} />
      Đã xử lý {formatDate(toDateOnly(resolvedAt))}
    </span>
  ) : (
    <span className={`${BADGE} bg-warning-light text-warning`}>
      <Clock size={12} />
      Chưa xử lý
    </span>
  )
}

const INCIDENT_COLUMNS: ColumnDef<Incident>[] = [
  {
    id: 'vehicle',
    header: 'Xe',
    cell: ({ row }) => <span className="font-medium">{vehicleLabel(row.original.contractVehicle.vehicle)}</span>,
  },
  {
    id: 'type',
    header: 'Loại',
    cell: ({ row }) => <IncidentTypeBadge type={row.original.incidentType} />,
  },
  {
    id: 'date',
    header: 'Ngày sự cố',
    cell: ({ row }) => formatDate(toDateOnly(row.original.incidentDate)),
  },
  {
    id: 'description',
    header: 'Mô tả',
    cell: ({ row }) => <span className="block max-w-[320px] truncate">{row.original.description}</span>,
  },
  {
    id: 'cost',
    header: 'Chi phí',
    cell: ({ row }) => (row.original.costAmount != null ? formatCurrency(row.original.costAmount) : '—'),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => <IncidentStatusBadge resolvedAt={row.original.resolvedAt} />,
  },
]

function IncidentMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-primary">{children}</dd>
    </div>
  )
}

interface IncidentsTabProps {
  contractId: number
  contractStatus: ContractStatus
  contractVehicles: ContractVehicle[]
  canEdit: boolean
}

export function IncidentsTab({ contractId, contractStatus, contractVehicles, canEdit }: IncidentsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Incident | undefined>()
  const [detailItem, setDetailItem] = useState<Incident | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'incidents'],
    queryFn: () => getIncidents(contractId),
  })
  const incidents: Incident[] = data?.data ?? []
  const reportableVehicles = contractVehicles.filter(canReportIncident)

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Incident) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-bg-card p-5">
      {canEdit && isContractOpen(contractStatus) && (
        <div className="flex items-center justify-end">
          <AppTooltip content={reportableVehicles.length === 0 ? 'Chỉ ghi sự cố cho xe đã xuất bãi và chưa trả' : undefined}>
            <Button
              variant="outline"
              size="sm"
              onClick={openAdd}
              disabled={reportableVehicles.length === 0}
              className="cursor-pointer"
            >
              <Plus size={14} />
              Ghi nhận sự cố
            </Button>
          </AppTooltip>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : !incidents || incidents.length === 0 ? (
        <EmptyState description="Chưa có sự cố nào" />
      ) : (
        <>
          <div className="hidden sm:block">
            <DataTable columns={INCIDENT_COLUMNS} data={incidents} onRowClick={setDetailItem} noWrap />
          </div>
          <div className="flex flex-col gap-3 sm:hidden">
            {incidents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDetailItem(item)}
                className="w-full cursor-pointer rounded-lg border border-border bg-bg-card p-4 text-left"
              >
                <p className="font-medium text-text-primary">{vehicleLabel(item.contractVehicle.vehicle)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <IncidentTypeBadge type={item.incidentType} />
                  <IncidentStatusBadge resolvedAt={item.resolvedAt} />
                </div>
                <p className="mt-2 truncate text-sm text-text-secondary">{item.description}</p>
                <p className="mt-1 text-xs text-text-secondary">{formatDate(toDateOnly(item.incidentDate))}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <MobileSheetDialog open={!!detailItem} onOpenChange={(v) => !v && setDetailItem(undefined)}>
        {detailItem && (
          <MobileSheetContent mobileVariant="sheet" className="sm:max-w-lg">
            <MobileSheetHeader>
              <MobileSheetTitle>Chi tiết sự cố</MobileSheetTitle>
            </MobileSheetHeader>
            <MobileSheetBody>
              <div>
                <p className="font-medium text-text-primary">{vehicleLabel(detailItem.contractVehicle.vehicle)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <IncidentTypeBadge type={detailItem.incidentType} />
                  <IncidentStatusBadge resolvedAt={detailItem.resolvedAt} />
                </div>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Mô tả</p>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-text-primary">{detailItem.description}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
                <IncidentMeta label="Ngày sự cố">{formatDate(toDateOnly(detailItem.incidentDate))}</IncidentMeta>
                <IncidentMeta label="Số ngày dừng">
                  {detailItem.downtimeDays != null ? `${detailItem.downtimeDays} ngày` : '—'}
                </IncidentMeta>
                <IncidentMeta label="Chi phí">
                  {detailItem.costAmount != null ? formatCurrency(detailItem.costAmount) : '—'}
                </IncidentMeta>
                <IncidentMeta label="Bên chịu chi phí">
                  {CHARGED_TO_OPTIONS.find((o) => o.value === detailItem.chargedTo)?.label ?? '—'}
                </IncidentMeta>
                {detailItem.replacementContractVehicle && (
                  <IncidentMeta label="Xe thay thế">
                    {vehicleLabel(detailItem.replacementContractVehicle.vehicle)}
                  </IncidentMeta>
                )}
                <IncidentMeta label="Ghi nhận lúc">{formatDateTime(detailItem.createdAt)}</IncidentMeta>
                {detailItem.createdBy && (
                  <IncidentMeta label="Người ghi nhận">{detailItem.createdBy.fullName}</IncidentMeta>
                )}
              </dl>
            </MobileSheetBody>
            <MobileSheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailItem(undefined)}
                className="cursor-pointer"
              >
                Đóng
              </Button>
              {canEdit && isContractOpen(contractStatus) && (
                <Button
                  type="button"
                  onClick={() => {
                    openEdit(detailItem)
                    setDetailItem(undefined)
                  }}
                  className="cursor-pointer"
                >
                  <Pencil size={14} />
                  Sửa
                </Button>
              )}
            </MobileSheetFooter>
          </MobileSheetContent>
        )}
      </MobileSheetDialog>

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
