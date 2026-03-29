import { NavLink } from "react-router-dom";
import { LayoutDashboard, Car, FileText, Users, Bell, Settings, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/vehicles", icon: Car, label: "Phương tiện" },
  { to: "/contracts", icon: FileText, label: "Hợp đồng" },
  { to: "/customers", icon: Users, label: "Khách hàng" },
  { to: "/users", icon: UserCog, label: "Người dùng" },
  { to: "/notifications", icon: Bell, label: "Thông báo" },
  { to: "/settings", icon: Settings, label: "Cài đặt" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col border-r border-border bg-bg-sidebar shadow-card">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <img src="/LOGOTTS.png" alt="TTS Logo" className="h-8" />
        <span className="ml-2 font-semibold text-primary text-sm">AWPMS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-light text-primary"
                  : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
