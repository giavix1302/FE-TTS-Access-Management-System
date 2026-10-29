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
  Plus,
  Trash2,
  Users,
  Search,
  Check,
} from "lucide-react";
import {
  getCustomerById,
  getCustomerContracts,
  updateIndividualCustomer,
  updateBusinessCustomer,
  activateCustomer,
  deactivateCustomer,
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
  getContacts,
  getContactById,
  linkCustomerContact,
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
import { useDebounce } from "@/hooks/useDebounce";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDate, formatDateTime, formatCurrency } from "@/utils/format";
import { getApiError, getApiErrorMessage } from "@/utils/apiError";
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
  CustomerContact,
  ContactListItem,
} from "@/types/customer.types";
import { isValidPhone, PHONE_INPUT_PATTERN, PHONE_VALIDATION_MESSAGE } from "@/utils/phone";

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const individualEditSchema = z.object({
  fullName: z.string().trim().min(1, "Bắt buộc").max(200),
  phone: z.string().refine((value) => isValidPhone(value, true), PHONE_VALIDATION_MESSAGE),
  email: z.string().email("Không hợp lệ").max(200).or(z.literal("")).optional(),
  nationalId: z.string().regex(/^\d{12}$/, "Phải là 12 số"),
  nationalIdIssueDate: z.string().max(20).optional(),
  nationalIdIssuePlace: z.string().max(300).optional(),
  dateOfBirth: z.string().max(20).optional(),
  gender: z.enum(["male", "female", "other"]).or(z.literal("")).optional(),
  nationality: z.string().max(100).optional(),
  hometown: z.string().max(300).optional(),
  permanentAddress: z.string().max(500).optional(),
});

const businessEditSchema = z.object({
  internationalName: z.string().trim().min(1, "Bắt buộc").max(300),
  shortName: z
    .string()
    .min(1, "Bắt buộc")
    .max(50)
    .regex(/^[A-Z0-9]+$/, "Chỉ chữ in hoa A–Z và số 0–9"),
  taxCode: z.string().regex(/^\d{10}(\d{3})?$/, "Phải là 10 hoặc 13 số"),
  taxAddress: z.string().max(500).optional(),
  officeAddress: z.string().max(500).optional(),
  representative: z.string().max(200).optional(),
  representativeTitle: z.string().max(100).optional(),
  phone: z.string().refine((value) => isValidPhone(value, false), PHONE_VALIDATION_MESSAGE).optional(),
  email: z.string().email("Không hợp lệ").max(200).or(z.literal("")).optional(),
});

const contactSchema = z
  .object({
    fullName: z.string().trim().min(1, "Bắt buộc").max(200, "Tối đa 200 ký tự"),
    phone: z.string().refine((value) => isValidPhone(value, false), PHONE_VALIDATION_MESSAGE),
    email: z.string().email("Email không hợp lệ").max(200).or(z.literal("")),
    title: z.string().max(100, "Tối đa 100 ký tự"),
  })
  .refine((data) => Boolean(data.phone.trim() || data.email.trim()), {
    message: "Cần ít nhất số điện thoại hoặc email",
    path: ["phone"],
  });

type IndividualEditForm = z.infer<typeof individualEditSchema>;
type BusinessEditForm = z.infer<typeof businessEditSchema>;
type ContactForm = z.infer<typeof contactSchema>;

const GENDER_LABELS: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

const fieldClass =
  "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
const errClass = "text-xs text-error mt-0.5";

