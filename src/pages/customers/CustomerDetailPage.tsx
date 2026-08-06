import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  Pencil,
  Building2,
  User,
  Phone,
  Mail,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import {
  getCustomerById,
  getCustomerContracts,
  updateIndividualCustomer,
  updateBusinessCustomer,
  activateCustomer,
  deactivateCustomer,
} from "@/api/customers.api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { DataTable } from "@/components/shared/DataTable";
import { DatePicker } from "@/components/shared/DatePicker";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDate, formatCurrency } from "@/utils/format";
import {
  getCustomerTypeBadge,
  getCustomerActiveBadge,
} from "@/constants/customerType";
import { getContractStatusBadge } from "@/constants/contractStatus";
import { usePermission } from "@/hooks/usePermission";
import type {
  IndividualCustomer,
  BusinessCustomer,
  CustomerContractItem,
} from "@/types/customer.types";

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const individualEditSchema = z.object({
  fullName: z.string().min(1, "Bắt buộc"),
  phone: z.string().min(1, "Bắt buộc"),
  email: z.string().email("Không hợp lệ").or(z.literal("")).optional(),
  nationalId: z.string().regex(/^\d{12}$/, "Phải là 12 số"),
  nationalIdIssueDate: z.string().optional(),
  nationalIdIssuePlace: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).or(z.literal("")).optional(),
  nationality: z.string().optional(),
  hometown: z.string().optional(),
  permanentAddress: z.string().optional(),
});

const businessEditSchema = z.object({
  internationalName: z.string().min(1, "Bắt buộc"),
  shortName: z
    .string()
    .min(1, "Bắt buộc")
    .regex(/^[A-Z0-9]+$/, "Chỉ chữ in hoa A–Z và số 0–9"),
  taxCode: z
    .string()
    .regex(/^\d{10}(\d{3})?$/, "Phải là 10 hoặc 13 số"),
  taxAddress: z.string().optional(),
  officeAddress: z.string().optional(),
  representative: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Không hợp lệ").or(z.literal("")).optional(),
});

type IndividualEditForm = z.infer<typeof individualEditSchema>;
type BusinessEditForm = z.infer<typeof businessEditSchema>;

const GENDER_LABELS: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

const fieldClass =
  "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
const errClass = "text-xs text-error mt-0.5";

// ─── InfoRow helper ───────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[length:var(--fs-xs)] text-text-secondary">{label}</p>
      <p className="text-[length:var(--fs-sm)] font-medium text-text-primary mt-0.5">
        {value || "—"}
      </p>
    </div>
  );
}

