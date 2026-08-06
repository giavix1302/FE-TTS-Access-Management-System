import { useState, useEffect } from "react";
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
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createLineItem,
  addContractVehicle,
} from "@/api/contracts.api";
import { uploadDocument } from "@/api/documents.api";
import {
  getCustomers,
  createIndividualCustomer,
  createBusinessCustomer,
} from "@/api/customers.api";
import { getVehicles } from "@/api/vehicles.api";
import { getServiceCatalog } from "@/api/service-catalog.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { cn } from "@/lib/utils";

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
  unit: string;
  isActive: boolean;
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
  unit_price: number;
  quantity: number;
}

interface VehicleDraft {
  _key: string;
  vehicle_id: number | null;
  deploy_date: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const contractSchema = z.object({
  customer_id: z.number({ error: "Bắt buộc chọn khách hàng" }),
  start_date: z.string().min(1, "Bắt buộc"),
  planned_days: z
    .number({ error: "Bắt buộc" })
    .min(1, "Phải >= 1 ngày"),
  site_address: z.string().min(1, "Bắt buộc"),
});

type ContractForm = z.infer<typeof contractSchema>;

const MOCK_DOC_URL =
  "https://giavixblob1302.blob.core.windows.net/documents/H%E1%BB%A2P%20%C4%90%E1%BB%92NG%20THU%C3%8A%20XE%20TTS-DOTHANH.docx";

// ─── File Preview ─────────────────────────────────────────────────────────────
function FilePreviewPanel({
  file,
  mockUrl,
}: {
  file: File | null;
  mockUrl: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
        {isPdf && objectUrl && (
          <iframe
            src={objectUrl}
            className="w-full h-full border-0"
            title="PDF preview"
          />
        )}
        {isImage && objectUrl && (
          <img
            src={objectUrl}
            alt="preview"
            className="w-full h-full object-contain"
          />
        )}
        {isOffice && objectUrl && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(objectUrl)}`}
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
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"business" | "individual">("business");

  // Business fields
  const [internationalName, setInternationalName] = useState("");
  const [shortName, setShortName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [taxAddress, setTaxAddress] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [representative, setRepresentative] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");

  // Individual fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cccd, setCccd] = useState("");
  const [email, setEmail] = useState("");
  const [cccdIssueDate, setCccdIssueDate] = useState("");
  const [cccdIssuePlace, setCccdIssuePlace] = useState("");
  const [dob, setDob] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");

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
    } else {
      if (!fullName.trim()) e.fullName = "Bắt buộc";
      if (!phone.trim()) e.phone = "Bắt buộc";
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
            phone: bizPhone || undefined,
            email: bizEmail || undefined,
          })
        : createIndividualCustomer({
            fullName,
            phone,
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
    onError: () => toast.error("Có lỗi xảy ra, vui lòng thử lại"),
  });

  function handleSubmit() {
    if (!validate()) return;
    mutation.mutate();
  }

  const fieldClass =
    "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
  const errClass = "text-xs text-error mt-0.5";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-l-lg">
      <div className="bg-bg-card rounded-xl shadow-xl w-[90%] max-h-[85%] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-text-primary">
            Thêm khách hàng mới
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
              <div className="grid grid-cols-2 gap-2">
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Điện thoại
                  </label>
                  <input
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    placeholder="028..."
                    className={cn(fieldClass, "mt-1")}
                  />
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary">
                    Số điện thoại <span className="text-error">*</span>
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567"
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
              <div className="grid grid-cols-2 gap-2">
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
    </div>
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
  const [mockUrl, setMockUrl] = useState<string | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([]);

  // Query service catalog — chỉ dùng active services cho dropdown
  const { data: serviceCatalogRes } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    staleTime: 5 * 60 * 1000,
  });
  const activeServices: ServiceOption[] = (serviceCatalogRes?.data ?? []).filter((s: ServiceOption) => s.isActive);

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
    setMockUrl(null);
    setLineItems([]);
    setVehicles([]);
    setShowCreateCustomer(false);
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
    mutationFn: async (data: ContractForm) => {
      // Step 1: upload file hợp đồng nếu có → lấy documentId
      let documentId: number | undefined;
      if (file) {
        const doc = await uploadDocument({ file, doc_type: "contract" });
        documentId = doc.id;
      }
      // Step 2: tạo contract (BE chỉ nhận field cơ bản, camelCase)
      const created = await createContract({
        customerId: data.customer_id,
        startDate: data.start_date,
        plannedDays: data.planned_days,
        siteAddress: data.site_address,
        documentId,
      });
      const contractId: number = created?.data?.id;

      // Step 3: thêm line items tuần tự (mỗi cái 1 endpoint)
      const validItems = lineItems.filter((li) => li.service_id);
      for (let i = 0; i < validItems.length; i++) {
        const li = validItems[i];
        await createLineItem(contractId, {
          serviceId: li.service_id,
          unitPrice: li.unit_price,
          quantity: li.quantity,
          sortOrder: i + 1,
        });
      }

      // Step 4: gán xe tuần tự
      const validVehicles = vehicles.filter((v) => v.vehicle_id);
      for (const v of validVehicles) {
        await addContractVehicle(contractId, {
          vehicleId: v.vehicle_id,
          deployDate: v.deploy_date || null,
        });
      }

      return created;
    },
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
    onError: () => toast.error("Tạo hợp đồng thất bại"),
  });

  const formContent = (
    <form
      id="create-contract-form"
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="flex flex-col gap-4 px-5 py-4 flex-1"
    >
              {/* AI extract button — disabled */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide">
                  Thông tin hợp đồng
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="h-7 text-xs gap-1.5 opacity-50 cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Tự điền từ file
                </Button>
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
                      onOpenCreateModal={() => setShowCreateCustomer(true)}
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

              {/* Start date + Planned days */}
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
                  <Label className="text-sm">
                    Số ngày <span className="text-error">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="30"
                    {...register("planned_days", { valueAsNumber: true })}
                  />
                  {errors.planned_days && (
                    <p className="text-xs text-error">
                      {errors.planned_days.message}
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

              {/* ── Dịch vụ ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> Dịch vụ
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems((prev) => [
                        ...prev,
                        {
                          _key: crypto.randomUUID(),
                          service_id: null,
                          service_name: "",
                          unit: "",
                          unit_price: 0,
                          quantity: 1,
                        },
                      ])
                    }
                    className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm dịch vụ
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <p className="text-xs text-text-disabled py-2 text-center border border-dashed border-border rounded-md">
                    Chưa có dịch vụ nào
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lineItems.map((item) => (
                      <div
                        key={item._key}
                        className="rounded-md border border-border bg-bg-page p-2.5 space-y-2"
                      >
                        {/* Service selector */}
                        <div className="flex items-center gap-2">
                          <select
                            value={item.service_id ?? ""}
                            onChange={(e) => {
                              const svc = activeServices.find(
                                (s) => s.id === Number(e.target.value),
                              );
                              setLineItems((prev) =>
                                prev.map((li) =>
                                  li._key === item._key
                                    ? {
                                        ...li,
                                        service_id: svc?.id ?? null,
                                        service_name: svc?.name ?? "",
                                        unit: svc?.unit ?? "",
                                      }
                                    : li,
                                ),
                              );
                            }}
                            className="flex-1 text-sm border border-input rounded-md px-2 py-1.5 outline-none focus:border-primary bg-background"
                          >
                            <option value="">-- Chọn dịch vụ --</option>
                            {activeServices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} · {s.unit}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setLineItems((prev) =>
                                prev.filter((li) => li._key !== item._key),
                              )
                            }
                            className="text-text-secondary hover:text-error cursor-pointer shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {/* Price + Qty */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="col-span-1">
                            <label className="text-text-secondary mb-0.5 block">
                              Đơn vị
                            </label>
                            <input
                              value={item.unit}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((li) =>
                                    li._key === item._key
                                      ? { ...li, unit: e.target.value }
                                      : li,
                                  ),
                                )
                              }
                              placeholder="ca"
                              className="w-full px-2 py-1.5 border border-input rounded-md outline-none focus:border-primary bg-background text-sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="text-text-secondary mb-0.5 block">
                              Số lượng
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((li) =>
                                    li._key === item._key
                                      ? {
                                          ...li,
                                          quantity: Number(e.target.value),
                                        }
                                      : li,
                                  ),
                                )
                              }
                              className="w-full px-2 py-1.5 border border-input rounded-md outline-none focus:border-primary bg-background text-sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="text-text-secondary mb-0.5 block">
                              Đơn giá
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((li) =>
                                    li._key === item._key
                                      ? {
                                          ...li,
                                          unit_price: Number(e.target.value),
                                        }
                                      : li,
                                  ),
                                )
                              }
                              className="w-full px-2 py-1.5 border border-input rounded-md outline-none focus:border-primary bg-background text-sm"
                            />
                          </div>
                        </div>
                        {/* Line total */}
                        {item.service_id && (
                          <p className="text-xs text-right text-text-secondary">
                            Thành tiền:{" "}
                            <span className="font-medium text-text-primary">
                              {(
                                item.unit_price * item.quantity
                              ).toLocaleString("vi-VN")}
                              ₫
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                    {/* Total */}
                    <div className="flex justify-between items-center pt-1 text-sm font-medium">
                      <span className="text-text-secondary">Tổng cộng</span>
                      <span className="text-text-primary">
                        {lineItems
                          .reduce(
                            (s, li) => s + li.unit_price * li.quantity,
                            0,
                          )
                          .toLocaleString("vi-VN")}
                        ₫
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Xe ── */}
              <div className="space-y-2 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> Xe thiết bị
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setVehicles((prev) => [
                        ...prev,
                        {
                          _key: crypto.randomUUID(),
                          vehicle_id: null,
                          deploy_date: "",
                        },
                      ])
                    }
                    className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm xe
                  </button>
                </div>

                {vehicles.length === 0 ? (
                  <p className="text-xs text-text-disabled py-2 text-center border border-dashed border-border rounded-md">
                    Chưa có xe nào
                  </p>
                ) : (
                  <div className="space-y-2">
                    {vehicles.map((v) => {
                      const selected = vehicleOptions.find(
                        (mv) => mv.id === v.vehicle_id,
                      );
                      return (
                        <div
                          key={v._key}
                          className="rounded-md border border-border bg-bg-page p-2.5 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <select
                              value={v.vehicle_id ?? ""}
                              onChange={(e) =>
                                setVehicles((prev) =>
                                  prev.map((vv) =>
                                    vv._key === v._key
                                      ? {
                                          ...vv,
                                          vehicle_id:
                                            Number(e.target.value) || null,
                                        }
                                      : vv,
                                  ),
                                )
                              }
                              className="flex-1 text-sm border border-input rounded-md px-2 py-1.5 outline-none focus:border-primary bg-background"
                            >
                              <option value="">-- Chọn xe --</option>
                              {vehicleOptions.map((mv) => (
                                <option key={mv.id} value={mv.id}>
                                  {mv.model} — {mv.serialNumber}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setVehicles((prev) =>
                                  prev.filter((vv) => vv._key !== v._key),
                                )
                              }
                              className="text-text-secondary hover:text-error cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-text-secondary">
                              Ngày giao xe
                            </label>
                            <DatePicker
                              value={v.deploy_date}
                              onChange={(d) =>
                                setVehicles((prev) =>
                                  prev.map((vv) =>
                                    vv._key === v._key
                                      ? { ...vv, deploy_date: d }
                                      : vv,
                                  ),
                                )
                              }
                              placeholder="Chọn ngày giao"
                            />
                          </div>
                          {selected && (
                            <p className="text-xs text-text-secondary">
                              Số serial:{" "}
                              <span className="font-medium text-text-primary">
                                {selected.serialNumber}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
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
      <Button type="submit" form="create-contract-form" disabled={mutation.isPending} className="cursor-pointer">
        {mutation.isPending ? "Đang tạo..." : "Tạo hợp đồng"}
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
        <FileUpload value={file} onChange={setFile} label="Kéo thả hoặc nhấp để chọn file hợp đồng" />
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
                <FileUpload value={file} onChange={setFile} label="Kéo thả hoặc nhấp để chọn file hợp đồng" />
                {!file && (
                  <button
                    type="button"
                    onClick={() => setMockUrl(MOCK_DOC_URL)}
                    className="w-full text-xs text-amber-600 border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-md py-1.5 transition-colors cursor-pointer"
                  >
                    [Dev] Dùng file mock để xem preview
                  </button>
                )}
                {(file || mockUrl) && <FilePreviewPanel file={file} mockUrl={mockUrl} />}
              </div>
            ) : (
              <>
                {showCreateCustomer && (
                  <CreateCustomerModal
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
          {/* ── Left: Form — width cố định 420px, ẩn khi chưa có file ── */}
          <div
            className="relative flex flex-col border-r border-border overflow-y-auto shrink-0 transition-all duration-300"
            style={{
              width: hasPreview ? "420px" : "0px",
              overflow: hasPreview ? undefined : "hidden",
            }}
          >
            {showCreateCustomer && (
              <CreateCustomerModal
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

          {/* ── Right: Preview — flex-1 + min-w-0 để không tràn ── */}
          <div
            className={cn(
              "flex-1 min-w-0 overflow-hidden h-full transition-all duration-300",
              hasPreview ? "pt-4 pl-4" : "p-8",
            )}
          >
            {!hasPreview ? uploadPanel : <FilePreviewPanel file={file} mockUrl={mockUrl} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
