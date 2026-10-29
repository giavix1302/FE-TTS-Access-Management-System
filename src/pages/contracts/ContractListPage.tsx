import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useQuery } from "@tanstack/react-query";
import { CreateContractDialog } from "./components/CreateContractDialog";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Plus, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/shared/DatePicker";
import { DataTable } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import { getContracts } from "@/api/contracts.api";
import { getCustomers } from "@/api/customers.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { daysUntil, formatCurrency, formatDate } from "@/utils/format";
import { useDebounce } from "@/hooks/useDebounce";
import {
  getContractStatusBadge,
  CONTRACT_STATUS_OPTIONS,
} from "@/constants/contractStatus";
import type { ContractListItem } from "@/types/contract.types";

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
  const [customerFilter, setCustomerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const debouncedSearch = useDebounce(search, 400);
  const page = pagination.pageIndex + 1;

  const { data: customersRes } = useQuery({
    queryKey: [...QUERY_KEYS.customers.all, { forContractFilter: true }],
    queryFn: () => getCustomers({ page: 1, page_size: 100 }),
    staleTime: 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      ...QUERY_KEYS.contracts.all,
      { search: debouncedSearch, status: statusFilter, customerId: customerFilter, fromDate, toDate, page, pageSize: pagination.pageSize },
    ],
    queryFn: () =>
      getContracts({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        customer_id: customerFilter ? Number(customerFilter) : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        page,
        page_size: pagination.pageSize,
      }),
  });

  const contracts: ContractListItem[] = data?.data ?? [];
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
            {row.original.contractNumber || "Chưa có số HĐ"}
          </p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5">
            {formatDate(row.original.createdAt)}
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
            {row.original.customer.displayName}
          </p>
          <span className="inline-block rounded-full bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 mt-0.5">
            {CUSTOMER_TYPE_LABELS[row.original.customer.customerType] ??
              row.original.customer.customerType}
          </span>
        </div>
      ),
    },
    {
      id: "period",
      header: "Thời gian",
      cell: ({ row }) => {
        const c = row.original;
        // HĐ chưa gán xe → không có endDate
        const isNearEnd =
          c.status === "active" && !!c.endDate && daysUntil(c.endDate) <= 7;
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
              {formatDate(c.startDate)} → {formatDate(c.endDate)}
            </span>
          </div>
        );
      },
    },
    {
      id: "total_amount",
      header: "Giá trị",
      cell: ({ row }) => (
        <span className="font-semibold text-text-primary">
          {formatCurrency(row.original.totalAmount)}
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
    <div className="flex flex-col gap-3 lg:gap-4">
      <PageHeader
        title="Hợp đồng"
        subtitle="Tất cả hợp đồng của công ty"
        actions={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-auto cursor-pointer rounded-lg border-0 bg-primary px-3 py-1.5 text-[length:var(--fs-sm)] text-white shadow-sm hover:bg-primary-dark sm:px-4 sm:py-2 sm:text-[length:var(--fs-base)]"
            >
              <Plus size={16} />
              Tạo hợp đồng
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
        searchPlaceholder="Tìm số HĐ, tên khách hàng..."
        activeFilterCount={
          Number(!!statusFilter) + Number(!!customerFilter) + Number(!!fromDate) + Number(!!toDate)
        }
        onClearFilters={() => {
          setStatusFilter("");
          setCustomerFilter("");
          setFromDate("");
          setToDate("");
          resetPage();
        }}
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Trạng thái
          </span>
          <Select
            value={statusFilter || "_all"}
            onValueChange={(v) => {
              setStatusFilter(v === "_all" ? "" : v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
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
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Khách hàng
          </span>
          <Select
            value={customerFilter || "_all"}
            onValueChange={(value) => {
              setCustomerFilter(value === "_all" ? "" : value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả khách hàng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả khách hàng</SelectItem>
              {(customersRes?.data ?? []).map((customer: { id: number; displayName: string }) => (
                <SelectItem key={customer.id} value={String(customer.id)}>
                  {customer.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Từ ngày
          </span>
          <DatePicker
            value={fromDate}
            onChange={(v) => {
              setFromDate(v);
              resetPage();
            }}
            placeholder="Chọn ngày bắt đầu"
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Đến ngày
          </span>
          <DatePicker
            value={toDate}
            onChange={(v) => {
              setToDate(v);
              resetPage();
            }}
            placeholder="Chọn ngày kết thúc"
            className="w-full"
          />
        </div>
      </FilterToolbar>

      <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
      {/* Table — desktop */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={contracts}
          loading={isLoading}
          pagination={pagination}
          pageCount={meta?.totalPages ?? 1}
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
            const isNearEnd =
              c.status === "active" && !!c.endDate && daysUntil(c.endDate) <= 7;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/contracts/${c.id}`)}
                className="bg-bg-card rounded-xl border border-border p-4 flex flex-col gap-3 cursor-pointer hover:border-primary hover:shadow-sm transition-all active:bg-bg-page"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-text-primary text-[length:var(--fs-base)] truncate">
                      {c.contractNumber || "Chưa có số HĐ"}
                    </p>
                    <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5 truncate">
                      {c.customer.displayName}
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
                    {CUSTOMER_TYPE_LABELS[c.customer.customerType] ??
                      c.customer.customerType}
                  </span>
                  <span
                    className={`rounded-full text-[10px] px-2 py-0.5 flex items-center gap-1 ${
                      isNearEnd
                        ? "bg-error-light text-error border border-error"
                        : "bg-primary-light text-primary"
                    }`}
                  >
                    <CalendarIcon size={9} />
                    {formatDate(c.startDate)} → {formatDate(c.endDate)}
                  </span>
                  <span className="rounded-full bg-primary-light text-primary text-[10px] px-2 py-0.5 font-semibold">
                    {formatCurrency(c.totalAmount)}
                  </span>
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
            onPageChange={(pageIndex) => setPagination((p) => ({ ...p, pageIndex }))}
            pageSize={pagination.pageSize}
            onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
          />
        )}
      </div>
      </div>

      <CreateContractDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