const toDatePickerValue = (value?: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

const toBackendDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const formatCustomerDate = (value?: string) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(value ?? "") ? value! : formatDate(value);

// ─── InfoRow helper ───────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[length:var(--fs-sm)] text-text-secondary">{label}</p>
      <p className="mt-0.5 text-[length:var(--fs-base)] font-medium text-text-primary">
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
    setError,
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
    mutationFn: (body: IndividualEditForm) => {
      const { gender, ...rest } = body;
      return updateIndividualCustomer(customer.id, {
        ...rest,
        ...(gender ? { gender } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customer.id),
      });
      toast.success("Đã cập nhật thông tin");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const apiError = getApiError(error);
      apiError.details?.forEach(({ field, message }) =>
        setError(field as keyof IndividualEditForm, {
          type: "server",
          message,
        }),
      );
      if (apiError.code === "CCCD_ALREADY_EXISTS") {
        setError("nationalId", {
          type: "server",
          message: apiError.message ?? "CCCD đã tồn tại",
        });
      }
      if (apiError.code === "PHONE_ALREADY_EXISTS") {
        setError("phone", {
          type: "server",
          message: apiError.message ?? "Số điện thoại đã được sử dụng",
        });
      }
      if (
        apiError.code === "CONTACT_PHONE_OR_EMAIL_EXISTS" &&
        !apiError.details?.length
      ) {
        const message = apiError.message ?? "Số điện thoại hoặc email đã được sử dụng";
        setError("phone", { type: "server", message });
        setError("email", { type: "server", message });
      }
      toast.error(getApiErrorMessage(error));
    },
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
        {errors.fullName && (
          <p className={errClass}>{errors.fullName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Điện thoại <span className="text-error">*</span>
          </Label>
          <input {...register("phone")} inputMode="tel" pattern={PHONE_INPUT_PATTERN} className={`${fieldClass} mt-1`} />
          {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Email
          </Label>
          <input {...register("email")} className={`${fieldClass} mt-1`} />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Số CCCD <span className="text-error">*</span>
        </Label>
        <input
          {...register("nationalId")}
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
          <select {...register("gender")} className={`${fieldClass} mt-1`}>
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
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Quê quán
        </Label>
        <input {...register("hometown")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ thường trú
        </Label>
        <input
          {...register("permanentAddress")}
          className={`${fieldClass} mt-1`}
        />
      </div>
    </form>
  );

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer"
        onClick={handleClose}
      >
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
          <div className="max-h-[60vh] overflow-y-auto pr-1 py-1">
            {formContent}
          </div>
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent
        mobileVariant="fullscreen"
        title="Chỉnh sửa khách hàng"
      >
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
    setError,
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
      representativeTitle: customer.representativeTitle ?? "",
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
    onError: (error: unknown) => {
      const apiError = getApiError(error);
      apiError.details?.forEach(({ field, message }) =>
        setError(field as keyof BusinessEditForm, { type: "server", message }),
      );
      const duplicateField = {
        TAX_CODE_ALREADY_EXISTS: "taxCode",
        SHORT_NAME_ALREADY_EXISTS: "shortName",
      }[apiError.code ?? ""] as keyof BusinessEditForm | undefined;
      if (duplicateField) {
        setError(duplicateField, {
          type: "server",
          message: apiError.message ?? "Giá trị đã tồn tại",
        });
      }
      if (apiError.code === "PHONE_ALREADY_EXISTS") {
        setError("phone", {
          type: "server",
          message: apiError.message ?? "Số điện thoại đã được sử dụng",
        });
      }
      if (
        apiError.code === "CONTACT_PHONE_OR_EMAIL_EXISTS" &&
        !apiError.details?.length
      ) {
        const message = apiError.message ?? "Số điện thoại hoặc email đã được sử dụng";
        setError("phone", { type: "server", message });
        setError("email", { type: "server", message });
      }
      toast.error(getApiErrorMessage(error));
    },
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
        <input
          {...register("internationalName")}
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
          <input {...register("taxCode")} className={`${fieldClass} mt-1`} />
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
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Chức vụ người đại diện
        </Label>
        <input
          {...register("representativeTitle")}
          className={`${fieldClass} mt-1`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Điện thoại
          </Label>
          <input {...register("phone")} inputMode="tel" pattern={PHONE_INPUT_PATTERN} className={`${fieldClass} mt-1`} />
          {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Email
          </Label>
          <input {...register("email")} className={`${fieldClass} mt-1`} />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ đăng ký thuế
        </Label>
        <input {...register("taxAddress")} className={`${fieldClass} mt-1`} />
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Địa chỉ văn phòng
        </Label>
        <input
          {...register("officeAddress")}
          className={`${fieldClass} mt-1`}
        />
      </div>
    </form>
  );

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer"
        onClick={handleClose}
      >
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
          <div className="max-h-[60vh] overflow-y-auto pr-1 py-1">
            {formContent}
          </div>
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent
        mobileVariant="fullscreen"
        title="Chỉnh sửa doanh nghiệp"
      >
        <MobileSheetHeader>
          <MobileSheetTitle>
            Chỉnh sửa — {customer.internationalName}
          </MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actionButtons}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── ContactDialog ────────────────────────────────────────────────────────────
function ContactDialog({
  open,
  onOpenChange,
  customerId,
  contact,
  canViewCustomers,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customerId: number;
  contact?: CustomerContact;
  canViewCustomers: boolean;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const { data: contactDetailResponse } = useQuery({
    queryKey: contact ? QUERY_KEYS.contacts.detail(contact.id) : ["contacts", "none"],
    queryFn: () => getContactById(contact!.id),
    enabled: Boolean(contact) && canViewCustomers,
  });
  const linkedCustomerCount = contactDetailResponse?.data.customers?.length ?? 0;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: contact?.fullName ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      title: contact?.title ?? "",
    },
  });
  const [conflictContactId, setConflictContactId] = useState<number>();

  const mutation = useMutation({
    mutationFn: (body: ContactForm) => {
      const normalized = {
        fullName: body.fullName.trim(),
        phone: body.phone.trim(),
        email: body.email.trim(),
        title: body.title.trim(),
      };
      return contact
        ? updateCustomerContact(customerId, contact.id, normalized)
        : createCustomerContact(customerId, {
            fullName: normalized.fullName,
            phone: normalized.phone || undefined,
            email: normalized.email || undefined,
            title: normalized.title || undefined,
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.contacts(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.history(customerId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all });
      if (contact) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.all });
      }
      toast.success(
        contact ? "Đã cập nhật người liên hệ" : "Đã thêm người liên hệ",
      );
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const apiError = getApiError(error);
      const duplicateContactId = apiError.details?.find((detail) => detail.contactId)?.contactId;
      setConflictContactId(duplicateContactId);
      apiError.details?.forEach(({ field, message }) =>
        setError(field as keyof ContactForm, { type: "server", message }),
      );
      if (
        apiError.code === "CONTACT_PHONE_OR_EMAIL_EXISTS" &&
        !apiError.details?.length
      ) {
        const message = apiError.message ?? "Số điện thoại hoặc email đã được sử dụng";
        setError("phone", { type: "server", message });
        setError("email", { type: "server", message });
      }
      toast.error(getApiErrorMessage(error));
    },
  });

  const linkExistingMutation = useMutation({
    mutationFn: () =>
      linkCustomerContact(customerId, {
        contactId: conflictContactId!,
        title: getValues("title").trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.detail(customerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.contacts(customerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all });
      toast.success("Đã gắn người liên hệ có sẵn vào khách hàng");
      onOpenChange(false);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error)),
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const formContent = (
    <form
      id="contact-form"
      onSubmit={handleSubmit((body) => mutation.mutate(body))}
      className="space-y-3"
    >
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Họ và tên <span className="text-error">*</span>
        </Label>
        <input {...register("fullName")} className={`${fieldClass} mt-1`} />
        {errors.fullName && (
          <p className={errClass}>{errors.fullName.message}</p>
        )}
      </div>
      {contact && linkedCustomerCount > 1 && (
        <div className="rounded-md border border-warning/30 bg-warning-light px-3 py-2 text-xs text-text-primary">
          Thay đổi họ tên, số điện thoại hoặc email sẽ áp dụng cho {linkedCustomerCount} khách hàng.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Điện thoại
          </Label>
          <input
            {...register("phone")}
            placeholder="0901234567"
            inputMode="tel"
            pattern={PHONE_INPUT_PATTERN}
            className={`${fieldClass} mt-1`}
          />
          {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Email
          </Label>
          <input
            {...register("email")}
            placeholder="contact@company.vn"
            className={`${fieldClass} mt-1`}
          />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Cần ít nhất số điện thoại hoặc email.
      </p>
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Chức vụ
        </Label>
        <input
          {...register("title")}
          placeholder="Kế toán"
          className={`${fieldClass} mt-1`}
        />
        {errors.title && <p className={errClass}>{errors.title.message}</p>}
      </div>
      {!contact && conflictContactId && (
        <div className="rounded-md border border-info/30 bg-info-light px-3 py-2 text-xs text-text-primary">
          Người có số điện thoại hoặc email này đã tồn tại. Bạn có thể gắn người đó vào khách hàng hiện tại.
          <Button
            type="button"
            variant="link"
            disabled={linkExistingMutation.isPending}
            onClick={() => linkExistingMutation.mutate()}
            className="ml-1 h-auto p-0 text-xs text-primary"
          >
            {linkExistingMutation.isPending ? "Đang gắn..." : "Gắn người có sẵn"}
          </Button>
        </div>
      )}
    </form>
  );

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer"
        onClick={handleClose}
      >
        Hủy
      </Button>
      <Button
        type="submit"
        form="contact-form"
        disabled={mutation.isPending}
        className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
      >
        {mutation.isPending
          ? "Đang lưu..."
          : contact
            ? "Lưu thay đổi"
            : "Thêm người liên hệ"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {contact ? "Chỉnh sửa người liên hệ" : "Thêm người liên hệ"}
            </DialogTitle>
          </DialogHeader>
          {formContent}
          <Separator />
          <DialogFooter>{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Người liên hệ">
        <MobileSheetHeader>
          <MobileSheetTitle>
            {contact ? "Chỉnh sửa người liên hệ" : "Thêm người liên hệ"}
          </MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actions}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

function LinkContactDialog({
  open,
  onOpenChange,
  customerId,
  linkedContactIds,
  canLink,
  canCreate,
  onCreateNew,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customerId: number;
  linkedContactIds: number[];
  canLink: boolean;
  canCreate: boolean;
  onCreateNew: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactListItem>();
  const [title, setTitle] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { data, isFetching } = useQuery({
    queryKey: [...QUERY_KEYS.contacts.all, { search: debouncedSearch }],
    queryFn: () => getContacts({ search: debouncedSearch.trim() || undefined, page: 1, page_size: 10 }),
    enabled: open,
  });
  const matches = (data?.data ?? []).filter((item) => !linkedContactIds.includes(item.id));

  const mutation = useMutation({
    mutationFn: () => linkCustomerContact(customerId, { contactId: selected!.id, title: title.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.detail(customerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.contacts(customerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.history(customerId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all });
      toast.success("Đã gắn người liên hệ vào khách hàng");
      close();
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error)),
  });

  const close = () => {
    setSearch("");
    setSelected(undefined);
    setTitle("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="pr-6">
            <DialogTitle>Danh sách người liên hệ</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-text-secondary">Tìm người liên hệ</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(undefined); }} placeholder="Tên, số điện thoại hoặc email" className={`${fieldClass} pl-9`} />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {isFetching ? <p className="p-4 text-center text-sm text-text-secondary">Đang tải…</p> : matches.length === 0 ? <p className="p-4 text-center text-sm text-text-secondary">Không có người phù hợp hoặc đã được gắn.</p> : matches.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelected(item)} className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 transition-colors ${selected?.id === item.id ? "bg-primary-light" : "hover:bg-bg-page"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected?.id === item.id ? "bg-primary text-white" : "bg-[#EEF2FF] text-[#4F46E5]"}`}><User size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">{item.fullName}</span>
                    <span className="mt-0.5 block truncate text-xs text-text-secondary">{item.phone ?? "Chưa có SĐT"} · {item.email ?? "Chưa có email"}</span>
                  </span>
                  {selected?.id === item.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
          </div>
          {selected && (
            <div>
              <Label className="text-xs font-medium text-text-secondary">Chức danh tại khách hàng này</Label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Kế toán" className={`${fieldClass} mt-1`} />
            </div>
          )}
        </div>
        <Separator />
        <DialogFooter>
          {canCreate && (
            <Button
              type="button"
              variant="outline"
              className="mr-auto cursor-pointer gap-1.5"
              onClick={() => {
                close();
                onCreateNew();
              }}
            >
              <Plus size={14} /> Thêm liên hệ mới
            </Button>
          )}
          <Button type="button" variant="outline" onClick={close} className="cursor-pointer">Hủy</Button>
          <Button type="button" disabled={!canLink || !selected || mutation.isPending} onClick={() => mutation.mutate()} className="cursor-pointer bg-primary text-white hover:bg-primary-dark">{mutation.isPending ? "Đang gắn..." : "Gắn liên hệ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CustomerDetailPage ───────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canView = hasPermission("customers.view");
  const canEdit = hasPermission("customers.update");
  const canToggle = hasPermission("customers.delete");
  const canViewContracts = hasPermission("contracts.view");
  const canViewContacts = hasPermission("contacts.view");
  const canCreateContacts = hasPermission("contacts.create");
  const canUpdateContacts = hasPermission("contacts.update");

  const customerId = Number(id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [contactOpen, setContactOpen] = useState(false);
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact>();
  const [deleteContactTarget, setDeleteContactTarget] =
    useState<CustomerContact>();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: customerResponse, isLoading } = useQuery({
    queryKey: QUERY_KEYS.customers.detail(customerId),
    queryFn: () => getCustomerById(customerId),
    enabled: !!customerId && canView,
  });

  const customer = customerResponse?.data;

  const { data: contractsResponse, isLoading: contractsLoading } = useQuery({
    queryKey: QUERY_KEYS.customers.contracts(customerId),
    queryFn: () => getCustomerContracts(customerId),
    enabled: !!customerId && canViewContracts,
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
        customer?.isActive
          ? "Đã vô hiệu hóa khách hàng"
          : "Đã kích hoạt khách hàng",
      );
      setConfirmToggle(false);
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { data?: { error?: { code?: string } } };
      };
      if (
        axiosError.response?.data?.error?.code ===
        "CUSTOMER_HAS_ACTIVE_CONTRACTS"
      ) {
        toast.error(
          "Không thể vô hiệu hóa: khách hàng đang có hợp đồng active",
        );
        if (canViewContracts) setActiveTab("contracts");
      } else {
        toast.error("Có lỗi xảy ra");
      }
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      deleteCustomerContact(customerId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.contacts(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.history(customerId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all });
      toast.success("Đã gỡ người liên hệ");
      setDeleteContactTarget(undefined);
    },
    onError: (error: unknown) => {
      if (getApiError(error).code === "CONTACT_NOT_FOUND") {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.customers.detail(customerId),
        });
      }
      toast.error(getApiErrorMessage(error));
    },
  });

  const setPrimaryContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      updateCustomerContact(customerId, contactId, { isPrimary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.detail(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.contacts(customerId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.customers.history(customerId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all });
      toast.success("Đã đặt người liên hệ chính");
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error)),
  });

  // ── Contract table columns ────────────────────────────────────────────────
  const contractColumns: ColumnDef<CustomerContractItem>[] = [
    {
      id: "contractNumber",
      header: "Số hợp đồng",
      cell: ({ row }) => (
        <p className="font-mono font-semibold text-text-primary text-[length:var(--fs-sm)]">
          {row.original.contractNumber ?? "—"}
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
        const { label, className } = getContractStatusBadge(
          row.original.status,
        );
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
  const contacts = customer.contacts ?? [];

  const typeBadge = getCustomerTypeBadge(customer.customerType);
  const activeBadge = getCustomerActiveBadge(customer.isActive);
  const displayName = isIndividual ? ind!.fullName : biz!.internationalName;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Back button */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary hover:bg-primary-light transition-colors w-fit cursor-pointer px-3 py-1.5 rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách khách hàng
      </button>

      {!customer.isActive && (
        <div className="rounded-lg border border-warning/30 bg-warning-light px-4 py-3 text-sm text-text-primary">
          Khách hàng này đang bị vô hiệu hóa và không thể dùng để tạo hợp đồng
          mới.
        </div>
      )}

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                  <span className="rounded bg-bg-page px-1.5 py-0.5 font-mono text-[length:var(--fs-sm)] text-text-secondary">
                    {biz.shortName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${typeBadge.className}`}
                >
                  {typeBadge.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${activeBadge.className}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${customer.isActive ? "bg-success" : "bg-text-secondary"}`}
                  />
                  {activeBadge.label}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1 text-[length:var(--fs-sm)] text-text-secondary">
                    <Phone size={11} />
                    {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1 text-[length:var(--fs-sm)] text-text-secondary">
                    <Mail size={11} />
                    {customer.email}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-sm)] text-text-secondary">
                <span>
                  Ngày tạo:{" "}
                  <span className="font-medium text-text-primary">
                    {formatDateTime(customer.createdAt)}
                  </span>
                </span>
                <span>
                  Cập nhật lần cuối:{" "}
                  <span className="font-medium text-text-primary">
                    {formatDateTime(customer.updatedAt)}
                  </span>
                </span>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1 overflow-x-auto">
          {[
            { value: "info", label: "Thông tin" },
            ...(canViewContracts
              ? [
                  {
                    value: "contracts",
                    label: "Lịch sử hợp đồng",
                    count: contracts.length || undefined,
                  },
                ]
              : []),
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
        <TabsContent value="info" className="mt-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            <div className="h-full rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-5">
              <p className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">
                {isIndividual ? "Thông tin cá nhân" : "Thông tin doanh nghiệp"}
              </p>

              {isIndividual && ind && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  <InfoRow label="Họ và tên" value={ind.fullName} />
                  <InfoRow
                    label="Giới tính"
                    value={ind.gender ? GENDER_LABELS[ind.gender] : undefined}
                  />
                  <InfoRow
                    label="Ngày sinh"
                    value={
                      ind.dateOfBirth
                        ? formatCustomerDate(ind.dateOfBirth)
                        : undefined
                    }
                  />
                  <InfoRow label="Quốc tịch" value={ind.nationality} />
                  <InfoRow label="Số CCCD" value={ind.nationalId} />
                  <InfoRow
                    label="Ngày cấp CCCD"
                    value={
                      ind.nationalIdIssueDate
                        ? formatCustomerDate(ind.nationalIdIssueDate)
                        : undefined
                    }
                  />
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Nơi cấp CCCD"
                      value={ind.nationalIdIssuePlace}
                    />
                  </div>
                </div>
              )}

              {isBusiness && biz && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Tên doanh nghiệp"
                      value={biz.internationalName}
                    />
                  </div>
                  <InfoRow label="Tên viết tắt" value={biz.shortName} />
                  <InfoRow label="Mã số thuế" value={biz.taxCode} />
                  <InfoRow label="Người đại diện" value={biz.representative} />
                  <InfoRow
                    label="Chức vụ người đại diện"
                    value={biz.representativeTitle}
                  />
                </div>
              )}
            </div>

            <div className="h-full rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-5">
              <p className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">
                Liên hệ & Địa chỉ
              </p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                <InfoRow label="Điện thoại" value={customer.phone} />
                <InfoRow label="Email" value={customer.email} />

                {isIndividual && ind && (
                  <>
                    <InfoRow label="Quê quán" value={ind.hometown} />
                    <div className="sm:col-span-2">
                      <InfoRow
                        label="Địa chỉ thường trú"
                        value={ind.permanentAddress}
                      />
                    </div>
                  </>
                )}

                {isBusiness && biz && (
                  <>
                    <div className="sm:col-span-2">
                      <InfoRow
                        label="Địa chỉ đăng ký thuế"
                        value={biz.taxAddress}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <InfoRow
                        label="Địa chỉ văn phòng"
                        value={biz.officeAddress}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {canViewContacts && (
            <div className="h-full rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:col-span-2 lg:p-5">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">
                    Người liên hệ
                  </p>
                  <p className="mt-0.5 text-[length:var(--fs-sm)] text-text-secondary">
                    Người đại diện khách hàng để liên hệ về hợp đồng, thanh
                    toán, thuê xe, v.v.
                  </p>
                </div>
                  {(canCreateContacts || canUpdateContacts) && (
                  <Button
                    size="sm"
                    className="cursor-pointer gap-1.5 bg-primary text-white hover:bg-primary-dark"
                      onClick={() => setLinkContactOpen(true)}
                    >
                    <Plus size={14} /> Thêm liên hệ
                  </Button>
                )}
              </div>

              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Users className="h-9 w-9 text-text-disabled" />
                  <p className="text-[length:var(--fs-base)] text-text-secondary">
                    Chưa có người liên hệ
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-bg-page p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
                            {contact.fullName}
                          </p>
                          {contact.title && (
                            <span className="rounded-full bg-bg-page px-2 py-0.5 text-[length:var(--fs-sm)] text-text-secondary">
                              {contact.title}
                            </span>
                          )}
                          {contact.isPrimary && (
                            <span className="rounded-full bg-primary-light px-2 py-0.5 text-[length:var(--fs-sm)] font-medium text-primary">
                              Liên hệ chính
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-sm)] text-text-secondary">
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={13} />
                              Số điện thoại: {contact.phone}
                            </span>
                          )}
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={13} />
                              Email: {contact.email}
                            </span>
                          )}
                        </div>
                      </div>
                        {canUpdateContacts && (
                        <div className="flex shrink-0 gap-2">
                          {!contact.isPrimary && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 cursor-pointer border-border px-2 text-[length:var(--fs-sm)]"
                              disabled={setPrimaryContactMutation.isPending}
                              onClick={() =>
                                setPrimaryContactMutation.mutate(contact.id)
                              }
                            >
                              Đặt chính
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer border-border"
                            title="Sửa người liên hệ"
                            aria-label={`Sửa người liên hệ ${contact.fullName}`}
                            onClick={() => {
                              setEditingContact(contact);
                              setContactOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer border-error text-error hover:bg-error hover:text-white"
                            title="Gỡ người liên hệ"
                            aria-label={`Gỡ người liên hệ ${contact.fullName}`}
                            onClick={() => setDeleteContactTarget(contact)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 2: Lịch sử hợp đồng ──────────────────────────────────── */}
        {canViewContracts && (
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
                  <div
                    key={i}
                    className="h-[80px] animate-pulse rounded-xl bg-[#E2E8F0]"
                  />
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
                          {c.contractNumber ?? "—"}
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
        )}
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

      {contactOpen && (
        <ContactDialog
          key={editingContact?.id ?? "new"}
          open={contactOpen}
          onOpenChange={(open) => {
            setContactOpen(open);
            if (!open) setEditingContact(undefined);
          }}
          customerId={customerId}
          contact={editingContact}
          canViewCustomers={canView}
        />
      )}

      <LinkContactDialog
        open={linkContactOpen}
        onOpenChange={setLinkContactOpen}
        customerId={customerId}
        linkedContactIds={contacts.map((contact) => contact.id)}
        canLink={canUpdateContacts}
        canCreate={canCreateContacts}
        onCreateNew={() => {
          setEditingContact(undefined);
          setContactOpen(true);
        }}
      />

      {canUpdateContacts && <ConfirmModal
        open={Boolean(deleteContactTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteContactTarget(undefined);
        }}
        title="Gỡ người liên hệ?"
        description={`Người liên hệ "${deleteContactTarget?.fullName ?? ""}" sẽ bị gỡ khỏi khách hàng.`}
        confirmLabel="Gỡ liên hệ"
        variant="danger"
        loading={deleteContactMutation.isPending}
        onConfirm={() => {
          if (deleteContactTarget)
            deleteContactMutation.mutate(deleteContactTarget.id);
        }}
      />}

      {/* ── Confirm toggle ─────────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={
          customer.isActive
            ? "Vô hiệu hóa khách hàng?"
            : "Kích hoạt khách hàng?"
        }
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
