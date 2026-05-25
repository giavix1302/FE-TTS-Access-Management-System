import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  FileText,
  Users,
  Bell,
  UserCog,
  Settings,
  BookOpen,
  ShieldCheck,
  BarChart2,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  exact?: boolean;
  guard?: (roles: string[], permissions: string[]) => boolean;
}

const NAV_MAIN: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/", exact: true },
];

const NAV_BUSINESS: NavItem[] = [
  { label: "Quản lý xe nâng", icon: Truck, to: "/vehicles" },
  { label: "Khách hàng", icon: Users, to: "/customers" },
  { label: "Hợp đồng", icon: FileText, to: "/contracts" },
  {
    label: "Danh mục dịch vụ",
    icon: BookOpen,
    to: "/service-catalog",
    guard: (_roles, permissions) => permissions.includes("service_catalog.view"),
  },
];

const NAV_ANALYTICS: NavItem[] = [
  { label: "Thống kê", icon: BarChart2, to: "/analytics" },
  { label: "Xuất báo cáo", icon: Download, to: "/reports" },
];

const NAV_SYSTEM: NavItem[] = [
  { label: "Thông báo", icon: Bell, to: "/notifications" },
  {
    label: "Người dùng",
    icon: UserCog,
    to: "/users",
    guard: (_roles, permissions) => permissions.includes("users.view"),
  },
  {
    label: "Cài đặt công ty",
    icon: Settings,
    to: "/settings",
    guard: (_roles, permissions) => permissions.includes("company.view"),
  },
  {
    label: "Phân quyền",
    icon: ShieldCheck,
    to: "/roles",
    guard: (roles) => roles.includes("admin"),
  },
];

function NavDivider() {
  return <div className="my-2 border-t border-[#E2E8F0]" />;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  // Đóng sidebar mobile khi chọn menu item
  const handleNavClick = () => {
    if (mobileOpen) onMobileClose();
  };

  const renderNavItem = (item: NavItem) => {
    if (item.guard && !item.guard(roles, permissions)) return null;

    const active = isActive(item);
    const Icon = item.icon;

    const linkContent = (
      <Link
        key={item.to}
        to={item.to}
        onClick={handleNavClick}
        className={cn(
          "flex items-center rounded-md transition-colors",
          "px-[var(--sp-nav-x)] py-[var(--sp-nav-y)] text-[length:var(--fs-nav)]",
          collapsed
            ? cn(
                "justify-center px-0",
                active ? "bg-[#E8F0FB] text-[#1A5FAB]" : "text-[#5A5A66] hover:bg-[#F4F6F8]",
              )
            : cn(
                active
                  ? "border-l-[3px] border-[#1A5FAB] bg-[#E8F0FB] pl-[9px] font-medium text-[#1A5FAB]"
                  : "font-normal text-[#5A5A66] hover:bg-[#F4F6F8]",
              ),
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
        </span>

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
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
          className="flex items-center gap-2 rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[length:var(--fs-body)] font-medium text-white shadow-lg"
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      {/* Backdrop overlay — chỉ hiện trên mobile khi drawer mở */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300",
          // Desktop: layout tĩnh, thu/mở theo collapsed
          "lg:relative lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
          // Mobile: fixed drawer, trượt vào/ra
          "fixed inset-y-0 left-0 z-50 w-[260px] lg:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        style={{ height: "100dvh" }}
      >
        {/* [1] Logo */}
        <div className="flex items-center px-[var(--sp-nav-x)] py-5">
          {!collapsed ? (
            <>
              <img
                src="/LOGOTTS.png"
                alt="TTS Logo"
                className="h-10 w-auto shrink-0 object-contain"
              />
              <span className="ml-2 flex-1 text-[length:var(--fs-logo)] font-bold text-[#1A5FAB]">
                TTS-AWPMS
              </span>
              {/* Nút thu nhỏ — chỉ hiện trên desktop */}
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="ml-1 hidden shrink-0 cursor-pointer items-center justify-center rounded-md p-2 text-[#718096] transition-colors hover:bg-[#F4F6F8] hover:text-[#5A5A66] lg:flex"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[length:var(--fs-body)] font-medium text-white shadow-lg"
                >
                  Thu nhỏ
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  className="mx-auto flex cursor-pointer items-center justify-center rounded-md p-2 text-[#718096] transition-colors hover:bg-[#F4F6F8] hover:text-[#1A5FAB]"
                >
                  <ChevronRight size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="rounded-lg border-0 bg-[#5A5A66] px-3 py-2 text-[length:var(--fs-body)] font-medium text-white shadow-lg"
              >
                Mở rộng
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* [2] Menu chính */}
        <nav className={cn("flex-1 py-2", collapsed ? "px-1" : "px-[var(--sp-nav-x)]")}>
          {NAV_MAIN.map(renderNavItem)}
          <NavDivider />
          {NAV_BUSINESS.map(renderNavItem)}
          <NavDivider />
          {NAV_ANALYTICS.map(renderNavItem)}
          <NavDivider />
          {NAV_SYSTEM.map(renderNavItem)}
        </nav>

      </aside>

    </TooltipProvider>
  );
}
