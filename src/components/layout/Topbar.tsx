import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { Bell, ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { generateInitials } from "@/utils/helpers";
import { logout } from "@/api/auth.api";

const ROUTE_TITLES: { pattern: string; title: string }[] = [
  { pattern: "/", title: "Dashboard" },
  { pattern: "/vehicles", title: "Quản lý xe nâng" },
  { pattern: "/vehicles/:id", title: "Chi tiết xe nâng" },
  { pattern: "/contracts", title: "Hợp đồng" },
  { pattern: "/contracts/:id", title: "Chi tiết hợp đồng" },
  { pattern: "/customers", title: "Khách hàng" },
  { pattern: "/users", title: "Người dùng & Phân quyền" },
  { pattern: "/notifications", title: "Thông báo" },
  { pattern: "/settings", title: "Cài đặt công ty" },
];

function usePageTitle(): string {
  const { pathname } = useLocation();

  // Thử khớp exact trước (để "/" không nuốt route khác)
  for (const { pattern, title } of ROUTE_TITLES) {
    const match = matchPath({ path: pattern, end: true }, pathname);
    if (match) return title;
  }
  return "";
}

interface TopbarProps {
  onMobileMenuOpen: () => void;
}

export default function Topbar({ onMobileMenuOpen }: TopbarProps) {
  const navigate = useNavigate();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const pageTitle = usePageTitle();

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
      // bỏ qua lỗi, vẫn clear local
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-[var(--sp-topbar)]"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
    >
      {/* Bên trái: hamburger (mobile) + tên trang */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          className="rounded p-1.5 text-[#718096] transition-colors hover:bg-[#F4F6F8] hover:text-[#1A5FAB] lg:hidden"
          title="Mở menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="hidden text-[length:var(--fs-title)] font-medium text-[#1A202C] lg:block">{pageTitle}</h1>
      </div>

      {/* Bên phải */}
      <div className="flex items-center gap-4">
        {/* Icon chuông */}
        <button
          onClick={() => navigate("/notifications")}
          className="relative rounded p-1 text-[#718096] transition-colors hover:text-[#1A5FAB]"
          title="Thông báo"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar + Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[#F4F6F8]">
              <Avatar className="h-9 w-9 shrink-0">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                ) : null}
                <AvatarFallback className="bg-[#1A5FAB] text-xs font-semibold text-white">
                  {user ? generateInitials(user.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-[length:var(--fs-base)] font-normal text-[#1A202C] lg:block">
                {user?.full_name ?? "---"}
              </span>
              <ChevronDown size={14} className="text-[#718096]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => {
                // TODO: mở modal đổi mật khẩu
              }}
            >
              <KeyRound size={15} className="text-[#718096]" />
              Đổi mật khẩu
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[#E74C3C] focus:text-[#E74C3C]"
              onClick={handleLogout}
            >
              <LogOut size={15} className="text-[#E74C3C]" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
