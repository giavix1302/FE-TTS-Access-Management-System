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
  CustomerDetail,
  IndividualCustomer,
  BusinessCustomer,
  CustomerContractItem,
} from "@/types/customer.types";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_CUSTOMERS: Record<number, CustomerDetail> = {
  1: {
    id: 1,
    customer_type: "individual",
    is_active: true,
    full_name: "Nguyễn Văn A",
    date_of_birth: "1990-05-15",
    gender: "male",
    nationality: "Việt Nam",
    cccd: "012345678901",
    cccd_issue_date: "2021-01-01",
    cccd_issue_place: "Cục Cảnh sát QLHC về TTXH",
    hometown: "Hà Nội",
    permanent_address: "123 Đường ABC, Quận 1, TP.HCM",
    phone: "0901234567",
    email: "vana@gmail.com",
    created_at: "2025-01-05T08:00:00Z",
    updated_at: "2025-06-01T08:00:00Z",
  },
  2: {
    id: 2,
    customer_type: "business",
    is_active: true,
    international_name: "Công ty TNHH Đô Thành",
    short_name: "DOTHANH",
    tax_code: "0301234567",
    tax_address: "123 Đường Hoàng Diệu, Quận 4, TP.HCM",
    office_address: "456 Đường Nguyễn Văn Linh, Quận 7, TP.HCM",
    representative: "Trần Văn Đô",
    phone: "0281234567",
    email: "contact@dothanh.vn",
    created_at: "2025-01-10T08:00:00Z",
    updated_at: "2025-06-01T08:00:00Z",
  },
  3: {
    id: 3,
    customer_type: "business",
    is_active: true,
    international_name: "Công ty CP Đại Phong",
    short_name: "DAIPHONG",
    tax_code: "3703116797",
    tax_address: "789 Đường Lê Văn Việt, Q.9, TP.HCM",
    office_address: null,
    representative: "Nguyễn Thị C",
    phone: "0251234567",
    email: "contact@daiphong.vn",
    created_at: "2025-02-01T08:00:00Z",
    updated_at: "2025-06-01T08:00:00Z",
  },
  4: {
    id: 4,
    customer_type: "individual",
    is_active: false,
    full_name: "Trần Thị Bích",
    date_of_birth: "1985-10-20",
    gender: "female",
    nationality: "Việt Nam",
    cccd: "079185012345",
    cccd_issue_date: "2020-05-01",
    cccd_issue_place: "Cục Cảnh sát QLHC về TTXH",
    hometown: "TP.HCM",
    permanent_address: "99 Đường CMT8, Quận 3, TP.HCM",
    phone: "0912345678",
    email: null,
    created_at: "2025-03-15T08:00:00Z",
    updated_at: "2025-05-10T08:00:00Z",
  },
  5: {
    id: 5,
    customer_type: "business",
    is_active: true,
    international_name: "Bệnh viện Hoàn Mỹ",
    short_name: "HOANMY",
    tax_code: "0304567890",
    tax_address: "60 Đường Phan Xích Long, Q.Phú Nhuận, TP.HCM",
    office_address: null,
    representative: "BS. Lê Hoàng Nam",
    phone: "0289012345",
    email: "contact@hoanmy.vn",
    created_at: "2025-04-20T08:00:00Z",
    updated_at: "2025-06-01T08:00:00Z",
  },
};

const MOCK_CONTRACTS: CustomerContractItem[] = [
  {
    id: 1,
    contract_number: "01012026/HĐTTB/TTS-DOTHANH",
    status: "active",
    start_date: "2026-01-05",
    end_date: "2026-03-05",
    total_amount: 64800000,
    created_at: "2026-01-01T08:00:00Z",
  },
  {
    id: 3,
    contract_number: "03122025/HĐTTB/TTS-DOTHANH",
    status: "completed",
    start_date: "2025-12-01",
    end_date: "2025-12-21",
    total_amount: 18000000,
    created_at: "2025-11-28T08:00:00Z",
  },
];

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const individualEditSchema = z.object({
  full_name: z.string().min(1, "Bắt buộc"),
  phone: z.string().min(1, "Bắt buộc"),
  email: z.string().email("Không hợp lệ").or(z.literal("")).optional(),
  cccd: z.string().regex(/^\d{12}$/, "Phải là 12 số"),
  cccd_issue_date: z.string().optional(),
  cccd_issue_place: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).or(z.literal("")).optional(),
  nationality: z.string().optional(),
  hometown: z.string().optional(),
  permanent_address: z.string().optional(),
});

