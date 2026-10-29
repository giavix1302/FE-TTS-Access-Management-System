import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { History, ShieldOff } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useDebounce } from "@/hooks/useDebounce";
import { getAuditLogs } from "@/api/audit-logs.api";
import { getUsers } from "@/api/users.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { AUDIT_ENTITY_OPTIONS, groupByRequest } from "@/constants/auditLog";
import type { User } from "@/types/user.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DatePicker } from "@/components/shared/DatePicker";
import { Pagination } from "@/components/shared/Pagination";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditLogDetailDialog } from "./components/AuditLogDetailDialog";
import {
  AUDIT_ROW_GRID,
  AuditLogGroupRow,
} from "./components/AuditLogGroupRow";

const PAGE_SIZE = 20;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { hasPermission } = usePermission();
  const canView = hasPermission("audit.view");
  const canListUsers = hasPermission("users.view");

  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [userId, setUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const debouncedEntityId = useDebounce(entityId.trim(), 400);

  const filters = {
    entityType: entityType || undefined,
    entityId: debouncedEntityId || undefined,
    userId: userId ? Number(userId) : undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.auditLogs.all, { ...filters, page, pageSize }],
    queryFn: () => getAuditLogs({ ...filters, page, page_size: pageSize }),
    enabled: canView,
    meta: { silentError: true },
  });

  const { data: usersData } = useQuery({
    queryKey: [...QUERY_KEYS.users.all, { page: 1, pageSize: 100 }],
    queryFn: () => getUsers({ page: 1, page_size: 100 }),
    enabled: canView && canListUsers,
  });
  const users: User[] = usersData?.data ?? [];

  const logs = data?.data ?? [];
  const meta = data?.meta;
  const groups = groupByRequest(logs);
  const isForbidden = isError && isAxiosError(error) && error.response?.status === 403;

  const hasFilter = !!(entityType || entityId || userId || fromDate || toDate);
  const resetAdvancedFilters = () => {
    setEntityType("");
    setUserId("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  if (!canView || isForbidden) {
    return (
      <div className="flex flex-col gap-3 lg:gap-4">
        <PageHeader title="Nhật ký hệ thống" />
        <div className="rounded-lg border border-border bg-bg-card">
          <EmptyState
            icon={<ShieldOff className="h-7 w-7 text-text-secondary" />}
            title="Không có quyền xem lịch sử"
            description="Liên hệ quản trị viên nếu bạn cần truy cập nhật ký hệ thống."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <PageHeader
        title="Nhật ký hệ thống"
        subtitle="Lịch sử thêm / sửa / xóa dữ liệu trên toàn hệ thống"
      />

      <FilterToolbar
        search={entityId}
        onSearchChange={(value) => {
          setEntityId(value);
          setPage(1);
        }}
        searchPlaceholder="Tìm theo ID bản ghi..."
        activeFilterCount={
          Number(!!entityType) +
          Number(!!userId) +
          Number(!!fromDate) +
          Number(!!toDate)
        }
        onClearFilters={resetAdvancedFilters}
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Đối tượng
          </span>
          <Select
            value={entityType || "_all"}
            onValueChange={(v) => {
              setEntityType(v === "_all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full cursor-pointer border-border">
              <SelectValue placeholder="Tất cả đối tượng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Tất cả đối tượng</SelectItem>
              {AUDIT_ENTITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canListUsers && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
              Người thao tác
            </span>
            <Select
              value={userId || "_all"}
              onValueChange={(v) => {
                setUserId(v === "_all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full cursor-pointer border-border">
                <SelectValue placeholder="Tất cả người dùng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tất cả người dùng</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[length:var(--fs-sm)] font-medium text-text-primary">
            Từ ngày
          </span>
          <DatePicker
            value={fromDate}
            onChange={(v) => {
              setFromDate(v);
              setPage(1);
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
              setPage(1);
            }}
            placeholder="Chọn ngày kết thúc"
            className="w-full"
          />
        </div>
      </FilterToolbar>

      <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
      {/* List */}
      {isLoading ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-3 w-24 animate-pulse rounded bg-bg-page" />
              <div className="h-3 w-32 animate-pulse rounded bg-bg-page" />
              <div className="h-3 flex-1 animate-pulse rounded bg-bg-page" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-white">
          <EmptyState
            title="Không tải được nhật ký"
            description="Đã có lỗi xảy ra, vui lòng thử lại sau."
          />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-white">
          <EmptyState
            icon={<History className="h-7 w-7 text-text-secondary" />}
            title="Không có bản ghi nào"
            description={hasFilter ? "Thử thay đổi bộ lọc" : undefined}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          {/* Header — desktop */}
          <div
            className={`hidden h-[52px] items-center gap-x-6 border-b border-border bg-primary-light px-4 text-[length:var(--fs-sm)] font-semibold text-primary sm:grid ${AUDIT_ROW_GRID}`}
          >
            <span>Thời gian</span>
            <span>Người thao tác</span>
            <span>Nội dung</span>
            <span />
          </div>

          <div className="divide-y divide-border">
            {groups.map((g) => (
              <AuditLogGroupRow key={g[0].id} group={g} onSelect={setSelectedId} />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && meta && logs.length > 0 && (
        <Pagination
          pageIndex={page - 1}
          totalPages={meta.totalPages}
          onPageChange={(i) => setPage(i + 1)}
          pageSize={pageSize}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      )}
      </div>

      <AuditLogDetailDialog
        logId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}
