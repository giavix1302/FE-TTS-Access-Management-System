export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // AppLayout tự xử lý restore session (getMe) và redirect về /login nếu cần
  return <>{children}</>;
}
