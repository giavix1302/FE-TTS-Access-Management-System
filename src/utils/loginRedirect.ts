// Giữ trang đang mở (vd. link QR /vehicles/qr/:code) để đăng nhập xong quay lại

export const buildLoginUrl = (): string => {
  const { pathname, search } = window.location;
  if (pathname === "/" || pathname.startsWith("/login")) return "/login";
  return `/login?redirect=${encodeURIComponent(pathname + search)}`;
};

// Thông báo cho trang login sau khi bị đưa về do hết phiên — chuyển trang bằng window.location nên toast không sống sót.
// Chỉ lưu message hiển thị, không lưu dữ liệu đăng nhập.
const LOGIN_NOTICE_KEY = "tts-login-notice";

export const setLoginNotice = (message: string | undefined) => {
  try {
    if (message) sessionStorage.setItem(LOGIN_NOTICE_KEY, message);
  } catch {
    // Trình duyệt chặn storage — bỏ qua
  }
};

export const consumeLoginNotice = (): string | null => {
  try {
    const message = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    sessionStorage.removeItem(LOGIN_NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
};

// Chỉ chấp nhận path nội bộ — chặn open redirect (//evil.com, /\evil.com, https://...)
export const getSafeRedirect = (raw: string | null): string =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
