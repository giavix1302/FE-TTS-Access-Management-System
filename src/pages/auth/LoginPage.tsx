import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Phone, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { loginSchema, type LoginFormValues } from "./login.schema";

// ---------------------------------------------------------------------------
// MOCK
// ---------------------------------------------------------------------------
const MOCK_CREDENTIALS = { phone: "0901234567", password: "123456" };
const MOCK_RESPONSE = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  user: {
    id: 1,
    full_name: "Nguyễn Văn Admin",
    phone: "0901234567",
    email: "admin@tts.vn",
    avatar_url: undefined as string | undefined,
    roles: ["admin"],
    permissions: [
      "users:view",
      "vehicles:view",
      "contracts:view",
      "customers:view",
    ],
  },
};

// ---------------------------------------------------------------------------
// Slides config
// ---------------------------------------------------------------------------
interface Slide {
  image: string;
  title: string;
}

const SLIDES: Slide[] = [
  { image: "/slides/slide-1.jpg", title: "Quản lý xe nâng người toàn diện" },
  { image: "/slides/slide-2.jpg", title: "Hợp đồng & Phụ lục dễ dàng" },
  { image: "/slides/slide-3.jpg", title: "Cảnh báo hết hạn tự động" },
  { image: "/slides/slide-4.jpg", title: "Quản lý khách hàng chuyên nghiệp" },
  { image: "/slides/slide-5.jpg", title: "Phân quyền & Bảo mật" },
];

const SLIDE_INTERVAL = 4000;

// ---------------------------------------------------------------------------
// RightPanel — Slideshow
// ---------------------------------------------------------------------------
function RightPanel() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (index: number) => setCurrent(index);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, SLIDE_INTERVAL);
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleDotClick = (i: number) => {
    goTo(i);
    resetTimer();
  };

  return (
    <div className="flex w-[60%] items-center justify-center">
      {/* Floating card — gradient cố định theo slide, không fade */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden p-20"
        style={{
          background: "linear-gradient(135deg, #1A5FAB 0%, #2E86C1 100%)",
        }}
      >
        {/* Phần trên — cố định, không animate */}
        <div>
          {/* Tag */}
          <span
            className="inline-block rounded-full px-3 py-1 text-[12px] font-medium text-white"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            Ứng dụng nội bộ
          </span>

          {/* Title cố định */}
          <h2 className="mt-4 text-[34px] font-bold leading-[1.25] text-white">
            Hệ thống quản lý xe nâng người
          </h2>

          {/* Subtitle cố định */}
          <p className="mt-2 text-[16px] font-semibold tracking-wide text-white/70">
            Công ty TNHH Thương mại dịch vụ TTS - mua bán và cho thuê xe nâng
            người
          </p>
        </div>

        {/* Slider — trượt ngang */}
        <div
          className="relative mt-6 overflow-hidden rounded-2xl"
          style={{
            flex: 1,
            maxHeight: "calc(100% - 100px)",
            width: "100%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <div
            className="flex h-full"
            style={{
              width: `${SLIDES.length * 100}%`,
              transform: `translateX(-${(current * 100) / SLIDES.length}%)`,
              transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {SLIDES.map((s, i) => (
              <div
                key={i}
                className="relative h-full flex-shrink-0"
                style={{ width: `${100 / SLIDES.length}%` }}
              >
                <img
                  src={s.image}
                  alt={s.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === current ? "24px" : "8px",
                backgroundColor:
                  i === current ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeftPanel — Form đăng nhập
// ---------------------------------------------------------------------------
function LeftPanel() {
  const navigate = useNavigate();
  const { setAuth, accessToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (accessToken) navigate("/", { replace: true });
  }, [accessToken, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      // --- MOCK ---
      await new Promise((res) => setTimeout(res, 800));
      if (
        values.phone === MOCK_CREDENTIALS.phone &&
        values.password === MOCK_CREDENTIALS.password
      ) {
        const { access_token, refresh_token, user } = MOCK_RESPONSE;
        setAuth(user, access_token, refresh_token);
        navigate("/", { replace: true });
      } else {
        toast.error("Số điện thoại hoặc mật khẩu không đúng");
      }
      return;
      // --- END MOCK ---

      // --- REAL API ---
      // const res = await login({ phone: values.phone, password: values.password });
      // if (res.success) {
      //   setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      //   navigate("/", { replace: true });
      // }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401) toast.error("Số điện thoại hoặc mật khẩu không đúng");
      else if (status === 403)
        toast.error("Tài khoản đã bị vô hiệu hóa. Liên hệ admin");
      else toast.error("Không thể kết nối server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-[40%] flex-col items-center justify-center bg-[#F4F6F8] px-12">
      <div className="w-full max-w-[500px] bg-white rounded-3xl p-8 shadow-md">
        {/* Logo */}
        <img
          src="/LOGOTTS.png"
          alt="TTS Logo"
          className="mb-4 h-20 w-auto object-contain"
        />

        {/* Tiêu đề */}
        <h1 className="text-[32px] font-bold text-[#1A202C]">Đăng nhập</h1>
        <p className="mt-1.5 text-[18px] leading-relaxed text-[#718096]">
          Chào mừng bạn đến công ty TTS
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 flex flex-col gap-5"
          noValidate
        >
          {/* Số điện thoại */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[17px] font-medium text-[#1A202C]">
              Số điện thoại
            </label>
            <div className="relative">
              <Phone
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]"
              />
              <input
                {...register("phone")}
                type="tel"
                placeholder="Nhập số điện thoại"
                autoComplete="tel"
                className="h-11 w-full rounded-lg border bg-white pl-10 pr-3 py-6 text-[18px] text-[#1A202C] placeholder:text-[#CBD5E0] outline-none transition-colors focus:border-[#1A5FAB] focus:ring-2 focus:ring-[#1A5FAB]/20"
                style={{ borderColor: errors.phone ? "#E74C3C" : "#E2E8F0" }}
              />
            </div>
            {errors.phone && (
              <p className="text-[12px] text-[#E74C3C]">
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Mật khẩu */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#1A202C]">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]"
              />
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border bg-white pl-10 pr-10 py-6 text-[18px] text-[#1A202C] placeholder:text-[#CBD5E0] outline-none transition-colors focus:border-[#1A5FAB] focus:ring-2 focus:ring-[#1A5FAB]/20"
                style={{ borderColor: errors.password ? "#E74C3C" : "#E2E8F0" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#1A202C]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[12px] text-[#E74C3C]">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Nút đăng nhập */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[#1A5FAB] text-[19px] font-medium text-white transition-colors hover:bg-[#154D8A] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-[14px] text-[#718096]">
          Gặp sự cố? Liên hệ quản trị viên để được hỗ trợ
        </p>
        <p className="mt-2 text-center text-[16px] text-[#CBD5E0]">
          Demo: <span className="font-mono">0901234567</span> /{" "}
          <span className="font-mono">123456</span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F8]">
      <LeftPanel />
      <RightPanel />
    </div>
  );
}
