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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { DatePicker } from '@/components/shared/DatePicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileCard } from '@/components/shared/FileCard'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { DocumentExtractButton } from '@/components/shared/DocumentExtractButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from '@/api/contracts.api'
import { uploadDocument } from '@/api/documents.api'
import { getCompanySettings } from '@/api/company.api'
import { getServiceErrorMessage } from '@/constants/serviceErrors'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { getApiError } from '@/utils/apiError'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Invoice, ContractSummary, InvoiceAutofillFields } from '@/types/contract.types'

// ─── InvoiceFileCard ──────────────────────────────────────────────────────────
function InvoiceFileCard({
  document,
  invoiceId,
  contractId,
  canEdit,
}: {
  document: Invoice['document']
  invoiceId: number
  contractId: number
  canEdit: boolean
}) {
  const replace = useReplaceDocument({
    documentId: document?.id,
    entityType: 'invoice',
    entityId: invoiceId,
    queryKeys: [[...QUERY_KEYS.contracts.detail(contractId), 'invoices']],
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

// ─── InvoiceDialog ────────────────────────────────────────────────────────────
// BE: invoiceSymbol bắt buộc (≤ 20), totalAmount > 0, |subtotal + taxAmount − totalAmount| ≤ 1.000đ
const invoiceSchema = z.object({
  invoiceSymbol: z.string().trim().min(1, 'Bắt buộc').max(20, 'Tối đa 20 ký tự'),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().min(1, 'Bắt buộc'),
  subtotal: z.number({ error: 'Bắt buộc' }).min(0),
  vatRatePercent: z.number({ error: 'Bắt buộc' }).min(0).max(100),
  taxAmount: z.number({ error: 'Bắt buộc' }).min(0),
  totalAmount: z.number({ error: 'Bắt buộc' }).positive('Phải > 0'),
  note: z.string().max(500).optional(),
})
  .refine(
    (d) => Math.abs(d.subtotal + d.taxAmount - d.totalAmount) <= 1000,
    { message: 'Subtotal + VAT lệch quá 1.000₫ so với tổng tiền', path: ['totalAmount'] }
  )

type InvoiceForm = z.infer<typeof invoiceSchema>

function InvoiceDialog({
  open,
  onOpenChange,
  contractId,
  editItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  editItem?: Invoice
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

  function buildDefaultValues(): Partial<InvoiceForm> {
    if (!editItem) return { vatRatePercent: defaultVatRate }
    return {
      invoiceSymbol: editItem.invoiceSymbol ?? '',
      invoiceNumber: editItem.invoiceNumber ?? '',
      invoiceDate: editItem.invoiceDate,
      subtotal: editItem.subtotal,
      vatRatePercent: editItem.subtotal > 0
        ? Math.round((editItem.taxAmount / editItem.subtotal) * 100 * 100) / 100
        : defaultVatRate,
      taxAmount: editItem.taxAmount,
      totalAmount: editItem.totalAmount,
      note: editItem.note ?? '',
    }
  }

  const { register, handleSubmit, control, watch, setValue, setError, reset, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
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
      const doc = await uploadDocument({ file: f, doc_type: 'invoice', is_temp: true })
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl })
    } catch {
      toast.error('Tải file lên thất bại, vui lòng thử lại')
      setDocFile(null)
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (body: InvoiceForm) => {
      // vatRatePercent chỉ dùng để tính taxAmount ở FE — BE không có field này
      const rest = Object.fromEntries(
        Object.entries(body).filter(([key]) => key !== 'vatRatePercent'),
      ) as Omit<InvoiceForm, 'vatRatePercent'>
      const documentId = uploadedDoc?.id
      const payload = { ...rest, documentId }
      return isEdit
        ? updateInvoice(contractId, editItem!.id, payload)
        : createInvoice(contractId, payload)
    },
    onSuccess: () => {
      // amountPaid của summary = tổng totalAmount hóa đơn → contracts.all (prefix) refetch cả summary
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      toast.success(isEdit ? 'Đã cập nhật hóa đơn' : 'Đã thêm hóa đơn')
      handleClose(false)
    },
    onError: (err) => {
      if (getApiError(err).code === 'AMOUNT_MISMATCH') {
        setError('totalAmount', { message: getServiceErrorMessage(err) })
        return
      }
      toast.error(getServiceErrorMessage(err))
    },
  })

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa hóa đơn' : 'Thêm hóa đơn'}
      file={uploadedDoc ? null : docFile}
      onFileChange={handleFileChange}
      isEdit={isEdit || !!uploadedDoc}
      existingFileName={uploadedDoc?.fileName ?? editItem?.document?.fileName}
      existingFileUrl={uploadedDoc?.sasUrl ?? editItem?.document?.sasUrl}
      uploadLabel="Kéo thả hoặc nhấp để chọn file hóa đơn"
    >
      <form
        id="invoice-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin hóa đơn</p>
        <DocumentExtractButton<InvoiceAutofillFields>
          documentId={uploadedDoc?.id ?? editItem?.document?.id}
          docType="invoice"
          disabled={uploading}
          onBusyChange={setExtracting}
          onExtract={(fields) => {
            if (fields.invoiceSymbol !== undefined) setValue('invoiceSymbol', fields.invoiceSymbol)
            if (fields.invoiceNumber !== undefined) setValue('invoiceNumber', fields.invoiceNumber)
            if (fields.invoiceDate !== undefined) setValue('invoiceDate', fields.invoiceDate)
            if (fields.subtotal !== undefined) setValue('subtotal', fields.subtotal)
            if (fields.taxAmount !== undefined) setValue('taxAmount', fields.taxAmount)
            if (fields.totalAmount !== undefined) setValue('totalAmount', fields.totalAmount)
            if (fields.note !== undefined) setValue('note', fields.note)
            if (fields.subtotal && fields.taxAmount !== undefined) {
              setValue('vatRatePercent', Math.round((fields.taxAmount / fields.subtotal) * 10000) / 100)
            }
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ký hiệu <span className="text-error">*</span></Label>
            <Input {...register('invoiceSymbol')} maxLength={20} placeholder="1C26TTS" />
            {errors.invoiceSymbol && <p className="text-xs text-error">{errors.invoiceSymbol.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Số hóa đơn</Label>
            <Input {...register('invoiceNumber')} placeholder="Điền sau khi xuất trên MISA/FAST" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Ngày hóa đơn <span className="text-error">*</span></Label>
          <Controller
            control={control}
            name="invoiceDate"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.invoiceDate && <p className="text-xs text-error">{errors.invoiceDate.message}</p>}
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
            {errors.totalAmount && <p className="text-xs text-error">{errors.totalAmount.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Ghi chú</Label>
          <Textarea rows={3} maxLength={500} {...register('note')} />
        </div>
      </form>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => handleClose(false)} className="cursor-pointer">
          Hủy
        </Button>
        <Button
          type="submit"
          form="invoice-form"
          disabled={mutation.isPending || uploading || extracting}
          className="cursor-pointer"
        >
          {mutation.isPending ? 'Đang lưu...' : uploading ? 'Đang tải file...' : 'Lưu'}
        </Button>
      </div>
    </MobileTwoColDialog>
  )
}

// ─── InvoicesTab ──────────────────────────────────────────────────────────────
interface InvoicesTabProps {
  contractId: number
  summary: ContractSummary | undefined
  canEdit: boolean
}

export function InvoicesTab({ contractId, summary, canEdit }: InvoicesTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Invoice | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'invoices'],
    queryFn: () => getInvoices(contractId),
  })
  const invoices: Invoice[] = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInvoice(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      toast.success('Đã xóa hóa đơn')
      setDeletingId(null)
    },
    onError: (err) => toast.error(getServiceErrorMessage(err)),
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Invoice) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      {/* Summary bar */}
      {summary && (
        <div className="flex flex-wrap gap-6 p-4 bg-primary-light rounded-lg mb-4 text-sm">
          <span>Phải thanh toán: <b>{formatCurrency(summary.amountPayable)}</b></span>
          <span>Đã thanh toán: <b className="text-success">{formatCurrency(summary.amountPaid)}</b></span>
          <span>
            Còn lại:{' '}
            <b className={summary.amountRemaining > 0 ? 'text-error' : 'text-success'}>
              {formatCurrency(summary.amountRemaining)}
            </b>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-text-primary">Hóa đơn</span>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus size={14} />
            Thêm hóa đơn
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <EmptyState description="Chưa có hóa đơn nào" />
      ) : (
        invoices.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {item.invoiceSymbol ? (
                    <span className="font-mono text-sm text-text-secondary">{item.invoiceSymbol}</span>
                  ) : (
                    <Badge variant="outline" className="border-warning text-warning">Chưa có ký hiệu</Badge>
                  )}
                  {/* BE bỏ key khi null → so `!` chứ không `=== null` */}
                  {!item.invoiceNumber ? (
                    <Badge variant="outline" className="border-warning text-warning">Chưa có số HĐ</Badge>
                  ) : (
                    <span className="font-mono font-semibold text-sm text-text-primary">{item.invoiceNumber}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CalendarIcon size={10} />
                    {formatDate(item.invoiceDate)}
                  </span>
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.totalAmount)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  Subtotal: {formatCurrency(item.subtotal)} · VAT: {formatCurrency(item.taxAmount)}
                </p>
                {item.note && (
                  <p className="text-sm text-text-secondary mt-1">{item.note}</p>
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
                    <TooltipContent>Chỉnh sửa hóa đơn</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingId(item.id) }} className="cursor-pointer h-8 w-8 p-0 hover:bg-error hover:text-white">
                        <Trash2 size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xóa hóa đơn</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {/* Row 2: file */}
            <div className="pt-3 border-t border-border">
              <InvoiceFileCard
                document={item.document}
                invoiceId={item.id}
                contractId={contractId}
                canEdit={canEdit}
              />
            </div>
          </div>
        ))
      )}

      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingItem(undefined) }}
        contractId={contractId}
        editItem={editingItem}
      />

      <ConfirmModal
        open={deletingId !== null}
        onOpenChange={(v) => { if (!v) setDeletingId(null) }}
        title="Xóa hóa đơn"
        description="Bạn có chắc muốn xóa hóa đơn này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingId !== null && deleteMutation.mutate(deletingId)}
      />
    </div>
  )
}
