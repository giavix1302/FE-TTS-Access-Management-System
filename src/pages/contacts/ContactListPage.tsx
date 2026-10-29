import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { Mail, Phone, Users } from "lucide-react";
import { getContacts } from "@/api/customers.api";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterToolbar } from "@/components/shared/FilterToolbar";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDateTime } from "@/utils/format";
import type { ContactListItem } from "@/types/customer.types";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;
const displayValue = (value?: string) => value?.trim() || "—";

export default function ContactListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const debouncedSearch = useDebounce(search, 300);
  const page = pagination.pageIndex + 1;

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.contacts.all, { search: debouncedSearch, page, pageSize: pagination.pageSize }],
    queryFn: () => getContacts({
      search: debouncedSearch.trim() || undefined,
      page,
      page_size: pagination.pageSize,
    }),
  });

  const columns: ColumnDef<ContactListItem>[] = [
    {
      id: "fullName",
      header: "Người liên hệ",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
            <Users className="h-4 w-4" />
          </span>
          <span className="font-medium text-text-primary">{row.original.fullName}</span>
        </div>
      ),
    },
    {
      id: "phone",
      header: "Điện thoại",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-[length:var(--fs-sm)] text-text-secondary"><Phone className="h-3.5 w-3.5" />{displayValue(row.original.phone)}</span>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-[length:var(--fs-sm)] text-text-secondary"><Mail className="h-3.5 w-3.5" />{displayValue(row.original.email)}</span>
      ),
    },
    {
      id: "customerCount",
      header: "Khách hàng liên kết",
      cell: ({ row }) => (
        <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-[length:var(--fs-xs)] font-medium text-primary">{row.original.customerCount} khách hàng</span>
      ),
    },
    {
      id: "updatedAt",
      header: "Cập nhật lần cuối",
      cell: ({ row }) => <span className="whitespace-nowrap text-[length:var(--fs-sm)] text-text-secondary">{formatDateTime(row.original.updatedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <PageHeader title="Người liên hệ" subtitle="Quản lý người liên hệ dùng chung giữa các khách hàng" />
      <FilterToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPagination((current) => ({ ...current, pageIndex: 0 }));
        }}
        searchPlaceholder="Tìm tên, số điện thoại, email..."
        showFilters={false}
      >
        <span />
      </FilterToolbar>
      <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          pagination={pagination}
          pageCount={data?.meta.totalPages ?? 1}
          onPaginationChange={setPagination}
          onRowClick={(contact) => navigate(`/contacts/${contact.id}`)}
          emptyTitle="Chưa có người liên hệ"
          emptyDescription="Người liên hệ được tạo độc lập hoặc khi thêm vào khách hàng."
        />
      </div>
    </div>
  );
}