const businessEditSchema = z.object({
  international_name: z.string().min(1, "Bắt buộc"),
  short_name: z
    .string()
    .min(1, "Bắt buộc")
    .regex(/^[A-Z0-9]+$/, "Chỉ chữ in hoa A–Z và số 0–9"),
  tax_code: z
    .string()
    .regex(/^\d{10}(\d{3})?$/, "Phải là 10 hoặc 13 số"),
  tax_address: z.string().optional(),
  office_address: z.string().optional(),
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
    setValue,
    formState: { errors },
  } = useForm<IndividualEditForm>({
    resolver: zodResolver(individualEditSchema),
    defaultValues: {
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email ?? "",
      cccd: customer.cccd,
      cccd_issue_date: customer.cccd_issue_date ?? "",
      cccd_issue_place: customer.cccd_issue_place ?? "",
      date_of_birth: customer.date_of_birth ?? "",
      gender: customer.gender ?? "",
      nationality: customer.nationality ?? "Việt Nam",
      hometown: customer.hometown ?? "",
      permanent_address: customer.permanent_address ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (_body: IndividualEditForm) =>
      new Promise<void>((res) => setTimeout(res, 500)),
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
        <input {...register("full_name")} className={`${fieldClass} mt-1`} />
        {errors.full_name && <p className={errClass}>{errors.full_name.message}</p>}
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
        <input {...register("cccd")} maxLength={12} className={`${fieldClass} mt-1`} />
        {errors.cccd && <p className={errClass}>{errors.cccd.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">Ngày cấp CCCD</Label>
          <Controller
            control={control}
            name="cccd_issue_date"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} className="mt-1 w-full" />
            )}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Ngày sinh</Label>
          <Controller
            control={control}
            name="date_of_birth"
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
        <input {...register("cccd_issue_place")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Quê quán</Label>
        <input {...register("hometown")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Địa chỉ thường trú</Label>
        <input {...register("permanent_address")} className={`${fieldClass} mt-1`} />
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
            <DialogTitle>Chỉnh sửa — {customer.full_name}</DialogTitle>
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
          <MobileSheetTitle>Chỉnh sửa — {customer.full_name}</MobileSheetTitle>
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
      international_name: customer.international_name,
      short_name: customer.short_name,
      tax_code: customer.tax_code,
      tax_address: customer.tax_address ?? "",
      office_address: customer.office_address ?? "",
      representative: customer.representative ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (_body: BusinessEditForm) =>
      new Promise<void>((res) => setTimeout(res, 500)),
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
        <input {...register("international_name")} className={`${fieldClass} mt-1`} />
        {errors.international_name && <p className={errClass}>{errors.international_name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Tên viết tắt <span className="text-error">*</span>
          </Label>
          <input
            {...register("short_name")}
            onChange={(e) =>
              setValue("short_name", e.target.value.toUpperCase(), { shouldValidate: true })
            }
            className={`${fieldClass} mt-1 uppercase`}
          />
          {errors.short_name && <p className={errClass}>{errors.short_name.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Mã số thuế <span className="text-error">*</span>
          </Label>
          <input {...register("tax_code")} className={`${fieldClass} mt-1`} />
          {errors.tax_code && <p className={errClass}>{errors.tax_code.message}</p>}
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
        <input {...register("tax_address")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Địa chỉ văn phòng</Label>
        <input {...register("office_address")} className={`${fieldClass} mt-1`} />
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
            <DialogTitle>Chỉnh sửa — {customer.international_name}</DialogTitle>
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
          <MobileSheetTitle>Chỉnh sửa — {customer.international_name}</MobileSheetTitle>
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
  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: QUERY_KEYS.customers.detail(customerId),
    queryFn: () =>
      Promise.resolve(MOCK_CUSTOMERS[customerId]).then((c) => {
        if (!c) throw new Error("not found");
        return c;
      }),
    enabled: !!customerId,
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<
    CustomerContractItem[]
  >({
    queryKey: QUERY_KEYS.customers.contracts(customerId),
    queryFn: () => Promise.resolve(MOCK_CONTRACTS),
    enabled: !!customerId,
  });

  // ── Toggle active mutation ────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: () => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customerId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.all });
      toast.success(
        customer?.is_active ? "Đã vô hiệu hóa khách hàng" : "Đã kích hoạt khách hàng",
      );
      setConfirmToggle(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // ── Contract table columns ────────────────────────────────────────────────
  const contractColumns: ColumnDef<CustomerContractItem>[] = [
    {
      id: "contract_number",
      header: "Số hợp đồng",
      cell: ({ row }) => (
        <p className="font-mono font-semibold text-text-primary text-[length:var(--fs-sm)]">
          {row.original.contract_number}
        </p>
      ),
    },
    {
      id: "period",
      header: "Thời gian",
      cell: ({ row }) => (
        <span className="text-[length:var(--fs-sm)] text-text-secondary">
          {formatDate(row.original.start_date)} → {formatDate(row.original.end_date)}
        </span>
      ),
    },
    {
      id: "total_amount",
      header: "Giá trị",
      cell: ({ row }) => (
        <span className="font-semibold text-[length:var(--fs-sm)] text-text-primary">
          {formatCurrency(row.original.total_amount)}
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

  const isIndividual = customer.customer_type === "individual";
  const isBusiness = customer.customer_type === "business";
  const ind = isIndividual ? (customer as IndividualCustomer) : null;
  const biz = isBusiness ? (customer as BusinessCustomer) : null;

  const typeBadge = getCustomerTypeBadge(customer.customer_type);
  const activeBadge = getCustomerActiveBadge(customer.is_active);
  const displayName = isIndividual ? ind!.full_name : biz!.international_name;

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
                {biz?.short_name && (
                  <span className="text-[length:var(--fs-xs)] font-mono text-text-secondary bg-bg-page px-1.5 py-0.5 rounded">
                    {biz.short_name}
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
                    className={`h-1.5 w-1.5 rounded-full ${customer.is_active ? "bg-success" : "bg-text-secondary"}`}
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
                  customer.is_active
                    ? "border-error text-error hover:bg-error hover:text-white"
                    : "border-success text-success hover:bg-success hover:text-white"
                }`}
                onClick={() => setConfirmToggle(true)}
              >
                {customer.is_active ? (
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
                <InfoRow label="Họ và tên" value={ind.full_name} />
                <InfoRow
                  label="Giới tính"
                  value={ind.gender ? GENDER_LABELS[ind.gender] : undefined}
                />
                <InfoRow
                  label="Ngày sinh"
                  value={ind.date_of_birth ? formatDate(ind.date_of_birth) : undefined}
                />
                <InfoRow label="Quốc tịch" value={ind.nationality} />
                <InfoRow label="Số CCCD" value={ind.cccd} />
                <InfoRow
                  label="Ngày cấp CCCD"
                  value={ind.cccd_issue_date ? formatDate(ind.cccd_issue_date) : undefined}
                />
                <div className="sm:col-span-2">
                  <InfoRow label="Nơi cấp CCCD" value={ind.cccd_issue_place} />
                </div>
              </div>
            )}

            {isBusiness && biz && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <div className="sm:col-span-2">
                  <InfoRow label="Tên doanh nghiệp" value={biz.international_name} />
                </div>
                <InfoRow label="Tên viết tắt" value={biz.short_name} />
                <InfoRow label="Mã số thuế" value={biz.tax_code} />
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
                    <InfoRow label="Địa chỉ thường trú" value={ind.permanent_address} />
                  </div>
                </>
              )}

              {isBusiness && biz && (
                <>
                  <div className="sm:col-span-2">
                    <InfoRow label="Địa chỉ đăng ký thuế" value={biz.tax_address} />
                  </div>
                  <div className="sm:col-span-2">
                    <InfoRow label="Địa chỉ văn phòng" value={biz.office_address} />
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
              <InfoRow label="Ngày tạo" value={formatDate(customer.created_at)} />
              <InfoRow label="Cập nhật lần cuối" value={formatDate(customer.updated_at)} />
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
                        {c.contract_number}
                      </p>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[length:var(--fs-xs)] text-text-secondary">
                      <span>
                        {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(c.total_amount)}
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
        title={customer.is_active ? "Vô hiệu hóa khách hàng?" : "Kích hoạt khách hàng?"}
        description={
          customer.is_active
            ? `Khách hàng "${displayName}" sẽ không thể tạo hợp đồng mới. Dữ liệu lịch sử vẫn được giữ nguyên.`
            : `Khách hàng "${displayName}" sẽ được kích hoạt trở lại.`
        }
        confirmLabel={customer.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
        variant={customer.is_active ? "danger" : "primary"}
        loading={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate()}
      />
    </div>
  );
}
