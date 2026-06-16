import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  Pencil,
  Plus,
  Star,
  EyeOff,
  Landmark,
  X,
} from "lucide-react";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDateTime } from "@/utils/format";
import {
  getCompanySettings,
  updateCompanySettings,
  createBankAccount,
  updateBankAccount,
} from "@/api/company.api";
import { uploadDocument } from "@/api/documents.api";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { FileUpload } from "@/components/shared/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetFullscreenHeader,
  MobileSheetBody,
} from "@/components/shared/MobileSheet";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogoDocument {
  id: number;
  fileName: string;
  sasUrl: string;
  sasExpiresAt: string | null;
}

interface BankAccount {
  id: number;
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
  bankBranch: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface CompanySettings {
  fullName: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  legalRepresentative: string | null;
  representativeTitle: string | null;
  vatRate: number;
  logo: LogoDocument | null;
  bankAccounts: BankAccount[];
  updatedAt: string;
  updatedBy: { id: number; fullName: string } | null;
}

interface CompanySettingsResponse {
  data: CompanySettings[];
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const companySchema = z.object({
  fullName: z.string().min(1, "Bắt buộc").max(300),
  taxCode: z.string().min(1, "Bắt buộc").max(20),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  legalRepresentative: z.string().max(150).optional(),
  representativeTitle: z.string().max(100).optional(),
  vatRate: z.number({ message: "Phải là số" }).min(0).max(100),
});
type CompanyForm = z.infer<typeof companySchema>;

const bankSchema = z.object({
  bankAccountNumber: z.string().min(6, "Tối thiểu 6 ký tự").max(50),
  bankAccountName: z.string().min(1, "Bắt buộc").max(200),
  bankName: z.string().min(1, "Bắt buộc").max(200),
  bankBranch: z.string().max(300).optional(),
  isDefault: z.boolean().optional(),
});
type BankForm = z.infer<typeof bankSchema>;

// ─── BankAccountDialog ────────────────────────────────────────────────────────

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: BankAccount | null;
  onSubmit: (data: BankForm) => void;
  isPending: boolean;
}

function BankAccountDialogContent({
  editItem,
  onSubmit,
  isPending,
  onClose,
}: {
  editItem?: BankAccount | null;
  onSubmit: (data: BankForm) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BankForm>({
    resolver: zodResolver(bankSchema),
    defaultValues: editItem
      ? {
          bankAccountNumber: editItem.bankAccountNumber,
          bankAccountName: editItem.bankAccountName,
          bankName: editItem.bankName,
          bankBranch: editItem.bankBranch ?? "",
          isDefault: editItem.isDefault,
        }
      : { isDefault: false },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Số tài khoản *</Label>
          <Input {...register("bankAccountNumber")} placeholder="110003009000" />
          {errors.bankAccountNumber && (
            <p className="text-[length:var(--fs-body)] text-red-500">
              {errors.bankAccountNumber.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Tên tài khoản *</Label>
          <Input {...register("bankAccountName")} placeholder="CT TNHH TMDV VAN TAI TTS" />
          {errors.bankAccountName && (
            <p className="text-[length:var(--fs-body)] text-red-500">
              {errors.bankAccountName.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Ngân hàng *</Label>
          <Input {...register("bankName")} placeholder="Vietinbank" />
          {errors.bankName && (
            <p className="text-[length:var(--fs-body)] text-red-500">
              {errors.bankName.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Chi nhánh</Label>
          <Input {...register("bankBranch")} placeholder="CN KCN Biên Hòa" />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" {...register("isDefault")} className="h-4 w-4" />
        <span className="text-[length:var(--fs-body)] text-[#4A5568]">
          Đặt làm tài khoản mặc định
        </span>
      </label>

      <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="cursor-pointer bg-[#1A5FAB] hover:bg-[#15499A]"
        >
          {editItem ? "Lưu thay đổi" : "Thêm tài khoản"}
        </Button>
      </div>
    </form>
  );
}

function BankAccountDialog({
  open,
  onOpenChange,
  editItem,
  onSubmit,
  isPending,
}: BankAccountDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const title = editItem ? "Chỉnh sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng";

  const content = (
    <BankAccountDialogContent
      editItem={editItem}
      onSubmit={onSubmit}
      isPending={isPending}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent mobileVariant="fullscreen" title={title}>
        <MobileSheetFullscreenHeader title={title} />
        <MobileSheetBody>{content}</MobileSheetBody>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── BankAccountCard ──────────────────────────────────────────────────────────

interface BankAccountCardProps {
  account: BankAccount;
  onEdit: () => void;
  onSetDefault: () => void;
  onDeactivate: () => void;
  canEdit: boolean;
}

function BankAccountCard({
  account,
  onEdit,
  onSetDefault,
  onDeactivate,
  canEdit,
}: BankAccountCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        account.isDefault
          ? "border-[#1A5FAB] bg-[#EFF6FF]"
          : "border-[#E2E8F0] bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            account.isDefault ? "bg-[#1A5FAB]" : "bg-[#F4F6F8]",
          )}
        >
          <Landmark
            size={18}
            className={account.isDefault ? "text-white" : "text-[#718096]"}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
              {account.bankAccountNumber}
            </span>
            {account.isDefault && (
              <Badge className="bg-[#1A5FAB] text-[length:var(--fs-xs)] text-white hover:bg-[#1A5FAB]">
                Mặc định
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[length:var(--fs-body)] text-[#4A5568]">
            {account.bankAccountName}
          </p>
          <p className="text-[length:var(--fs-body)] text-[#718096]">
            {account.bankName}
            {account.bankBranch ? ` — ${account.bankBranch}` : ""}
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              title="Chỉnh sửa"
              className="cursor-pointer rounded p-1.5 text-[#718096] hover:bg-[#F4F6F8] hover:text-[#1A5FAB]"
            >
              <Pencil size={15} />
            </button>
            {!account.isDefault && (
              <button
                type="button"
                onClick={onSetDefault}
                title="Đặt làm mặc định"
                className="cursor-pointer rounded p-1.5 text-[#718096] hover:bg-[#F4F6F8] hover:text-amber-500"
              >
                <Star size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onDeactivate}
              title="Ẩn tài khoản"
              className="cursor-pointer rounded p-1.5 text-[#718096] hover:bg-red-50 hover:text-red-500"
            >
              <EyeOff size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("company.update");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // Bank account dialog state
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  // Confirm modals
  const [deactivateTarget, setDeactivateTarget] = useState<BankAccount | null>(null);
  const [defaultTarget, setDefaultTarget] = useState<BankAccount | null>(null);

  const { data: settings } = useQuery<CompanySettingsResponse, unknown, CompanySettings>({
    queryKey: QUERY_KEYS.companySettings,
    queryFn: getCompanySettings,
    select: (r) => r.data[0],
  });

  // Company info form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    values: settings
      ? {
          fullName: settings.fullName,
          taxCode: settings.taxCode ?? "",
          address: settings.address ?? "",
          phone: settings.phone ?? "",
          email: settings.email ?? "",
          legalRepresentative: settings.legalRepresentative ?? "",
          representativeTitle: settings.representativeTitle ?? "",
          vatRate: settings.vatRate,
        }
      : undefined,
  });

  const { mutate: saveCompany, isPending: isSavingCompany } = useMutation({
    mutationFn: async (form: CompanyForm) => {
      let logoDocumentId: number | undefined;
      // Upload logo trước (nếu có) → lấy documentId
      if (logoFile) {
        const doc = await uploadDocument({ file: logoFile, doc_type: "logo" });
        logoDocumentId = doc.id;
      }
      await updateCompanySettings({ ...form, logoDocumentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.companySettings });
      toast.success("Đã cập nhật thông tin công ty");
      setIsEditingInfo(false);
      setLogoFile(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // Bank: create / update
  const { mutate: saveBank, isPending: isSavingBank } = useMutation({
    mutationFn: (body: BankForm) =>
      editingBank
        ? updateBankAccount(editingBank.id, body)
        : createBankAccount(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.companySettings });
      toast.success(editingBank ? "Đã cập nhật tài khoản" : "Đã thêm tài khoản");
      setBankDialogOpen(false);
      setEditingBank(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // Bank: set default
  const { mutate: setDefault, isPending: isSettingDefault } = useMutation({
    mutationFn: (id: number) => updateBankAccount(id, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.companySettings });
      toast.success("Đã đặt tài khoản mặc định");
      setDefaultTarget(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // Bank: deactivate
  const { mutate: deactivateBank, isPending: isDeactivating } = useMutation({
    mutationFn: (id: number) => updateBankAccount(id, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.companySettings });
      toast.success("Đã ẩn tài khoản");
      setDeactivateTarget(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  const bankAccounts = settings?.bankAccounts ?? [];

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader title="Cài đặt công ty" />

      {/* ── Phần A: Thông tin công ty ── */}
      <section className="rounded-lg border border-[#E2E8F0] bg-white">
        {/* Section header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-[var(--sp-card)] py-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#1A5FAB]" />
            <h2 className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
              Thông tin công ty
            </h2>
          </div>
          {canEdit && !isEditingInfo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingInfo(true)}
              className="cursor-pointer gap-1.5"
            >
              <Pencil size={14} />
              Chỉnh sửa
            </Button>
          )}
          {isEditingInfo && (
            <button
              type="button"
              onClick={() => {
                setIsEditingInfo(false);
                reset();
                setLogoFile(null);
              }}
              className="cursor-pointer rounded p-1.5 text-[#718096] hover:text-[#E74C3C]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-[var(--sp-card)]">
          {isEditingInfo ? (
            <form
              onSubmit={handleSubmit((data) => saveCompany(data))}
              className="flex flex-col gap-5"
            >
              {/* Logo upload */}
              <div className="flex flex-col gap-1.5">
                <Label>Logo công ty</Label>
                {settings?.logo && !logoFile && (
                  <div className="mb-2 flex items-center gap-3">
                    <img
                      src={settings.logo.sasUrl}
                      alt="Logo"
                      className="h-14 w-auto rounded border border-[#E2E8F0] object-contain"
                    />
                    <span className="text-[length:var(--fs-body)] text-[#718096]">
                      {settings.logo.fileName}
                    </span>
                  </div>
                )}
                <FileUpload
                  value={logoFile}
                  onChange={setLogoFile}
                  label="Chọn logo (PNG, JPEG)"
                />
              </div>

              {/* Fields grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Tên công ty *</Label>
                  <Input {...register("fullName")} />
                  {errors.fullName && (
                    <p className="text-[length:var(--fs-body)] text-red-500">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Mã số thuế *</Label>
                  <Input {...register("taxCode")} />
                  {errors.taxCode && (
                    <p className="text-[length:var(--fs-body)] text-red-500">
                      {errors.taxCode.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>VAT (%)</Label>
                  <Input {...register("vatRate", { valueAsNumber: true })} type="number" step="any" min="0" max="100" />
                  {errors.vatRate && (
                    <p className="text-[length:var(--fs-body)] text-red-500">
                      {errors.vatRate.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Địa chỉ</Label>
                  <Input {...register("address")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Số điện thoại</Label>
                  <Input {...register("phone")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input {...register("email")} type="email" />
                  {errors.email && (
                    <p className="text-[length:var(--fs-body)] text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Người đại diện pháp luật</Label>
                  <Input {...register("legalRepresentative")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Chức vụ</Label>
                  <Input {...register("representativeTitle")} />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingInfo(false);
                    reset();
                    setLogoFile(null);
                  }}
                  className="cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={(!isDirty && !logoFile) || isSavingCompany}
                  className="cursor-pointer bg-[#1A5FAB] hover:bg-[#15499A]"
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : (
            // View mode
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {settings?.logo && (
                <div className="sm:col-span-2">
                  <img
                    src={settings.logo.sasUrl}
                    alt="Logo công ty"
                    className="h-16 w-auto rounded border border-[#E2E8F0] object-contain"
                  />
                </div>
              )}
              <InfoRow label="Tên công ty" value={settings?.fullName} span={2} />
              <InfoRow label="Mã số thuế" value={settings?.taxCode ?? undefined} />
              <InfoRow label="VAT" value={settings?.vatRate != null ? `${settings.vatRate}%` : undefined} />
              <InfoRow label="Địa chỉ" value={settings?.address ?? undefined} span={2} />
              <InfoRow label="Số điện thoại" value={settings?.phone ?? undefined} />
              <InfoRow label="Email" value={settings?.email ?? undefined} />
              <InfoRow label="Người đại diện pháp luật" value={settings?.legalRepresentative ?? undefined} />
              <InfoRow label="Chức vụ" value={settings?.representativeTitle ?? undefined} />
              {settings?.updatedBy && (
                <div className="sm:col-span-2 border-t border-[#F4F6F8] pt-3">
                  <p className="text-[length:var(--fs-body)] text-[#718096]">
                    Cập nhật lần cuối bởi{" "}
                    <span className="font-medium text-[#4A5568]">
                      {settings.updatedBy.fullName}
                    </span>{" "}
                    lúc {formatDateTime(settings.updatedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Phần B: Tài khoản ngân hàng ── */}
      <section className="rounded-lg border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-[var(--sp-card)] py-4">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-[#1A5FAB]" />
            <h2 className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
              Tài khoản ngân hàng
            </h2>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditingBank(null);
                setBankDialogOpen(true);
              }}
              className="cursor-pointer gap-1.5 bg-[#1A5FAB] hover:bg-[#15499A]"
            >
              <Plus size={14} />
              Thêm tài khoản
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 p-[var(--sp-card)]">
          {bankAccounts.length === 0 ? (
            <p className="py-8 text-center text-[length:var(--fs-body)] text-[#718096]">
              Chưa có tài khoản ngân hàng
            </p>
          ) : (
            bankAccounts.map((acc) => (
              <BankAccountCard
                key={acc.id}
                account={acc}
                canEdit={canEdit}
                onEdit={() => {
                  setEditingBank(acc);
                  setBankDialogOpen(true);
                }}
                onSetDefault={() => setDefaultTarget(acc)}
                onDeactivate={() => setDeactivateTarget(acc)}
              />
            ))
          )}
        </div>
      </section>

      {/* Bank dialog */}
      <BankAccountDialog
        open={bankDialogOpen}
        onOpenChange={(open) => {
          setBankDialogOpen(open);
          if (!open) setEditingBank(null);
        }}
        editItem={editingBank}
        onSubmit={(data) => saveBank(data)}
        isPending={isSavingBank}
      />

      {/* Confirm set default */}
      <ConfirmModal
        open={!!defaultTarget}
        onOpenChange={(open) => !open && setDefaultTarget(null)}
        title="Đặt làm tài khoản mặc định"
        description={`Đặt tài khoản ${defaultTarget?.bankAccountNumber} (${defaultTarget?.bankName}) làm mặc định? Tài khoản mặc định hiện tại sẽ bị hủy.`}
        confirmLabel="Xác nhận"
        variant="primary"
        loading={isSettingDefault}
        onConfirm={() => defaultTarget && setDefault(defaultTarget.id)}
      />

      {/* Confirm deactivate */}
      <ConfirmModal
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Ẩn tài khoản ngân hàng"
        description={`Ẩn tài khoản ${deactivateTarget?.bankAccountNumber} (${deactivateTarget?.bankName})? Tài khoản sẽ không còn hiển thị trong hệ thống.${deactivateTarget?.isDefault ? " Lưu ý: đây là tài khoản mặc định — bạn cần chọn tài khoản mặc định mới sau khi ẩn." : ""}`}
        confirmLabel="Ẩn tài khoản"
        variant="danger"
        loading={isDeactivating}
        onConfirm={() => deactivateTarget && deactivateBank(deactivateTarget.id)}
      />
    </div>
  );
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  span,
}: {
  label: string;
  value?: string | number;
  span?: number;
}) {
  return (
    <div className={cn(span === 2 && "sm:col-span-2")}>
      <p className="text-[length:var(--fs-body)] text-[#718096]">{label}</p>
      <p className="mt-0.5 text-[length:var(--fs-body)] font-medium text-[#2D3748]">
        {value ?? "—"}
      </p>
    </div>
  );
}
