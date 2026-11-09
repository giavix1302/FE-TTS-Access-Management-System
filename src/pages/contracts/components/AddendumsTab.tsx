import { useState, useEffect, useRef } from 'react'
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
import { DatePicker } from '@/components/shared/DatePicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileCard } from '@/components/shared/FileCard'
import { MobileTwoColDialog } from '@/components/shared/MobileTwoColDialog'
import { DocumentExtractButton } from '@/components/shared/DocumentExtractButton'
import { AppTooltip } from '@/components/shared/AppTooltip'
import { getAddendums, createAddendum, updateAddendum, deleteAddendum } from '@/api/contracts.api'
import { uploadDocument } from '@/api/documents.api'
import { getServiceErrorMessage } from '@/constants/serviceErrors'
import { isContractOpen } from '@/constants/contractStatus'
import { usePermission } from '@/hooks/usePermission'
import { useReplaceDocument } from '@/hooks/useReplaceDocument'
import { LineItemDialog } from './LineItemDialog'
import { DraftLineItems } from './DraftLineItems'
import {
  applyLineItemApiErrors,
  buildLineItemsPayload,
  draftsFromExtract,
  validateLineDrafts,
  type LineErrors,
  type LineItemDraft,
} from '@/utils/draftLineItems'
import { applyApiErrors, getApiErrorMessage, isConcurrentUpdateError } from '@/utils/apiError'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { formatLineCalculation } from '@/utils/contractLines'
import { formatCurrency, formatDate, toDateOnly } from '@/utils/format'
import type {
  ContractStatus,
  Addendum,
  AddendumAutofillFields,
  ExtractedFileTotals,
} from '@/types/contract.types'

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
// Không còn loại phụ lục (BE bỏ 04/11).
// - Thêm: POST /addendums kèm lineItems[] (+ vehicles[] từng dòng) — lưu 1 lượt, lỗi 1 dòng thì không tạo gì
// - Sửa: PUT chỉ nhận số / ngày bắt đầu / nội dung / file. Dòng của phụ lục thêm-sửa-xóa riêng qua
//   /line-items kèm addendumId (LineItemDialog), xe qua /vehicles (tab Hợp đồng)
// startDate: THÊM bắt buộc (BE 400 nếu thiếu); SỬA tùy chọn nhưng không xóa về trống được (kiểm ở onSubmit theo isEdit).
// Không được trước ngày bắt đầu HĐ (ADDENDUM_START_BEFORE_CONTRACT) → DatePicker đặt minDate
const addendumSchema = z.object({
  addendumNumber: z.string({ error: 'Bắt buộc nhập số phụ lục' }).trim().min(1, 'Bắt buộc nhập số phụ lục'),
  startDate: z.string().optional(),
  content: z.string().max(2000).optional(),
})

type AddendumForm = z.infer<typeof addendumSchema>

// Field BE ở cấp phụ lục (camelCase, trùng tên ô form); lineItems[i].… do applyLineItemApiErrors xử lý
const ADDENDUM_ERROR_FIELDS = ['addendumNumber', 'startDate', 'content']

