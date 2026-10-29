import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth.api";
import { buildLoginUrl } from "@/utils/loginRedirect";

export default function AppLayout() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [restoring, setRestoring] = useState(!user);

  useEffect(() => {
    if (user) {
      setRestoring(false);
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await getMe();
        if (res.success) {
          setUser(res.data);
        } else {
          navigate(buildLoginUrl(), { replace: true });
        }
      } catch {
        navigate(buildLoginUrl(), { replace: true });
      } finally {
        setRestoring(false);
      }
    };

    fetchMe();
  }, [user, setUser, navigate]);

  if (restoring) return null;

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
        <main className="flex-1 overflow-y-auto bg-[#F7F8FA] p-[var(--sp-page)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
