import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/DatePicker";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FileCard } from "@/components/shared/FileCard";
import { MobileTwoColDialog } from "@/components/shared/MobileTwoColDialog";
import { updateContract } from "@/api/contracts.api";
import { uploadDocument } from "@/api/documents.api";
import { useReplaceDocument } from "@/hooks/useReplaceDocument";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatCurrency, formatDate } from "@/utils/format";
import type { ContractCustomer, ContractDetail } from "@/types/contract.types";

// ─── Khách hàng ───────────────────────────────────────────────────────────────
// GET /contracts/{id} không trả displayName (chỉ list có) → field theo loại khách
function InfoField({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-sm font-medium text-text-primary break-words">{value || "—"}</p>
    </div>
  );
}

// Ngày cấp CCCD lưu dạng dd/MM/yyyy (giống CustomerDetailPage) — chỉ format khi BE trả dạng ISO
const formatIssueDate = (value?: string) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(value ?? "") ? value : value ? formatDate(value) : undefined;

function CustomerInfo({ customer }: { customer: ContractCustomer }) {
  const isBusiness = customer.customerType === "business";
  const Icon = isBusiness ? Building2 : User;
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
        <Icon size={13} className="shrink-0" />
        {isBusiness ? "Khách hàng doanh nghiệp" : "Khách hàng cá nhân"}
      </p>
      {customer.customerType === "business" ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <InfoField label="Tên công ty" value={customer.internationalName} wide />
          <InfoField label="Mã số thuế" value={customer.taxCode} />
          <InfoField label="Người đại diện" value={customer.representative} />
          <InfoField label="Địa chỉ" value={customer.officeAddress || customer.taxAddress} wide />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <InfoField label="Họ tên" value={customer.fullName} wide />
          <InfoField label="Số CCCD" value={customer.cccd} />
          <InfoField label="Ngày cấp" value={formatIssueDate(customer.cccdIssueDate)} />
          <InfoField label="Nơi cấp" value={customer.cccdIssuePlace} wide />
          <InfoField label="Quê quán" value={customer.hometown} wide />
          <InfoField label="Địa chỉ thường trú" value={customer.permanentAddress} wide />
        </div>
      )}
    </div>
  );
}

// ─── ContractInfoDialog ────────────────────────────────────────────────────────
// Ngày kết thúc không nhập tay: BE tính = startDate + số ngày làm lớn nhất của các xe − 1.
// Ngày trừ đã chuyển sang BBNT.
const contractInfoSchema = z.object({
  contractNumber: z.string().trim().min(1, "Bắt buộc").max(100, "Tối đa 100 ký tự"),
  startDate: z.string().min(1, "Bắt buộc"),
  siteAddress: z.string().trim().min(1, "Bắt buộc").max(500, "Tối đa 500 ký tự"),
  depositAmount: z.number().min(0, "Phải >= 0").optional(),
});

type ContractInfoForm = z.infer<typeof contractInfoSchema>;

