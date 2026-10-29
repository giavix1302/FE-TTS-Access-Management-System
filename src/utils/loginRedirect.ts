// Giữ trang đang mở (vd. link QR /vehicles/qr/:code) để đăng nhập xong quay lại

export const buildLoginUrl = (): string => {
  const { pathname, search } = window.location;
  if (pathname === "/" || pathname.startsWith("/login")) return "/login";
  return `/login?redirect=${encodeURIComponent(pathname + search)}`;
};

// Chỉ chấp nhận path nội bộ — chặn open redirect (//evil.com, /\evil.com, https://...)
export const getSafeRedirect = (raw: string | null): string =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/";
