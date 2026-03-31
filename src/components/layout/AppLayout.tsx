import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuthStore } from "@/stores/authStore";
// import { getMe } from "@/api/auth.api"; // uncomment khi backend sẵn sàng

// --- MOCK DATA (xóa khi backend sẵn sàng) ---
const MOCK_USER = {
  id: 1,
  full_name: "Nguyễn Văn Admin",
  phone: "0901234567",
  email: "admin@tts.vn",
  avatar_url: undefined as string | undefined,
  roles: ["admin"],
  permissions: ["users:view", "vehicles:view", "contracts:view", "customers:view"],
};
// --- END MOCK DATA ---

export default function AppLayout() {
  const navigate = useNavigate();
  const { user, accessToken, setAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Nếu đã có user trong store (persist), không cần gọi lại
    if (user) return;

    // TODO: Bỏ mock và dùng getMe() khi backend sẵn sàng
    const fetchMe = async () => {
      try {
        // --- MOCK: comment khối này khi backend sẵn sàng ---
        setAuth(
          MOCK_USER,
          accessToken ?? "mock-access-token",
          "mock-refresh-token"
        );
        // --- END MOCK ---

        // --- REAL API (uncomment khi backend sẵn sàng) ---
        // const res = await getMe();
        // if (res.success) {
        //   setAuth(res.data, accessToken ?? "", useAuthStore.getState().refreshToken ?? "");
        // }
      } catch {
        navigate("/login", { replace: true });
      }
    };

    fetchMe();
  }, [user, accessToken, setAuth, navigate]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

