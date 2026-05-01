import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldAlert,
  Wrench,
  CheckCheck,
  ExternalLink,
  Clock,
} from "lucide-react";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDate, formatDateTime } from "@/utils/format";
import { useNotificationStore } from "@/stores/notificationStore";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "expiry_warning_15d"
  | "expiry_warning_7d"
  | "expiry_warning_3d";

type EntityType = "insurance" | "inspection";

interface NotificationEntity {
  id: number;
  vehicle: {
    id: number;
    model: string;
    serial_number: string;
  };
  expiry_date: string;
}

interface Notification {
  id: number;
  type: NotificationType;
  entity_type: EntityType;
  entity: NotificationEntity;
  message: string;
  notify_date: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  data: Notification[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    unread_count: number;
  };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const TODAY = new Date();
const daysAgo = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysFromNow = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: "expiry_warning_3d",
    entity_type: "insurance",
    entity: {
      id: 1,
      vehicle: { id: 1, model: "AWP 20S", serial_number: "SN-2021-001" },
      expiry_date: daysFromNow(3),
    },
    message: "KHẨN: Bảo hiểm xe AWP 20S (SN-2021-001) còn 3 ngày nữa hết hạn.",
    notify_date: daysAgo(0).split("T")[0],
    sent_at: daysAgo(0),
    read_at: null,
    created_at: daysAgo(30),
  },
  {
    id: 2,
    type: "expiry_warning_7d",
    entity_type: "inspection",
    entity: {
      id: 2,
      vehicle: { id: 2, model: "Haulotte HA16", serial_number: "SN-2019-004" },
      expiry_date: daysFromNow(7),
    },
    message: "Đăng kiểm xe Haulotte HA16 (SN-2019-004) còn 7 ngày nữa hết hạn.",
    notify_date: daysAgo(0).split("T")[0],
    sent_at: daysAgo(0),
    read_at: null,
    created_at: daysAgo(20),
  },
  {
    id: 3,
    type: "expiry_warning_15d",
    entity_type: "insurance",
    entity: {
      id: 3,
      vehicle: { id: 3, model: "Genie Z-60/34", serial_number: "SN-2020-003" },
      expiry_date: daysFromNow(15),
    },
    message: "Bảo hiểm xe Genie Z-60/34 (SN-2020-003) còn 15 ngày nữa hết hạn.",
    notify_date: daysAgo(0).split("T")[0],
    sent_at: daysAgo(0),
    read_at: null,
    created_at: daysAgo(10),
  },
  {
    id: 4,
    type: "expiry_warning_7d",
    entity_type: "insurance",
    entity: {
      id: 4,
      vehicle: { id: 4, model: "JLG 1350SJP", serial_number: "SN-2018-007" },
      expiry_date: daysFromNow(7),
    },
    message: "Bảo hiểm xe JLG 1350SJP (SN-2018-007) còn 7 ngày nữa hết hạn.",
    notify_date: daysAgo(7).split("T")[0],
    sent_at: daysAgo(7),
    read_at: daysAgo(6),
    created_at: daysAgo(25),
  },
  {
    id: 5,
    type: "expiry_warning_15d",
    entity_type: "inspection",
    entity: {
      id: 5,
      vehicle: { id: 1, model: "AWP 20S", serial_number: "SN-2021-001" },
      expiry_date: daysFromNow(15),
    },
    message: "Đăng kiểm xe AWP 20S (SN-2021-001) còn 15 ngày nữa hết hạn.",
    notify_date: daysAgo(15).split("T")[0],
    sent_at: daysAgo(15),
    read_at: daysAgo(14),
    created_at: daysAgo(40),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; urgency: "high" | "medium" | "low" }
> = {
  expiry_warning_3d:  { label: "Hết hạn trong 3 ngày",  urgency: "high" },
  expiry_warning_7d:  { label: "Hết hạn trong 7 ngày",  urgency: "medium" },
  expiry_warning_15d: { label: "Hết hạn trong 15 ngày", urgency: "low" },
};

const ENTITY_LABEL: Record<EntityType, string> = {
  insurance:  "Bảo hiểm",
  inspection: "Đăng kiểm",
};

function NotificationIcon({
  type,
  entityType,
}: {
  type: NotificationType;
  entityType: EntityType;
}) {
  const urgency = TYPE_CONFIG[type]?.urgency ?? "low";
  const Icon = entityType === "insurance" ? ShieldAlert : Wrench;
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        urgency === "high"   && "bg-red-100 text-red-600",
        urgency === "medium" && "bg-amber-100 text-amber-600",
        urgency === "low"    && "bg-blue-100 text-blue-600",
      )}
    >
      <Icon size={18} />
    </div>
  );
}

function UrgencyBadge({ type }: { type: NotificationType }) {
  const config = TYPE_CONFIG[type];
  return (
    <Badge
      className={cn(
        "shrink-0 text-[length:var(--fs-xs)]",
        config.urgency === "high"   && "bg-red-100 text-red-700 hover:bg-red-100",
        config.urgency === "medium" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
        config.urgency === "low"    && "bg-blue-100 text-blue-700 hover:bg-blue-100",
      )}
    >
      {config.label}
    </Badge>
  );
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: number) => void;
  isMarkingRead: boolean;
}

