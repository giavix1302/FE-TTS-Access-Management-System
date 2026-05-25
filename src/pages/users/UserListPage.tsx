import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Plus, Search, Pencil, ShieldOff, ShieldCheck, KeyRound, Copy, Check } from "lucide-react";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/stores/authStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/utils/format";
import type { User, UserRole } from "@/types/user.types";
import {
  getUsers,
  createUser,
  updateUser,
  activateUser,
  deactivateUser,
  resetPassword,
  updateUserRoles,
} from "@/api/users.api";
import { getRoles } from "@/api/roles.api";

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "bg-[#FEE2E2] text-[#991B1B]",
  },
  manager: {
    label: "Quản lý",
    className: "bg-[#EDE9FE] text-[#5B21B6]",
  },
  accountant: {
    label: "Kế toán",
    className: "bg-[#FEF3C7] text-[#92400E]",
  },
  staff: {
    label: "Nhân viên",
    className: "bg-[#DCFCE7] text-[#166534]",
  },
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Quản lý" },
  { value: "accountant", label: "Kế toán" },
  { value: "staff", label: "Nhân viên" },
];

function RoleBadge({ role }: { role: UserRole }) {
  const { label, className } = ROLE_CONFIG[role];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--fs-xs)] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium ${
        isActive
          ? "bg-[#DCFCE7] text-[#166534]"
          : "bg-[#F1F5F9] text-[#64748B]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-success" : "bg-text-secondary"}`}
      />
      {isActive ? "Đang hoạt động" : "Đã vô hiệu"}
    </span>
  );
}

function UserAvatar({ user, size = "sm" }: { user: User; size?: "sm" | "md" | "lg" }) {
  const initials = user.fullName
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const sizeClass = {
    sm: "h-9 w-9 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }

  const colors = [
    "bg-[#DBEAFE] text-[#1D4ED8]",
    "bg-[#FCE7F3] text-[#9D174D]",
    "bg-[#D1FAE5] text-[#065F46]",
    "bg-[#FEF3C7] text-[#92400E]",
    "bg-[#EDE9FE] text-[#5B21B6]",
  ];
  const color = colors[user.id % colors.length];

  return (
    <div
      className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const createSchema = z.object({
  full_name: z.string().min(1, "Bắt buộc"),
  phone: z
    .string()
    .regex(/^0\d{9}$/, "Phải là 10 số, bắt đầu bằng 0"),
  email: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  password: z.string().min(8, "Tối thiểu 8 ký tự"),
  confirm_password: z.string().min(1, "Bắt buộc"),
  role: z.enum(["admin", "manager", "accountant", "staff"], {
    required_error: "Bắt buộc chọn vai trò",
  }),
}).refine((d) => d.password === d.confirm_password, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirm_password"],
});

const editSchema = z.object({
  full_name: z.string().min(1, "Bắt buộc"),
  email: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  role: z.enum(["admin", "manager", "accountant", "staff"], {
    required_error: "Bắt buộc chọn vai trò",
  }),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const PAGE_SIZE = 10;

const fieldClass =
  "w-full px-3 py-2 text-sm border border-input rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background";
const errClass = "text-xs text-error mt-0.5";

// ─── CreateUserDialog ─────────────────────────────────────────────────────────
function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const { data: rolesData } = useQuery({
    queryKey: QUERY_KEYS.roles.all,
    queryFn: () => getRoles(),
    staleTime: 5 * 60 * 1000,
  });
  const rolesList: { id: number; name: string }[] = rolesData?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const mutation = useMutation({
    mutationFn: (body: CreateForm) => {
      const roleId = rolesList.find((r) => r.name === body.role)?.id;
      if (!roleId) throw new Error("Không tìm thấy role");
      return createUser({
        fullName: body.full_name,
        phone: body.phone,
        email: body.email || null,
        password: body.password,
        roleIds: [roleId],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users.all });
      toast.success("Thêm người dùng thành công");
      handleClose();
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      if (code === "PHONE_ALREADY_EXISTS") toast.error("Số điện thoại đã được sử dụng");
      else if (code === "EMAIL_ALREADY_EXISTS") toast.error("Email đã được sử dụng");
      else toast.error("Có lỗi xảy ra");
    },
  });

  function handleClose() {
    onOpenChange(false);
    reset();
  }

  const selectedRole = watch("role");

  const formContent = (
    <form id="user-create-form" onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Họ và tên <span className="text-error">*</span>
        </Label>
        <input
          {...register("full_name")}
          placeholder="Nguyễn Văn A"
          className={`${fieldClass} mt-1`}
        />
        {errors.full_name && <p className={errClass}>{errors.full_name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Số điện thoại <span className="text-error">*</span>
          </Label>
          <input
            {...register("phone")}
            placeholder="0901234567"
            className={`${fieldClass} mt-1`}
          />
          {errors.phone && <p className={errClass}>{errors.phone.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">Email</Label>
          <input
            {...register("email")}
            placeholder="user@awpms.vn"
            className={`${fieldClass} mt-1`}
          />
          {errors.email && <p className={errClass}>{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Mật khẩu <span className="text-error">*</span>
          </Label>
          <input
            {...register("password")}
            type="password"
            placeholder="Tối thiểu 8 ký tự"
            className={`${fieldClass} mt-1`}
          />
          {errors.password && <p className={errClass}>{errors.password.message}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-text-secondary">
            Xác nhận mật khẩu <span className="text-error">*</span>
          </Label>
          <input
            {...register("confirm_password")}
            type="password"
            placeholder="Nhập lại mật khẩu"
            className={`${fieldClass} mt-1`}
          />
          {errors.confirm_password && <p className={errClass}>{errors.confirm_password.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Vai trò <span className="text-error">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setValue("role", r.value, { shouldValidate: true })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                selectedRole === r.value
                  ? "border-primary bg-primary-light text-primary"
                  : "border-border text-text-secondary hover:border-primary hover:text-primary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  selectedRole === r.value ? "bg-primary" : "bg-border"
                }`}
              />
              {r.label}
            </button>
          ))}
        </div>
        {errors.role && <p className={errClass}>{errors.role.message}</p>}
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
        form="user-create-form"
        disabled={mutation.isPending}
        className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
      >
        {mutation.isPending ? "Đang lưu..." : "Thêm người dùng"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm người dùng mới</DialogTitle>
          </DialogHeader>
          {formContent}
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Thêm người dùng mới">
        <MobileSheetHeader>
          <MobileSheetTitle>Thêm người dùng mới</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actionButtons}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── EditUserDialog ───────────────────────────────────────────────────────────
function EditUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User;
}) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const { user: currentUser } = useAuthStore();
  const isSelf = currentUser?.id === user.id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: user.fullName,
      email: user.email ?? "",
      role: user.roles[0] ?? "staff",
    },
  });

  const { data: rolesData } = useQuery({
    queryKey: QUERY_KEYS.roles.all,
    queryFn: () => getRoles(),
    staleTime: 5 * 60 * 1000,
  });
  const rolesList: { id: number; name: string }[] = rolesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: async (body: EditForm) => {
      await updateUser(user.id, {
        fullName: body.full_name,
        email: body.email || null,
      });
      if (!isSelf && body.role !== user.roles[0]) {
        const roleId = rolesList.find((r) => r.name === body.role)?.id;
        if (roleId) await updateUserRoles(user.id, [roleId]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users.all });
      toast.success("Cập nhật thành công");
      handleClose();
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  const selectedRole = watch("role");

  const formContent = (
    <form id="user-edit-form" onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Họ và tên <span className="text-error">*</span>
        </Label>
        <input
          {...register("full_name")}
          className={`${fieldClass} mt-1`}
        />
        {errors.full_name && <p className={errClass}>{errors.full_name.message}</p>}
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Số điện thoại
        </Label>
        <input
          value={user.phone}
          disabled
          className={`${fieldClass} mt-1 opacity-50 cursor-not-allowed`}
        />
        <p className="text-[length:var(--fs-xs)] text-text-secondary mt-0.5">
          Không thể thay đổi số điện thoại
        </p>
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">Email</Label>
        <input
          {...register("email")}
          placeholder="user@awpms.vn"
          className={`${fieldClass} mt-1`}
        />
        {errors.email && <p className={errClass}>{errors.email.message}</p>}
      </div>

      <div>
        <Label className="text-xs font-medium text-text-secondary">
          Vai trò <span className="text-error">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {ROLE_OPTIONS.map((r) => {
            const disabled = isSelf && r.value !== "admin";
            return (
              <button
                key={r.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  !disabled && setValue("role", r.value, { shouldValidate: true })
                }
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  disabled
                    ? "opacity-40 cursor-not-allowed border-border text-text-secondary"
                    : selectedRole === r.value
                      ? "border-primary bg-primary-light text-primary cursor-pointer"
                      : "border-border text-text-secondary hover:border-primary hover:text-primary cursor-pointer"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    selectedRole === r.value ? "bg-primary" : "bg-border"
                  }`}
                />
                {r.label}
              </button>
            );
          })}
        </div>
        {isSelf && (
          <p className="text-[length:var(--fs-xs)] text-text-secondary mt-1">
            Không thể thay đổi vai trò của chính mình
          </p>
        )}
        {errors.role && <p className={errClass}>{errors.role.message}</p>}
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
        form="user-edit-form"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa — {user.fullName}</DialogTitle>
          </DialogHeader>
          {formContent}
          <Separator />
          <DialogFooter>{actionButtons}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={handleClose}>
      <MobileSheetContent mobileVariant="fullscreen" title="Chỉnh sửa người dùng">
        <MobileSheetHeader>
          <MobileSheetTitle>Chỉnh sửa — {user.fullName}</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody className="flex-1 overflow-y-auto">
          {formContent}
        </MobileSheetBody>
        <MobileSheetFooter>{actionButtons}</MobileSheetFooter>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── ResetPasswordDialog ──────────────────────────────────────────────────────
function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => resetPassword(user.id),
    onSuccess: (res) => {
      setTempPassword(res.data?.temporaryPassword ?? null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  function handleClose() {
    onOpenChange(false);
    setTempPassword(null);
    setCopied(false);
  }

  function handleCopy() {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ConfirmModal
      open={open}
      onOpenChange={(v) => { if (!v) handleClose(); }}
      title={`Reset mật khẩu — ${user.fullName}`}
      description={
        tempPassword
          ? undefined
          : `Hệ thống sẽ tạo mật khẩu tạm thời mới và thu hồi toàn bộ phiên đăng nhập của "${user.fullName}". Hành động này không thể hoàn tác.`
      }
      confirmLabel={tempPassword ? "Đóng" : "Reset mật khẩu"}
      variant="primary"
      loading={mutation.isPending}
      onConfirm={tempPassword ? handleClose : () => mutation.mutate()}
      customContent={
        tempPassword ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Mật khẩu tạm thời đã được tạo. Thông báo cho người dùng qua Zalo hoặc kênh khác.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-page border border-border">
              <code className="flex-1 font-mono text-[length:var(--fs-base)] font-semibold text-text-primary tracking-wider">
                {tempPassword}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="cursor-pointer p-1.5 rounded-md hover:bg-border text-text-secondary transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ) : null
      }
    />
  );
}

// ─── UserListPage ─────────────────────────────────────────────────────────────
export default function UserListPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.roles?.includes("admin") ?? false;

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [toggleUser, setToggleUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const debouncedSearch = useDebounce(search, 400);
  const page = pagination.pageIndex + 1;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      ...QUERY_KEYS.users.all,
      { search: debouncedSearch, roleFilter, activeFilter, page },
    ],
    queryFn: () =>
      getUsers({
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        isActive: activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const users = data?.data ?? [];
  const meta = data?.meta;

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const toggleMutation = useMutation({
    mutationFn: (u: User) => u.isActive ? deactivateUser(u.id) : activateUser(u.id),
    onSuccess: (_, u) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users.all });
      toast.success(u.isActive ? "Đã vô hiệu hóa tài khoản" : "Đã kích hoạt tài khoản");
      setToggleUser(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // ─── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnDef<User>[] = [
    {
      id: "user",
      header: "Người dùng",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3">
            <UserAvatar user={u} size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary truncate">{u.fullName}</p>
              <p className="text-[length:var(--fs-xs)] text-text-secondary">{u.phone}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-[length:var(--fs-sm)] text-text-secondary">
          {row.original.email ?? "—"}
        </span>
      ),
    },
    {
      id: "roles",
      header: "Vai trò",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} />,
    },
    {
      id: "created_at",
      header: "Ngày tạo",
      cell: ({ row }) => (
        <span className="text-[length:var(--fs-sm)] text-text-secondary">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = currentUser?.id === u.id;
        if (!isAdmin) return null;
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-text-secondary hover:text-primary hover:bg-primary-light h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); setEditUser(u); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chỉnh sửa</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-text-secondary hover:text-warning hover:bg-[#FEF3C7] h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); setResetUser(u); }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset mật khẩu</TooltipContent>
            </Tooltip>
            {!isSelf && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`cursor-pointer h-8 w-8 p-0 ${
                      u.isActive
                        ? "text-text-secondary hover:text-error hover:bg-error-light"
                        : "text-text-secondary hover:text-success hover:bg-[#DCFCE7]"
                    }`}
                    onClick={(e) => { e.stopPropagation(); setToggleUser(u); }}
                  >
                    {u.isActive ? (
                      <ShieldOff className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{u.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Người dùng"
        subtitle="Quản lý tài khoản nhân viên hệ thống"
        actions={
          isAdmin ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="cursor-pointer bg-primary text-white hover:bg-primary-dark gap-1.5 text-[length:var(--fs-sm)] sm:text-[length:var(--fs-base)]"
            >
              <Plus size={16} />
              Thêm người dùng
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Tìm tên, SĐT, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="pl-9 border-border"
          />
        </div>

        <Select
          value={roleFilter || "_all"}
          onValueChange={(v) => { setRoleFilter(v === "_all" ? "" : v); resetPage(); }}
        >
          <SelectTrigger className="w-full sm:w-44 border-border cursor-pointer">
            <SelectValue placeholder="Tất cả vai trò" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả vai trò</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeFilter || "_all"}
          onValueChange={(v) => { setActiveFilter(v === "_all" ? "" : v); resetPage(); }}
        >
          <SelectTrigger className="w-full sm:w-44 border-border cursor-pointer">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Đang hoạt động</SelectItem>
            <SelectItem value="inactive">Đã vô hiệu</SelectItem>
          </SelectContent>
        </Select>

        {meta && (
          <p className="ml-auto text-[length:var(--fs-base)] text-text-secondary">
            Tổng{" "}
            <span className="font-medium text-text-primary">{meta.total}</span>{" "}
            người dùng
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={users}
          loading={isLoading}
          pagination={pagination}
          pageCount={meta?.total_pages ?? 1}
          onPaginationChange={setPagination}
          emptyTitle="Không tìm thấy người dùng nào"
          emptyDescription="Thử thay đổi bộ lọc hoặc thêm người dùng mới"
          emptyAction={
            isAdmin ? (
              <Button
                size="sm"
                className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm người dùng
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[110px] animate-pulse rounded-xl bg-[#E2E8F0]" />
          ))
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-bg-card py-16">
            <p className="text-[length:var(--fs-base)] text-text-secondary">
              Không tìm thấy người dùng nào
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="cursor-pointer bg-primary text-white hover:bg-primary-dark mt-1"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm người dùng
              </Button>
            )}
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3"
            >
              {/* Row 1: avatar + info + status */}
              <div className="flex items-center gap-3">
                <UserAvatar user={u} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[length:var(--fs-base)] text-text-primary truncate">
                    {u.fullName}
                  </p>
                  <p className="text-[length:var(--fs-xs)] text-text-secondary">{u.phone}</p>
                </div>
                <ActiveBadge isActive={u.isActive} />
              </div>

              {/* Row 2: roles + email */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
                </div>
                {u.email && (
                  <span className="text-[length:var(--fs-xs)] text-text-secondary truncate max-w-[140px]">
                    {u.email}
                  </span>
                )}
              </div>

              {/* Row 3: actions — chỉ admin thấy */}
              {isAdmin && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer flex-1 gap-1.5 text-[length:var(--fs-xs)]"
                      onClick={() => setEditUser(u)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer flex-1 gap-1.5 text-[length:var(--fs-xs)] text-warning border-warning hover:bg-[#FEF3C7]"
                      onClick={() => setResetUser(u)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset MK
                    </Button>
                    {currentUser?.id !== u.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`cursor-pointer flex-1 gap-1.5 text-[length:var(--fs-xs)] ${
                          u.isActive
                            ? "text-error border-error hover:bg-error hover:text-white"
                            : "text-success border-success hover:bg-success hover:text-white"
                        }`}
                        onClick={() => setToggleUser(u)}
                      >
                        {u.isActive ? (
                          <>
                            <ShieldOff className="h-3.5 w-3.5" />
                            Vô hiệu
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Kích hoạt
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}

        {/* Pagination mobile */}
        {!isLoading && meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Trang {meta.page}/{meta.total_pages} · {meta.total} người dùng
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 border-border cursor-pointer"
                disabled={pagination.pageIndex === 0}
                onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 border-border cursor-pointer"
                disabled={pagination.pageIndex + 1 >= meta.total_pages}
                onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))}
              >
                Tiếp
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(v) => { if (!v) setEditUser(null); }}
          user={editUser}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          open={!!resetUser}
          onOpenChange={(v) => { if (!v) setResetUser(null); }}
          user={resetUser}
        />
      )}

      {toggleUser && (
        <ConfirmModal
          open={!!toggleUser}
          onOpenChange={(v) => { if (!v) setToggleUser(null); }}
          title={
            toggleUser.isActive
              ? `Vô hiệu hóa "${toggleUser.fullName}"?`
              : `Kích hoạt "${toggleUser.fullName}"?`
          }
          description={
            toggleUser.isActive
              ? "Tài khoản sẽ bị khóa ngay lập tức. Toàn bộ phiên đăng nhập sẽ bị thu hồi."
              : "Tài khoản sẽ được kích hoạt và người dùng có thể đăng nhập trở lại."
          }
          confirmLabel={toggleUser.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
          variant={toggleUser.isActive ? "danger" : "primary"}
          loading={toggleMutation.isPending}
          onConfirm={() => toggleMutation.mutate(toggleUser)}
        />
      )}
    </div>
  );
}
