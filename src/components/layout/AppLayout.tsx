import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth.api";

export default function AppLayout() {
  const navigate = useNavigate();
  const { user, accessToken, setUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Đã có user in-memory → không cần gọi lại
    if (user) return;

    // Sau reload: accessToken mất, user mất, nhưng cookie vẫn còn
    // Gọi getMe() → axios interceptor sẽ tự refresh cookie để lấy accessToken mới
    const fetchMe = async () => {
      try {
        const res = await getMe();
        if (res.success) {
          setUser(res.data);
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    };

    fetchMe();
  }, [user, setUser, navigate]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-[#F4F6F8] p-[var(--sp-page)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
