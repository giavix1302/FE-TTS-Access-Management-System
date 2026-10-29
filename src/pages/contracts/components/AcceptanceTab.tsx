import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileCard } from '@/components/shared/FileCard'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { DocumentExtractButton } from '@/components/shared/DocumentExtractButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAcceptanceRecords, createAcceptanceRecord, updateAcceptanceRecord, deleteAcceptanceRecord } from '@/api/contracts.api'
import { uploadDocument } from '@/api/documents.api'
import { getCompanySettings } from '@/api/company.api'
import { getServiceErrorMessage } from '@/constants/serviceErrors'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDateTime } from '@/utils/format'
import type { AcceptanceRecord, AcceptanceAutofillFields } from '@/types/contract.types'

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

// ─── AcceptanceDialog ─────────────────────────────────────────────────────────
// Ngày trừ chuyển từ HĐ sang BBNT; không còn ngày lập / ngày thực tế
const acceptanceSchema = z.object({
  recordNumber: z.string().min(1, 'Bắt buộc'),
  subtotal: z.number({ error: 'Bắt buộc' }).min(0),
  vatRatePercent: z.number({ error: 'Bắt buộc' }).min(0).max(100),
  taxAmount: z.number({ error: 'Bắt buộc' }).min(0),
  totalAmount: z.number({ error: 'Bắt buộc' }).min(0),
  depositAmount: z.number().min(0, 'Phải >= 0').optional(),
  excludedDays: z.number().int('Phải là số nguyên').min(0, 'Phải >= 0').optional(),
  excludedReason: z.string().trim().max(500, 'Tối đa 500 ký tự').optional(),
})
  .refine(
    (d) => Math.abs(d.subtotal + d.taxAmount - d.totalAmount) <= 1000,
    { message: 'Subtotal + VAT lệch quá 1.000₫ so với tổng tiền', path: ['totalAmount'] }
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
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const { data: companySettingsRes } = useQuery({
    queryKey: ['company-settings'],
    queryFn: getCompanySettings,
    staleTime: 5 * 60 * 1000,
  })
  const defaultVatRate: number = companySettingsRes?.data?.[0]?.vatRate ?? 8

  function buildDefaultValues(): AcceptanceForm | Partial<AcceptanceForm> {
    if (!editItem) return { vatRatePercent: defaultVatRate, excludedReason: '' }
    return {
      recordNumber: editItem.recordNumber,
      depositAmount: editItem.depositAmount,
      excludedDays: editItem.excludedDays,
      excludedReason: editItem.excludedReason ?? '',
      subtotal: editItem.subtotal,
      vatRatePercent: editItem.subtotal > 0
        ? Math.round((editItem.taxAmount / editItem.subtotal) * 100 * 100) / 100
        : defaultVatRate,
      taxAmount: editItem.taxAmount,
      totalAmount: editItem.totalAmount,
    }
  }

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<AcceptanceForm>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: buildDefaultValues(),
  })

  // Dialog không unmount giữa các lần mở — reset lại form theo editItem mỗi lần open đổi sang true
  useEffect(() => {
    if (open) reset(buildDefaultValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem])

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
      const doc = await uploadDocument({ file: f, doc_type: 'acceptance', is_temp: true })
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl })
    } catch {
      toast.error('Tải file lên thất bại, vui lòng thử lại')
      setDocFile(null)
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (body: AcceptanceForm) => {
      // vatRatePercent chỉ dùng để tính taxAmount ở FE — BE không có field này
      const rest = Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== 'vatRatePercent'),
      ) as Omit<AcceptanceForm, 'vatRatePercent'>
      const documentId = uploadedDoc?.id
      // Ô trống → 0. excludedReason: tạo không gửi khi trống; sửa gửi "" để xóa
      const payload = {
        ...rest,
        depositAmount: rest.depositAmount ?? 0,
        excludedDays: rest.excludedDays ?? 0,
        excludedReason: isEdit ? (rest.excludedReason ?? '') : rest.excludedReason || undefined,
        documentId,
      }
      return isEdit
        ? updateAcceptanceRecord(contractId, editItem!.id, payload)
        : createAcceptanceRecord(contractId, payload)
    },
    onSuccess: () => {
      // contracts.all là prefix của detail/acceptance-records/summary
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      toast.success(isEdit ? 'Đã cập nhật biên bản' : 'Đã thêm biên bản')
      handleClose(false)
    },
    onError: (err) => toast.error(getServiceErrorMessage(err)),
  })

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa biên bản' : 'Thêm biên bản nghiệm thu'}
      file={uploadedDoc ? null : docFile}
      onFileChange={handleFileChange}
      isEdit={isEdit || !!uploadedDoc}
      existingFileName={uploadedDoc?.fileName ?? editItem?.document?.fileName}
      existingFileUrl={uploadedDoc?.sasUrl ?? editItem?.document?.sasUrl}
      uploadLabel="Kéo thả hoặc nhấp để chọn file biên bản"
    >
      <form
        id="acceptance-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin biên bản</p>
        <DocumentExtractButton<AcceptanceAutofillFields>
          documentId={uploadedDoc?.id ?? editItem?.document?.id}
          docType="acceptance"
          disabled={uploading}
          onBusyChange={setExtracting}
          onExtract={(fields) => {
            if (fields.recordNumber !== undefined) setValue('recordNumber', fields.recordNumber)
            if (fields.subtotal !== undefined) setValue('subtotal', fields.subtotal)
            if (fields.taxAmount !== undefined) setValue('taxAmount', fields.taxAmount)
            if (fields.totalAmount !== undefined) setValue('totalAmount', fields.totalAmount)
            if (fields.depositAmount !== undefined) setValue('depositAmount', fields.depositAmount)
            if (fields.excludedDays !== undefined) setValue('excludedDays', fields.excludedDays)
            if (fields.excludedReason !== undefined) setValue('excludedReason', fields.excludedReason)
            if (fields.subtotal && fields.taxAmount !== undefined) {
              setValue('vatRatePercent', Math.round((fields.taxAmount / fields.subtotal) * 10000) / 100)
            }
          }}
        />

        <div className="space-y-1">
          <Label>Số biên bản <span className="text-error">*</span></Label>
          <Input {...register('recordNumber')} placeholder="BBNT-2026-001" />
          {errors.recordNumber && <p className="text-xs text-error">{errors.recordNumber.message}</p>}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Số tiền đã cọc</Label>
            <Controller
              control={control}
              name="depositAmount"
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="0" />
              )}
            />
            {errors.depositAmount && <p className="text-xs text-error">{errors.depositAmount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Số ngày trừ</Label>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="0"
              {...register('excludedDays', {
                setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
              })}
            />
            {errors.excludedDays && <p className="text-xs text-error">{errors.excludedDays.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Lý do trừ ngày</Label>
          <Textarea rows={2} maxLength={500} className="resize-none" {...register('excludedReason')} />
          {errors.excludedReason && <p className="text-xs text-error">{errors.excludedReason.message}</p>}
        </div>
      </form>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => handleClose(false)} className="cursor-pointer">
          Hủy
        </Button>
        <Button
          type="submit"
          form="acceptance-form"
          disabled={mutation.isPending || uploading || extracting}
          className="cursor-pointer"
        >
          {mutation.isPending ? 'Đang lưu...' : uploading ? 'Đang tải file...' : 'Lưu'}
        </Button>
      </div>
    </MobileTwoColDialog>
  )
}

// ─── AcceptanceTab ────────────────────────────────────────────────────────────
interface AcceptanceTabProps {
  contractId: number
  canEdit: boolean
}

export function AcceptanceTab({ contractId, canEdit }: AcceptanceTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AcceptanceRecord | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'acceptance-records'],
    queryFn: () => getAcceptanceRecords(contractId),
  })
  const records: AcceptanceRecord[] = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAcceptanceRecord(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
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
        <EmptyState description="Chưa có biên bản nghiệm thu nào" />
      ) : (
        records.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.recordNumber}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span
                    className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                    title="Ngày tạo"
                  >
                    <CalendarIcon size={10} />
                    {formatDateTime(item.createdAt)}
                  </span>
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.totalAmount)}
                  </span>
                  {item.depositAmount > 0 && (
                    <span className="bg-success-light text-success text-xs px-2.5 py-1 rounded-full">
                      Đã cọc {formatCurrency(item.depositAmount)}
                    </span>
                  )}
                  {item.excludedDays > 0 && (
                    <span className="bg-warning-light text-warning text-xs px-2.5 py-1 rounded-full">
                      Trừ {item.excludedDays} ngày
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  Subtotal: {formatCurrency(item.subtotal)} · VAT: {formatCurrency(item.taxAmount)}
                </p>
                {item.excludedReason && (
                  <p className="text-sm text-text-secondary mt-1">Lý do trừ ngày: {item.excludedReason}</p>
                )}
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
