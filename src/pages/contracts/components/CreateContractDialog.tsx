import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Building2,
  User,
  X,
  Sparkles,
  FileText,
  ChevronDown,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FileUpload } from "@/components/shared/FileUpload";
import { DatePicker } from "@/components/shared/DatePicker";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetFullscreenHeader,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  createContract,
} from "@/api/contracts.api";
import { extractDocument, uploadDocument } from "@/api/documents.api";
import {
  getCustomers,
  createIndividualCustomer,
  createBusinessCustomer,
} from "@/api/customers.api";
import { getVehicles } from "@/api/vehicles.api";
import { getServiceCatalog } from "@/api/service-catalog.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { usePermission } from "@/hooks/usePermission";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { getApiError } from "@/utils/apiError";
import { isValidPhone, normalizePhone, PHONE_INPUT_PATTERN, PHONE_VALIDATION_MESSAGE } from "@/utils/phone";
import type { ContractAutofillFields, ExtractedCustomerFields } from "@/types/contract.types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CustomerOption {
  id: number;
  customerType: "business" | "individual";
  displayName: string;
  shortName?: string | null;
  phone?: string;
  isActive?: boolean;
}

interface ServiceOption {
  id: number;
  name: string;
  units: string[];
  isActive: boolean;
  allowVehicle: boolean;
}

interface VehicleOption {
  id: number;
  model: string;
  serialNumber: string;
  status: string;
}

interface LineItemDraft {
  _key: string; // local unique key
  service_id: number | null;
  service_name: string;
  unit: string;
  // Dịch vụ cho phép gán xe (allowVehicle) — chỉ dòng này mới chọn được xe ở bước 4
  allow_vehicle: boolean;
  unit_price: number | undefined;
  quantity: number | undefined;
  duration: number | undefined;
  // Dòng thuê xe chọn tối đa quantity xe; AI không tự chọn xe.
  vehicles: VehicleDraft[];
  // Ghi chú dòng (BE `note`, ≤ 500) — BE không có field description riêng cho dòng
  note: string;
}

interface VehicleDraft {
  vehicle_id: number;
  deploy_date: string;
  work_days: number;
  note: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const contractSchema = z.object({
  customer_id: z.number({ error: "Bắt buộc chọn khách hàng" }),
  contract_number: z.string().trim().max(100, "Tối đa 100 ký tự").optional(),
  start_date: z.string().min(1, "Bắt buộc"),
  // Không còn số ngày kế hoạch: ngày kết thúc BE tự tính từ số ngày làm của xe
  deposit_amount: z.number().min(0, "Phải >= 0").optional(),
  site_address: z.string().trim().min(1, "Bắt buộc").max(500, "Tối đa 500 ký tự"),
});

type ContractForm = z.infer<typeof contractSchema>;

const MOCK_DOC_URL =
  "https://giavixblob1302.blob.core.windows.net/documents/H%E1%BB%A2P%20%C4%90%E1%BB%92NG%20THU%C3%8A%20XE%20TTS-DOTHANH.docx";

// ─── File Preview ─────────────────────────────────────────────────────────────
// Xem trước bằng sasUrl của file đã upload tạm (is_temp) — không dùng blob URL cục bộ
// vì Office Viewer (DOCX/XLSX) là server Microsoft, không đọc được link blob: trong trình duyệt
function FilePreviewPanel({
  file,
  sasUrl,
  uploading,
  mockUrl,
}: {
  file: File | null;
  sasUrl: string | null;
  uploading: boolean;
  mockUrl: string | null;
}) {
  // Mock URL preview — dùng Office Online Viewer
  if (mockUrl) {
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(mockUrl)}`;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 rounded-t-lg">
          <FileText className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs font-medium text-amber-700 truncate flex-1">
            HỢP ĐỒNG THUÊ XE TTS-DOTHANH.docx
          </p>
          <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium shrink-0">
            Mock
          </span>
        </div>
        <div className="flex-1 bg-gray-100 rounded-b-lg overflow-hidden">
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title="Document preview"
          />
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">Chọn file để xem trước</p>
      </div>
    );
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  const isOffice =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return (
    <div className="flex flex-col h-full">
      {/* File info bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-page border-b border-border rounded-t-lg">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs font-medium text-text-primary truncate flex-1">
          {file.name}
        </p>
        <span className="text-xs text-text-secondary shrink-0">
          {file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
        </span>
      </div>

      {/* Preview area */}
      <div className="flex-1 bg-gray-100 rounded-b-lg overflow-hidden">
        {uploading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Đang tải file...</p>
          </div>
        )}
        {isPdf && sasUrl && (
          <iframe
            src={sasUrl}
            className="w-full h-full border-0"
            title="PDF preview"
          />
        )}
        {isImage && sasUrl && (
          <img
            src={sasUrl}
            alt="preview"
            className="w-full h-full object-contain"
          />
        )}
        {isOffice && sasUrl && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sasUrl)}`}
            className="w-full h-full border-0"
            title="Office preview"
          />
        )}
      </div>
    </div>
  );
}

