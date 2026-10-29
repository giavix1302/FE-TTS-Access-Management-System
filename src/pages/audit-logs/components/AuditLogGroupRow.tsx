import { useState } from "react";
import { Archive, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/utils/format";
import {
  getAuditActionBadge,
  getAuditActorName,
  getAuditEntityLabel,
  summarizeAuditChange,
} from "@/constants/auditLog";
import type { AuditAction, AuditLogListItem } from "@/types/auditLog.types";
import { cn } from "@/lib/utils";

// Desktop: Thời gian · Người thao tác · Nội dung · (toggle)
export const AUDIT_ROW_GRID = "sm:grid-cols-[130px_160px_1fr_auto]";

const ACTION_ICON: Record<AuditAction, React.ElementType> = {
  insert: Plus,
  update: Pencil,
  delete: Trash2,
  soft_delete: Archive,
};

const COLLAPSED_LIMIT = 8;

interface GroupSummary {
  action: AuditAction;
  target: string;
  details: string[];
  // Bản ghi gốc đứng đầu, phần còn lại giữ thứ tự BE
  entries: AuditLogListItem[];
}

// Gộp 1 thao tác thành câu: "Cập nhật Hợp đồng #4" + "Đổi: Thuế · Tạo mới Hạng mục hợp đồng"
function summarizeGroup(group: AuditLogListItem[]): GroupSummary {
  const first = group[0];
  const sameRoot =
    first.rootType != null &&
    group.every((e) => e.rootType === first.rootType && String(e.rootId) === String(first.rootId));

  const rootEntry = sameRoot
    ? group.find((e) => e.entityType === first.rootType && e.entityId === String(first.rootId))
    : undefined;
  const head = rootEntry ?? (sameRoot ? undefined : first);
  const others = group.filter((e) => e !== head);

  const details: string[] = [];
  if (head) {
    const changed = summarizeAuditChange(head);
    if (changed) details.push(changed);
  }

  // Gom các bảng con theo action + bảng: "Xóa 30 Quyền của vai trò"
  const counts = new Map<string, { action: AuditAction; entityType: string; n: number; sample: AuditLogListItem }>();
  for (const e of others) {
    const key = `${e.action}|${e.entityType}`;
    const c = counts.get(key);
    if (c) c.n++;
    else counts.set(key, { action: e.action, entityType: e.entityType, n: 1, sample: e });
  }
  for (const c of counts.values()) {
    const action = getAuditActionBadge(c.action).label;
    const entity = getAuditEntityLabel(c.entityType);
    // 1 bản ghi update → nói rõ đổi gì
    const changed = c.n === 1 ? summarizeAuditChange(c.sample) : null;
    details.push(
      c.n > 1
        ? `${action} ${c.n} ${entity.toLowerCase()}`
        : `${action} ${entity.toLowerCase()}${changed ? ` (${changed.replace(/^Đổi: /, "")})` : ""}`,
    );
  }

  return {
    // Chỉ đổi bảng con → bản ghi gốc được coi là "Cập nhật"
    action: head?.action ?? "update",
    target: head
      ? `${getAuditEntityLabel(head.entityType)} #${head.entityId}`
      : `${getAuditEntityLabel(first.rootType!)} #${first.rootId}`,
    details,
    entries: head ? [head, ...others] : others,
  };
}

function ActionIcon({ action, size = "md" }: { action: AuditAction; size?: "sm" | "md" }) {
  const Icon = ACTION_ICON[action] ?? Pencil;
  const { className } = getAuditActionBadge(action);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "h-8 w-8" : "h-5 w-5",
        className,
      )}
    >
      <Icon size={size === "md" ? 15 : 11} />
    </span>
  );
}

// ─── Entry (dòng con khi mở rộng) ─────────────────────────────────────────────

function EntryLine({ log, onSelect }: { log: AuditLogListItem; onSelect: (id: number) => void }) {
  const { label } = getAuditActionBadge(log.action);
  const changed = summarizeAuditChange(log);
  return (
    <button
      type="button"
      onClick={() => onSelect(log.id)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-[length:var(--fs-body)] hover:bg-bg-page"
    >
      <ActionIcon action={log.action} size="sm" />
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="shrink-0 text-text-primary">
        {getAuditEntityLabel(log.entityType)}{" "}
        <span className="font-mono text-[length:var(--fs-sm)] text-text-secondary">#{log.entityId}</span>
      </span>
      {changed && <span className="min-w-0 truncate text-text-secondary">· {changed}</span>}
      <ChevronRight size={14} className="ml-auto shrink-0 text-text-disabled group-hover:text-primary" />
    </button>
  );
}

// ─── Group row ────────────────────────────────────────────────────────────────

interface AuditLogGroupRowProps {
  group: AuditLogListItem[];
  onSelect: (id: number) => void;
}

export function AuditLogGroupRow({ group, onSelect }: AuditLogGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const first = group[0];
  const isSingle = group.length === 1;
  const { action, target, details, entries } = summarizeGroup(group);
  const actionLabel = getAuditActionBadge(action).label;
  const visibleEntries = showAll ? entries : entries.slice(0, COLLAPSED_LIMIT);

  return (
    <div>
      <button
        type="button"
        onClick={() => (isSingle ? onSelect(first.id) : setExpanded((v) => !v))}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-6 px-4 py-3 text-left transition-colors hover:bg-bg-page",
          AUDIT_ROW_GRID,
          expanded && "bg-primary-light",
        )}
      >
        <span className="hidden text-[length:var(--fs-sm)] text-text-secondary sm:block">
          {formatDateTime(first.occurredAt)}
        </span>
        <span className="hidden truncate text-[length:var(--fs-body)] font-medium text-text-primary sm:block">
          {getAuditActorName(first)}
        </span>

        <span className="flex min-w-0 items-center gap-3">
          <ActionIcon action={action} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[length:var(--fs-body)] text-text-primary">
              <span className="text-text-secondary">{actionLabel}</span>{" "}
              <span className="font-semibold">{target}</span>
            </span>
            {details.length > 0 && (
              <span className="truncate text-[length:var(--fs-sm)] text-text-secondary">
                {details.join(" · ")}
              </span>
            )}
            {/* Mobile: người + thời gian */}
            <span className="truncate text-[length:var(--fs-xs)] text-text-secondary sm:hidden">
              {getAuditActorName(first)} · {formatDateTime(first.occurredAt)}
            </span>
          </span>
        </span>

        {isSingle ? (
          <ChevronRight size={16} className="text-text-disabled" />
        ) : (
          <span className="flex items-center gap-1 whitespace-nowrap text-[length:var(--fs-sm)] text-text-secondary">
            {group.length} thay đổi
            <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} />
          </span>
        )}
      </button>

      {!isSingle && expanded && (
        <div className="border-t border-border bg-bg-card px-4 py-2 sm:pl-[calc(130px+160px+3rem+1rem)]">
          {visibleEntries.map((log) => (
            <EntryLine key={log.id} log={log} onSelect={onSelect} />
          ))}
          {entries.length > COLLAPSED_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="cursor-pointer px-2 py-1.5 text-[length:var(--fs-sm)] font-medium text-primary hover:underline"
            >
              {showAll ? "Thu gọn" : `Xem thêm ${entries.length - COLLAPSED_LIMIT} thay đổi`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
