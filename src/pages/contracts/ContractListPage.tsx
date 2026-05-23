import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery } from "@tanstack/react-query";
import { CreateContractDialog } from "./components/CreateContractDialog";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Plus, CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/shared/DatePicker";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatCurrency, formatDate } from "@/utils/format";
import { useDebounce } from "@/hooks/useDebounce";
import {
  getContractStatusBadge,
  CONTRACT_STATUS_OPTIONS,
} from "@/constants/contractStatus";
import type { ContractListItem } from "@/types/contract.types";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_CONTRACTS: ContractListItem[] = [
  {
    id: 1,
    contract_number: "01012026/HĐTTB/TTS-DOTHANH",
    status: "active",
    customer: {
      id: 1,
      customer_type: "business",
      display_name: "Công ty TNHH Đô Thành",
    },
    start_date: "2026-01-05",
    planned_days: 59,
    end_date: "2026-03-05",
    total_amount: 64800000,
    created_at: "2026-01-01T08:00:00Z",
  },
  {
    id: 2,
    contract_number: "02012026/HĐTTB/TTS-DAIPHONG",
    status: "active",
    customer: {
      id: 2,
      customer_type: "business",
      display_name: "Công ty CP Đại Phong",
    },
    start_date: "2026-01-10",
    planned_days: 30,
    end_date: "2026-02-09",
    total_amount: 27000000,
    created_at: "2026-01-08T08:00:00Z",
  },
  {
    id: 3,
    contract_number: "03122025/HĐTTB/TTS-VIETTIN",
    status: "completed",
    customer: {
      id: 3,
      customer_type: "individual",
      display_name: "Nguyễn Văn A",
    },
    start_date: "2025-12-01",
    planned_days: 20,
    end_date: "2025-12-21",
    total_amount: 18000000,
    created_at: "2025-11-28T08:00:00Z",
  },
  {
    id: 4,
    contract_number: "04112025/HĐTTB/TTS-HOANMY",
    status: "cancelled",
    customer: {
      id: 4,
      customer_type: "business",
      display_name: "Bệnh viện Hoàn Mỹ",
    },
    start_date: "2025-11-01",
    planned_days: 45,
    end_date: "2025-12-16",
    total_amount: 40500000,
    created_at: "2025-10-25T08:00:00Z",
  },
  {
    id: 5,
    contract_number: "05102025/HĐTTB/TTS-THANHCONG",
    status: "completed",
    customer: {
      id: 5,
      customer_type: "business",
      display_name: "Công ty Thành Công",
    },
    start_date: "2025-10-01",
    planned_days: 60,
    end_date: "2025-11-30",
    total_amount: 72000000,
    created_at: "2025-09-25T08:00:00Z",
  },
];

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  individual: "Cá nhân",
  business: "Doanh nghiệp",
};

const PAGE_SIZE = 10;