// ─── IndividualEditDialog ─────────────────────────────────────────────────────
function IndividualEditDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: IndividualCustomer;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<IndividualEditForm>({
    resolver: zodResolver(individualEditSchema),
    defaultValues: {
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email ?? "",
      nationalId: customer.nationalId,
      nationalIdIssueDate: customer.nationalIdIssueDate ?? "",
      nationalIdIssuePlace: customer.nationalIdIssuePlace ?? "",
      dateOfBirth: customer.dateOfBirth ?? "",
      gender: customer.gender ?? "",
      nationality: customer.nationality ?? "Việt Nam",
      hometown: customer.hometown ?? "",
      permanentAddress: customer.permanentAddress ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (body: IndividualEditForm) =>
      updateIndividualCustomer(customer.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customer.id),
      });
      toast.success("Đã cập nhật thông tin");
      onOpenChange(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  const formContent = (
    <form
      id="individual-edit-form"
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Họ và tên <span className="text-error">*</span>
        </Label>
        <input {...register("fullName")} className={`${fieldClass} mt-1`} />
        {errors.fullName && <p className={errClass}>{errors.fullName.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Điện thoại <span className="text-error">*</span>
          </Label>
          <input {...register("phone")} className={`${fieldClass} mt-1`} />
          {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Email</Label>
          <input {...register("email")} className={`${fieldClass} mt-1`} />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Số CCCD <span className="text-error">*</span>
        </Label>
        <input {...register("nationalId")} maxLength={12} className={`${fieldClass} mt-1`} />
        {errors.nationalId && <p className={errClass}>{errors.nationalId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">Ngày cấp CCCD</Label>
          <Controller
            control={control}
            name="nationalIdIssueDate"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} className="mt-1 w-full" />
            )}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Ngày sinh</Label>
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} className="mt-1 w-full" />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">Giới tính</Label>
          <select {...register("gender")} className={`${fieldClass} mt-1`}>
            <option value="">--</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Quốc tịch</Label>
          <input {...register("nationality")} className={`${fieldClass} mt-1`} />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Nơi cấp CCCD</Label>
        <input {...register("nationalIdIssuePlace")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Quê quán</Label>
        <input {...register("hometown")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Địa chỉ thường trú</Label>
        <input {...register("permanentAddress")} className={`${fieldClass} mt-1`} />
      </div>
    </form>
  );

  const actionButtons = (
    <>
      <Button type="button" variant="outline" className="cursor-pointer" onClick={handleClose}>
        Hủy
      </Button>
      <Button
        type="submit"
        form="individual-edit-form"
        disabled={mutation.isPending}
        className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
      >
        {mutation.isPending ? "Đang lưu..." : "Lưu"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa — {customer.fullName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1 py-1">{formContent}</div>
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Chỉnh sửa khách hàng">
        <MobileSheetHeader>
          <MobileSheetTitle>Chỉnh sửa — {customer.fullName}</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actionButtons}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── BusinessEditDialog ───────────────────────────────────────────────────────
function BusinessEditDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: BusinessCustomer;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BusinessEditForm>({
    resolver: zodResolver(businessEditSchema),
    defaultValues: {
      internationalName: customer.internationalName,
      shortName: customer.shortName,
      taxCode: customer.taxCode,
      taxAddress: customer.taxAddress ?? "",
      officeAddress: customer.officeAddress ?? "",
      representative: customer.representative ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (body: BusinessEditForm) =>
      updateBusinessCustomer(customer.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customer.id),
      });
      toast.success("Đã cập nhật thông tin");
      onOpenChange(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  const formContent = (
    <form
      id="business-edit-form"
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Tên doanh nghiệp <span className="text-error">*</span>
        </Label>
        <input {...register("internationalName")} className={`${fieldClass} mt-1`} />
        {errors.internationalName && <p className={errClass}>{errors.internationalName.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Tên viết tắt <span className="text-error">*</span>
          </Label>
          <input
            {...register("shortName")}
            onChange={(e) =>
              setValue("shortName", e.target.value.toUpperCase(), { shouldValidate: true })
            }
            className={`${fieldClass} mt-1 uppercase`}
          />
          {errors.shortName && <p className={errClass}>{errors.shortName.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Mã số thuế <span className="text-error">*</span>
          </Label>
          <input {...register("taxCode")} className={`${fieldClass} mt-1`} />
          {errors.taxCode && <p className={errClass}>{errors.taxCode.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Người đại diện</Label>
        <input {...register("representative")} className={`${fieldClass} mt-1`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">Điện thoại</Label>
          <input {...register("phone")} className={`${fieldClass} mt-1`} />
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Email</Label>
          <input {...register("email")} className={`${fieldClass} mt-1`} />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Địa chỉ đăng ký thuế</Label>
        <input {...register("taxAddress")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Địa chỉ văn phòng</Label>
        <input {...register("officeAddress")} className={`${fieldClass} mt-1`} />
      </div>
    </form>
  );

  const actionButtons = (
    <>
      <Button type="button" variant="outline" className="cursor-pointer" onClick={handleClose}>
        Hủy
      </Button>
      <Button
        type="submit"
        form="business-edit-form"
        disabled={mutation.isPending}
        className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
      >
        {mutation.isPending ? "Đang lưu..." : "Lưu"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa — {customer.internationalName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1 py-1">{formContent}</div>
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Chỉnh sửa doanh nghiệp">
        <MobileSheetHeader>
          <MobileSheetTitle>Chỉnh sửa — {customer.internationalName}</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actionButtons}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── CustomerDetailPage ───────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("customers.update");
  const canToggle = hasPermission("customers.update");

  const customerId = Number(id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: customerResponse, isLoading } = useQuery({
    queryKey: QUERY_KEYS.customers.detail(customerId),
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId,
  });

  const customer = customerResponse?.data;

  const { data: contractsResponse, isLoading: contractsLoading } = useQuery({
    queryKey: QUERY_KEYS.customers.contracts(customerId),
    queryFn: () => getCustomerContracts(customerId),
    enabled: !!customerId,
  });

  const contracts = contractsResponse?.data ?? [];

  // ── Toggle active mutation ────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: () =>
      customer?.isActive
        ? deactivateCustomer(customerId)
        : activateCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customerId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.all });
      toast.success(
        customer?.isActive ? "Đã vô hiệu hóa khách hàng" : "Đã kích hoạt khách hàng",
      );
      setConfirmToggle(false);
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: { code?: string } } } };
      if (axiosError.response?.data?.error?.code === "CUSTOMER_HAS_ACTIVE_CONTRACTS") {
        toast.error("Không thể vô hiệu hóa: khách hàng đang có hợp đồng active");
      } else {
        toast.error("Có lỗi xảy ra");
      }
    },
  });

  // ── Contract table columns ────────────────────────────────────────────────
  const contractColumns: ColumnDef<CustomerContractItem>[] = [
    {
      id: "contractNumber",
      header: "Số hợp đồng",
      cell: ({ row }) => (
        <p className="font-mono font-semibold text-text-primary text-[length:var(--fs-sm)]">
          {row.original.contractNumber}
        </p>
      ),
    },
    {
      id: "period",
      header: "Thời gian",
      cell: ({ row }) => (
        <span className="text-[length:var(--fs-sm)] text-text-secondary">
          {formatDate(row.original.startDate)} → {formatDate(row.original.endDate)}
        </span>
      ),
    },
    {
      id: "totalAmount",
      header: "Giá trị",
      cell: ({ row }) => (
        <span className="font-semibold text-[length:var(--fs-sm)] text-text-primary">
          {formatCurrency(row.original.totalAmount)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: ({ row }) => {
        const { label, className } = getContractStatusBadge(row.original.status);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium ${className}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer text-primary hover:bg-primary-light hover:text-primary"
          onClick={() => navigate(`/contracts/${row.original.id}`)}
        >
          Xem
        </Button>
      ),
    },
  ];

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-text-secondary">Không tìm thấy khách hàng</p>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => navigate("/customers")}
        >
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const isIndividual = customer.customerType === "individual";
  const isBusiness = customer.customerType === "business";
  const ind = isIndividual ? (customer as IndividualCustomer) : null;
  const biz = isBusiness ? (customer as BusinessCustomer) : null;

  const typeBadge = getCustomerTypeBadge(customer.customerType);
  const activeBadge = getCustomerActiveBadge(customer.isActive);
  const displayName = isIndividual ? ind!.fullName : biz!.internationalName;

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      {/* Back button */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary hover:bg-primary-light transition-colors w-fit cursor-pointer px-3 py-1.5 rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách khách hàng
      </button>

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: avatar + info */}
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
                isBusiness ? "bg-[#FFF7ED]" : "bg-[#EEF2FF]"
              }`}
            >
              {isBusiness ? (
                <Building2 className="h-8 w-8 text-[#C2410C]" />
              ) : (
                <User className="h-8 w-8 text-[#4F46E5]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-[length:var(--fs-heading)] font-semibold text-text-primary">
                  {displayName}
                </h1>
                {biz?.shortName && (
                  <span className="text-[length:var(--fs-xs)] font-mono text-text-secondary bg-bg-page px-1.5 py-0.5 rounded">
                    {biz.shortName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium ${typeBadge.className}`}
                >
                  {typeBadge.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium ${activeBadge.className}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${customer.isActive ? "bg-success" : "bg-text-secondary"}`}
                  />
                  {activeBadge.label}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1 text-[length:var(--fs-xs)] text-text-secondary">
                    <Phone size={11} />
                    {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1 text-[length:var(--fs-xs)] text-text-secondary">
                    <Mail size={11} />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: actions — mobile xuống dưới, border-t phân tách */}
          <div className="flex items-center gap-2 sm:shrink-0 border-t border-border pt-3 sm:border-0 sm:pt-0">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer flex-1 sm:flex-none gap-1.5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={14} />
                Chỉnh sửa
              </Button>
            )}
            {canToggle && (
              <Button
                variant="outline"
                size="sm"
                className={`cursor-pointer flex-1 sm:flex-none gap-1.5 ${
                  customer.isActive
                    ? "border-error text-error hover:bg-error hover:text-white"
                    : "border-success text-success hover:bg-success hover:text-white"
                }`}
                onClick={() => setConfirmToggle(true)}
              >
                {customer.isActive ? (
                  <>
                    <ShieldOff size={14} />
                    Vô hiệu hóa
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    Kích hoạt
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="info">
        <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1 overflow-x-auto">
          {[
            { value: "info", label: "Thông tin" },
            {
              value: "contracts",
              label: "Lịch sử hợp đồng",
              count: contracts.length > 0 ? contracts.length : undefined,
            },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm text-text-secondary px-4 py-2.5 text-[length:var(--fs-base)] font-medium gap-1.5 cursor-pointer"
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-primary-light text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab 1: Thông tin ──────────────────────────────────────────── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <p className="text-[length:var(--fs-sm)] font-semibold text-text-primary mb-4">
              {isIndividual ? "Thông tin cá nhân" : "Thông tin doanh nghiệp"}
            </p>

            {isIndividual && ind && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Họ và tên" value={ind.fullName} />
                <InfoRow
                  label="Giới tính"
                  value={ind.gender ? GENDER_LABELS[ind.gender] : undefined}
                />
                <InfoRow
                  label="Ngày sinh"
                  value={ind.dateOfBirth ? formatDate(ind.dateOfBirth) : undefined}
                />
                <InfoRow label="Quốc tịch" value={ind.nationality} />
                <InfoRow label="Số CCCD" value={ind.nationalId} />
                <InfoRow
                  label="Ngày cấp CCCD"
                  value={ind.nationalIdIssueDate ? formatDate(ind.nationalIdIssueDate) : undefined}
                />
                <div className="sm:col-span-2">
                  <InfoRow label="Nơi cấp CCCD" value={ind.nationalIdIssuePlace} />
                </div>
              </div>
            )}

            {isBusiness && biz && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="sm:col-span-2">
                  <InfoRow label="Tên doanh nghiệp" value={biz.internationalName} />
                </div>
                <InfoRow label="Tên viết tắt" value={biz.shortName} />
                <InfoRow label="Mã số thuế" value={biz.taxCode} />
                <div className="sm:col-span-2">
                  <InfoRow label="Người đại diện" value={biz.representative} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-5">
            <p className="text-[length:var(--fs-sm)] font-semibold text-text-primary mb-4">
              Liên hệ & Địa chỉ
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="Điện thoại" value={customer.phone} />
              <InfoRow label="Email" value={customer.email} />

              {isIndividual && ind && (
                <>
                  <InfoRow label="Quê quán" value={ind.hometown} />
                  <div className="sm:col-span-2">
                    <InfoRow label="Địa chỉ thường trú" value={ind.permanentAddress} />
                  </div>
                </>
              )}

              {isBusiness && biz && (
                <>
                  <div className="sm:col-span-2">
                    <InfoRow label="Địa chỉ đăng ký thuế" value={biz.taxAddress} />
                  </div>
                  <div className="sm:col-span-2">
                    <InfoRow label="Địa chỉ văn phòng" value={biz.officeAddress} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-5">
            <p className="text-[length:var(--fs-sm)] font-semibold text-text-primary mb-4">
              Thông tin hệ thống
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="Ngày tạo" value={formatDate(customer.createdAt)} />
              <InfoRow label="Cập nhật lần cuối" value={formatDate(customer.updatedAt)} />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Lịch sử hợp đồng ──────────────────────────────────── */}
        <TabsContent value="contracts" className="mt-4">
          <div className="hidden sm:block">
            <DataTable
              columns={contractColumns}
              data={contracts}
              loading={contractsLoading}
              emptyTitle="Chưa có hợp đồng nào"
              emptyDescription="Khách hàng này chưa có hợp đồng"
            />
          </div>

          {/* Mobile contract list */}
          <div className="flex flex-col gap-3 sm:hidden">
            {contractsLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-[80px] animate-pulse rounded-xl bg-[#E2E8F0]" />
              ))
            ) : contracts.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg-card py-12 text-center">
                <p className="text-[length:var(--fs-sm)] text-text-secondary">
                  Chưa có hợp đồng nào
                </p>
              </div>
            ) : (
              contracts.map((c) => {
                const { label, className } = getContractStatusBadge(c.status);
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/contracts/${c.id}`)}
                    className="cursor-pointer rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-2 hover:border-primary hover:shadow-sm transition-all active:bg-bg-page"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono font-semibold text-[length:var(--fs-sm)] text-text-primary truncate flex-1">
                        {c.contractNumber}
                      </p>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[length:var(--fs-xs)] text-text-secondary">
                      <span>
                        {formatDate(c.startDate)} → {formatDate(c.endDate)}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(c.totalAmount)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit dialogs ───────────────────────────────────────────────────── */}
      {isIndividual && ind && (
        <IndividualEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={ind}
        />
      )}
      {isBusiness && biz && (
        <BusinessEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={biz}
        />
      )}

      {/* ── Confirm toggle ─────────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={customer.isActive ? "Vô hiệu hóa khách hàng?" : "Kích hoạt khách hàng?"}
        description={
          customer.isActive
            ? `Khách hàng "${displayName}" sẽ không thể tạo hợp đồng mới. Dữ liệu lịch sử vẫn được giữ nguyên.`
            : `Khách hàng "${displayName}" sẽ được kích hoạt trở lại.`
        }
        confirmLabel={customer.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
        variant={customer.isActive ? "danger" : "primary"}
        loading={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate()}
      />
    </div>
  );
}