function AddendumDialog({
  open,
  onOpenChange,
  contractId,
  contractStartDate,
  editItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contractId: number
  /** Ngày bắt đầu HĐ — mốc sớm nhất của ngày bắt đầu phụ lục */
  contractStartDate?: string
  editItem?: Addendum
}) {
  const minStartDate = contractStartDate ? toDateOnly(contractStartDate) : undefined
  const queryClient = useQueryClient()
  const isEdit = !!editItem
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  // Tăng mỗi lần chọn file / đóng dialog → bỏ kết quả upload cũ về muộn (tránh gửi nhầm documentId)
  const uploadSeq = useRef(0)
  const [extracting, setExtracting] = useState(false)
  // Dòng dịch vụ + xe chỉ nhập lúc thêm phụ lục
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [lineErrors, setLineErrors] = useState<LineErrors>({})
  const [fileTotals, setFileTotals] = useState<ExtractedFileTotals | null>(null)

  function buildDefaultValues(): Partial<AddendumForm> {
    if (!editItem) return {}
    return {
      addendumNumber: editItem.addendumNumber,
      startDate: editItem.startDate ? toDateOnly(editItem.startDate) : undefined,
      content: editItem.content ?? '',
    }
  }

  const { register, handleSubmit, control, reset, setValue, setError, formState: { errors } } = useForm<AddendumForm>({
    resolver: zodResolver(addendumSchema),
    defaultValues: buildDefaultValues(),
  })

  function resetLines() {
    setLineItems([])
    setLineErrors({})
    setFileTotals(null)
  }

  // Dialog không unmount giữa các lần mở — reset lại form theo editItem mỗi lần open đổi sang true
  useEffect(() => {
    if (open) {
      reset(buildDefaultValues())
      resetLines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editItem])

  function handleClose(v: boolean) {
    if (!v) {
      reset(); setDocFile(null); setUploadedDoc(null); resetLines()
      uploadSeq.current++
      setUploading(false)
    }
    onOpenChange(v)
  }

  // Upload ngay lúc chọn file (is_temp=true) để có URL thật cho preview — thay vì blob URL cục bộ,
  // đặc biệt cần cho DOCX/XLSX vốn chỉ xem trước được qua Office Viewer (cần URL công khai truy cập được).
  async function handleFileChange(f: File | null) {
    const seq = ++uploadSeq.current
    setDocFile(f)
    setUploadedDoc(null)
    setFileTotals(null)
    if (!f) {
      setUploading(false)
      return
    }
    setUploading(true)
    try {
      const doc = await uploadDocument({ file: f, doc_type: 'addendum', is_temp: true })
      if (seq !== uploadSeq.current) return
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl })
    } catch (err) {
      if (seq !== uploadSeq.current) return
      toast.error(getApiErrorMessage(err, 'Tải file lên thất bại, vui lòng thử lại'))
      setDocFile(null)
    } finally {
      if (seq === uploadSeq.current) setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (body: AddendumForm) => {
      const documentId = uploadedDoc?.id
      // Sửa: ô trống = không gửi (giữ nguyên), không gửi chuỗi rỗng
      if (isEdit) return updateAddendum(contractId, editItem!.id, { ...body, startDate: body.startDate || undefined, documentId })
      return createAddendum(contractId, {
        ...body,
        startDate: body.startDate!, // đã chặn trống ở onSubmit
        documentId,
        ...(lineItems.length > 0 ? { lineItems: buildLineItemsPayload(lineItems) } : {}),
      })
    },
    onSuccess: () => {
      // contracts.all là prefix của detail/addendums/summary → invalidate 1 lần là đủ.
      // Detail HĐ chứa cả xe (vehicles[]) → xe vừa gán cho dòng phụ lục tự được tải lại
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all })
      // Xe vừa được giữ cho phụ lục → danh sách xe (currentContract) cũng đổi
      if (!isEdit && lineItems.some((li) => li.vehicles.length > 0)) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all })
      }
      toast.success(isEdit ? 'Đã cập nhật phụ lục' : 'Đã thêm phụ lục')
      handleClose(false)
    },
    // Map theo code + field, không theo HTTP status — dialog giữ nguyên để sửa rồi bấm Lưu lại
    onError: (err) => {
      if (isEdit) {
        applyApiErrors(err, setError, ADDENDUM_ERROR_FIELDS, getServiceErrorMessage(err))
        if (isConcurrentUpdateError(err)) handleClose(false)
        return
      }
      const { lineErrors: nextLineErrors, mapped } = applyLineItemApiErrors(
        err,
        lineItems,
        (name, error) => setError(name as keyof AddendumForm, error),
        ADDENDUM_ERROR_FIELDS,
        queryClient,
      )
      setLineErrors(nextLineErrors)
      // Form dài, ô đỏ có thể nằm ngoài màn hình
      if (mapped) toast.error('Vui lòng kiểm tra các ô báo đỏ')
    },
  })

  function handleExtract(fields: AddendumAutofillFields) {
    if (fields.addendumNumber !== undefined) setValue('addendumNumber', fields.addendumNumber)
    if (fields.startDate !== undefined) setValue('startDate', fields.startDate)
    if (fields.content !== undefined) setValue('content', fields.content)
    // Sửa phụ lục: PUT không nhận dòng → chỉ điền 3 ô trên
    if (isEdit) return
    const extracted = fields.lineItems ?? []
    // Phụ lục không có bảng giá → lineItems [] : giữ nguyên các dòng người dùng đã nhập
    const replaceLines =
      extracted.length > 0 &&
      (lineItems.length === 0 || window.confirm('AI sẽ thay toàn bộ các dòng dịch vụ hiện tại. Tiếp tục?'))
    if (replaceLines) {
      setLineItems(draftsFromExtract(extracted))
      setLineErrors({})
    }
    // fileTotals chỉ để đối chiếu (BE tự tính lại); toàn null → coi như không có.
    // Giữ dòng cũ (hoặc file không có bảng giá) thì tổng trong file không khớp dòng sẽ gửi → không hiện
    const totals = fields.fileTotals
    setFileTotals(replaceLines && totals && Object.values(totals).some((v) => v != null) ? totals : null)
  }

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
        onSubmit={handleSubmit((d) => {
          // Phụ lục đã có ngày bắt đầu thì không xóa về trống được (PUT không gửi = giữ nguyên)
          if (!d.startDate && (!isEdit || editItem?.startDate)) {
            setError('startDate', { message: 'Bắt buộc chọn ngày bắt đầu' })
            return
          }
          if (d.startDate && minStartDate && (toDateOnly(d.startDate) ?? '') < minStartDate) {
            setError('startDate', { message: `Không được trước ngày bắt đầu hợp đồng (${formatDate(minStartDate)})` })
            return
          }
          if (!isEdit) {
            const lineError = validateLineDrafts(lineItems)
            if (lineError) {
              toast.error(lineError)
              return
            }
          }
          mutation.mutate(d)
        })}
        // Desktop bỏ padding trái để nội dung thẳng hàng với tiêu đề dialog (giống Tạo hợp đồng); mobile giữ px-5
        className="flex flex-col gap-4 px-5 sm:pl-0 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Thông tin phụ lục</p>
        <DocumentExtractButton<AddendumAutofillFields>
          documentId={uploadedDoc?.id ?? editItem?.document?.id}
          docType="addendum"
          disabled={uploading}
          onBusyChange={setExtracting}
          onExtract={handleExtract}
        />

        <div className="space-y-1">
          <Label>Số phụ lục <span className="text-error">*</span></Label>
          <Input {...register('addendumNumber')} placeholder="0101-01PLHĐ/TTS-..." />
          {errors.addendumNumber && <p className="text-xs text-error">{errors.addendumNumber.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Ngày bắt đầu {(!isEdit || !!editItem?.startDate) && <span className="text-error">*</span>}</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} placeholder="Chọn ngày" minDate={minStartDate} />
            )}
          />
          {errors.startDate && <p className="text-xs text-error">{errors.startDate.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Nội dung</Label>
          <Textarea rows={3} maxLength={2000} {...register('content')} />
          {errors.content && <p className="text-xs text-error">{errors.content.message}</p>}
        </div>

        {isEdit ? (
          <p className="rounded-md bg-bg-page px-3 py-2 text-xs text-text-secondary">
            Tiền phụ lục được tự tính từ các dòng dịch vụ của phụ lục (cùng VAT công ty).
            Thêm, sửa, xóa dịch vụ ở danh sách phụ lục; gán xe ở mục Dịch vụ & xe của tab Hợp đồng.
          </p>
        ) : (
          <>
            <DraftLineItems
              lineItems={lineItems}
              setLineItems={setLineItems}
              lineErrors={lineErrors}
              setLineErrors={setLineErrors}
              fileTotals={fileTotals}
              enabled={open}
              emptyHint="Chưa có dịch vụ nào — có thể bỏ trống và thêm sau khi lưu phụ lục"
            />
            <p className="rounded-md bg-bg-page px-3 py-2 text-xs text-text-secondary">
              Tiền phụ lục do hệ thống tự tính từ các dòng dịch vụ (cùng VAT công ty). Phụ lục, dịch vụ và xe được lưu cùng lúc:
              một dòng lỗi thì không tạo gì.
            </p>
          </>
        )}
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
  /** Ngày bắt đầu HĐ — chặn chọn ngày bắt đầu phụ lục sớm hơn */
  contractStartDate?: string
  canEdit: boolean
}

export function AddendumsTab({ contractId, contractStatus, contractStartDate, canEdit }: AddendumsTabProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Addendum | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // Thêm dòng dịch vụ cho phụ lục — cần cả contracts.update lẫn service_catalog.view (giống dòng HĐ gốc)
  const [addingLineTo, setAddingLineTo] = useState<Addendum | undefined>()
  const canWrite = canEdit && isContractOpen(contractStatus)
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
    <div className="mt-4 rounded-lg border border-border bg-bg-card p-5">
      {canWrite && (
        <div className="flex items-center justify-end mb-4">
          <Button variant="outline" size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus size={14} />
            Thêm phụ lục
          </Button>
        </div>
      )}

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
          <div key={item.id} className="bg-bg-card rounded-lg border border-border p-4 mb-3 last:mb-0 space-y-3">
            {/* Row 1: info + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-sm text-text-primary">{item.addendumNumber}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
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
                  <AppTooltip content="Chỉnh sửa phụ lục">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="cursor-pointer h-8 w-8 p-0">
                      <Pencil size={14} />
                    </Button>
                  </AppTooltip>
                  {/* BE chặn xóa phụ lục còn dòng (409 ADDENDUM_HAS_LINE_ITEMS) → disable trước */}
                  <AppTooltip content={hasLines ? 'Phụ lục còn dòng dịch vụ, xóa các dòng trước' : 'Xóa phụ lục'}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={hasLines}
                      onClick={(e) => { e.stopPropagation(); setDeletingId(item.id) }}
                      className="cursor-pointer h-8 w-8 p-0 hover:bg-error hover:text-white"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </AppTooltip>
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
                            · {formatLineCalculation(li)}
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
        contractStartDate={contractStartDate}
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
