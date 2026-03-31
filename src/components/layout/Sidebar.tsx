import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  FileText,
  Users,
  Bell,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { generateInitials } from "@/utils/helpers";
import { logout } from "@/api/auth.api";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  exact?: boolean;
  guard?: (roles: string[], permissions: string[]) => boolean;
}

const NAV_MAIN: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/", exact: true },
  { label: "Quản lý xe nâng", icon: Truck, to: "/vehicles" },
  { label: "Hợp đồng", icon: FileText, to: "/contracts" },
  { label: "Khách hàng", icon: Users, to: "/customers" },
];

const NAV_NOTIFY: NavItem[] = [
  { label: "Thông báo", icon: Bell, to: "/notifications" },
];

const NAV_ADMIN: NavItem[] = [
  {
    label: "Người dùng",
    icon: UserCog,
    to: "/users",
    guard: (_roles, permissions) => permissions.includes("users:view"),
  },
  {
    label: "Cài đặt công ty",
    icon: Settings,
    to: "/settings",
    guard: (roles) => roles.includes("admin") || roles.includes("manager"),
  },
];

function NavDivider() {
  return <div className="my-2 border-t border-[#E2E8F0]" />;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
      // bỏ qua lỗi logout, vẫn clear local
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  const renderNavItem = (item: NavItem) => {
    if (item.guard && !item.guard(roles, permissions)) return null;

    const active = isActive(item);
    const Icon = item.icon;

    const linkContent = (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center rounded-md px-3 py-[10px] text-[18px] transition-colors",
          collapsed ? "justify-center px-0" : "",
          active
            ? "border-l-[3px] border-[#1A5FAB] bg-[#E8F0FB] pl-[9px] font-medium text-[#1A5FAB]"
            : "font-normal text-[#5A5A66] hover:bg-[#F4F6F8]",
          collapsed && active ? "border-l-[3px] border-[#1A5FAB] pl-[9px]" : "",
        )}
      >
        <span className="relative shrink-0">
          <Icon
            size={20}
            className={cn(
              active ? "text-[#1A5FAB]" : "text-[#718096]",
              !collapsed && "mr-[10px]",
            )}
          />
          {item.to === "/notifications" && unreadCount > 0 && collapsed && (
            <span className="absolute -right-1 -top-1 h-[8px] w-[8px] rounded-full bg-[#E74C3C]" />
          )}
        </span>

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.to === "/notifications" && unreadCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[15px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (!collapsed) return <span key={item.to}>{linkContent}</span>;

    return (
      <Tooltip key={item.to} delayDuration={100}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="flex items-center gap-2 rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[13px] font-medium text-white shadow-lg"
        >
          {item.label}
          {item.to === "/notifications" && unreadCount > 0 && (
            <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#E74C3C] px-1 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300",
          collapsed ? "w-[72px]" : "w-72",
        )}
        style={{ height: "100vh" }}
      >
        {/* [1] Logo */}
        <div className="flex items-center px-4 py-5">
          {!collapsed ? (
            <>
              <img
                src="/LOGOTTS.png"
                alt="TTS Logo"
                className="h-10 w-auto shrink-0 object-contain"
              />
              <span className="ml-2 flex-1 text-[20px] font-bold text-[#1A5FAB]">
                TTS-AWPMS
              </span>
              <button
                onClick={onToggle}
                title="Thu nhỏ sidebar"
                className="ml-1 shrink-0 rounded p-1 text-[#718096] transition-colors hover:bg-[#F4F6F8] hover:text-[#5A5A66]"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              title="Mo rong sidebar"
              className="mx-auto flex items-center justify-center rounded-md p-2 text-[#718096] transition-colors hover:bg-[#F4F6F8] hover:text-[#1A5FAB]"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* [2] Menu chính */}
        <nav className={cn("flex-1 py-2", collapsed ? "px-1" : "px-2")}>
          {NAV_MAIN.map(renderNavItem)}
          <NavDivider />
          {NAV_NOTIFY.map(renderNavItem)}
          <NavDivider />
          {NAV_ADMIN.map(renderNavItem)}
        </nav>

        {/* [3] User section */}
        <div
          className={cn(
            "border-t border-[#E2E8F0] px-4 py-4",
            collapsed && "px-1",
          )}
        >
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                ) : null}
                <AvatarFallback className="bg-[#1A5FAB] text-xs font-semibold text-white">
                  {user ? generateInitials(user.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-[18px] font-medium text-[#5A5A66]">
                {user?.full_name ?? "---"}
              </span>
              <button
                onClick={handleLogout}
                title="Dang xuat"
                className="shrink-0 rounded p-1 text-[#718096] transition-colors hover:text-[#E74C3C]"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 shrink-0 cursor-default">
                    {user?.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt={user.full_name} />
                    ) : null}
                    <AvatarFallback className="bg-[#1A5FAB] text-xs font-semibold text-white">
                      {user ? generateInitials(user.full_name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[13px] font-medium text-white shadow-lg"
                >
                  {user?.full_name ?? "---"}
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center rounded p-1 text-[#718096] transition-colors hover:text-[#E74C3C]"
                  >
                    <LogOut size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="rounded-lg border-0 bg-[#E74C3C] px-3 py-2 text-[13px] font-medium text-white shadow-lg"
                >
                  Dang xuat
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
