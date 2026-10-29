import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff, Pencil, Plus, ShieldOff, Truck } from "lucide-react";
import {
  getServiceCatalog,
  activateServiceCatalog,
  deactivateServiceCatalog,
} from "@/api/service-catalog.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { getApiError } from "@/utils/apiError";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { matchesSearch, sortServices } from "@/utils/serviceCatalog";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ServiceCatalogItem } from "@/types/serviceCatalog.types";
import { ServiceFormDialog } from "./components/ServiceFormDialog";

type FilterTab = "all" | "active" | "inactive";
type VehicleFilter = "all" | "yes" | "no";

const VEHICLE_FILTER_LABELS: Record<VehicleFilter, string> = {
  all: "Tất cả",
  yes: "Gán xe được",
  no: "Không gán xe",
};

const FILTER_LABELS: Record<FilterTab, string> = {
  active: "Đang dùng",
  inactive: "Đã ẩn",
  all: "Tất cả",
};

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-light px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Đang dùng
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg-page px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-text-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-text-secondary" />
      Đã ẩn
    </span>
  );
}

// Badge “Có xe” khi allowVehicle = true; false thì để trống
function VehicleBadge({ allowVehicle }: { allowVehicle: boolean }) {
  if (!allowVehicle) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-primary">
      <Truck size={12} />
      Có xe
    </span>
  );
}

