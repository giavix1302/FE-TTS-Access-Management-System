import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Truck, MapPin, RefreshCw } from "lucide-react";
import { getVehicles, createVehicle } from "@/api/vehicles.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { DataTable } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import {
  VEHICLE_STATUS_OPTIONS,
  getVehicleStatusBadge,
} from "@/constants/vehicleStatus";
import { VEHICLE_TYPE_OPTIONS, getVehicleTypeLabel } from "@/constants/vehicleType";
import type { VehicleListItem, VehicleStatus, VehicleType } from "@/types/vehicle.types";
import { VehicleFormFields } from "@/pages/vehicles/components/VehicleForm";
import {
  EMPTY_VEHICLE_FORM,
  applyVehicleServerError,
  makeVehicleSchema,
  toCreateVehicleBody,
  type VehicleFormInput,
  type VehicleFormValues,
} from "@/pages/vehicles/components/vehicleForm.schema";

const createVehicleSchema = makeVehicleSchema("create");

const toHeightParam = (v: string) => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

function LocationLink({ v }: { v: VehicleListItem }) {
  if (v.lat == null || v.lng == null) return <span className="text-text-secondary">—</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={v.locationUpdatedAt ? `Cập nhật: ${formatDateTime(v.locationUpdatedAt)}` : undefined}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[length:var(--fs-sm)] text-primary hover:bg-primary-light cursor-pointer"
    >
      <MapPin className="h-3.5 w-3.5" /> Bản đồ
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  const canCreate = hasPermission("vehicles.create");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<VehicleType | "">("");
  const [minHeight, setMinHeight] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [addOpen, setAddOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const minWorkHeight = toHeightParam(useDebounce(minHeight, 300));
  const maxWorkHeight = toHeightParam(useDebounce(maxHeight, 300));
  const page = pagination.pageIndex + 1;
  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  // ── Query ────────────────────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    vehicle_type: typeFilter || undefined,
    min_work_height: minWorkHeight,
    max_work_height: maxWorkHeight,
    page,
    page_size: pagination.pageSize,
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [...QUERY_KEYS.vehicles.all, listParams],
    queryFn: () => getVehicles(listParams),
  });

  // Lỗi tải (toast đã báo ở QueryCache) — không hiện nhầm thành "không có xe"
  const retryButton = (
    <Button
      size="sm"
      variant="outline"
      className="cursor-pointer"
      disabled={isFetching}
      onClick={() => refetch()}
    >
      <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
      Thử lại
    </Button>
  );

  // ── Mutation ─────────────────────────────────────────────────────────────

  const form = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: EMPTY_VEHICLE_FORM,
  });

  const addMutation = useMutation({
    mutationFn: (values: VehicleFormValues) => createVehicle(toCreateVehicleBody(values)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      toast.success("Thêm xe thành công");
      setAddOpen(false);
      form.reset(EMPTY_VEHICLE_FORM);
      // Sang trang chi tiết để thêm ảnh / bảo hiểm / kiểm định
      if (res?.data?.id) navigate(`/vehicles/${res.data.id}`);
    },
    onError: (err: unknown) => {
      if (!applyVehicleServerError(err, form)) toast.error(getApiErrorMessage(err));
    },
  });

  const closeAdd = () => {
    setAddOpen(false);
    form.reset(EMPTY_VEHICLE_FORM);
  };

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<VehicleListItem>[] = [
    {
      id: "model",
      header: "Model / Serial",
      size: 280,
      cell: ({ row }) => (
        <div className="min-w-0 max-w-full">
          <p
            className="truncate font-semibold text-text-primary"
            title={row.original.model}
          >
            {row.original.model}
          </p>
          <p
            className="truncate text-[length:var(--fs-sm)] text-text-secondary"
            title={row.original.serialNumber}
          >
            {row.original.serialNumber}
          </p>
        </div>
      ),
    },
    {
      id: "manufacturer",
      header: "Hãng SX",
      cell: ({ row }) => (
        <div>
          <p className="text-text-primary">{row.original.manufacturer}</p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary">
            {row.original.manufactureYear}
          </p>
        </div>
      ),
    },
    {
      id: "vehicle_type",
      header: "Loại xe",
      cell: ({ row }) => (
        <span className="text-text-primary">{getVehicleTypeLabel(row.original.vehicleType)}</span>
      ),
    },
    {
      id: "engine_type",
      header: "Động cơ",
      cell: ({ row }) => {
        const isElectric = row.original.engineType === "Electric";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${
              isElectric
                ? "bg-primary-light text-primary"
                : "bg-warning-light text-warning"
            }`}
          >
            {isElectric ? "Điện" : "Xăng/Dầu"}
          </span>
        );
      },
    },
    {
      id: "work_height",
      header: "Cao LV",
      cell: ({ row }) => (
        <span className="text-text-primary">
          {row.original.workHeight != null ? `${row.original.workHeight}m` : "—"}
        </span>
      ),
    },
    {
      id: "location",
      header: "Vị trí",
      cell: ({ row }) => <LocationLink v={row.original} />,
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: ({ row }) => {
        const { label, className } = getVehicleStatusBadge(row.original.status);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${className}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      id: "updated_at",
      header: "Cập nhật lần cuối",
      size: 170,
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap text-[length:var(--fs-sm)] text-text-secondary"
          title="Thời điểm cập nhật thông tin xe gần nhất"
        >
          {formatDateTime(row.original.updatedAt)}
        </span>
      ),
    },
  ];

  const vehicles = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <PageHeader
        title="Quản lý xe nâng"
        subtitle="Danh sách toàn bộ xe nâng người"
        actions={
          canCreate ? (
            <Button
              className="h-auto cursor-pointer rounded-lg border-0 bg-primary px-3 py-1.5 text-[length:var(--fs-sm)] text-white shadow-sm hover:bg-primary-dark sm:px-4 sm:py-2 sm:text-[length:var(--fs-base)]"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Thêm xe
            </Button>
          ) : undefined
        }
      />

      <FilterToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        searchPlaceholder="Tìm theo model, số chế tạo, hãng..."
        activeFilterCount={
          Number(!!statusFilter) + Number(!!typeFilter) + Number(!!minHeight) + Number(!!maxHeight)
        }
        onClearFilters={() => {
          setStatusFilter("");
          setTypeFilter("");
          setMinHeight("");
          setMaxHeight("");
          resetPage();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Loại xe
          </span>
          <Select
            value={typeFilter || "_all"}
            onValueChange={(v) => {
              setTypeFilter(v === "_all" ? "" : (v as VehicleType));
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả loại xe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả loại xe</SelectItem>
              {VEHICLE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Trạng thái
          </span>
          <Select
            value={statusFilter || "_all"}
            onValueChange={(v) => {
              setStatusFilter(v === "_all" ? "" : (v as VehicleStatus));
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả trạng thái</SelectItem>
              {VEHICLE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Chiều cao làm việc từ (m)
          </span>
          <Input
            type="number"
            step="any"
            min={0}
            placeholder="Nhập chiều cao tối thiểu"
            value={minHeight}
            onChange={(e) => {
              setMinHeight(e.target.value);
              resetPage();
            }}
            className="border-border"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Chiều cao làm việc đến (m)
          </span>
          <Input
            type="number"
            step="any"
            min={0}
            placeholder="Nhập chiều cao tối đa"
            value={maxHeight}
            onChange={(e) => {
              setMaxHeight(e.target.value);
              resetPage();
            }}
            className="border-border"
          />
        </div>
      </FilterToolbar>

      {/* Card danh sách xe */}
      <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
        {/* Table — desktop */}
        <div className="hidden sm:block">
          <DataTable
            columns={columns}
            data={vehicles}
            loading={isLoading}
            pagination={pagination}
            pageCount={meta?.totalPages ?? 1}
            onPaginationChange={setPagination}
            onRowClick={(row) => navigate(`/vehicles/${row.id}`)}
            emptyTitle={isError ? "Không tải được danh sách xe" : "Không tìm thấy xe nào"}
            emptyDescription={
              isError ? "Đã có lỗi khi tải dữ liệu, vui lòng thử lại" : "Thử thay đổi bộ lọc hoặc thêm xe mới"
            }
            emptyAction={
              isError ? retryButton : canCreate ? (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm xe
                </Button>
              ) : undefined
            }
          />
        </div>

      {/* Card list — mobile */}
        <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-card rounded-xl border border-border p-4 flex gap-3"
            >
              <div className="h-14 w-14 rounded-lg bg-bg-page shrink-0 animate-pulse" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-2/3 bg-bg-page rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-bg-page rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-bg-page rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 bg-bg-card rounded-xl border border-border">
            <Truck className="h-8 w-8 text-text-secondary" />
            <p className="text-[length:var(--fs-base)] text-text-secondary">
              {isError ? "Không tải được danh sách xe" : "Không tìm thấy xe nào"}
            </p>
            {isError ? retryButton : canCreate && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary-dark text-white mt-1"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> Thêm xe
              </Button>
            )}
          </div>
        ) : (
          vehicles.map((v) => {
            const { label: statusLabel, className: statusClass } =
              getVehicleStatusBadge(v.status);
            const isElectric = v.engineType === "Electric";
            return (
              <div
                key={v.id}
                onClick={() => navigate(`/vehicles/${v.id}`)}
                className="bg-bg-card rounded-xl border border-border p-4 flex gap-3 cursor-pointer hover:border-primary hover:shadow-sm transition-all active:bg-bg-page"
              >
                {/* Ảnh */}
                {v.primaryImageUrl ? (
                  <img
                    src={v.primaryImageUrl}
                    alt={v.model}
                    className="h-14 w-14 rounded-lg object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-bg-page border border-border shrink-0">
                    <Truck className="h-6 w-6 text-text-secondary" />
                  </div>
                )}
                {/* Nội dung */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary text-[length:var(--fs-base)] truncate">
                        {v.model}
                      </p>
                      <p className="text-[length:var(--fs-sm)] text-text-secondary truncate">
                        {v.serialNumber}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[length:var(--fs-sm)] text-text-secondary">
                      {v.manufacturer} · {v.manufactureYear}
                    </span>
                    {v.vehicleType && (
                      <span className="inline-flex items-center rounded-full bg-bg-page px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        {getVehicleTypeLabel(v.vehicleType)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isElectric ? "bg-primary-light text-primary" : "bg-warning-light text-warning"}`}
                    >
                      {isElectric ? "Điện" : "Xăng/Dầu"}
                    </span>
                    <span className="text-[length:var(--fs-sm)] text-text-secondary">
                      Cao LV: {v.workHeight != null ? `${v.workHeight}m` : "—"}
                    </span>
                    {v.lat != null && v.lng != null && <LocationLink v={v} />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination mobile */}
        {!isLoading && meta && (
          <Pagination
            pageIndex={pagination.pageIndex}
            totalPages={meta.totalPages}
            onPageChange={(i) => setPagination((p) => ({ ...p, pageIndex: i }))}
            pageSize={pagination.pageSize}
            onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
          />
        )}
        </div>
      </div>

      {/* ── Modal Thêm xe ── */}
      <MobileSheetDialog
        open={addOpen}
        onOpenChange={(o) => (o ? setAddOpen(true) : closeAdd())}
      >
        <MobileSheetContent mobileVariant="fullscreen" className="sm:max-w-2xl">
          <MobileSheetHeader>
            <MobileSheetTitle>Thêm xe mới</MobileSheetTitle>
          </MobileSheetHeader>

          <form onSubmit={form.handleSubmit((v) => addMutation.mutate(v))}>
            <MobileSheetBody>
              <VehicleFormFields form={form} mode="create" />
            </MobileSheetBody>

            <MobileSheetFooter className="sm:mt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-text-secondary cursor-pointer"
                onClick={closeAdd}
                disabled={addMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </MobileSheetFooter>
          </form>
        </MobileSheetContent>
      </MobileSheetDialog>
    </div>
  );
}