function NotificationItem({
  notification: n,
  onMarkRead,
  isMarkingRead,
}: NotificationItemProps) {
  const isUnread = !n.read_at;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4 transition-colors",
        isUnread
          ? "border-[#BFDBFE] bg-[#EFF6FF]"
          : "border-[#E2E8F0] bg-white",
      )}
    >
      <NotificationIcon type={n.type} entityType={n.entity_type} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="shrink-0 text-[length:var(--fs-xs)] text-[#718096]"
          >
            {ENTITY_LABEL[n.entity_type]}
          </Badge>
          <UrgencyBadge type={n.type} />
          {isUnread && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#1A5FAB]" />
          )}
        </div>

        {/* message */}
        <p
          className={cn(
            "text-[length:var(--fs-body)] leading-snug",
            isUnread
              ? "font-medium text-[#1A3A5C]"
              : "text-[#4A5568]",
          )}
        >
          {n.message}
        </p>

        {/* meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--fs-body)] text-[#718096]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatDateTime(n.sent_at)}
          </span>
          <span>
            Hết hạn:{" "}
            <span className="font-medium">{formatDate(n.entity.expiry_date)}</span>
          </span>
        </div>

        {/* actions */}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <Link
            to={`/vehicles/${n.entity.vehicle.id}`}
            className="flex cursor-pointer items-center gap-1 text-[length:var(--fs-body)] font-medium text-[#1A5FAB] hover:underline"
          >
            <ExternalLink size={12} />
            {n.entity.vehicle.model} ({n.entity.vehicle.serial_number})
          </Link>

          {isUnread && (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              disabled={isMarkingRead}
              className="cursor-pointer text-[length:var(--fs-body)] text-[#718096] hover:text-[#1A5FAB] disabled:opacity-50"
            >
              Đánh dấu đã đọc
            </button>
          )}
        </div>
      </div>

      {/* Date — desktop only */}
      <div className="hidden shrink-0 text-right text-[length:var(--fs-body)] text-[#718096] sm:block">
        {formatDate(n.notify_date)}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterType = "all" | "unread" | "read";

const FILTER_LABEL: Record<FilterType, string> = {
  all:    "Tất cả",
  unread: "Chưa đọc",
  read:   "Đã đọc",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const [filter, setFilter] = useState<FilterType>("all");

  // --- MOCK query ---
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: [...QUERY_KEYS.notifications.all, filter],
    queryFn: () => {
      const filtered =
        filter === "unread"
          ? MOCK_NOTIFICATIONS.filter((n) => !n.read_at)
          : filter === "read"
          ? MOCK_NOTIFICATIONS.filter((n) => !!n.read_at)
          : MOCK_NOTIFICATIONS;
      const unread_count = MOCK_NOTIFICATIONS.filter((n) => !n.read_at).length;
      return Promise.resolve({
        data: filtered,
        meta: {
          total: filtered.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
          unread_count,
        },
      });
      // --- REAL API ---
      // return getNotifications({
      //   is_read: filter === "all" ? undefined : filter === "read",
      // });
    },
    select: (res) => {
      setUnreadCount(res.meta.unread_count);
      return res;
    },
  });

  // Mark single as read
  const { mutate: markRead, isPending: isMarkingRead } = useMutation({
    mutationFn: (_id: number) =>
      new Promise<void>((res) => setTimeout(res, 300)),
    // --- REAL API ---
    // mutationFn: markAsRead,
    onSuccess: (_, id) => {
      queryClient.setQueryData<NotificationsResponse>(
        [...QUERY_KEYS.notifications.all, filter],
        (old) => {
          if (!old) return old;
          const updated = old.data.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          );
          const unread = MOCK_NOTIFICATIONS.filter(
            (n) => n.id !== id && !n.read_at
          ).length;
          setUnreadCount(unread);
          return { ...old, data: updated, meta: { ...old.meta, unread_count: unread } };
        }
      );
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  // Mark all as read
  const { mutate: markAll, isPending: isMarkingAll } = useMutation({
    mutationFn: () => new Promise<void>((res) => setTimeout(res, 500)),
    // --- REAL API ---
    // mutationFn: markAllAsRead,
    onSuccess: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationsResponse>(
        [...QUERY_KEYS.notifications.all, filter],
        (old) => {
          if (!old) return old;
          const updated = old.data.map((n) => ({
            ...n,
            read_at: n.read_at ?? now,
          }));
          return { ...old, data: updated, meta: { ...old.meta, unread_count: 0 } };
        }
      );
      setUnreadCount(0);
      toast.success("Đã đánh dấu tất cả là đã đọc");
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta.unread_count ?? 0;

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Thông báo"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll()}
              disabled={isMarkingAll}
              className="cursor-pointer gap-1.5"
            >
              <CheckCheck size={15} />
              Đánh dấu tất cả đã đọc
            </Button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[#E2E8F0]">
        {(["all", "unread", "read"] as FilterType[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "cursor-pointer border-b-2 px-4 py-2.5 text-[length:var(--fs-body)] font-medium transition-colors",
              filter === f
                ? "border-[#1A5FAB] text-[#1A5FAB]"
                : "border-transparent text-[#718096] hover:text-[#4A5568]",
            )}
          >
            {FILTER_LABEL[f]}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-[#1A5FAB] px-1.5 py-0.5 text-[length:var(--fs-xs)] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[length:var(--fs-body)] text-[#718096]">
          Đang tải...
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#718096]">
          <CheckCheck size={40} className="opacity-30" />
          <p className="text-[length:var(--fs-base)]">
            {filter === "unread"
              ? "Không có thông báo chưa đọc"
              : "Không có thông báo"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={(id) => markRead(id)}
              isMarkingRead={isMarkingRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
