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
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { DocumentExtractButton } from '@/components/shared/DocumentExtractButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAddendums, createAddendum, updateAddendum, deleteAddendum } from '@/api/contracts.api'
import { uploadDocument } from '@/api/documents.api'
import { getServiceErrorMessage } from '@/constants/serviceErrors'
import { usePermission } from '@/hooks/usePermission'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { LineItemDialog } from './LineItemDialog'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatCurrency, formatDate } from '@/utils/format'
import type { ContractStatus, Addendum, AddendumType, AddendumAutofillFields } from '@/types/contract.types'

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
// Tiền phụ lục BE tự tính từ các dòng của phụ lục → form không có tiền / ngày kết thúc mới.
// Dòng phụ lục thêm qua POST /contracts/{id}/line-items kèm addendumId (LineItemDialog)
const addendumSchema = z.object({
  addendumNumber: z.string().min(1, 'Bắt buộc'),
  addendumType: z.enum(['extension', 'price_change', 'add_service', 'mixed']),
  startDate: z.string().optional(),
  content: z.string().max(2000).optional(),
})

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
  const [extracting, setExtracting] = useState(false)

  function buildDefaultValues(): Partial<AddendumForm> {
    if (!editItem) return {}
    return {
      addendumNumber: editItem.addendumNumber,
      addendumType: editItem.addendumType,
      startDate: editItem.startDate ?? undefined,
      content: editItem.content ?? '',
    }
  }

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<AddendumForm>({
    resolver: zodResolver(addendumSchema),
    defaultValues: buildDefaultValues(),
  })

  // Dialog không unmount giữa các lần mở — reset lại form theo editItem mỗi lần open đổi sang true
  useEffect(() => {
    if (open) reset(buildDefaultValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem])

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
      const documentId = uploadedDoc?.id
      const payload = { ...body, documentId }
      return isEdit
        ? updateAddendum(contractId, editItem!.id, payload)
        : createAddendum(contractId, payload)
    },
    onSuccess: () => {
      // contracts.all là prefix của detail/addendums/summary → invalidate 1 lần là đủ
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      toast.success(isEdit ? 'Đã cập nhật phụ lục' : 'Đã thêm phụ lục')
      handleClose(false)
    },
    onError: (err) => toast.error(getServiceErrorMessage(err)),
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
        <DocumentExtractButton<AddendumAutofillFields>
          documentId={uploadedDoc?.id ?? editItem?.document?.id}
          docType="addendum"
          disabled={uploading}
          onBusyChange={setExtracting}
          onExtract={(fields) => {
            if (fields.addendumNumber !== undefined) setValue('addendumNumber', fields.addendumNumber)
            if (fields.addendumType !== undefined) setValue('addendumType', fields.addendumType)
            if (fields.startDate !== undefined) setValue('startDate', fields.startDate)
            if (fields.content !== undefined) setValue('content', fields.content)
          }}
        />

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
          <Label>Nội dung</Label>
          <Textarea rows={3} maxLength={2000} {...register('content')} />
        </div>

        <p className="rounded-md bg-bg-page px-3 py-2 text-xs text-text-secondary">
          Tiền phụ lục được tự tính từ các dòng dịch vụ của phụ lục (cùng VAT công ty).
          {isEdit ? '' : ' Lưu phụ lục xong rồi thêm dòng dịch vụ.'}
        </p>
      </form>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={() => handleClose(false)} className="cursor-pointer">
          Hủy
        </Button>
        <Button
          type="submit"
          form="addendum-form"
          disabled={mutation.isPending || uploading || extracting}
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
  const { hasPermission } = usePermission()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Addendum | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // Thêm dòng dịch vụ cho phụ lục — cần cả contracts.update lẫn service_catalog.view (giống dòng HĐ gốc)
  const [addingLineTo, setAddingLineTo] = useState<Addendum | undefined>()
  const canWrite = canEdit && contractStatus === 'active'
  const canAddService = canWrite && hasPermission('service_catalog.view')

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), 'addendums'],
    queryFn: () => getAddendums(contractId),
  })
  const addendums: Addendum[] = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAddendum(contractId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      toast.success('Đã xóa phụ lục')
      setDeletingId(null)
    },
    onError: (err) => {
      // 409 ADDENDUM_HAS_LINE_ITEMS: dữ liệu lệch (vừa có dòng mới) → đồng bộ lại
      toast.error(getServiceErrorMessage(err))
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) })
      setDeletingId(null)
    },
  })

  const openAdd = () => { setEditingItem(undefined); setDialogOpen(true) }
  const openEdit = (item: Addendum) => { setEditingItem(item); setDialogOpen(true) }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-text-primary">Phụ lục</span>
        {canWrite && (
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
        addendums.map((item) => {
          const lineItems = item.lineItems ?? []
          const hasLines = lineItems.length > 0
          return (
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.addendumNumber}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${ADDENDUM_TYPE_CHIP[item.addendumType]}`}>
                    {ADDENDUM_TYPE_LABELS[item.addendumType]}
                  </span>
                  {item.startDate && (
                    <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CalendarIcon size={10} />
                      Từ {formatDate(item.startDate)}
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
              {canWrite && (
                <div className="flex items-center gap-0.5 flex-none">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="cursor-pointer h-8 w-8 p-0">
                        <Pencil size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chỉnh sửa phụ lục</TooltipContent>
                  </Tooltip>
                  {/* BE chặn xóa phụ lục còn dòng (409 ADDENDUM_HAS_LINE_ITEMS) → disable trước.
                      Bọc span để tooltip vẫn hiện khi nút disable */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={hasLines}
                          onClick={(e) => { e.stopPropagation(); setDeletingId(item.id) }}
                          className="cursor-pointer h-8 w-8 p-0 hover:bg-error hover:text-white"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hasLines ? 'Phụ lục còn dòng dịch vụ, xóa các dòng trước' : 'Xóa phụ lục'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Row 2: dòng dịch vụ của phụ lục (gán xe / sửa dòng ở mục Dịch vụ & xe, tab Hợp đồng) */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Dịch vụ</p>
                {canAddService && (
                  <button
                    type="button"
                    onClick={() => setAddingLineTo(item)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm dịch vụ
                  </button>
                )}
              </div>
              {!hasLines ? (
                <p className="text-xs text-text-disabled">Chưa có dòng dịch vụ</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {lineItems.map((li) => (
                      <li key={li.id} className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 text-text-primary">
                          {li.service.name}{' '}
                          <span className="text-text-secondary">
                            · {formatCurrency(li.unitPrice)} × {li.quantity} {li.unit}
                            {li.duration != null ? ` × ${li.duration}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium text-text-primary">{formatCurrency(li.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  {/* Tiền phụ lục do BE tự tính — chỉ đọc */}
                  <div className="rounded-md bg-primary-light px-3 py-2 text-xs text-text-secondary space-y-0.5">
                    <div className="flex justify-between">
                      <span>Cộng tiền hàng</span>
                      <span className="font-medium text-text-primary">{formatCurrency(item.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT</span>
                      <span className="font-medium text-text-primary">{formatCurrency(item.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-text-primary">Tổng phụ lục</span>
                      <span className="font-bold text-primary">{formatCurrency(item.totalAmount)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Row 3: file */}
            <div className="pt-3 border-t border-border">
              <AddendumFileCard
                document={item.document}
                addendumId={item.id}
                contractId={contractId}
                canEdit={canWrite}
              />
            </div>
          </div>
          )
        })
      )}

      <AddendumDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingItem(undefined) }}
        contractId={contractId}
        editItem={editingItem}
      />

      <LineItemDialog
        open={!!addingLineTo}
        onOpenChange={(v) => { if (!v) setAddingLineTo(undefined) }}
        contractId={contractId}
        addendum={addingLineTo}
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