function ContractInfoDialog({
  open,
  onOpenChange,
  contract,
  contractId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: ContractDetail;
  contractId: number;
}) {
  const queryClient = useQueryClient();
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ContractInfoForm>({
    resolver: zodResolver(contractInfoSchema),
    defaultValues: {
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      siteAddress: contract.siteAddress,
      depositAmount: contract.depositAmount,
    },
  });

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null); setUploadedDoc(null) }
    onOpenChange(v);
  }

  // Upload ngay lúc chọn file (is_temp=true) để có URL thật cho preview — blob URL cục bộ
  // không xem được DOCX/XLSX vì Office Viewer cần URL công khai. BE dọn file tạm sau 3h nếu không gắn vào HĐ.
  async function handleFileChange(f: File | null) {
    setDocFile(f);
    setUploadedDoc(null);
    if (!f) return;
    setUploading(true);
    try {
      const doc = await uploadDocument({ file: f, doc_type: "contract", is_temp: true });
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl });
    } catch {
      toast.error("Tải file lên thất bại, vui lòng thử lại");
      setDocFile(null);
    } finally {
      setUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async (form: ContractInfoForm) => {
      const documentId = uploadedDoc?.id;
      // depositAmount không gửi = không đổi; ô trống = 0
      await updateContract(contractId, {
        contractNumber: form.contractNumber,
        startDate: form.startDate,
        siteAddress: form.siteAddress,
        depositAmount: form.depositAmount ?? 0,
        documentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Đã cập nhật thông tin hợp đồng");
      handleClose(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title="Chỉnh sửa thông tin hợp đồng"
      file={uploadedDoc ? null : docFile}
      onFileChange={handleFileChange}
      isEdit
      existingFileName={uploadedDoc?.fileName ?? contract.document?.fileName}
      existingFileUrl={uploadedDoc?.sasUrl ?? contract.document?.sasUrl}
      uploadLabel="Kéo thả hoặc nhấp để chọn file hợp đồng mới"
    >
      <form
        id="contract-info-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Thông tin hợp đồng
        </p>

        <div className="space-y-1">
          <Label>Số hợp đồng <span className="text-error">*</span></Label>
          <Input {...register('contractNumber')} placeholder="01012026/HĐTTB/TTS-..." />
          {errors.contractNumber && (
            <p className="text-xs text-error">{errors.contractNumber.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày bắt đầu <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.startDate && (
              <p className="text-xs text-error">{errors.startDate.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Tiền cọc (₫)</Label>
            <Controller
              control={control}
              name="depositAmount"
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="0" />
              )}
            />
            {errors.depositAmount && (
              <p className="text-xs text-error">{errors.depositAmount.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Địa chỉ công trường <span className="text-error">*</span></Label>
          <Textarea rows={2} className="resize-none" {...register("siteAddress")} />
          {errors.siteAddress && (
            <p className="text-xs text-error">{errors.siteAddress.message}</p>
          )}
        </div>
      </form>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleClose(false)}
          className="cursor-pointer"
        >
          Hủy
        </Button>
        <Button
          type="submit"
          form="contract-info-form"
          disabled={mutation.isPending || uploading}
          className="cursor-pointer"
        >
          {mutation.isPending ? "Đang lưu..." : uploading ? "Đang tải file..." : "Lưu"}
        </Button>
      </div>
    </MobileTwoColDialog>
  );
}

// ─── ContractTab ──────────────────────────────────────────────────────────────
interface ContractTabProps {
  contract: ContractDetail;
  contractId: number;
  canEdit: boolean;
}

export function ContractTab({
  contract,
  contractId,
  canEdit,
}: ContractTabProps) {
  const [editInfoOpen, setEditInfoOpen] = useState(false);

  const replaceContractDoc = useReplaceDocument({
    documentId: contract.document?.id,
    entityType: "contract",
    entityId: contractId,
    queryKeys: [[...QUERY_KEYS.contracts.detail(contractId)]],
  });

  return (
    <div className="space-y-4">
      {/* Section A — Thông tin hợp đồng. Header cùng kiểu với card "Dịch vụ & xe" (ServiceLinesTab) */}
      <div className="overflow-hidden rounded-lg border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="font-medium text-text-primary">
            Thông tin hợp đồng
          </span>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditInfoOpen(true)}
              className="cursor-pointer"
            >
              <Pencil size={14} />
              Chỉnh sửa
            </Button>
          )}
        </div>
        <div className="p-5">
          <CustomerInfo customer={contract.customer} />

          <Separator className="my-4" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
            Hợp đồng
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-text-secondary">Ngày bắt đầu</p>
              <p className="text-sm font-medium text-text-primary">
                {formatDate(contract.startDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Ngày kết thúc</p>
              <p className="text-sm font-medium text-text-primary">
                {formatDate(contract.endDate)}
              </p>
              <p className="text-xs text-text-secondary">
                {contract.endDate
                  ? "Ngày bắt đầu + số ngày làm lớn nhất của các xe − 1"
                  : "Tự tính khi có xe được nhập số ngày làm (mục Dịch vụ & xe)"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Tiền cọc</p>
              <p className="text-sm font-medium text-text-primary">
                {formatCurrency(contract.depositAmount ?? 0)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-text-secondary">Địa chỉ công trường</p>
              <p className="text-sm font-medium text-text-primary">
                {contract.siteAddress || "—"}
              </p>
            </div>
          </div>

          <Separator className="my-4" />
          <div>
            <p className="text-xs text-text-secondary mb-2">File HĐ đã ký</p>
            {contract.document ? (
              <FileCard
                fileName={contract.document?.fileName}
                url={contract.document?.sasUrl}
                documentId={contract.document?.id}
                fileSize={contract.document.fileSizeKb * 1024}
                createdAt={contract.document.uploadedAt}
                onReplace={
                  canEdit ? (file) => replaceContractDoc.mutate(file) : undefined
                }
                isReplacing={replaceContractDoc.isPending}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-disabled">Chưa có file</span>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditInfoOpen(true)}
                    className="cursor-pointer"
                  >
                    Upload file HĐ
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ContractInfoDialog
        open={editInfoOpen}
        onOpenChange={setEditInfoOpen}
        contract={contract}
        contractId={contractId}
      />
    </div>
  );
}
