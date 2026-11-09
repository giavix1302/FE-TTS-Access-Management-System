import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { login } from "@/api/auth.api";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  applyApiErrors,
  getApiError,
  getApiErrorStatus,
  getRetryAfterSeconds,
} from "@/utils/apiError";
import { consumeLoginNotice, getSafeRedirect } from "@/utils/loginRedirect";
import { loginSchema, type LoginFormValues } from "./login.schema";

// Chỉ ghi nhớ SĐT/email — KHÔNG lưu token (xem CLAUDE.md mục Auth).
// Giữ key cũ để người đã ghi nhớ SĐT không phải nhập lại
const REMEMBER_IDENTIFIER_KEY = "tts-remember-phone";

function readRememberedIdentifier(): string {
  try {
    return localStorage.getItem(REMEMBER_IDENTIFIER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeRememberedIdentifier(identifier: string | null) {
  try {
    if (identifier) localStorage.setItem(REMEMBER_IDENTIFIER_KEY, identifier);
    else localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
  } catch {
    // Trình duyệt chặn storage — bỏ qua
  }
}

const inputClass =
  "h-12 w-full rounded-lg border bg-white pl-10 text-[15px] text-[#1A202C] placeholder:text-[#A0AEC0] outline-none transition-all duration-200 hover:border-[#CBD5E0] focus:bg-white focus:border-[#1A5FAB] focus:ring-4 focus:ring-[#1A5FAB]/10";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-[13px] text-[#E74C3C]">
      <AlertCircle size={13} className="shrink-0" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// LoginCard — Form đăng nhập
// ---------------------------------------------------------------------------
function LoginCard() {
  const navigate = useNavigate();
  const { setAuth, accessToken } = useAuthStore();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  const [rememberedIdentifier] = useState(readRememberedIdentifier);
  const [rememberIdentifier, setRememberIdentifier] = useState(rememberedIdentifier !== "");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 429: BE khóa đăng nhập, kể cả nhập đúng mật khẩu → khóa nút tới khi hết thời gian chờ
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    if (accessToken) navigate(redirectTo, { replace: true });
  }, [accessToken, navigate, redirectTo]);

  // Bị đưa về do hết phiên → báo lý do
  useEffect(() => {
    const notice = consumeLoginNotice();
    if (notice) toast.warning(notice);
  }, []);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [lockSeconds]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const {
    register,
    handleSubmit,
    setFocus,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: rememberedIdentifier, password: "" },
  });

  // Đã nhớ tài khoản → focus thẳng vào mật khẩu
  useEffect(() => {
    setFocus(rememberedIdentifier ? "password" : "identifier");
  }, [setFocus, rememberedIdentifier]);

  const handlePasswordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const res = await login({ identifier: values.identifier, password: values.password });
      if (res.success) {
        writeRememberedIdentifier(rememberIdentifier ? values.identifier : null);
        const { accessToken, user } = res.data;
        setAuth(
          {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            email: user.email,
            avatarUrl: user.avatarUrl,
            roles: user.roles,
            permissions: user.permissions,
          },
          accessToken,
        );
        navigate(redirectTo, { replace: true });
      }
    } catch (err: unknown) {
      const { code, message } = getApiError(err);
      if (code === "UNAUTHORIZED") toast.error("Số điện thoại/email hoặc mật khẩu không đúng");
      else if (code === "ACCOUNT_DISABLED") toast.error("Tài khoản đã bị vô hiệu hóa. Liên hệ admin");
      // Theo HTTP status: limiter có thể trả 429 với code khác hoặc không có envelope
      else if (getApiErrorStatus(err) === 429 || code === "TOO_MANY_REQUESTS") {
        toast.error(message ?? "Bạn thử quá nhiều lần, vui lòng thử lại sau");
        setLockSeconds(getRetryAfterSeconds(err) ?? 0);
      } else if (getApiErrorStatus(err) === undefined) toast.error("Không thể kết nối server");
      else applyApiErrors(err, setError, ["identifier", "password"]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative z-10 w-full max-w-[480px] overflow-hidden rounded-2xl border border-white/80 bg-white/70 px-6 py-8 shadow-[0_30px_80px_-20px_rgba(11,37,69,0.65),0_0_0_1px_rgba(11,37,69,0.06)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-500 ease-out sm:px-10 sm:py-14",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {/* Dải màu thương hiệu (xanh → cam như logo) */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#1A5FAB] via-[#2E86C1] to-[#F5A623]" />

      {/* Tiêu đề */}
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1A5FAB]">
        Hệ thống quản lý AWPMS
      </p>
      <h1 className="mt-3 text-[28px] font-bold leading-tight text-[#1A202C]">Đăng nhập</h1>
      <p className="mt-2 text-[14px] text-[#4A5568]">
        Nhập thông tin tài khoản để tiếp tục
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-9 flex flex-col gap-6" noValidate>
        {/* Số điện thoại hoặc email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="login-identifier" className="text-[14px] font-medium text-[#2D3748]">
            Số điện thoại hoặc email
          </label>
          <div className="relative">
            <User
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AEC0]"
            />
            <input
              id="login-identifier"
              {...register("identifier")}
              type="text"
              placeholder="0901234567 hoặc email@congty.vn"
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={!!errors.identifier}
              className={cn(inputClass, "pr-3", errors.identifier ? "border-[#E74C3C]" : "border-[#E2E8F0]")}
            />
          </div>
          <FieldError message={errors.identifier?.message} />
        </div>

        {/* Mật khẩu */}
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-[14px] font-medium text-[#2D3748]">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AEC0]"
            />
            <input
              id="login-password"
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              onKeyUp={handlePasswordKey}
              onKeyDown={handlePasswordKey}
              className={cn(
                inputClass,
                "pr-11 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
                errors.password ? "border-[#E74C3C]" : "border-[#E2E8F0]",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#A0AEC0] transition-colors hover:bg-[#EDF2F7] hover:text-[#4A5568] cursor-pointer"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {capsLockOn && (
            <p className="flex items-center gap-1 text-[13px] text-[#D68910]">
              <AlertCircle size={13} className="shrink-0" />
              Caps Lock đang bật
            </p>
          )}
          <FieldError message={errors.password?.message} />
        </div>

        {/* Ghi nhớ tài khoản */}
        <label className="flex w-fit items-center gap-2 text-[14px] text-[#4A5568] cursor-pointer select-none">
          <Checkbox
            checked={rememberIdentifier}
            onCheckedChange={(v) => setRememberIdentifier(v === true)}
            className="border-[#A0AEC0] bg-white data-[state=checked]:border-[#1A5FAB] data-[state=checked]:bg-[#1A5FAB] cursor-pointer"
          />
          Ghi nhớ tài khoản
        </label>

        {/* Nút đăng nhập */}
        <button
          type="submit"
          disabled={isLoading || lockSeconds > 0}
          className="group mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1A5FAB] text-[15px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(26,95,171,0.6)] transition-all duration-200 hover:bg-[#154D8A] hover:shadow-[0_10px_24px_-6px_rgba(26,95,171,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Đang đăng nhập...
            </>
          ) : lockSeconds > 0 ? (
            `Thử lại sau ${Math.floor(lockSeconds / 60)}:${String(lockSeconds % 60).padStart(2, "0")}`
          ) : (
            <>
              Đăng nhập
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      {/* Hỗ trợ */}
      <div className="mt-9 border-t border-[#1A202C]/10 pt-6 text-center text-[13px] text-[#4A5568]">
        Gặp sự cố khi đăng nhập? Liên hệ quản trị viên
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#1A5FAB] bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: "url('/background-login.png')" }}
    >
      <LoginCard />

      <p className="absolute inset-x-0 bottom-4 z-10 text-center text-[12px] font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
        © {new Date().getFullYear()} Công ty TNHH Thương mại Dịch vụ TTS
      </p>
    </div>
  );
}
