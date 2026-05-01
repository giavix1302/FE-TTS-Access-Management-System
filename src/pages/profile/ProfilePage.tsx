import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, Eye, EyeOff, KeyRound, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { generateInitials } from "@/utils/helpers";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:      "Admin",
  manager:    "Quản lý",
  accountant: "Kế toán",
  staff:      "Nhân viên",
};

const ROLE_COLOR: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-700 hover:bg-purple-100",
  manager:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
  accountant: "bg-green-100 text-green-700 hover:bg-green-100",
  staff:      "bg-gray-100 text-gray-700 hover:bg-gray-100",
};

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const infoSchema = z.object({
  full_name: z.string().min(1, "Bắt buộc").max(150),
  email: z
    .string()
    .email("Email không hợp lệ")
    .or(z.literal(""))
    .optional(),
});
type InfoForm = z.infer<typeof infoSchema>;

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Bắt buộc"),
    new_password: z.string().min(8, "Tối thiểu 8 ký tự"),
    confirm_password: z.string().min(1, "Bắt buộc"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirm_password"],
  })
  .refine((d) => d.old_password !== d.new_password, {
    message: "Mật khẩu mới không được trùng mật khẩu cũ",
    path: ["new_password"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

// ─── PasswordInput ────────────────────────────────────────────────────────────

function PasswordInput({
  placeholder,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className="pr-10"
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#718096] hover:text-[#4A5568]"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // ── Info form ──
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    values: user
      ? { full_name: user.full_name, email: user.email ?? "" }
      : undefined,
  });

  // ── Password form ──
  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  // Mutation: update info
  const { mutate: saveInfo, isPending: isSavingInfo } = useMutation({
    mutationFn: (_body: InfoForm) =>
      new Promise<void>((res) => setTimeout(res, 500)),
    // --- REAL API ---
    // mutationFn: (body) => updateUser(user!.id, body),
    onSuccess: (_, data) => {
      if (user) setUser({ ...user, ...data, email: data.email ?? user.email });
      toast.success("Đã cập nhật thông tin");
      setIsEditingInfo(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // Mutation: change password
  const { mutate: changePassword, isPending: isChangingPwd } = useMutation({
    mutationFn: (_body: PasswordForm) =>
      new Promise<void>((res) => setTimeout(res, 500)),
    // --- REAL API ---
    // mutationFn: (body) => axiosInstance.put("/auth/change-password", { old_password: body.old_password, new_password: body.new_password }),
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu thành công");
      resetPwd();
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        ?.response?.data?.error?.code;
      if (code === "WRONG_OLD_PASSWORD") {
        toast.error("Mật khẩu cũ không đúng");
      } else if (code === "SAME_PASSWORD") {
        toast.error("Mật khẩu mới không được trùng mật khẩu cũ");
      } else {
        toast.error("Có lỗi xảy ra");
      }
    },
  });

  // Avatar picker
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh JPEG hoặc PNG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ảnh không được vượt quá 2MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    if (!isEditingInfo) setIsEditingInfo(true);
  };

  const avatarSrc = avatarPreview ?? user?.avatar_url ?? undefined;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[var(--sp-section)]">
      <PageHeader title="Hồ sơ của tôi" />

      {/* ── Phần A: Thông tin cá nhân ── */}
      <section className="rounded-lg border border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-[var(--sp-card)] py-4">
          <User size={18} className="text-[#1A5FAB]" />
          <h2 className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
            Thông tin cá nhân
          </h2>
        </div>

        <div className="flex flex-col gap-6 p-[var(--sp-card)]">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={user?.full_name} />
                ) : null}
                <AvatarFallback className="bg-[#1A5FAB] text-xl font-semibold text-white">
                  {user ? generateInitials(user.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Đổi ảnh đại diện"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#1A5FAB] text-white shadow hover:bg-[#15499A]"
              >
                <Camera size={13} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
                {user?.full_name}
              </p>
              <p className="mt-0.5 text-[length:var(--fs-body)] text-[#718096]">
                {user?.phone}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user?.roles.map((r) => (
                  <Badge
                    key={r}
                    className={cn(
                      "text-[length:var(--fs-xs)]",
                      ROLE_COLOR[r] ?? "bg-gray-100 text-gray-700"
                    )}
                  >
                    {ROLE_LABEL[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Form fields */}
          {isEditingInfo ? (
            <form
              onSubmit={handleSubmit((data) => saveInfo(data))}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label>Họ và tên *</Label>
                <Input {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-[length:var(--fs-body)] text-red-500">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input {...register("email")} type="email" placeholder="email@example.com" />
                {errors.email && (
                  <p className="text-[length:var(--fs-body)] text-red-500">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Số điện thoại</Label>
                <Input value={user?.phone ?? ""} disabled className="bg-[#F8FAFC] text-[#718096]" />
                <p className="text-[length:var(--fs-body)] text-[#718096]">
                  Số điện thoại không thể thay đổi
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingInfo(false);
                    reset();
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  className="cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={(!isDirty && !avatarFile) || isSavingInfo}
                  className="cursor-pointer bg-[#1A5FAB] hover:bg-[#15499A]"
                >
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[length:var(--fs-body)] text-[#718096]">Họ và tên</p>
                  <p className="mt-0.5 font-medium text-[#2D3748]">{user?.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[length:var(--fs-body)] text-[#718096]">Email</p>
                  <p className="mt-0.5 font-medium text-[#2D3748]">{user?.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[length:var(--fs-body)] text-[#718096]">Số điện thoại</p>
                  <p className="mt-0.5 font-medium text-[#2D3748]">{user?.phone ?? "—"}</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingInfo(true)}
                  className="cursor-pointer"
                >
                  Chỉnh sửa
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Phần B: Đổi mật khẩu ── */}
      <section className="rounded-lg border border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-[var(--sp-card)] py-4">
          <KeyRound size={18} className="text-[#1A5FAB]" />
          <h2 className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
            Đổi mật khẩu
          </h2>
        </div>

        <form
          onSubmit={handlePwd((data) => changePassword(data))}
          className="flex flex-col gap-4 p-[var(--sp-card)]"
        >
          <div className="flex flex-col gap-1.5">
            <Label>Mật khẩu hiện tại *</Label>
            <PasswordInput {...regPwd("old_password")} placeholder="••••••••" />
            {pwdErrors.old_password && (
              <p className="text-[length:var(--fs-body)] text-red-500">
                {pwdErrors.old_password.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Mật khẩu mới *</Label>
            <PasswordInput {...regPwd("new_password")} placeholder="Tối thiểu 8 ký tự" />
            {pwdErrors.new_password && (
              <p className="text-[length:var(--fs-body)] text-red-500">
                {pwdErrors.new_password.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Xác nhận mật khẩu mới *</Label>
            <PasswordInput {...regPwd("confirm_password")} placeholder="Nhập lại mật khẩu mới" />
            {pwdErrors.confirm_password && (
              <p className="text-[length:var(--fs-body)] text-red-500">
                {pwdErrors.confirm_password.message}
              </p>
            )}
          </div>
          <div className="flex justify-end border-t border-[#E2E8F0] pt-4">
            <Button
              type="submit"
              disabled={isChangingPwd}
              className="cursor-pointer bg-[#1A5FAB] hover:bg-[#15499A]"
            >
              Đổi mật khẩu
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
