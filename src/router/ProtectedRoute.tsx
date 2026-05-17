import { useAuthStore } from "@/stores/authStore";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();

  // Có user (từ getMe) hoặc accessToken in-memory → cho qua
  // Trường hợp reload: cả hai null nhưng cookie vẫn còn → AppLayout gọi getMe() để restore
  if (user || accessToken) return <>{children}</>;

  // Không có gì cả → về login (cookie cũng hết hoặc chưa login lần nào)
  return <Navigate to="/login" replace />;
}