// ─── ContractListPage ─────────────────────────────────────────────────────────
export default function ContractListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("contracts.create");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const debouncedSearch = useDebounce(search, 400);
  const page = pagination.pageIndex + 1;

  // --- REAL API ---
  // const { data, isLoading } = useQuery({
  //   queryKey: [...QUERY_KEYS.contracts.all, { search: debouncedSearch, status: statusFilter, fromDate, toDate, page }],
  //   queryFn: () => getContracts({ search: debouncedSearch, status: statusFilter, from_date: fromDate, to_date: toDate, page }),
  // })

  // Mock: filter client-side
  const { data, isLoading } = useQuery({
    queryKey: [
      ...QUERY_KEYS.contracts.all,
      { search: debouncedSearch, status: statusFilter, fromDate, toDate, page },
    ],
    queryFn: () => {
      const filtered = MOCK_CONTRACTS.filter((c) => {
        const matchSearch =
          !debouncedSearch ||
          c.contract_number
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase()) ||
          c.customer.display_name
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase());
        const matchStatus = !statusFilter || c.status === statusFilter;
        const matchFrom = !fromDate || c.start_date >= fromDate;
        const matchTo = !toDate || c.end_date <= toDate;
        return matchSearch && matchStatus && matchFrom && matchTo;
      });
      const start = (page - 1) * PAGE_SIZE;
      return Promise.resolve({
        data: filtered.slice(start, start + PAGE_SIZE),
        meta: {
          total: filtered.length,
          page,
          page_size: PAGE_SIZE,
          total_pages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
        },
      });
    },
  });

  const contracts = data?.data ?? [];
  const meta = data?.meta;

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  // ─── Columns (desktop) ───────────────────────────────────────────────────────
  const columns: ColumnDef<ContractListItem>[] = [
    {
      id: "contract_number",
      header: "Số hợp đồng",
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-semibold text-text-primary">
            {row.original.contract_number}
          </p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5">
            {formatDate(row.original.created_at)}
          </p>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Khách hàng",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-text-primary">
            {row.original.customer.display_name}
          </p>
          <span className="inline-block rounded-full bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 mt-0.5">
            {CUSTOMER_TYPE_LABELS[row.original.customer.customer_type] ??
              row.original.customer.customer_type}
          </span>
        </div>
      ),
    },
    {
      id: "period",
      header: "Thời gian",
      cell: ({ row }) => {
        const c = row.original;
        const daysLeft = Math.ceil(
          (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        const isNearEnd = c.status === "active" && daysLeft <= 7;
        return (
          <div className="space-y-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-1 ${
                isNearEnd
                  ? "bg-error-light text-error border border-error"
                  : "bg-primary-light text-primary"
              }`}
            >
              <CalendarIcon size={10} />
              {formatDate(c.start_date)} → {formatDate(c.end_date)}
            </span>
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              {c.planned_days} ngày
            </p>
          </div>
        );
      },
    },
    {
      id: "total_amount",
      header: "Giá trị",
      cell: ({ row }) => (
        <span className="font-semibold text-text-primary">
          {formatCurrency(row.original.total_amount)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      cell: ({ row }) => {
        const { label, className } = getContractStatusBadge(
          row.original.status,
        );
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

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Hợp đồng"
        subtitle="Tất cả hợp đồng của công ty"
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)} className="cursor-pointer">
              <Plus size={16} />
              Tạo hợp đồng
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Tìm số HĐ, tên khách hàng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="pl-9 border-border"
          />
        </div>

        <Select
          value={statusFilter || "_all"}
          onValueChange={(v) => {
            setStatusFilter(v === "_all" ? "" : v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-48 border-border cursor-pointer">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả trạng thái</SelectItem>
            {CONTRACT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePicker
          value={fromDate}
          onChange={(v) => { setFromDate(v); resetPage(); }}
          placeholder="Từ ngày"
          className="w-36 shrink-0"
        />
        <DatePicker
          value={toDate}
          onChange={(v) => { setToDate(v); resetPage(); }}
          placeholder="Đến ngày"
          className="w-36 shrink-0"
        />
        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFromDate("");
              setToDate("");
              resetPage();
            }}
            className="cursor-pointer text-text-secondary"
          >
            Xóa ngày
          </Button>
        )}

        {meta && (
          <p className="ml-auto text-[length:var(--fs-base)] text-text-secondary">
            Tổng{" "}
            <span className="font-medium text-text-primary">{meta.total}</span>{" "}
            hợp đồng
            {meta.total_pages > 1 && (
              <>
                {" "}
                — Trang{" "}
                <span className="font-medium text-text-primary">
                  {meta.page}
                </span>{" "}
                / {meta.total_pages}
              </>
            )}
          </p>
        )}
      </div>

      {/* Table — desktop */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={contracts}
          loading={isLoading}
          pagination={pagination}
          pageCount={meta?.total_pages ?? 1}
          onPaginationChange={setPagination}
          onRowClick={(row) => navigate(`/contracts/${row.id}`)}
          emptyTitle="Không tìm thấy hợp đồng nào"
          emptyDescription="Thử thay đổi bộ lọc hoặc tạo hợp đồng mới"
          emptyAction={
            canCreate ? (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Tạo hợp đồng
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Card list — mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-card rounded-xl border border-border p-4 space-y-2"
            >
              <div className="h-4 w-2/3 bg-bg-page rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-bg-page rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-bg-page rounded animate-pulse" />
            </div>
          ))
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 bg-bg-card rounded-xl border border-border">
            <p className="text-[length:var(--fs-base)] text-text-secondary">
              Không tìm thấy hợp đồng nào
            </p>
            {canCreate && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary-dark text-white mt-1 cursor-pointer"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> Tạo hợp đồng
              </Button>
            )}
          </div>
        ) : (
          contracts.map((c) => {
            const { label: statusLabel, className: statusClass } =
              getContractStatusBadge(c.status);
            const daysLeft = Math.ceil(
              (new Date(c.end_date).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24),
            );
            const isNearEnd = c.status === "active" && daysLeft <= 7;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/contracts/${c.id}`)}
                className="bg-bg-card rounded-xl border border-border p-4 flex flex-col gap-3 cursor-pointer hover:border-primary hover:shadow-sm transition-all active:bg-bg-page"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-text-primary text-[length:var(--fs-base)] truncate">
                      {c.contract_number}
                    </p>
                    <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5 truncate">
                      {c.customer.display_name}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5">
                    {CUSTOMER_TYPE_LABELS[c.customer.customer_type] ??
                      c.customer.customer_type}
                  </span>
                  <span
                    className={`rounded-full text-[10px] px-2 py-0.5 flex items-center gap-1 ${
                      isNearEnd
                        ? "bg-error-light text-error border border-error"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    <CalendarIcon size={9} />
                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                  </span>
                  <span className="rounded-full bg-primary-light text-primary text-[10px] px-2 py-0.5">
                    {c.planned_days} ngày
                  </span>
                  <span className="rounded-full bg-primary-light text-primary text-[10px] px-2 py-0.5 font-semibold">
                    {formatCurrency(c.total_amount)}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination mobile */}
        {!isLoading && meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between px-1 pt-1">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Trang {meta.page}/{meta.total_pages} · {meta.total} HĐ
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 border-border cursor-pointer"
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
                className="h-8 px-3 border-border cursor-pointer"
                disabled={pagination.pageIndex + 1 >= meta.total_pages}
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

      <CreateContractDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
