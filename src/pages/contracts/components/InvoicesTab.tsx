import { useState } from 'react'
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
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from '@/api/contracts.api'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Invoice, ContractSummary } from '@/types/contract.types'

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
      fileName={document.file_name}
      url={document.sas_url}
      fileSize={document.file_size_kb * 1024}
      createdAt={document.uploaded_at}
      onReplace={canEdit ? (file) => replace.mutate(file) : undefined}
      isReplacing={replace.isPending}
    />
  )
}

// ─── InvoiceDialog ────────────────────────────────────────────────────────────
const invoiceSchema = z.object({
  invoice_number: z.string().optional(),
  invoice_date: z.string().min(1, 'Bắt buộc'),
  amount: z.number({ invalid_type_error: 'Bắt buộc' }).min(1, 'Phải > 0'),
  note: z.string().max(500).optional(),
})

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

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: isEdit
      ? {
          invoice_number: editItem.invoice_number ?? '',
          invoice_date: editItem.invoice_date,
          amount: editItem.amount,
          note: editItem.note ?? '',
        }
      : {},
  })

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null) }
    onOpenChange(v)
  }

  const mutation = useMutation({
    mutationFn: (body: InvoiceForm) =>
      isEdit
        ? updateInvoice(contractId, editItem!.id, body)
        : createInvoice(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'invoices'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success(isEdit ? 'Đã cập nhật hóa đơn' : 'Đã thêm hóa đơn')
      handleClose(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title={isEdit ? 'Chỉnh sửa hóa đơn' : 'Thêm hóa đơn'}
      file={docFile}
      onFileChange={setDocFile}
      isEdit={isEdit}
      existingFileName={editItem?.document?.file_name}
      existingFileUrl={editItem?.document?.sas_url}
      uploadLabel="Kéo thả hoặc nhấp để chọn file hóa đơn"
    >
      <form
        id="invoice-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin hóa đơn</p>

        <div className="space-y-1">
          <Label>Số hóa đơn</Label>
          <Input {...register('invoice_number')} placeholder="Điền sau khi xuất trên MISA/FAST" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày hóa đơn <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="invoice_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.invoice_date && <p className="text-xs text-error">{errors.invoice_date.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Số tiền <span className="text-error">*</span></Label>
            <Input type="number" min={1} {...register('amount', { valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-error">{errors.amount.message}</p>}
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
        <Button type="submit" form="invoice-form" disabled={mutation.isPending || (!isEdit && !docFile)} className="cursor-pointer">
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
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
  initialData?: Invoice[]
}

export function InvoicesTab({ contractId, summary, canEdit, initialData }: InvoicesTabProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Invoice | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'invoices'],
    queryFn: () => getInvoices(contractId),
    initialData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInvoice(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'invoices'] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'summary'] })
      toast.success('Đã xóa hóa đơn')
      setDeletingId(null)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Invoice) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      {/* Summary bar */}
      {summary && (
        <div className="flex flex-wrap gap-6 p-4 bg-primary-light rounded-lg mb-4 text-sm">
          <span>Phải thanh toán: <b>{formatCurrency(summary.amount_payable)}</b></span>
          <span>Đã thanh toán: <b className="text-success">{formatCurrency(summary.amount_paid)}</b></span>
          <span>
            Còn lại:{' '}
            <b className={summary.amount_remaining > 0 ? 'text-error' : 'text-success'}>
              {formatCurrency(summary.amount_remaining)}
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
        <EmptyState message="Chưa có hóa đơn nào" />
      ) : (
        invoices.map((item) => (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.invoice_number === null ? (
                    <Badge variant="outline" className="border-warning text-warning">Chưa có số HĐ</Badge>
                  ) : (
                    <span className="font-mono font-semibold text-sm text-text-primary">{item.invoice_number}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CalendarIcon size={10} />
                    {formatDate(item.invoice_date)}
                  </span>
                  <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
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
