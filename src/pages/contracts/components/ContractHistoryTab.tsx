import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getContractHistory } from "@/api/audit-logs.api";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { groupByRequest } from "@/constants/auditLog";
import { AuditLogGroupRow } from "@/pages/audit-logs/components/AuditLogGroupRow";
import { AuditLogDetailDialog } from "@/pages/audit-logs/components/AuditLogDetailDialog";
import { QUERY_KEYS } from "@/utils/queryKeys";

const PAGE_SIZE = 20;

export function ContractHistoryTab({ contractId }: { contractId: number }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.contracts.history(contractId, pageIndex + 1),
    queryFn: () => getContractHistory(contractId, { page: pageIndex + 1, page_size: PAGE_SIZE }),
  });

  const groups = groupByRequest(data?.data ?? []);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-bg-card">
      <div className="border-b border-border px-5 py-3 font-medium text-text-primary">Lịch sử thay đổi</div>
      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="Chưa có lịch sử thay đổi" description="Các thao tác trên hợp đồng sẽ xuất hiện tại đây." />
      ) : (
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <AuditLogGroupRow key={group[0].id} group={group} onSelect={setSelectedId} />
          ))}
        </div>
      )}
      {(data?.meta.totalPages ?? 0) > 1 && (
        <div className="border-t border-border p-3">
          <Pagination
            pageIndex={pageIndex}
            totalPages={data?.meta.totalPages ?? 1}
            onPageChange={setPageIndex}
          />
        </div>
      )}
      <AuditLogDetailDialog logId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}