const toggleButtonClass = (isActive: boolean) =>
  isActive
    ? "hover:bg-error hover:text-white"
    : "hover:bg-primary-light hover:text-primary";

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canView = hasPermission("service_catalog.view");
  const canCreate = hasPermission("service_catalog.create");
  const canUpdate = hasPermission("service_catalog.update");
  // Ẩn/hiện dùng quyền `delete`, KHÔNG phải `update`
  const canToggle = hasPermission("service_catalog.delete");

  const [filterTab, setFilterTab] = useState<FilterTab>("active");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCatalogItem | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<ServiceCatalogItem | null>(null);

  const { data: servicesRes, isLoading } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    enabled: canView,
  });

  const services = useMemo(() => sortServices(servicesRes?.data ?? []), [servicesRes]);

  const counts = useMemo(() => {
    const active = services.filter((s) => s.isActive).length;
    return { all: services.length, active, inactive: services.length - active };
  }, [services]);

  const filtered = useMemo(
    () =>
      services.filter((s) => {
        if (filterTab === "active" && !s.isActive) return false;
        if (filterTab === "inactive" && s.isActive) return false;
        if (vehicleFilter === "yes" && !s.allowVehicle) return false;
        if (vehicleFilter === "no" && s.allowVehicle) return false;
        return matchesSearch(s.name, search);
      }),
    [services, filterTab, vehicleFilter, search],
  );

  const toggleMutation = useMutation({
    mutationFn: (item: ServiceCatalogItem) =>
      item.isActive ? deactivateServiceCatalog(item.id) : activateServiceCatalog(item.id),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all });
      toast.success(item.isActive ? "Đã ẩn dịch vụ" : "Đã hiện dịch vụ");
      setConfirmToggle(null);
    },
    onError: (err) => {
      toast.error(getServiceErrorMessage(err));
      if (getApiError(err).code === "SERVICE_NOT_FOUND") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all });
      }
      setConfirmToggle(null);
    },
  });

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (item: ServiceCatalogItem) => {
    setEditTarget(item);
    setDialogOpen(true);
  };

  if (!canView) {
    return (
      <div className="rounded-lg border border-border bg-bg-card">
        <EmptyState
          icon={<ShieldOff className="h-7 w-7 text-text-secondary" />}
          title="Không có quyền xem danh mục dịch vụ"
          description="Liên hệ quản trị viên nếu bạn cần truy cập."
        />
      </div>
    );
  }

  const showActions = canUpdate || canToggle;
  const hasFilter = filterTab !== "all" || vehicleFilter !== "all" || search.trim() !== "";

  const columns: ColumnDef<ServiceCatalogItem>[] = [
    {
      accessorKey: "name",
      header: "Tên dịch vụ",
      cell: ({ row }) => (
        <span
          className={cn("font-medium text-text-primary", !row.original.isActive && "opacity-50")}
        >
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "units",
      header: "Đơn vị",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded-md bg-bg-page px-2 py-0.5 text-[length:var(--fs-sm)] text-text-secondary",
            !row.original.isActive && "opacity-50",
          )}
        >
          {row.original.units.join(", ")}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Trạng thái",
      cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} />,
    },
    {
      accessorKey: "allowVehicle",
      header: "Gán xe",
      cell: ({ row }) => <VehicleBadge allowVehicle={row.original.allowVehicle} />,
    },
    ...(showActions
      ? [
          {
            id: "actions",
            header: "Thao tác",
            cell: ({ row }: { row: { original: ServiceCatalogItem } }) => (
              <div className="flex items-center gap-1">
                {canUpdate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 cursor-pointer p-0 text-text-secondary hover:bg-primary-light hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row.original);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Chỉnh sửa</TooltipContent>
                  </Tooltip>
                )}
                {canToggle && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-8 cursor-pointer p-0 text-text-secondary",
                          toggleButtonClass(row.original.isActive),
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmToggle(row.original);
                        }}
                      >
                        {row.original.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {row.original.isActive ? "Ẩn dịch vụ" : "Hiện dịch vụ"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ),
          } satisfies ColumnDef<ServiceCatalogItem>,
        ]
      : []),
  ];

  const addButton = canCreate ? (
    <Button onClick={openCreate} className="cursor-pointer gap-1.5">
      <Plus size={16} />
      Thêm dịch vụ
    </Button>
  ) : undefined;

  // Danh mục rỗng hẳn (mới triển khai) khác với "bộ lọc không có kết quả"
  const emptyTitle = services.length === 0 ? "Chưa có dịch vụ nào" : "Không tìm thấy dịch vụ";
  const emptyDescription =
    services.length === 0
      ? canCreate
        ? "Cần thêm dịch vụ vào danh mục trước khi lập hợp đồng đầu tiên."
        : "Liên hệ quản lý để thêm dịch vụ vào danh mục."
      : hasFilter
        ? "Thử đổi từ khóa hoặc bộ lọc trạng thái"
        : undefined;

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Danh mục dịch vụ"
        subtitle="Quản lý các dịch vụ dùng chung cho hợp đồng"
        actions={addButton}
      />

      {/* Tìm kiếm + bộ lọc (trạng thái, gán xe) — lọc phía FE trên mảng đã tải */}
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên dịch vụ..."
        activeFilterCount={(filterTab !== "all" ? 1 : 0) + (vehicleFilter !== "all" ? 1 : 0)}
        onClearFilters={() => {
          setFilterTab("all");
          setVehicleFilter("all");
        }}
      >
        <div className="space-y-1">
          <Label>Trạng thái</Label>
          <Select value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
                <SelectItem key={tab} value={tab}>
                  {FILTER_LABELS[tab]} ({counts[tab]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Gán xe</Label>
          <Select
            value={vehicleFilter}
            onValueChange={(v) => setVehicleFilter(v as VehicleFilter)}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VEHICLE_FILTER_LABELS) as VehicleFilter[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {VEHICLE_FILTER_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterToolbar>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={services.length === 0 ? addButton : undefined}
        />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-border" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-bg-card p-8 text-center">
            <BookOpen size={28} className="mx-auto mb-2 text-text-disabled" />
            <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
              {emptyTitle}
            </p>
            {emptyDescription && (
              <p className="mt-1 text-[length:var(--fs-sm)] text-text-secondary">
                {emptyDescription}
              </p>
            )}
            {services.length === 0 && addButton && <div className="mt-3">{addButton}</div>}
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl bg-bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-[length:var(--fs-base)] font-medium leading-snug text-text-primary",
                    !item.isActive && "opacity-50",
                  )}
                >
                  {item.name}
                </span>
                <ActiveBadge isActive={item.isActive} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[length:var(--fs-sm)]">
                <span
                  className={cn(
                    "rounded-md bg-bg-page px-2 py-0.5 text-text-secondary",
                    !item.isActive && "opacity-50",
                  )}
                >
                  {item.units.join(", ")}
                </span>
                <VehicleBadge allowVehicle={item.allowVehicle} />
              </div>

              {showActions && (
                <div className="flex items-center gap-2 border-t border-border pt-2">
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 cursor-pointer gap-1.5 text-[length:var(--fs-sm)] text-text-secondary hover:bg-primary-light hover:text-primary"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil size={14} />
                      Sửa
                    </Button>
                  )}
                  {canToggle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex-1 cursor-pointer gap-1.5 text-[length:var(--fs-sm)] text-text-secondary",
                        toggleButtonClass(item.isActive),
                      )}
                      onClick={() => setConfirmToggle(item)}
                    >
                      {item.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      {item.isActive ? "Ẩn" : "Hiện"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditTarget(null);
        }}
        editTarget={editTarget}
        services={services}
        canReactivate={canToggle}
      />

      {confirmToggle && (
        <ConfirmModal
          open={!!confirmToggle}
          onOpenChange={(open) => {
            if (!open) setConfirmToggle(null);
          }}
          title={confirmToggle.isActive ? "Ẩn dịch vụ?" : "Hiện dịch vụ?"}
          description={
            confirmToggle.isActive
              ? `Dịch vụ “${confirmToggle.name}” sẽ không chọn được cho dòng mới. Dòng đã có trong hợp đồng không bị ảnh hưởng.`
              : `Dịch vụ “${confirmToggle.name}” sẽ chọn được lại khi thêm dòng dịch vụ vào hợp đồng.`
          }
          confirmLabel={confirmToggle.isActive ? "Ẩn dịch vụ" : "Hiện dịch vụ"}
          variant={confirmToggle.isActive ? "danger" : "primary"}
          loading={toggleMutation.isPending}
          onConfirm={() => toggleMutation.mutate(confirmToggle)}
        />
      )}
    </div>
  );
}
