import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Truck, Search } from "lucide-react";
import { getVehicles, createVehicle } from "@/api/vehicles.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type VehicleStatus,
} from "@/constants/vehicleStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: number;
  model: string;
  serialNumber: string;
  manufacturer: string;
  manufactureYear: number;
  engineType: "Fuel" | "Electric";
  workHeight: number | null;
  status: VehicleStatus;
  primaryImageUrl: string | null;
  createdAt: string;
}

interface VehicleListResponse {
  data: Vehicle[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const addVehicleSchema = z.object({
  model: z.string().min(1, "Bắt buộc"),
  serial_number: z.string().min(1, "Bắt buộc"),
  manufacturer: z.string().min(1, "Bắt buộc"),
  engine_type: z.enum(["Fuel", "Electric"], { required_error: "Bắt buộc" }),
  manufacture_year: z.coerce.number().int().min(1990).max(2100).optional(),
  capacity: z.coerce.number().positive().optional(),
  occupancy: z.coerce.number().int().positive().optional(),
  platform_height: z.coerce.number().positive().optional(),
  work_height: z.coerce.number().positive().optional(),
  lifting_speed: z.coerce.number().positive().optional(),
  traveling_speed: z.coerce.number().positive().optional(),
});

type AddVehicleForm = z.infer<typeof addVehicleSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  const isAdminOrManager = hasPermission("vehicles.create");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [addOpen, setAddOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 400);
  const page = pagination.pageIndex + 1;

  // ── Query ────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<VehicleListResponse>({
    queryKey: [
      ...QUERY_KEYS.vehicles.all,
      { search: debouncedSearch, status: statusFilter, page },
    ],
    queryFn: () =>
      getVehicles({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: pagination.pageSize,
      }),
  });

  // ── Mutation ─────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (body: AddVehicleForm) => createVehicle(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      toast.success("Thêm xe thành công");
      setAddOpen(false);
      reset();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Form ─────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddVehicleForm>({ resolver: zodResolver(addVehicleSchema) });

  const onSubmit = (values: AddVehicleForm) =>
    addMutation.mutate({
      serialNumber: values.serial_number,
      model: values.model,
      manufacturer: values.manufacturer,
      manufactureYear: values.manufacture_year,
      engineType: values.engine_type,
      capacity: values.capacity,
      occupancy: values.occupancy,
      platformHeight: values.platform_height,
      workHeight: values.work_height,
      liftingSpeed: values.lifting_speed,
      travelingSpeed: values.traveling_speed,
    } as unknown as AddVehicleForm);

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<Vehicle>[] = [
    {
      id: "image",
      header: "Ảnh",
      cell: ({ row }) =>
        row.original.primaryImageUrl ? (
          <img
            src={row.original.primaryImageUrl}
            alt={row.original.model}
            className="h-12 w-12 rounded-lg object-cover border border-border"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-bg-page border border-border">
            <Truck className="h-5 w-5 text-text-secondary" />
          </div>
        ),
    },
    {
      id: "model",
      header: "Model / Serial",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-text-primary">
            {row.original.model}
          </p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary">
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
  ];

  const vehicles = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Quản lý xe nâng"
        subtitle="Danh sách toàn bộ xe nâng người"
        actions={
          isAdminOrManager ? (
            <Button
              className="cursor-pointer bg-primary hover:bg-primary-dark text-white text-[length:var(--fs-sm)] sm:text-[length:var(--fs-base)] px-3 py-1.5 sm:px-4 sm:py-2 h-auto"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Thêm xe
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Tìm theo model, số chế tạo, hãng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className="pl-9 border-border"
          />
        </div>

        <Select
          value={statusFilter || "_all"}
          onValueChange={(v) => {
            setStatusFilter(v === "_all" ? "" : v);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-full sm:w-48 border-border cursor-pointer">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả</SelectItem>
            {VEHICLE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {meta && (
          <p className="ml-auto text-[length:var(--fs-base)] text-text-secondary">
            Tổng{" "}
            <span className="font-medium text-text-primary">{meta.total}</span>{" "}
            xe
            {meta.totalPages > 1 && (
              <>
                {" "}
                — Trang{" "}
                <span className="font-medium text-text-primary">
                  {meta.page}
                </span>{" "}
                / {meta.totalPages}
              </>
            )}
          </p>
        )}
      </div>

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
          emptyTitle="Không tìm thấy xe nào"
          emptyDescription="Thử thay đổi bộ lọc hoặc thêm xe mới"
          emptyAction={
            isAdminOrManager ? (
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
              Không tìm thấy xe nào
            </p>
            {isAdminOrManager && (
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
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isElectric ? "bg-primary-light text-primary" : "bg-warning-light text-warning"}`}
                    >
                      {isElectric ? "Điện" : "Xăng/Dầu"}
                    </span>
                    <span className="text-[length:var(--fs-sm)] text-text-secondary">
                      Cao LV: {v.workHeight != null ? `${v.workHeight}m` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination mobile */}
        {!isLoading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Trang {meta.page}/{meta.totalPages} · {meta.total} xe
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 border-border"
                disabled={pagination.pageIndex === 0}
                onClick={() =>
                  setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
                }
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 border-border"
                disabled={pagination.pageIndex + 1 >= meta.totalPages}
                onClick={() =>
                  setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
                }
              >
                Tiếp
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Thêm xe ── */}
      <MobileSheetDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) reset();
        }}
      >
        <MobileSheetContent mobileVariant="fullscreen" className="sm:max-w-2xl">
          <MobileSheetHeader>
            <MobileSheetTitle>Thêm xe mới</MobileSheetTitle>
          </MobileSheetHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <MobileSheetBody>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cột 1 */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Model <span className="text-error">*</span>
                    </Label>
                    <Input
                      {...register("model")}
                      placeholder="VD: AWP 20S"
                      className="border-border"
                    />
                    {errors.model && (
                      <p className="text-[length:var(--fs-sm)] text-error">
                        {errors.model.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Serial Number <span className="text-error">*</span>
                    </Label>
                    <Input
                      {...register("serial_number")}
                      placeholder="VD: SN-2021-001"
                      className="border-border"
                    />
                    {errors.serial_number && (
                      <p className="text-[length:var(--fs-sm)] text-error">
                        {errors.serial_number.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Hãng SX <span className="text-error">*</span>
                    </Label>
                    <Input
                      {...register("manufacturer")}
                      placeholder="VD: Genie"
                      className="border-border"
                    />
                    {errors.manufacturer && (
                      <p className="text-[length:var(--fs-sm)] text-error">
                        {errors.manufacturer.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Năm SX
                    </Label>
                    <Input
                      {...register("manufacture_year")}
                      type="number"
                      placeholder="VD: 2021"
                      className="border-border"
                    />
                  </div>
                </div>

                {/* Cột 2 */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Loại động cơ <span className="text-error">*</span>
                    </Label>
                    <Select
                      onValueChange={(v) =>
                        setValue("engine_type", v as "Fuel" | "Electric")
                      }
                    >
                      <SelectTrigger className="border-border cursor-pointer">
                        <SelectValue placeholder="Chọn loại động cơ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Electric">Điện</SelectItem>
                        <SelectItem value="Fuel">Xăng/Dầu</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.engine_type && (
                      <p className="text-[length:var(--fs-sm)] text-error">
                        {errors.engine_type.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Tải trọng (kg)
                    </Label>
                    <Input
                      {...register("capacity")}
                      type="number"
                      placeholder="VD: 230"
                      className="border-border"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Số người
                    </Label>
                    <Input
                      {...register("occupancy")}
                      type="number"
                      placeholder="VD: 1"
                      className="border-border"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[length:var(--fs-base)] font-medium">
                      Chiều cao sàn (m)
                    </Label>
                    <Input
                      {...register("platform_height")}
                      type="number"
                      step="any"
                      placeholder="VD: 7.79"
                      className="border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Chiều cao LV (m)
                  </Label>
                  <Input
                    {...register("work_height")}
                    type="number"
                    step="any"
                    placeholder="VD: 9.8"
                    className="border-border"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Tốc độ nâng (m/ph)
                  </Label>
                  <Input
                    {...register("lifting_speed")}
                    type="number"
                    step="any"
                    placeholder="VD: 0.20"
                    className="border-border"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Tốc độ di chuyển (km/h)
                  </Label>
                  <Input
                    {...register("traveling_speed")}
                    type="number"
                    step="any"
                    placeholder="VD: 4.0"
                    className="border-border"
                  />
                </div>
              </div>
            </MobileSheetBody>

            <MobileSheetFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border text-text-secondary cursor-pointer"
                onClick={() => {
                  setAddOpen(false);
                  reset();
                }}
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