// ─── Create Customer Modal (overlay nằm trên cột trái) ───────────────────────
function CreateCustomerModal({
  onClose,
  onCreated,
  initialValues,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
  initialValues?: ExtractedCustomerFields;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"business" | "individual">(initialValues?.customerType ?? "business");

  // Business fields
  const [internationalName, setInternationalName] = useState(initialValues?.companyName ?? "");
  const [shortName, setShortName] = useState("");
  const [taxCode, setTaxCode] = useState(initialValues?.taxCode ?? "");
  const [taxAddress, setTaxAddress] = useState(initialValues?.address ?? "");
  const [officeAddress, setOfficeAddress] = useState(initialValues?.address ?? "");
  const [representative, setRepresentative] = useState(initialValues?.representativeName ?? "");
  const [representativeTitle, setRepresentativeTitle] = useState(initialValues?.representativeTitle ?? "");
  const [bizPhone, setBizPhone] = useState(normalizePhone(initialValues?.phone ?? ""));
  const [bizEmail, setBizEmail] = useState(initialValues?.email ?? "");

  // Individual fields
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [phone, setPhone] = useState(normalizePhone(initialValues?.phone ?? ""));
  const [cccd, setCccd] = useState(initialValues?.nationalId ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [cccdIssueDate, setCccdIssueDate] = useState("");
  const [cccdIssuePlace, setCccdIssuePlace] = useState("");
  const [dob, setDob] = useState("");
  const [permanentAddress, setPermanentAddress] = useState(initialValues?.address ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (type === "business") {
      if (!internationalName.trim()) e.internationalName = "Bắt buộc";
      if (!shortName.trim()) e.shortName = "Bắt buộc";
      else if (!/^[A-Z0-9]+$/.test(shortName))
        e.shortName = "Chỉ chữ in hoa A-Z và số 0-9";
      if (!taxCode.trim()) e.taxCode = "Bắt buộc";
      else if (!/^\d{10}(\d{3})?$/.test(taxCode))
        e.taxCode = "Phải là 10 hoặc 13 số";
      if (!isValidPhone(bizPhone, false)) {
        e.bizPhone = PHONE_VALIDATION_MESSAGE;
      }
    } else {
      if (!fullName.trim()) e.fullName = "Bắt buộc";
      if (!phone.trim()) e.phone = "Bắt buộc";
      else if (!isValidPhone(phone, true)) e.phone = PHONE_VALIDATION_MESSAGE;
      if (!cccd.trim()) e.cccd = "Bắt buộc";
      else if (!/^\d{12}$/.test(cccd)) e.cccd = "Phải là 12 số";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: () =>
      type === "business"
        ? createBusinessCustomer({
            internationalName,
            shortName,
            taxCode,
            taxAddress: taxAddress || undefined,
            officeAddress: officeAddress || undefined,
            representative: representative || undefined,
            representativeTitle: representativeTitle || undefined,
            phone: normalizePhone(bizPhone) || undefined,
            email: bizEmail || undefined,
          })
        : createIndividualCustomer({
            fullName,
            phone: normalizePhone(phone),
            nationalId: cccd,
            email: email || undefined,
            nationalIdIssueDate: cccdIssueDate || undefined,
            nationalIdIssuePlace: cccdIssuePlace || undefined,
            dateOfBirth: dob || undefined,
            permanentAddress: permanentAddress || undefined,
          }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.all });
      toast.success("Đã thêm khách hàng");
      onCreated(res.data.id);
    },
    onError: (error) => {
      const apiError = getApiError(error);
      const serverErrors: Record<string, string> = {};
      apiError.details?.forEach((detail) => {
        const field = detail.field.charAt(0).toLowerCase() + detail.field.slice(1);
        if (field === "phone") serverErrors[type === "business" ? "bizPhone" : "phone"] = detail.message;
        else if (field === "taxCode") serverErrors.taxCode = detail.message;
        else if (field === "shortName") serverErrors.shortName = detail.message;
        else if (field === "internationalName") serverErrors.internationalName = detail.message;
        else if (field === "fullName") serverErrors.fullName = detail.message;
        else if (field === "nationalId" || field === "cccd") serverErrors.cccd = detail.message;
      });
      if (Object.keys(serverErrors).length > 0) setErrors((current) => ({ ...current, ...serverErrors }));
      if (apiError.code === "PHONE_ALREADY_EXISTS") {
        setErrors((current) => ({
          ...current,
          [type === "business" ? "bizPhone" : "phone"]: apiError.message ?? "Số điện thoại đã được sử dụng",
        }));
      }
      toast.error(apiError.message ?? "Có lỗi xảy ra, vui lòng thử lại");
    },
  });

  function handleSubmit() {
    if (!validate()) return;
    mutation.mutate();
  }

  const fieldClass =
    "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
  const errClass = "text-xs text-error mt-0.5";

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:!max-h-[90dvh] sm:max-w-2xl sm:!overflow-hidden sm:p-0">
      <div className="flex max-h-[90dvh] min-h-0 flex-col overflow-hidden bg-bg-card">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-base font-semibold text-text-primary">
            Thêm khách hàng mới
          </DialogTitle>
        </DialogHeader>

        {/* Type toggle */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("business")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors",
                type === "business"
                  ? "bg-primary text-white border-primary"
                  : "bg-bg-page text-text-secondary border-border hover:border-primary hover:text-primary",
              )}
            >
              <Building2 className="h-4 w-4" /> Doanh nghiệp
            </button>
            <button
              type="button"
              onClick={() => setType("individual")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors",
                type === "individual"
                  ? "bg-primary text-white border-primary"
                  : "bg-bg-page text-text-secondary border-border hover:border-primary hover:text-primary",
              )}
            >
              <User className="h-4 w-4" /> Cá nhân
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {type === "business" ? (
            <>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Tên đầy đủ <span className="text-error">*</span>
                </label>
                <input
                  value={internationalName}
                  onChange={(e) => setInternationalName(e.target.value)}
                  placeholder="Công ty TNHH ABC"
                  className={cn(fieldClass, "mt-1")}
                />
                {errors.internationalName && (
                  <p className={errClass}>{errors.internationalName}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Tên viết tắt <span className="text-error">*</span>
                  </label>
                  <input
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value.toUpperCase())}
                    placeholder="ABC"
                    className={cn(fieldClass, "mt-1")}
                  />
                  {errors.shortName && (
                    <p className={errClass}>{errors.shortName}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Mã số thuế <span className="text-error">*</span>
                  </label>
                  <input
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    placeholder="0123456789"
                    className={cn(fieldClass, "mt-1")}
                  />
                  {errors.taxCode && (
                    <p className={errClass}>{errors.taxCode}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Người đại diện
                </label>
                <input
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Chức vụ người đại diện</label>
                <input
                  value={representativeTitle}
                  onChange={(e) => setRepresentativeTitle(e.target.value)}
                  placeholder="Giám đốc"
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Điện thoại
                  </label>
                  <input
                    value={bizPhone}
                    onChange={(e) => {
                      setBizPhone(e.target.value);
                      if (errors.bizPhone) setErrors((current) => ({ ...current, bizPhone: "" }));
                    }}
                    onBlur={() => setBizPhone(normalizePhone(bizPhone))}
                    placeholder="0901234567"
                    inputMode="tel"
                    pattern={PHONE_INPUT_PATTERN}
                    className={cn(fieldClass, "mt-1")}
                  />
                  {errors.bizPhone && <p className={errClass}>{errors.bizPhone}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    placeholder="contact@..."
                    className={cn(fieldClass, "mt-1")}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Địa chỉ đăng ký thuế
                </label>
                <input
                  value={taxAddress}
                  onChange={(e) => setTaxAddress(e.target.value)}
                  placeholder="123 Đường ABC..."
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Địa chỉ văn phòng
                </label>
                <input
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="456 Đường XYZ..."
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Họ và tên <span className="text-error">*</span>
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={cn(fieldClass, "mt-1")}
                />
                {errors.fullName && (
                  <p className={errClass}>{errors.fullName}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Số điện thoại <span className="text-error">*</span>
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors((current) => ({ ...current, phone: "" }));
                    }}
                    onBlur={() => setPhone(normalizePhone(phone))}
                    placeholder="0901234567"
                    inputMode="tel"
                    pattern={PHONE_INPUT_PATTERN}
                    className={cn(fieldClass, "mt-1")}
                  />
                  {errors.phone && <p className={errClass}>{errors.phone}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vana@gmail.com"
                    className={cn(fieldClass, "mt-1")}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Số CCCD <span className="text-error">*</span>
                </label>
                <input
                  value={cccd}
                  onChange={(e) => setCccd(e.target.value)}
                  placeholder="012345678901"
                  className={cn(fieldClass, "mt-1")}
                  maxLength={12}
                />
                {errors.cccd && <p className={errClass}>{errors.cccd}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Ngày cấp CCCD
                  </label>
                  <input
                    type="date"
                    value={cccdIssueDate}
                    onChange={(e) => setCccdIssueDate(e.target.value)}
                    className={cn(fieldClass, "mt-1")}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className={cn(fieldClass, "mt-1")}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Nơi cấp CCCD
                </label>
                <input
                  value={cccdIssuePlace}
                  onChange={(e) => setCccdIssuePlace(e.target.value)}
                  placeholder="Cục Cảnh sát QLHC về TTXH"
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">
                  Địa chỉ thường trú
                </label>
                <input
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="123 Đường ABC..."
                  className={cn(fieldClass, "mt-1")}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Đang lưu..." : "Thêm khách hàng"}
          </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Customer Picker ──────────────────────────────────────────────────────────
function CustomerPicker({
  value,
  onChange,
  error,
  onOpenCreateModal,
  options,
}: {
  value: number | undefined;
  onChange: (id: number) => void;
  error?: string;
  onOpenCreateModal: () => void;
  options: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const customers = options.filter(
    (c) =>
      !search ||
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (c.shortName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const selected = options.find((c) => c.id === value);

  function handleSelect(c: CustomerOption) {
    onChange(c.id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 rounded-md border px-3 h-10 text-left text-sm cursor-pointer transition-colors",
          "hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          error ? "border-error" : "border-input",
          open && "border-primary ring-2 ring-primary/20",
        )}
      >
        {selected ? (
          <>
            {selected.customerType === "business" ? (
              <Building2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <User className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="flex-1 truncate text-text-primary">
              {selected.displayName}
            </span>
            {selected.shortName && (
              <span className="text-xs text-text-secondary shrink-0">
                {selected.shortName}
              </span>
            )}
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <span className="text-text-disabled flex-1">
              Tìm hoặc chọn khách hàng...
            </span>
          </>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-secondary shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-bg-card shadow-lg">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã số thuế..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border-0 outline-none bg-transparent text-text-primary placeholder:text-text-disabled"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {customers.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-secondary">
                Không tìm thấy
              </p>
            ) : (
              customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-primary-light transition-colors",
                    value === c.id && "bg-primary-light",
                  )}
                >
                  {c.customerType === "business" ? (
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <User className="h-4 w-4 text-text-secondary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {c.displayName}
                    </p>
                    {c.shortName && (
                      <p className="text-xs text-text-secondary">
                        {c.shortName}
                      </p>
                    )}
                  </div>
                  {value === c.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
          <Separator />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenCreateModal();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary-light transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Thêm khách hàng mới
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CreateContractDialog ─────────────────────────────────────────────────────
interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CreateContractDialog({
  open,
  onOpenChange,
}: CreateContractDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  // Tăng mỗi lần chọn file / đóng dialog → bỏ kết quả upload cũ về muộn (tránh gửi nhầm documentId)
  const uploadSeq = useRef(0);
  const [mockUrl, setMockUrl] = useState<string | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [extractedCustomer, setExtractedCustomer] = useState<ExtractedCustomerFields | undefined>();
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractUnavailable, setExtractUnavailable] = useState(false);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [fileTotals, setFileTotals] = useState<ContractAutofillFields["fileTotals"] | null>(null);

  // Query service catalog — chỉ dùng active services cho dropdown.
  // Thiếu service_catalog.view thì GET /service-catalog trả 403 → không gọi, ẩn nút thêm dịch vụ
  const { hasPermission } = usePermission();
  const canViewCatalog = hasPermission("service_catalog.view");
  const canExtract = hasPermission("extract.use");
  const { data: serviceCatalogRes } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    enabled: canViewCatalog,
    staleTime: 5 * 60 * 1000,
  });
  const activeServices: ServiceOption[] = (serviceCatalogRes?.data ?? []).filter((s: ServiceOption) => s.isActive);
  const catalogEmpty = canViewCatalog && !!serviceCatalogRes && activeServices.length === 0;

  // Query customers (active) cho picker
  const { data: customersRes } = useQuery({
    queryKey: [...QUERY_KEYS.customers.all, { forContract: true }],
    queryFn: () => getCustomers({ is_active: true, page_size: 100 }),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const customerOptions: CustomerOption[] = customersRes?.data ?? [];

  // Query vehicles at_yard cho dropdown gán xe
  const { data: vehiclesRes } = useQuery({
    queryKey: [...QUERY_KEYS.vehicles.all, { status: "at_yard", forContract: true }],
    queryFn: () => getVehicles({ status: "at_yard", page_size: 100 }),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const vehicleOptions: VehicleOption[] = vehiclesRes?.data ?? [];

  const hasPreview = !!file || !!mockUrl;
  const draftTotal = lineItems.reduce(
    (s, li) => s + (li.unit_price ?? 0) * (li.quantity ?? 0) * (li.duration ?? 1),
    0,
  );

  function patchLine(key: string, patch: Partial<LineItemDraft>) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)));
  }

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContractForm>({
    resolver: zodResolver(contractSchema),
  });

  function handleClose() {
    onOpenChange(false);
    reset();
    setFile(null);
    setUploadedDoc(null);
    uploadSeq.current++;
    setUploading(false);
    setMockUrl(null);
    setLineItems([]);
    setExtractWarnings([]);
    setFileTotals(null);
    setExtracting(false);
    setExtractUnavailable(false);
    setShowCreateCustomer(false);
    setExtractedCustomer(undefined);
  }

  // Upload ngay lúc chọn file (is_temp=true) để có sasUrl cho preview; khi Tạo chỉ gửi documentId.
  // Không cần xóa file khi đổi/đóng — BE tự dọn file tạm chưa gắn vào HĐ sau 3h
  async function handleFileChange(f: File | null) {
    const seq = ++uploadSeq.current;
    setFile(f);
    setUploadedDoc(null);
    setExtractWarnings([]);
    setFileTotals(null);
    setExtractUnavailable(false);
    if (!f) {
      setUploading(false);
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadDocument({ file: f, doc_type: "contract", is_temp: true });
      if (seq !== uploadSeq.current) return;
      setUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl });
    } catch {
      if (seq !== uploadSeq.current) return;
      toast.error("Tải file lên thất bại, vui lòng thử lại");
      setFile(null);
    } finally {
      if (seq === uploadSeq.current) setUploading(false);
    }
  }

  async function handleExtractContract() {
    if (!uploadedDoc || extracting) return;
    setExtracting(true);
    try {
      const response = await extractDocument<ContractAutofillFields>(uploadedDoc.id, "contract");
      const fields = response.data.fields;
      if (fields.contractNumber !== undefined) setValue("contract_number", fields.contractNumber);
      if (fields.startDate !== undefined) setValue("start_date", fields.startDate);
      if (fields.siteAddress !== undefined) setValue("site_address", fields.siteAddress);
      if (fields.depositAmount !== undefined) setValue("deposit_amount", fields.depositAmount);
      if (fields.customer.status === "matched" && fields.customer.customerId != null) {
        setValue("customer_id", fields.customer.customerId);
        setExtractedCustomer(undefined);
      } else if (fields.customer.status === "new") {
        setExtractedCustomer(fields.customer.extracted);
        setShowCreateCustomer(true);
      }
      if (lineItems.length === 0 || window.confirm("AI sẽ thay toàn bộ các dòng dịch vụ hiện tại. Tiếp tục?")) {
        setLineItems(
          fields.lineItems.map((item) => ({
              _key: crypto.randomUUID(),
              service_id: item.serviceId,
              service_name: item.serviceName,
              unit: item.unit,
              allow_vehicle: item.allowVehicle,
              unit_price: item.unitPrice,
              quantity: item.quantity,
              duration: item.duration,
              vehicles: [],
              note: item.note ?? "",
          })),
        );
      }
      setFileTotals(fields.fileTotals);
      setExtractWarnings(response.data.extraction.warnings ?? []);
      toast.success("Đã điền dữ liệu đọc từ hợp đồng");
    } catch (err) {
      const code = getApiError(err).code;
      if (code === "EXTRACT_DISABLED") setExtractUnavailable(true);
      const fallback =
        code === "AI_INVALID_RESPONSE"
          ? "AI không đọc được, vui lòng nhập tay"
          : code === "EXTRACT_DISABLED" || code === "AI_PROVIDER_UNAVAILABLE"
            ? "AI tạm thời không khả dụng"
            : code === "EXTRACT_TIMEOUT"
              ? "AI xử lý quá lâu, thử lại"
              : getServiceErrorMessage(err);
      toast.error(fallback);
    } finally {
      setExtracting(false);
    }
  }

  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [mobileTab, setMobileTab] = useState<"document" | "form">("document");

  useEffect(() => {
    if (file || mockUrl) setMobileTab("form");
  }, [file, mockUrl]);

  useEffect(() => {
    if (!open) setMobileTab("document");
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: ContractForm) =>
      createContract({
        customerId: data.customer_id,
        startDate: data.start_date,
        siteAddress: data.site_address,
        ...(data.contract_number?.trim() ? { contractNumber: data.contract_number.trim() } : {}),
        ...(data.deposit_amount ? { depositAmount: data.deposit_amount } : {}),
        ...(uploadedDoc?.id ? { documentId: uploadedDoc.id } : {}),
        lineItems: lineItems.map((li, index) => ({
            serviceId: li.service_id!,
            unitPrice: li.unit_price!,
            quantity: li.quantity!,
            unit: li.unit,
            ...(li.duration != null ? { duration: li.duration } : {}),
            sortOrder: index,
            ...(li.note.trim() ? { note: li.note.trim() } : {}),
            ...(li.allow_vehicle && li.vehicles.length > 0
              ? {
                  vehicles: li.vehicles.map((vehicle) => ({
                    vehicleId: vehicle.vehicle_id,
                    ...(vehicle.deploy_date ? { deployDate: vehicle.deploy_date } : {}),
                    workDays: vehicle.work_days,
                    ...(vehicle.note.trim() ? { note: vehicle.note.trim() } : {}),
                  })),
                }
              : {}),
          })),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.contracts.all],
      });
      toast.success("Đã tạo hợp đồng");
      handleClose();
      // Navigate to detail page
      const id = res?.data?.id;
      if (id) navigate(`/contracts/${id}`);
    },
    onError: (err) => toast.error(getApiError(err).message ?? getServiceErrorMessage(err)),
  });

  const formContent = (
    <form
      id="create-contract-form"
      onSubmit={handleSubmit((d) => {
        // Dòng chưa chọn dịch vụ sẽ bị bỏ qua khi gửi → chặn để không mất dữ liệu âm thầm
        if (lineItems.some((li) => li.service_id === null)) {
          toast.error("Vui lòng chọn dịch vụ cho mọi dòng hoặc xóa dòng trống");
          return;
        }
        // BE: unitPrice > 0, quantity > 0
        if (lineItems.some((li) => !((li.unit_price ?? 0) > 0) || !((li.quantity ?? 0) > 0))) {
          toast.error("Đơn giá và số lượng của dòng dịch vụ phải lớn hơn 0");
          return;
        }
        if (lineItems.some((li) => li.allow_vehicle && !Number.isInteger(li.quantity))) {
          toast.error("Số lượng của dòng thuê xe phải là số nguyên");
          return;
        }
        if (lineItems.some((li) => li.vehicles.length > (li.quantity ?? 0))) {
          toast.error("Số xe được chọn không được vượt quá số lượng của dòng");
          return;
        }
        if (lineItems.some((li) => li.vehicles.some((vehicle) => !Number.isInteger(vehicle.work_days) || vehicle.work_days < 0 || vehicle.work_days > 3650))) {
          toast.error("Số ngày làm của xe phải là số nguyên từ 0 đến 3650");
          return;
        }
        mutation.mutate(d);
      })}
      // Desktop bỏ padding trái để nội dung thẳng hàng với tiêu đề dialog; mobile giữ px-5
      className="flex flex-col gap-4 px-5 sm:pl-0 py-4 flex-1"
    >
              {/* AI extract */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide">
                  Thông tin hợp đồng
                </p>
                {canExtract && <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!uploadedDoc || uploading || extracting || extractUnavailable}
                  onClick={handleExtractContract}
                  className="h-7 text-xs gap-1.5 cursor-pointer"
                >
                  {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {extracting ? "AI đang đọc..." : "Nhập từ file hợp đồng"}
                </Button>}
              </div>

              {extractWarnings.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning-light px-3 py-2 text-xs text-warning">
                  <p className="font-medium">Cần kiểm tra lại:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {extractWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">Số hợp đồng</Label>
                <Input placeholder="Để trống để hệ thống tự sinh" {...register("contract_number")} />
                {errors.contract_number && <p className="text-xs text-error">{errors.contract_number.message}</p>}
              </div>

              {/* Customer */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Khách hàng <span className="text-error">*</span>
                </Label>
                <Controller
                  control={control}
                  name="customer_id"
                  render={({ field }) => (
                    <CustomerPicker
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.customer_id?.message}
                      onOpenCreateModal={() => {
                        setExtractedCustomer(undefined);
                        setShowCreateCustomer(true);
                      }}
                      options={customerOptions}
                    />
                  )}
                />
                {errors.customer_id && (
                  <p className="text-xs text-error">
                    {errors.customer_id.message}
                  </p>
                )}
              </div>

              {/* Start date + Deposit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Ngày bắt đầu <span className="text-error">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="start_date"
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Chọn ngày"
                      />
                    )}
                  />
                  {errors.start_date && (
                    <p className="text-xs text-error">
                      {errors.start_date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Tiền cọc (₫)</Label>
                  <Controller
                    control={control}
                    name="deposit_amount"
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="0"
                      />
                    )}
                  />
                  {errors.deposit_amount && (
                    <p className="text-xs text-error">
                      {errors.deposit_amount.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Site address */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Địa điểm công trường <span className="text-error">*</span>
                </Label>
                <Textarea
                  rows={2}
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..."
                  className="resize-none"
                  {...register("site_address")}
                />
                {errors.site_address && (
                  <p className="text-xs text-error">
                    {errors.site_address.message}
                  </p>
                )}
              </div>

              {/* ── Dịch vụ & xe ── mỗi dòng dịch vụ kèm xe của nó (giống tab "Dịch vụ & xe") */}
              <div className="space-y-3 border-t border-border pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide">
                    Dịch vụ & xe
                  </p>
                  {canViewCatalog && !catalogEmpty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLineItems((prev) => [
                          ...prev,
                          {
                            _key: crypto.randomUUID(),
                            service_id: null,
                            service_name: "",
                            unit: "",
                            allow_vehicle: false,
                            unit_price: undefined,
                            quantity: 1,
                            duration: undefined,
                            vehicles: [],
                            note: "",
                          },
                        ])
                      }
                      className="h-7 text-xs gap-1.5 cursor-pointer hover:bg-primary-light hover:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm dịch vụ
                    </Button>
                  )}
                </div>

                {lineItems.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4 px-3 text-center border border-dashed border-border rounded-lg">
                    {!canViewCatalog
                      ? "Bạn không có quyền xem danh mục dịch vụ. Hãy nhờ quản lý bổ sung dịch vụ sau khi tạo hợp đồng."
                      : catalogEmpty
                        ? "Danh mục chưa có dịch vụ nào đang hoạt động. Thêm dịch vụ ở mục Danh mục dịch vụ trước."
                        : "Chưa có dịch vụ nào"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lineItems.map((item, index) => {
                      const selectedService = activeServices.find((service) => service.id === item.service_id);
                      // Một xe chỉ nằm ở 1 dòng chưa trả (BE 409 VEHICLE_ALREADY_IN_CONTRACT) → ẩn xe đã chọn ở dòng khác
                      const takenVehicleIds = lineItems
                        .filter((li) => li._key !== item._key)
                        .flatMap((li) => li.vehicles.map((vehicle) => vehicle.vehicle_id));
                      const lineVehicleOptions = vehicleOptions.filter(
                        (mv) => !takenVehicleIds.includes(mv.id),
                      );
                      return (
                        <div
                          key={item._key}
                          className="rounded-lg border border-border bg-bg-card overflow-hidden"
                        >
                          {/* Header dòng: số thứ tự + xóa */}
                          <div className="flex items-center justify-between border-b border-border bg-bg-page px-3 py-2">
                            <p className="text-sm font-medium text-text-primary">
                              Dịch vụ {index + 1}
                            </p>
                            <button
                              type="button"
                              aria-label="Xóa dòng dịch vụ"
                              onClick={() =>
                                setLineItems((prev) => prev.filter((li) => li._key !== item._key))
                              }
                              className="rounded p-1 text-text-secondary hover:bg-error hover:text-white cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="space-y-3 p-3">
                            <div className="space-y-1.5">
                              <Label className="text-sm">
                                Dịch vụ <span className="text-error">*</span>
                              </Label>
                              <Select
                                value={item.service_id ? String(item.service_id) : ""}
                                onValueChange={(v) => {
                                  const svc = activeServices.find((s) => s.id === Number(v));
                                  if (!svc) return;
                                  patchLine(item._key, {
                                    service_id: svc.id,
                                    service_name: svc.name,
                                    unit: svc.units[0] ?? "",
                                    allow_vehicle: svc.allowVehicle,
                                    // Dịch vụ không cho gán xe → bỏ xe đã chọn (BE 400 LINE_ITEM_VEHICLE_NOT_ALLOWED)
                                    ...(svc.allowVehicle ? {} : { vehicles: [] }),
                                  });
                                }}
                              >
                                <SelectTrigger className="w-full cursor-pointer border-border">
                                  <SelectValue placeholder="Chọn dịch vụ" />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeServices.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                      {s.name} ({s.units.join(", ")})
                                      {s.allowVehicle && (
                                        <span className="ml-1.5 rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                          Có xe
                                        </span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-sm">Đơn vị <span className="text-error">*</span></Label>
                                <Select value={item.unit} onValueChange={(unit) => patchLine(item._key, { unit })}>
                                  <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
                                  <SelectContent>
                                    {(selectedService?.units ?? (item.unit ? [item.unit] : [])).map((unit) => (
                                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-sm">Thời gian</Label>
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="Không áp dụng"
                                  value={item.duration ?? ""}
                                  onChange={(e) => patchLine(item._key, { duration: e.target.value === "" ? undefined : Number(e.target.value) })}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-sm">
                                  Số lượng{item.unit ? ` (${item.unit})` : ""} <span className="text-error">*</span>
                                </Label>
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  inputMode="decimal"
                                  value={item.quantity ?? ""}
                                  onChange={(e) =>
                                    patchLine(item._key, {
                                      quantity: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-sm">
                                  Đơn giá (₫) <span className="text-error">*</span>
                                </Label>
                                <CurrencyInput
                                  value={item.unit_price}
                                  onChange={(v) => patchLine(item._key, { unit_price: v })}
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-sm">Ghi chú</Label>
                              <Textarea
                                rows={2}
                                maxLength={500}
                                placeholder="Mô tả thêm cho dòng dịch vụ (không bắt buộc)"
                                className="resize-none"
                                value={item.note}
                                onChange={(e) => patchLine(item._key, { note: e.target.value })}
                              />
                            </div>


                            {/* Xe của dòng — có thể chọn tối đa quantity xe */}
                            {item.allow_vehicle && (
                              <div className="space-y-3 rounded-md bg-bg-page p-3">
                                <div className="space-y-1.5">
                                  <Label className="text-sm">Xe ({item.vehicles.length}/{item.quantity ?? 0})</Label>
                                  {item.vehicles.length > 0 && (
                                    <div className="space-y-2">
                                      {item.vehicles.map((vehicleDraft) => {
                                        const vehicle = vehicleOptions.find((option) => option.id === vehicleDraft.vehicle_id);
                                        return (
                                          <div key={vehicleDraft.vehicle_id} className="space-y-2 rounded-md border border-border bg-bg-card p-2">
                                            <div className="flex items-center justify-between text-xs font-medium text-text-primary">
                                              <span>{vehicle?.model ?? "Xe"} · {vehicle?.serialNumber ?? `#${vehicleDraft.vehicle_id}`}</span>
                                              <button type="button" className="cursor-pointer text-text-secondary hover:text-error" onClick={() => patchLine(item._key, { vehicles: item.vehicles.filter((entry) => entry.vehicle_id !== vehicleDraft.vehicle_id) })}>
                                                <X size={14} />
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <DatePicker
                                                value={vehicleDraft.deploy_date}
                                                onChange={(date) => patchLine(item._key, {
                                                  vehicles: item.vehicles.map((entry) => entry.vehicle_id === vehicleDraft.vehicle_id ? { ...entry, deploy_date: date } : entry),
                                                })}
                                                placeholder="Ngày xuất bãi"
                                              />
                                              <Input
                                                type="number"
                                                min={0}
                                                max={3650}
                                                step={1}
                                                value={vehicleDraft.work_days}
                                                onChange={(event) => patchLine(item._key, {
                                                  vehicles: item.vehicles.map((entry) => entry.vehicle_id === vehicleDraft.vehicle_id ? { ...entry, work_days: Number(event.target.value) } : entry),
                                                })}
                                                placeholder="Số ngày làm"
                                              />
                                            </div>
                                            <Input
                                              value={vehicleDraft.note}
                                              maxLength={500}
                                              onChange={(event) => patchLine(item._key, {
                                                vehicles: item.vehicles.map((entry) => entry.vehicle_id === vehicleDraft.vehicle_id ? { ...entry, note: event.target.value } : entry),
                                              })}
                                              placeholder="Ghi chú giao xe"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <Select
                                    value=""
                                    onValueChange={(v) => patchLine(item._key, {
                                      vehicles: [...item.vehicles, { vehicle_id: Number(v), deploy_date: "", work_days: 0, note: "" }],
                                    })}
                                    disabled={item.vehicles.length >= (item.quantity ?? 0)}
                                  >
                                    <SelectTrigger className="w-full cursor-pointer border-border bg-bg-card">
                                      <SelectValue placeholder="Chọn thêm xe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lineVehicleOptions.filter((mv) => !item.vehicles.some((entry) => entry.vehicle_id === mv.id)).map((mv) => (
                                        <SelectItem key={mv.id} value={String(mv.id)}>
                                          {mv.model}
                                          <span className="text-text-secondary"> · {mv.serialNumber}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer dòng: thành tiền */}
                          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                            <span className="text-text-secondary">Thành tiền</span>
                            <span className="font-medium text-text-primary">
                              {formatCurrency((item.unit_price ?? 0) * (item.quantity ?? 0) * (item.duration ?? 1))}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Tạm tính trước VAT — tổng chính thức (kèm VAT công ty) do BE tính sau khi tạo */}
                    <div className="flex items-center justify-between rounded-lg bg-primary-light px-3 py-2.5">
                      <span className="text-sm font-medium text-text-primary">Tổng cộng</span>
                      <span className="text-base font-semibold text-primary">{formatCurrency(draftTotal)}</span>
                    </div>
                    {fileTotals && (
                      <div className="rounded-lg border border-border bg-bg-page px-3 py-2 text-xs text-text-secondary">
                        <p className="font-medium text-text-primary">Tổng trong file (để đối chiếu)</p>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {fileTotals.subtotal != null && <span>Trước thuế: {formatCurrency(fileTotals.subtotal)}</span>}
                          {fileTotals.vatRate != null && <span>VAT: {fileTotals.vatRate}%</span>}
                          {fileTotals.taxAmount != null && <span>Tiền thuế: {formatCurrency(fileTotals.taxAmount)}</span>}
                          {fileTotals.totalAmount != null && <span>Tổng: {formatCurrency(fileTotals.totalAmount)}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
    </form>
  );

  const footerButtons = (
    <>
      <Button type="button" variant="outline" onClick={handleClose} className="cursor-pointer">
        Hủy
      </Button>
      <Button type="submit" form="create-contract-form" disabled={mutation.isPending || uploading || extracting} className="cursor-pointer">
        {mutation.isPending ? "Đang tạo..." : uploading ? "Đang tải file..." : "Tạo hợp đồng"}
      </Button>
    </>
  );

  const uploadPanel = (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="text-center">
        <p className="text-lg font-semibold text-text-primary mb-1">
          Bắt đầu bằng cách chọn file hợp đồng
        </p>
        <p className="text-sm text-text-secondary">
          Sau khi chọn file, form nhập liệu sẽ hiện ra bên trái
        </p>
      </div>
      <div className="w-full max-w-md space-y-2">
        <FileUpload value={file} onChange={handleFileChange} label="Kéo thả hoặc nhấp để chọn file hợp đồng" />
        <button
          type="button"
          onClick={() => setMockUrl(MOCK_DOC_URL)}
          className="w-full text-xs text-amber-600 border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-md py-1.5 transition-colors cursor-pointer"
        >
          [Dev] Dùng file mock để xem preview
        </button>
      </div>
      <p className="text-xs text-text-secondary">PDF, DOCX, XLSX, JPEG, PNG — tối đa 20MB</p>
    </div>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <MobileSheetDialog open={open} onOpenChange={handleClose}>
        <MobileSheetContent mobileVariant="fullscreen" title="Tạo hợp đồng mới">
          <MobileSheetFullscreenHeader title="Tạo hợp đồng mới" />

          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab("document")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                mobileTab === "document"
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-secondary",
              )}
            >
              Tài liệu
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("form")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                mobileTab === "form"
                  ? "text-primary border-b-2 border-primary cursor-pointer"
                  : "text-text-disabled cursor-not-allowed",
              )}
              disabled={!file && !mockUrl}
            >
              Thông tin
            </button>
          </div>

          <MobileSheetBody>
            {mobileTab === "document" ? (
              <div className="flex flex-col gap-4 p-4">
                <FileUpload value={file} onChange={handleFileChange} label="Kéo thả hoặc nhấp để chọn file hợp đồng" />
                {!file && (
                  <button
                    type="button"
                    onClick={() => setMockUrl(MOCK_DOC_URL)}
                    className="w-full text-xs text-amber-600 border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-md py-1.5 transition-colors cursor-pointer"
                  >
                    [Dev] Dùng file mock để xem preview
                  </button>
                )}
                {(file || mockUrl) && <FilePreviewPanel file={file} sasUrl={uploadedDoc?.sasUrl ?? null} uploading={uploading} mockUrl={mockUrl} />}
              </div>
            ) : (
              <>
                {showCreateCustomer && (
                  <CreateCustomerModal
                    initialValues={extractedCustomer}
                    onClose={() => setShowCreateCustomer(false)}
                    onCreated={(id) => { setValue("customer_id", id); setShowCreateCustomer(false); }}
                  />
                )}
                {formContent}
              </>
            )}
          </MobileSheetBody>

          <MobileSheetFooter>
            {footerButtons}
          </MobileSheetFooter>
        </MobileSheetContent>
      </MobileSheetDialog>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-h-[90vh]"
        style={{ width: "80vw", maxWidth: "80vw" }}
      >
        <DialogHeader className=" pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            Tạo hợp đồng mới
          </DialogTitle>
        </DialogHeader>

        <div
          className="flex flex-row overflow-hidden"
          style={{ height: "calc(90vh - 130px)" }}
        >
          {/* ── Left: Form — 40% dialog, ẩn khi chưa có file ── */}
          <div
            className="relative flex flex-col border-r border-border overflow-y-auto shrink-0 transition-all duration-300"
            style={{
              width: hasPreview ? "40%" : "0px",
              overflow: hasPreview ? undefined : "hidden",
            }}
          >
            {showCreateCustomer && (
              <CreateCustomerModal
                initialValues={extractedCustomer}
                onClose={() => setShowCreateCustomer(false)}
                onCreated={(id) => {
                  setValue("customer_id", id);
                  setShowCreateCustomer(false);
                }}
              />
            )}
            {formContent}

            {/* Footer buttons */}
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
              {footerButtons}
            </div>
          </div>

          {/* ── Right: Preview — 60% dialog + min-w-0 để không tràn ── */}
          <div
            className={cn(
              "flex-1 min-w-0 overflow-hidden h-full transition-all duration-300",
              hasPreview ? "pt-4 pl-4" : "p-8",
            )}
          >
            {!hasPreview ? uploadPanel : <FilePreviewPanel file={file} sasUrl={uploadedDoc?.sasUrl ?? null} uploading={uploading} mockUrl={mockUrl} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
