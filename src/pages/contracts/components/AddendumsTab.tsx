import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { DatePicker } from '@/components/shared/DatePicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileCard } from '@/components/shared/FileCard'
import { TwoColDialog } from '@/components/shared/TwoColDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAddendums, createAddendum, updateAddendum, deleteAddendum } from '@/api/contracts.api'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate } from '@/utils/format'
import type { ContractStatus, Addendum, AddendumType } from '@/types/contract.types'

// ─── AddendumFileCard — wraps FileCard to call hook per-item ─────────────────
function AddendumFileCard({
  document,
  addendumId,
  contractId,
  canEdit,
}: {
  document: Addendum['document']
  addendumId: number
  contractId: number
  canEdit: boolean
}) {
  const replace = useReplaceDocument({
    documentId: document?.id,
    entityType: 'addendum',
    entityId: addendumId,
    queryKeys: [[...QUERY_KEYS.contracts.detail(contractId), 'addendums']],
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

// ─── AddendumDialog ───────────────────────────────────────────────────────────
const addendumSchema = z.object({
  addendum_number: z.string().min(1, 'Bắt buộc'),
  addendum_type: z.enum(['extension', 'price_change', 'add_service', 'mixed']),
  start_date: z.string().optional(),
  new_end_date: z.string().optional(),
  subtotal: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
  tax_amount: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
  total_amount: z.number({ invalid_type_error: 'Bắt buộc' }).min(0),
  content: z.string().max(2000).optional(),
  document_id: z.number().optional(),
})
  .refine(
    (d) => Math.abs(d.subtotal + d.tax_amount - d.total_amount) <= 1000,
    { message: 'Subtotal + VAT lệch quá 1.000₫ so với tổng tiền', path: ['total_amount'] }
  )
  .refine(
    (d) => d.addendum_type !== 'extension' || !!d.new_end_date,
    { message: 'Bắt buộc nhập ngày kết thúc mới khi loại phụ lục là Gia hạn', path: ['new_end_date'] }
  )

type AddendumForm = z.infer<typeof addendumSchema>

const ADDENDUM_TYPE_OPTIONS: { value: AddendumType; label: string }[] = [
  { value: 'extension', label: 'Gia hạn' },
  { value: 'price_change', label: 'Thay đổi giá' },
  { value: 'add_service', label: 'Bổ sung dịch vụ' },
  { value: 'mixed', label: 'Hỗn hợp' },
]

const ADDENDUM_TYPE_CHIP: Record<AddendumType, string> = {
  extension: 'bg-purple-100 text-purple-700',
  price_change: 'bg-accent-light text-accent',
  add_service: 'bg-success-light text-success',
  mixed: 'bg-gray-100 text-gray-600',
}

const ADDENDUM_TYPE_LABELS: Record<AddendumType, string> = {
  extension: 'Gia hạn',
  price_change: 'Thay đổi giá',
  add_service: 'Bổ sung dịch vụ',
  mixed: 'Hỗn hợp',
}

function AddendumDialog({
  open,
  onOpenChange,
  contractId,
  editItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  editItem?: Addendum
}) {
  const queryClient = useQueryClient()
  const isEdit = !!editItem
  const [docFile, setDocFile] = useState<File | null>(null)

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<AddendumForm>({
    resolver: zodResolver(addendumSchema),
    defaultValues: isEdit
      ? {
          addendum_number: editItem.addendum_number,
          addendum_type: editItem.addendum_type,
          start_date: editItem.start_date ?? undefined,
          new_end_date: editItem.new_end_date ?? undefined,
          subtotal: editItem.subtotal,
          tax_amount: editItem.tax_amount,
          total_amount: editItem.total_amount,
          content: editItem.content ?? '',
        }
      : {},
  })

  const addendumType = watch('addendum_type')

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null) }
    onOpenChange(v)
  }

  const mutation = useMutation({
    mutationFn: (body: AddendumForm) =>
      isEdit
        ? updateAddendum(contractId, editItem!.id, body)
        : createAddendum(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success(isEdit ? 'Đã cập nhật phụ lục' : 'Đã thêm phụ lục')
      handleClose(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  return (
    <TwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa phụ lục' : 'Thêm phụ lục'}
      file={docFile}
      onFileChange={setDocFile}
      isEdit={isEdit}
      existingFileName={editItem?.document?.file_name}
      existingFileUrl={editItem?.document?.sas_url}
      uploadLabel="Kéo thả hoặc nhấp để chọn file phụ lục"
    >
      <form
        id="addendum-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin phụ lục</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Số phụ lục <span className="text-error">*</span></Label>
            <Input {...register('addendum_number')} placeholder="0101-01PLHĐ/TTS-..." />
            {errors.addendum_number && <p className="text-xs text-error">{errors.addendum_number.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Loại phụ lục <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="addendum_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Chọn loại" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDENDUM_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.addendum_type && <p className="text-xs text-error">{errors.addendum_type.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày bắt đầu</Label>
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Chọn ngày" />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>
              Ngày kết thúc mới
              {addendumType === 'extension' && <span className="text-error"> *</span>}
            </Label>
            <Controller
              control={control}
              name="new_end_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Chọn ngày" align="end" />
              )}
            />
            {errors.new_end_date && <p className="text-xs text-error">{errors.new_end_date.message}</p>}
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

        <div className="space-y-1">
          <Label>Nội dung</Label>
          <Textarea rows={3} maxLength={2000} {...register('content')} />
        </div>
      </form>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => handleClose(false)} className="cursor-pointer">
          Hủy
        </Button>
        <Button type="submit" form="addendum-form" disabled={mutation.isPending || (!isEdit && !docFile)} className="cursor-pointer">
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
      </div>
    </TwoColDialog>
  )
}

// ─── AddendumsTab ─────────────────────────────────────────────────────────────
interface AddendumsTabProps {
  contractId: number
  contractStatus: ContractStatus
  canEdit: boolean
  initialData?: Addendum[]
}

export function AddendumsTab({ contractId, contractStatus, canEdit, initialData }: AddendumsTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Addendum | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: addendums, isLoading } = useQuery<Addendum[]>({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'],
    queryFn: () => getAddendums(contractId),
    initialData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAddendum(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success('Đã xóa phụ lục')
      setDeletingId(null)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Addendum) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-text-primary">Phụ lục</span>
        {canEdit && contractStatus === 'active' && (
          <Button variant="outline" size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus size={14} />
            Thêm phụ lục
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : !addendums || addendums.length === 0 ? (
        <EmptyState message="Chưa có phụ lục nào" />
      ) : (
        addendums.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.addendum_number}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${ADDENDUM_TYPE_CHIP[item.addendum_type]}`}>
                    {ADDENDUM_TYPE_LABELS[item.addendum_type]}
                  </span>
                  {(item.start_date || item.new_end_date) && (
                    <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                      {formatDate(item.start_date)} → {formatDate(item.new_end_date)}
                    </span>
                  )}
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.total_amount)}
                  </span>
                </div>
                {item.content && (
                  <p className="text-sm text-text-secondary mt-2 line-clamp-2">{item.content}</p>
                )}
              </div>
              {canEdit && contractStatus === 'active' && (
                <div className="flex items-center gap-0.5 flex-none">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="cursor-pointer h-8 w-8 p-0">
                        <Pencil size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chỉnh sửa phụ lục</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingId(item.id) }} className="cursor-pointer h-8 w-8 p-0 hover:bg-error hover:text-white">
                        <Trash2 size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xóa phụ lục</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {/* Row 2: file */}
            <div className="pt-3 border-t border-border">
              <AddendumFileCard
                document={item.document}
                addendumId={item.id}
                contractId={contractId}
                canEdit={canEdit && contractStatus === 'active'}
              />
            </div>
          </div>
        ))
      )}

      <AddendumDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingItem(undefined) }}
        contractId={contractId}
        editItem={editingItem}
      />

      <ConfirmModal
        open={deletingId !== null}
        onOpenChange={(v) => { if (!v) setDeletingId(null) }}
        title="Xóa phụ lục"
        description="Bạn có chắc muốn xóa phụ lục này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingId !== null && deleteMutation.mutate(deletingId)}
      />
    </div>
  )
}
