import { useState, useEffect } from 'react'
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
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAddendums, createAddendum, updateAddendum, deleteAddendum } from '@/api/contracts.api'
import { uploadDocument } from '@/api/documents.api'
import { getCompanySettings } from '@/api/company.api'
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
      fileName={document.fileName}
      url={document.sasUrl}
      documentId={document.id}
      fileSize={document.fileSizeKb * 1024}
      createdAt={document.uploadedAt}
      onReplace={canEdit ? (file) => replace.mutate(file) : undefined}
      isReplacing={replace.isPending}
    />
  )
}

// ─── AddendumDialog ───────────────────────────────────────────────────────────
const addendumSchema = z.object({
  addendumNumber: z.string().min(1, 'Bắt buộc'),
  addendumType: z.enum(['extension', 'price_change', 'add_service', 'mixed']),
  startDate: z.string().optional(),
  newEndDate: z.string().optional(),
  subtotal: z.number({ error: 'Bắt buộc' }).min(0),
  vatRatePercent: z.number({ error: 'Bắt buộc' }).min(0).max(100),
  taxAmount: z.number({ error: 'Bắt buộc' }).min(0),
  totalAmount: z.number({ error: 'Bắt buộc' }).min(0),
  content: z.string().max(2000).optional(),
})
  .refine(
    (d) => Math.abs(d.subtotal + d.taxAmount - d.totalAmount) <= 1000,
    { message: 'Subtotal + VAT lệch quá 1.000₫ so với tổng tiền', path: ['totalAmount'] }
  )
  .refine(
    (d) => d.addendumType !== 'extension' || !!d.newEndDate,
    { message: 'Bắt buộc nhập ngày kết thúc mới khi loại phụ lục là Gia hạn', path: ['newEndDate'] }
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
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: companySettingsRes } = useQuery({
    queryKey: ['company-settings'],
    queryFn: getCompanySettings,
    staleTime: 5 * 60 * 1000,
  })
  const defaultVatRate: number = companySettingsRes?.data?.[0]?.vatRate ?? 8

  function buildDefaultValues(): AddendumForm | Partial<AddendumForm> {
    if (!editItem) return { vatRatePercent: defaultVatRate }
    return {
      addendumNumber: editItem.addendumNumber,
      addendumType: editItem.addendumType,
      startDate: editItem.startDate ?? undefined,
      newEndDate: editItem.newEndDate ?? undefined,
      subtotal: editItem.subtotal,
      vatRatePercent: editItem.subtotal > 0
        ? Math.round((editItem.taxAmount / editItem.subtotal) * 100 * 100) / 100
        : defaultVatRate,
      taxAmount: editItem.taxAmount,
      totalAmount: editItem.totalAmount,
      content: editItem.content ?? '',
    }
  }

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<AddendumForm>({
    resolver: zodResolver(addendumSchema),
    defaultValues: buildDefaultValues(),
  })

  // Dialog không unmount giữa các lần mở — reset lại form theo editItem mỗi lần open đổi sang true
  useEffect(() => {
    if (open) reset(buildDefaultValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem])

  const addendumType = watch('addendumType')
  const subtotal = watch('subtotal')
  const vatRatePercent = watch('vatRatePercent')
  const taxAmount = watch('taxAmount')

  // Subtotal hoặc % thuế đổi → tự tính lại tiền thuế (user vẫn sửa tay được ô Tiền thuế nếu cần làm tròn)
  useEffect(() => {
    if (subtotal === undefined || vatRatePercent === undefined) return
    const computed = Math.round(subtotal * vatRatePercent) / 100
    setValue('taxAmount', computed, { shouldValidate: true })
  }, [subtotal, vatRatePercent, setValue])

  // Subtotal hoặc tiền thuế đổi → tự tính lại tổng tiền (luôn auto, không cho sửa tay)
  useEffect(() => {
    if (subtotal === undefined || taxAmount === undefined) return
    setValue('totalAmount', subtotal + taxAmount, { shouldValidate: true })
  }, [subtotal, taxAmount, setValue])

  // Company settings load xong sau khi form đã mount (create mode) → cập nhật % mặc định
  useEffect(() => {
    if (!isEdit && companySettingsRes?.data?.[0]?.vatRate !== undefined) {
      setValue('vatRatePercent', companySettingsRes.data[0].vatRate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySettingsRes])

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null); setUploadedDoc(null) }
    onOpenChange(v)
  }

  // Upload ngay lúc chọn file (is_temp=true) để có URL thật cho preview — thay vì blob URL cục bộ,
  // đặc biệt cần cho DOCX/XLSX vốn chỉ xem trước được qua Office Viewer (cần URL công khai truy cập được).
  async function handleFileChange(f: File | null) {
    setDocFile(f)
    setUploadedDoc(null)
    if (!f) return
    setUploading(true)
    try {
      const doc = await uploadDocument({ file: f, doc_type: 'addendum', is_temp: true })
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl })
    } catch {
      toast.error('Tải file lên thất bại, vui lòng thử lại')
      setDocFile(null)
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (body: AddendumForm) => {
      // vatRatePercent chỉ dùng để tính taxAmount ở FE — BE không có field này
      const { vatRatePercent: _vatRatePercent, ...rest } = body
      const documentId = uploadedDoc?.id
      const payload = { ...rest, documentId }
      return isEdit
        ? updateAddendum(contractId, editItem!.id, payload)
        : createAddendum(contractId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success(isEdit ? 'Đã cập nhật phụ lục' : 'Đã thêm phụ lục')
      handleClose(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa phụ lục' : 'Thêm phụ lục'}
      file={uploadedDoc ? null : docFile}
      onFileChange={handleFileChange}
      isEdit={isEdit || !!uploadedDoc}
      existingFileName={uploadedDoc?.fileName ?? editItem?.document?.fileName}
      existingFileUrl={uploadedDoc?.sasUrl ?? editItem?.document?.sasUrl}
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
            <Input {...register('addendumNumber')} placeholder="0101-01PLHĐ/TTS-..." />
            {errors.addendumNumber && <p className="text-xs text-error">{errors.addendumNumber.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Loại phụ lục <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="addendumType"
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
            {errors.addendumType && <p className="text-xs text-error">{errors.addendumType.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày bắt đầu</Label>
            <Controller
              control={control}
              name="startDate"
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
              name="newEndDate"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} placeholder="Chọn ngày" align="end" />
              )}
            />
            {errors.newEndDate && <p className="text-xs text-error">{errors.newEndDate.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tổng trước thuế <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="subtotal"
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.subtotal && <p className="text-xs text-error">{errors.subtotal.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Thuế suất (%) <span className="text-error">*</span></Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              {...register('vatRatePercent', { valueAsNumber: true })}
            />
            {errors.vatRatePercent && <p className="text-xs text-error">{errors.vatRatePercent.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tiền thuế <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="taxAmount"
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.taxAmount && <p className="text-xs text-error">{errors.taxAmount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Tổng tiền</Label>
            <Controller
              control={control}
              name="totalAmount"
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} disabled />
              )}
            />
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
        <Button
          type="submit"
          form="addendum-form"
          disabled={mutation.isPending || uploading || (!isEdit && !uploadedDoc)}
          className="cursor-pointer"
        >
          {mutation.isPending ? 'Đang lưu...' : uploading ? 'Đang tải file...' : 'Lưu'}
        </Button>
      </div>
    </MobileTwoColDialog>
  )
}

// ─── AddendumsTab ─────────────────────────────────────────────────────────────
interface AddendumsTabProps {
  contractId: number
  contractStatus: ContractStatus
  canEdit: boolean
}

export function AddendumsTab({ contractId, contractStatus, canEdit }: AddendumsTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Addendum | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'],
    queryFn: () => getAddendums(contractId),
  })
  const addendums: Addendum[] = data?.data ?? []

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
        <EmptyState description="Chưa có phụ lục nào" />
      ) : (
        addendums.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.addendumNumber}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${ADDENDUM_TYPE_CHIP[item.addendumType]}`}>
                    {ADDENDUM_TYPE_LABELS[item.addendumType]}
                  </span>
                  {(item.startDate || item.newEndDate) && (
                    <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                      {formatDate(item.startDate)} → {formatDate(item.newEndDate)}
                    </span>
                  )}
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.totalAmount)}
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
