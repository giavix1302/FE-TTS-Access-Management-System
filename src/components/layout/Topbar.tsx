import { useState } from "react";
import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu, UserCircle } from "lucide-react";
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
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ROUTE_TITLES: { pattern: string; title: string }[] = [
  { pattern: "/", title: "Dashboard" },
  { pattern: "/vehicles", title: "Quản lý xe nâng" },
  { pattern: "/vehicles/:id", title: "Chi tiết xe nâng" },
  { pattern: "/contracts", title: "Hợp đồng" },
  { pattern: "/contracts/:id", title: "Chi tiết hợp đồng" },
  { pattern: "/customers", title: "Khách hàng" },
  { pattern: "/customers/:id", title: "Chi tiết khách hàng" },
  { pattern: "/users", title: "Người dùng & Phân quyền" },
  { pattern: "/notifications", title: "Thông báo" },
  { pattern: "/settings", title: "Cài đặt công ty" },
  { pattern: "/service-catalog", title: "Danh mục dịch vụ" },
  { pattern: "/roles", title: "Phân quyền vai trò" },
  { pattern: "/profile", title: "Hồ sơ của tôi" },
  { pattern: "/analytics", title: "Thống kê" },
  { pattern: "/reports", title: "Xuất báo cáo" },
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
  const { user, clearAuth } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const pageTitle = usePageTitle();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch {
      // bỏ qua lỗi, vẫn clear local
    } finally {
      setLogoutLoading(false);
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
        <h1 className="hidden text-[length:var(--fs-title)] font-medium text-[#1A202C] lg:block">
          {pageTitle}
        </h1>
      </div>

      {/* Bên phải */}
      <div className="flex items-center gap-4">
        {/* Icon chuông */}
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/notifications")}
                className="cursor-pointer relative rounded p-1 text-[#718096] transition-colors hover:text-[#1A5FAB]"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[11px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[length:var(--fs-body)] font-medium text-white shadow-lg"
            >
              Thông báo
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Avatar + Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-primary-light">
              <Avatar className="h-9 w-9 shrink-0">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                ) : null}
                <AvatarFallback className="bg-[#1A5FAB] text-xs font-semibold text-white">
                  {user ? generateInitials(user.fullName) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-[length:var(--fs-base)] font-normal text-[#1A202C] lg:block">
                {user?.fullName ?? "---"}
              </span>
              <ChevronDown size={14} className="text-[#718096]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48 border-none">
            <DropdownMenuItem
              className="cursor-pointer gap-2 focus:bg-primary-light focus:text-primary"
              onClick={() => navigate("/profile")}
            >
              <UserCircle size={15} />
              Hồ sơ của tôi
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[#E74C3C] focus:bg-[#FEE2E2] focus:text-[#E74C3C]"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut size={15} />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Đăng xuất?"
        description="Bạn sẽ được chuyển về trang đăng nhập. Các phiên làm việc chưa lưu sẽ bị mất."
        confirmLabel="Đăng xuất"
        variant="danger"
        loading={logoutLoading}
        onConfirm={handleLogout}
      />
    </header>
  );
}
