import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Clock, ExternalLink, Globe, User as UserIcon } from "lucide-react";
import { getAuditLogDetail } from "@/api/audit-logs.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDateTime } from "@/utils/format";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  EMPTY_VALUE,
  HIDDEN_AUDIT_COLUMNS,
  formatAuditValue,
  getAuditMaskedText,
  getAuditActionBadge,
  getAuditActorName,
  getAuditEntityLabel,
  getAuditFieldLabel,
  getAuditRootLink,
} from "@/constants/auditLog";
import type { AuditFieldChange, AuditLogDetail } from "@/types/auditLog.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MobileSheetBody,
  MobileSheetContent,
  MobileSheetDialog,
  MobileSheetHeader,
  MobileSheetTitle,
} from "@/components/shared/MobileSheet";
import { cn } from "@/lib/utils";

// ─── Value / Changes ──────────────────────────────────────────────────────────

function ValueText({
  entityType,
  column,
  value,
  strike,
}: {
  entityType: string;
  column: string;
  value: unknown;
  strike?: boolean;
}) {
  const text = formatAuditValue(entityType, column, value);
  return (
    <span
      className={cn(
        "break-words",
        text === EMPTY_VALUE && "italic text-text-disabled",
        strike && "line-through text-text-secondary",
      )}
    >
      {text}
    </span>
  );
}

function ChangeDetails({ log }: { log: AuditLogDetail }) {
  const entries = Object.entries(log.changes ?? {}).filter(
    ([col]) => !HIDDEN_AUDIT_COLUMNS.has(col),
  );
  const maskedText = (col: string) => getAuditMaskedText(log.entityType, col, log.action);

  if (log.action === "soft_delete" && log.changes?.is_deleted?.new === true) {
    return <p className="text-[length:var(--fs-body)] text-text-secondary">Đã xóa bản ghi (lưu trữ).</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-[length:var(--fs-body)] italic text-text-secondary">
        Không có thay đổi được ghi nhận
      </p>
    );
  }

  if (log.action === "update" || log.action === "soft_delete") {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[minmax(140px,1fr)_2fr_2fr] gap-3 bg-bg-page px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary sm:grid">
          <span>Trường</span>
          <span>Giá trị cũ</span>
          <span>Giá trị mới</span>
        </div>
        {entries.map(([col, change]: [string, AuditFieldChange]) => (
          <div
            key={col}
            className="grid grid-cols-1 gap-1 border-t border-border px-3 py-2 text-[length:var(--fs-body)] first:border-t-0 sm:grid-cols-[minmax(140px,1fr)_2fr_2fr] sm:gap-3 sm:first:border-t"
          >
            <span className="font-medium text-text-primary">
              {getAuditFieldLabel(log.entityType, col)}
            </span>
            {maskedText(col) ? (
              <span className="text-text-secondary sm:col-span-2">{maskedText(col)}</span>
            ) : (
              <>
                <span className="flex gap-1.5">
                  <span className="text-text-secondary sm:hidden">Cũ:</span>
                  {"old" in change ? (
                    <ValueText entityType={log.entityType} column={col} value={change.old} />
                  ) : (
                    <span className="text-text-disabled">—</span>
                  )}
                </span>
                <span className="flex gap-1.5">
                  <span className="text-text-secondary sm:hidden">Mới:</span>
                  {"new" in change ? (
                    <span className="font-medium text-primary">
                      <ValueText entityType={log.entityType} column={col} value={change.new} />
                    </span>
                  ) : (
                    <span className="text-text-disabled">—</span>
                  )}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  // insert → giá trị "new"; delete → giá trị "old" (gạch ngang)
  const isDelete = log.action === "delete";
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-lg border border-border px-3 py-2 sm:grid-cols-2">
      {entries.map(([col, change]) => (
        <div key={col} className="flex flex-wrap gap-x-1.5 text-[length:var(--fs-body)]">
          <dt className="text-text-secondary">{getAuditFieldLabel(log.entityType, col)}:</dt>
          <dd className="min-w-0">
            {maskedText(col) ? (
              <span className="text-text-secondary">{maskedText(col)}</span>
            ) : (
              <ValueText
                entityType={log.entityType}
                column={col}
                value={isDelete ? change.old : change.new}
                strike={isDelete}
              />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function DetailBody({ logId }: { logId: number }) {
  const { data: log, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.auditLogs.detail(logId),
    queryFn: () => getAuditLogDetail(logId),
    // Log không bao giờ thay đổi
    staleTime: Infinity,
    meta: { silentError: true },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-bg-page" />
        <div className="h-24 w-full animate-pulse rounded bg-bg-page" />
      </div>
    );
  }

  if (isError || !log) {
    const notFound = isAxiosError(error) && error.response?.status === 404;
    return (
      <p className="py-6 text-center text-[length:var(--fs-body)] text-text-secondary">
        {notFound ? "Không tìm thấy bản ghi nhật ký" : "Không tải được chi tiết, vui lòng thử lại"}
      </p>
    );
  }

  const { label, className } = getAuditActionBadge(log.action);
  const rootLink = getAuditRootLink(log.rootType, log.rootId);
  const isRootSelf = log.rootType === log.entityType;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium",
            className,
          )}
        >
          {label}
        </span>
        <span className="font-medium text-text-primary">
          {getAuditEntityLabel(log.entityType)}{" "}
          <span className="font-mono text-text-secondary">#{log.entityId}</span>
        </span>
        {rootLink && (
          <Link
            to={rootLink}
            className="flex cursor-pointer items-center gap-1 text-[length:var(--fs-sm)] text-primary hover:underline"
          >
            <ExternalLink size={12} />
            {isRootSelf ? "Mở bản ghi" : `${getAuditEntityLabel(log.rootType!)} #${log.rootId}`}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-body)] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <UserIcon size={13} />
          {getAuditActorName(log)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={13} />
          {formatDateTime(log.occurredAt)}
        </span>
        {log.ipAddress && (
          <span className="flex items-center gap-1.5">
            <Globe size={13} />
            {log.ipAddress}
          </span>
        )}
      </div>

      <ChangeDetails log={log} />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface AuditLogDetailDialogProps {
  logId: number | null;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailDialog({ logId, onOpenChange }: AuditLogDetailDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const open = logId != null;
  const title = "Chi tiết thay đổi";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {logId != null && <DetailBody logId={logId} />}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent title={title}>
        <MobileSheetHeader>
          <MobileSheetTitle>{title}</MobileSheetTitle>
        </MobileSheetHeader>
        <MobileSheetBody>{logId != null && <DetailBody logId={logId} />}</MobileSheetBody>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}
