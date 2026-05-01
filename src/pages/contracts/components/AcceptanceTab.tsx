import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { DatePicker } from '@/components/shared/DatePicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileCard } from '@/components/shared/FileCard'
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAcceptanceRecords, createAcceptanceRecord, updateAcceptanceRecord, deleteAcceptanceRecord } from '@/api/contracts.api'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate } from '@/utils/format'
import type { AcceptanceRecord } from '@/types/contract.types'

// ─── AcceptanceFileCard ───────────────────────────────────────────────────────
function AcceptanceFileCard({
  document,
  recordId,
  contractId,
  canEdit,
}: {
  document: AcceptanceRecord['document']
  recordId: number
  contractId: number
  canEdit: boolean
}) {
  const replace = useReplaceDocument({
    documentId: document?.id,
    entityType: 'acceptance',
    entityId: recordId,
    queryKeys: [[...QUERY_KEYS.contracts.detail(contractId), 'acceptance-records']],
  })
  if (!document) return <span className="text-xs text-text-disabled">Chưa có file đính kèm</span>
  return (
    <FileCard
      fileName={document.file_name}
      url={document.sas_url}
      fileSize={document.file_size_kb * 1024}
      createdAt={document.uploaded_at}
      onReplace={canEdit ? (file) => replace.mutate(file) : undefined}
      isReplacing={replace.isPending}
    />
  )
}

// ─── AcceptanceDialog ─────────────────────────────────────────────────────────
const acceptanceSchema = z.object({
  record_number: z.string().min(1, 'Bắt buộc'),
  record_date: z.string().min(1, 'Bắt buộc'),
  actual_start_date: z.string().min(1, 'Bắt buộc'),
  actual_end_date: z.string().min(1, 'Bắt buộc'),
  subtotal: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
  tax_amount: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
  total_amount: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
})
  .refine(
    (d) => new Date(d.actual_end_date) >= new Date(d.actual_start_date),
    { message: 'Ngày kết thúc phải >= ngày bắt đầu', path: ['actual_end_date'] }
  )
  .refine(
    (d) => Math.abs(d.subtotal + d.tax_amount - d.total_amount) <= 1000,
    { message: 'Subtotal + VAT lệch quá 1.000₫ so với tổng tiền', path: ['total_amount'] }
  )

type AcceptanceForm = z.infer<typeof acceptanceSchema>

function AcceptanceDialog({
  open,
  onOpenChange,
  contractId,
  editItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  editItem?: AcceptanceRecord
}) {
  const queryClient = useQueryClient()
  const isEdit = !!editItem
  const [docFile, setDocFile] = useState<File | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AcceptanceForm>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: isEdit
      ? {
          record_number: editItem.record_number,
          record_date: editItem.record_date,
          actual_start_date: editItem.actual_start_date,
          actual_end_date: editItem.actual_end_date,
          subtotal: editItem.subtotal,
          tax_amount: editItem.tax_amount,
          total_amount: editItem.total_amount,
        }
      : {},
  })

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null) }
    onOpenChange(v)
  }

  const mutation = useMutation({
    mutationFn: (body: AcceptanceForm) =>
      isEdit
        ? updateAcceptanceRecord(contractId, editItem!.id, body)
        : createAcceptanceRecord(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'acceptance-records'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success(isEdit ? 'Đã cập nhật biên bản' : 'Đã thêm biên bản')
      handleClose(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa biên bản' : 'Thêm biên bản nghiệm thu'}
      file={docFile}
      onFileChange={setDocFile}
      isEdit={isEdit}
      existingFileName={editItem?.document?.file_name}
      existingFileUrl={editItem?.document?.sas_url}
      uploadLabel="Kéo thả hoặc nhấp để chọn file biên bản"
    >
      <form
        id="acceptance-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin biên bản</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Số biên bản <span className="text-error">*</span></Label>
            <Input {...register('record_number')} placeholder="BBNT-2026-001" />
            {errors.record_number && <p className="text-xs text-error">{errors.record_number.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Ngày lập <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="record_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.record_date && <p className="text-xs text-error">{errors.record_date.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày bắt đầu TT <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="actual_start_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.actual_start_date && <p className="text-xs text-error">{errors.actual_start_date.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Ngày kết thúc TT <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="actual_end_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} align="end" />
              )}
            />
            {errors.actual_end_date && <p className="text-xs text-error">{errors.actual_end_date.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Subtotal <span className="text-error">*</span></Label>
            <Input type="number" min={0} {...register('subtotal', { valueAsNumber: true })} />
            {errors.subtotal && <p className="text-xs text-error">{errors.subtotal.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>VAT <span className="text-error">*</span></Label>
            <Input type="number" min={0} {...register('tax_amount', { valueAsNumber: true })} />
            {errors.tax_amount && <p className="text-xs text-error">{errors.tax_amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Tổng tiền <span className="text-error">*</span></Label>
            <Input type="number" min={0} {...register('total_amount', { valueAsNumber: true })} />
            {errors.total_amount && <p className="text-xs text-error">{errors.total_amount.message}</p>}
          </div>
        </div>
      </form>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => handleClose(false)} className="cursor-pointer">
          Hủy
        </Button>
        <Button type="submit" form="acceptance-form" disabled={mutation.isPending || (!isEdit && !docFile)} className="cursor-pointer">
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </div>
    </MobileTwoColDialog>
  )
}

// ─── AcceptanceTab ────────────────────────────────────────────────────────────
interface AcceptanceTabProps {
  contractId: number
  canEdit: boolean
  initialData?: AcceptanceRecord[]
}

export function AcceptanceTab({ contractId, canEdit, initialData }: AcceptanceTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AcceptanceRecord | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: records, isLoading } = useQuery<AcceptanceRecord[]>({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'acceptance-records'],
    queryFn: () => getAcceptanceRecords(contractId),
    initialData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAcceptanceRecord(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'acceptance-records'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success('Đã xóa biên bản')
      setDeletingId(null)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: AcceptanceRecord) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-text-primary">Biên bản nghiệm thu</span>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus size={14} />
            Thêm biên bản
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : !records || records.length === 0 ? (
        <EmptyState message="Chưa có biên bản nghiệm thu nào" />
      ) : (
        records.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.record_number}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CalendarIcon size={10} />
                    {formatDate(item.record_date)}
                  </span>
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatDate(item.actual_start_date)} → {formatDate(item.actual_end_date)}
                  </span>
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.total_amount)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  Subtotal: {formatCurrency(item.subtotal)} · VAT: {formatCurrency(item.tax_amount)}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-0.5 flex-none">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="cursor-pointer h-8 w-8 p-0">
                        <Pencil size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chỉnh sửa biên bản</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingId(item.id) }} className="cursor-pointer h-8 w-8 p-0 hover:bg-error hover:text-white">
                        <Trash2 size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xóa biên bản</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {/* Row 2: file */}
            <div className="pt-3 border-t border-border">
              <AcceptanceFileCard
                document={item.document}
                recordId={item.id}
                contractId={contractId}
                canEdit={canEdit}
              />
            </div>
          </div>
        ))
      )}

      <AcceptanceDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingItem(undefined) }}
        contractId={contractId}
        editItem={editingItem}
      />

      <ConfirmModal
        open={deletingId !== null}
        onOpenChange={(v) => { if (!v) setDeletingId(null) }}
        title="Xóa biên bản"
        description="Bạn có chắc muốn xóa biên bản nghiệm thu này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingId !== null && deleteMutation.mutate(deletingId)}
      />
    </div>
  )
}
