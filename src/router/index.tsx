import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

// Pages
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import VehicleListPage from "@/pages/vehicles/VehicleListPage";
import VehicleDetailPage from "@/pages/vehicles/VehicleDetailPage";
import ContractListPage from "@/pages/contracts/ContractListPage";
import ContractDetailPage from "@/pages/contracts/ContractDetailPage";
import CustomerListPage from "@/pages/customers/CustomerListPage";
import CustomerDetailPage from "@/pages/customers/CustomerDetailPage";
import UserListPage from "@/pages/users/UserListPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import CompanySettingsPage from "@/pages/settings/CompanySettingsPage";
import ServiceCatalogPage from "@/pages/service-catalog/ServiceCatalogPage";
import RolesPermissionsPage from "@/pages/roles/RolesPermissionsPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import ComingSoonPage from "@/pages/coming-soon/ComingSoonPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "vehicles", element: <VehicleListPage /> },
      { path: "vehicles/:id", element: <VehicleDetailPage /> },
      { path: "contracts", element: <ContractListPage /> },
      { path: "contracts/:id", element: <ContractDetailPage /> },
      { path: "customers", element: <CustomerListPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "users", element: <UserListPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "settings", element: <CompanySettingsPage /> },
      { path: "service-catalog", element: <ServiceCatalogPage /> },
      { path: "roles", element: <RolesPermissionsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "analytics", element: <ComingSoonPage title="Thống kê" description="Trang thống kê tổng quan doanh thu, xe và hợp đồng đang được phát triển." /> },
      { path: "reports", element: <ComingSoonPage title="Xuất báo cáo" description="Tính năng xuất báo cáo Excel / PDF theo kỳ đang được phát triển." /> },
    ],
  },
]);
