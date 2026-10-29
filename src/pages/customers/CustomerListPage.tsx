import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Plus, Building2, User } from "lucide-react";
import {
  getCustomers,
  createIndividualCustomer,
  createBusinessCustomer,
} from "@/api/customers.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDateTime } from "@/utils/format";
import { getApiError, getApiErrorMessage } from "@/utils/apiError";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DataTable } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import { DatePicker } from "@/components/shared/DatePicker";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  getCustomerTypeBadge,
  getCustomerActiveBadge,
  CUSTOMER_TYPE_OPTIONS,
} from "@/constants/customerType";
import type { CustomerListItem, CustomerType } from "@/types/customer.types";
import { isValidPhone, PHONE_INPUT_PATTERN, PHONE_VALIDATION_MESSAGE } from "@/utils/phone";

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const individualSchema = z.object({
  type: z.literal("individual"),
  fullName: z.string().trim().min(1, "Bắt buộc").max(200, "Tối đa 200 ký tự"),
  phone: z.string().refine((value) => isValidPhone(value, true), PHONE_VALIDATION_MESSAGE),
  nationalId: z.string().regex(/^\d{12}$/, "Phải là 12 số"),
  email: z.string().email("Email không hợp lệ").max(200).or(z.literal("")).optional(),
  dateOfBirth: z.string().max(20).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z.string().max(100).optional(),
  nationalIdIssueDate: z.string().max(20).optional(),
  nationalIdIssuePlace: z.string().max(300).optional(),
  hometown: z.string().max(300).optional(),
  permanentAddress: z.string().max(500).optional(),
});

const businessSchema = z.object({
  type: z.literal("business"),
  internationalName: z.string().trim().min(1, "Bắt buộc").max(300, "Tối đa 300 ký tự"),
  shortName: z
    .string()
    .min(1, "Bắt buộc")
    .max(50, "Tối đa 50 ký tự")
    .regex(/^[A-Z0-9]+$/, "Chỉ chữ in hoa A–Z và số 0–9, không dấu cách"),
  taxCode: z
    .string()
    .regex(/^\d{10}(\d{3})?$/, "Phải là 10 hoặc 13 số"),
  taxAddress: z.string().max(500).optional(),
  officeAddress: z.string().max(500).optional(),
  representative: z.string().max(200).optional(),
  representativeTitle: z.string().max(100).optional(),
  phone: z.string().refine((value) => isValidPhone(value, false), PHONE_VALIDATION_MESSAGE).optional(),
  email: z.string().email("Email không hợp lệ").max(200).or(z.literal("")).optional(),
});

type IndividualForm = z.infer<typeof individualSchema>;
type BusinessForm = z.infer<typeof businessSchema>;

const PAGE_SIZE = 10;

const fieldClass =
  "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
const errClass = "text-xs text-error mt-0.5";
const displayOptionalValue = (value?: string | null) => value?.trim() || "—";

const toDatePickerValue = (value?: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

const toBackendDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

// ─── Form nội dung: Doanh nghiệp ─────────────────────────────────────────────
function BusinessFormFields({
  form,
}: {
  form: ReturnType<typeof useForm<BusinessForm>>;
}) {
  const { register, setValue, formState: { errors } } = form;
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Tên doanh nghiệp <span className="text-error">*</span>
        </Label>
        <input
          {...register("internationalName")}
          placeholder="Công ty TNHH ABC"
          className={`${fieldClass} mt-1`}
        />
        {errors.internationalName && (
          <p className={errClass}>{errors.internationalName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Tên viết tắt <span className="text-error">*</span>
          </Label>
          <input
            {...register("shortName")}
            placeholder="ABC"
            onChange={(e) =>
              setValue("shortName", e.target.value.toUpperCase(), {
                shouldValidate: true,
              })
            }
            className={`${fieldClass} mt-1 uppercase`}
          />
          {errors.shortName && (
            <p className={errClass}>{errors.shortName.message}</p>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Mã số thuế <span className="text-error">*</span>
          </Label>
          <input
            {...register("taxCode")}
            placeholder="0123456789"
            className={`${fieldClass} mt-1`}
          />
          {errors.taxCode && (
            <p className={errClass}>{errors.taxCode.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Người đại diện
        </Label>
        <input
          {...register("representative")}
          placeholder="Nguyễn Văn A"
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Chức vụ người đại diện
        </Label>
        <input
          {...register("representativeTitle")}
          placeholder="Giám đốc"
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Điện thoại
          </Label>
          <input
            {...register("phone")}
            placeholder="028..."
            inputMode="tel"
            pattern={PHONE_INPUT_PATTERN}
            className={`${fieldClass} mt-1`}
          />
          {errors.phone && (
            <p className={errClass}>{errors.phone.message}</p>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Email
          </Label>
          <input
            {...register("email")}
            placeholder="contact@..."
            className={`${fieldClass} mt-1`}
          />
          {errors.email && (
            <p className={errClass}>{errors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ đăng ký thuế
        </Label>
        <input
          {...register("taxAddress")}
          placeholder="123 Đường ABC, Quận 1..."
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ văn phòng
        </Label>
        <input
          {...register("officeAddress")}
          placeholder="456 Đường XYZ, Quận 7..."
          className={`${fieldClass} mt-1`}
        />
      </div>
    </div>
  );
}

// ─── Form nội dung: Cá nhân ───────────────────────────────────────────────────
function IndividualFormFields({
  form,
}: {
  form: ReturnType<typeof useForm<IndividualForm>>;
}) {
  const { register, control, formState: { errors } } = form;
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Họ và tên <span className="text-error">*</span>
        </Label>
        <input
          {...register("fullName")}
          placeholder="Nguyễn Văn A"
          className={`${fieldClass} mt-1`}
        />
        {errors.fullName && (
          <p className={errClass}>{errors.fullName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Số điện thoại <span className="text-error">*</span>
          </Label>
          <input
            {...register("phone")}
            placeholder="0901234567"
            inputMode="tel"
            pattern={PHONE_INPUT_PATTERN}
            className={`${fieldClass} mt-1`}
          />
          {errors.phone && (
            <p className={errClass}>{errors.phone.message}</p>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Email
          </Label>
          <input
            {...register("email")}
            placeholder="vana@gmail.com"
            className={`${fieldClass} mt-1`}
          />
          {errors.email && (
            <p className={errClass}>{errors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Số CCCD <span className="text-error">*</span>
        </Label>
        <input
          {...register("nationalId")}
          placeholder="012345678901"
          maxLength={12}
          className={`${fieldClass} mt-1`}
        />
        {errors.nationalId && (
          <p className={errClass}>{errors.nationalId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Ngày cấp CCCD
          </Label>
          <Controller
            control={control}
            name="nationalIdIssueDate"
            render={({ field }) => (
              <DatePicker
                value={toDatePickerValue(field.value)}
                onChange={(value) => field.onChange(toBackendDate(value))}
                className="mt-1 w-full"
              />
            )}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Ngày sinh
          </Label>
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <DatePicker
                value={toDatePickerValue(field.value)}
                onChange={(value) => field.onChange(toBackendDate(value))}
                className="mt-1 w-full"
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Giới tính
          </Label>
          <select
            {...register("gender")}
            className={`${fieldClass} mt-1`}
          >
            <option value="">--</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Quốc tịch
          </Label>
          <input
            {...register("nationality")}
            className={`${fieldClass} mt-1`}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Nơi cấp CCCD
        </Label>
        <input
          {...register("nationalIdIssuePlace")}
          placeholder="Cục Cảnh sát QLHC về TTXH"
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Quê quán
        </Label>
        <input
          {...register("hometown")}
          placeholder="Hà Nội"
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ thường trú
        </Label>
        <input
          {...register("permanentAddress")}
          placeholder="123 Đường ABC, Quận 1..."
          className={`${fieldClass} mt-1`}
        />
      </div>
    </div>
  );
}

// ─── CreateCustomerDialog ─────────────────────────────────────────────────────
function CreateCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [activeType, setActiveType] = useState<CustomerType>("business");

  const individualForm = useForm<IndividualForm>({
    resolver: zodResolver(individualSchema),
    defaultValues: { type: "individual", nationality: "Việt Nam" },
  });

  const businessForm = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: { type: "business" },
  });

  const mutation = useMutation({
    mutationFn: (body: IndividualForm | BusinessForm) => {
      if (body.type === "individual") {
        const { type, ...rest } = body;
        void type;
        return createIndividualCustomer(rest);
      } else {
        const { type, ...rest } = body;
        void type;
        return createBusinessCustomer(rest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.all });
      toast.success("Thêm khách hàng thành công");
      handleClose();
    },
    onError: (error: unknown) => {
      const apiError = getApiError(error);
      const targetForm = activeType === "individual" ? individualForm : businessForm;
      apiError.details?.forEach(({ field, message }) => {
        targetForm.setError(field as never, { type: "server", message });
      });

      const duplicateField = {
        CCCD_ALREADY_EXISTS: "nationalId",
        TAX_CODE_ALREADY_EXISTS: "taxCode",
        SHORT_NAME_ALREADY_EXISTS: "shortName",
      }[apiError.code ?? ""];
      if (duplicateField) {
        targetForm.setError(duplicateField as never, {
          type: "server",
          message: apiError.message ?? "Giá trị đã tồn tại",
        });
      }
      if (apiError.code === "PHONE_ALREADY_EXISTS") {
        targetForm.setError("phone" as never, {
          type: "server",
          message: apiError.message ?? "Số điện thoại đã được sử dụng",
        });
      }
      if (
        apiError.code === "CONTACT_PHONE_OR_EMAIL_EXISTS" &&
        !apiError.details?.length
      ) {
        targetForm.setError("phone" as never, {
          type: "server",
          message: apiError.message ?? "Số điện thoại hoặc email đã được sử dụng",
        });
        targetForm.setError("email" as never, {
          type: "server",
          message: apiError.message ?? "Số điện thoại hoặc email đã được sử dụng",
        });
      }
      toast.error(getApiErrorMessage(error));
    },
  });

  function handleClose() {
    onOpenChange(false);
    individualForm.reset({ type: "individual", nationality: "Việt Nam" });
    businessForm.reset({ type: "business" });
  }

  const typeToggle = (
    <div className="flex gap-2">
      {(["business", "individual"] as CustomerType[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setActiveType(t)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
            activeType === t
              ? "bg-primary text-white border-primary"
              : "bg-bg-page text-text-secondary border-border hover:border-primary hover:text-primary"
          }`}
        >
          {t === "business" ? (
            <Building2 className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
          {t === "business" ? "Doanh nghiệp" : "Cá nhân"}
        </button>
      ))}
    </div>
  );

  const submitButton = (
    <Button
      type="submit"
      form="customer-create-form"
      disabled={mutation.isPending}
      className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
    >
      {mutation.isPending ? "Đang lưu..." : "Thêm khách hàng"}
    </Button>
  );

  const formContent = (
    <>
      {activeType === "business" ? (
        <form
          id="customer-create-form"
          onSubmit={businessForm.handleSubmit((d) => mutation.mutate(d))}
        >
          <BusinessFormFields form={businessForm} />
        </form>
      ) : (
        <form
          id="customer-create-form"
          onSubmit={individualForm.handleSubmit((d) => mutation.mutate(d))}
        >
          <IndividualFormFields form={individualForm} />
        </form>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm khách hàng mới</DialogTitle>
          </DialogHeader>
          {typeToggle}
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {formContent}
          </div>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleClose}
            >
              Hủy
            </Button>
            {submitButton}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Thêm khách hàng mới">
        <MobileSheetHeader>
          <MobileSheetTitle>Thêm khách hàng mới</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto gap-3">
          {typeToggle}
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer flex-1 sm:flex-none"
            onClick={handleClose}
          >
            Hủy
          </Button>
          <div className="flex-1 sm:flex-none">{submitButton}</div>
        </MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── CustomerListPage ─────────────────────────────────────────────────────────
export default function CustomerListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("customers.create");

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "">("");
  const [activeFilter, setActiveFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const debouncedSearch = useDebounce(search, 400);
  const page = pagination.pageIndex + 1;

  const { data, isLoading } = useQuery({
    queryKey: [
      ...QUERY_KEYS.customers.all,
      { search: debouncedSearch, typeFilter, activeFilter, page, pageSize: pagination.pageSize },
    ],
    queryFn: () =>
      getCustomers({
        search: debouncedSearch || undefined,
        customer_type: typeFilter || undefined,
        is_active:
          activeFilter === "active"
            ? true
            : activeFilter === "inactive"
              ? false
              : undefined,
        page,
        page_size: pagination.pageSize,
      }),
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  // ─── Columns ──────────────────────────────────────────────────────────────
  const columns: ColumnDef<CustomerListItem>[] = [
    {
      id: "name",
      header: "Khách hàng",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                c.customerType === "business" ? "bg-[#FFF7ED]" : "bg-[#EEF2FF]"
              }`}
            >
              {c.customerType === "business" ? (
                <Building2 className="h-4 w-4 text-[#C2410C]" />
              ) : (
                <User className="h-4 w-4 text-[#4F46E5]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text-primary truncate">
                {c.displayName}
              </p>
              {c.shortName && (
                <p className="text-[length:var(--fs-xs)] text-text-secondary">
                  {c.shortName}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "type",
      header: "Loại",
      cell: ({ row }) => {
        const { label, className } = getCustomerTypeBadge(row.original.customerType);
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
      id: "phone",
      header: "Điện thoại",
      cell: ({ row }) => (
        <span className="text-text-secondary text-[length:var(--fs-sm)]">
          {displayOptionalValue(row.original.phone)}
        </span>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-text-secondary text-[length:var(--fs-sm)]">
          {displayOptionalValue(row.original.email)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: ({ row }) => {
        const { label, className } = getCustomerActiveBadge(row.original.isActive);
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium ${className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${row.original.isActive ? "bg-success" : "bg-text-secondary"}`}
            />
            {label}
          </span>
        );
      },
    },
    {
      id: "updated_at",
      header: "Cập nhật lần cuối",
      size: 170,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-[length:var(--fs-sm)] text-text-secondary">
          {formatDateTime(row.original.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <PageHeader
        title="Khách hàng"
        subtitle="Danh sách khách hàng của công ty"
        actions={
          canEdit ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-auto cursor-pointer gap-1.5 rounded-lg border-0 bg-primary px-3 py-1.5 text-[length:var(--fs-sm)] text-white shadow-sm hover:bg-primary-dark sm:px-4 sm:py-2 sm:text-[length:var(--fs-base)]"
            >
              <Plus size={16} />
              Thêm khách hàng
            </Button>
          ) : undefined
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        searchPlaceholder="Tìm tên, SĐT, email..."
        activeFilterCount={Number(!!typeFilter) + Number(!!activeFilter)}
        onClearFilters={() => {
          setTypeFilter("");
          setActiveFilter("");
          resetPage();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label className="text-[length:var(--fs-sm)]">Loại khách hàng</Label>
          <Select
            value={typeFilter || "_all"}
            onValueChange={(v) => {
              setTypeFilter(v === "_all" ? "" : (v as CustomerType));
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả loại</SelectItem>
              {CUSTOMER_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[length:var(--fs-sm)]">Trạng thái</Label>
          <Select
            value={activeFilter || "_all"}
            onValueChange={(v) => {
              setActiveFilter(v === "_all" ? "" : v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả trạng thái</SelectItem>
              <SelectItem value="active">Đang hoạt động</SelectItem>
              <SelectItem value="inactive">Đã vô hiệu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterToolbar>

      <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={customers}
          loading={isLoading}
          pagination={pagination}
          pageCount={meta?.totalPages ?? 1}
          onPaginationChange={setPagination}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
          emptyTitle="Không tìm thấy khách hàng nào"
          emptyDescription="Thử thay đổi bộ lọc hoặc thêm khách hàng mới"
          emptyAction={
            canEdit ? (
              <Button
                size="sm"
                className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm khách hàng
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-xl bg-[#E2E8F0]" />
          ))
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-bg-card py-16">
            <p className="text-[length:var(--fs-base)] text-text-secondary">
              Không tìm thấy khách hàng nào
            </p>
            {canEdit && (
              <Button
                size="sm"
                className="cursor-pointer bg-primary text-white hover:bg-primary-dark mt-1"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm khách hàng
              </Button>
            )}
          </div>
        ) : (
          customers.map((c) => {
            const typeBadge = getCustomerTypeBadge(c.customerType);
            const activeBadge = getCustomerActiveBadge(c.isActive);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className="cursor-pointer rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-2.5 hover:border-primary hover:shadow-sm transition-all active:bg-bg-page"
              >
                {/* Row 1: avatar + name + badges */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      c.customerType === "business" ? "bg-[#FFF7ED]" : "bg-[#EEF2FF]"
                    }`}
                  >
                    {c.customerType === "business" ? (
                      <Building2 className="h-5 w-5 text-[#C2410C]" />
                    ) : (
                      <User className="h-5 w-5 text-[#4F46E5]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[length:var(--fs-base)] text-text-primary truncate">
                      {c.displayName}
                    </p>
                    {c.shortName && (
                      <p className="text-[length:var(--fs-xs)] text-text-secondary">
                        {c.shortName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge.className}`}
                    >
                      {typeBadge.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${activeBadge.className}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${c.isActive ? "bg-success" : "bg-text-secondary"}`}
                      />
                      {activeBadge.label}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Row 2: phone + email */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-sm)] text-text-secondary">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span className="truncate">{c.email}</span>}
                  {!c.phone && !c.email && (
                    <span className="text-text-disabled">Chưa có liên hệ</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination mobile */}
        {!isLoading && meta && (
          <Pagination
            pageIndex={pagination.pageIndex}
            totalPages={meta.totalPages}
            onPageChange={(pageIndex) => setPagination((p) => ({ ...p, pageIndex }))}
            pageSize={pagination.pageSize}
            onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
          />
        )}
      </div>
      </div>

      <CreateCustomerDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
