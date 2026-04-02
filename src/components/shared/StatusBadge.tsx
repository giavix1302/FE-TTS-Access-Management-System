import { cn } from "@/lib/utils"

type StatusKey =
  | "Tại bãi"
  | "Đang thuê"
  | "Bảo trì"
  | "Active"
  | "Hoàn thành"
  | "Hủy"
  | "Còn hạn"
  | "Sắp hết hạn"
  | "Quá hạn"

const STATUS_STYLES: Record<StatusKey, { color: string; bg: string }> = {
  "Tại bãi":     { color: "#27AE60", bg: "#E8F8EF" },
  "Đang thuê":   { color: "#F5A623", bg: "#FEF3DC" },
  "Bảo trì":     { color: "#E74C3C", bg: "#FDECEA" },
  "Active":      { color: "#27AE60", bg: "#E8F8EF" },
  "Hoàn thành":  { color: "#2980B9", bg: "#EAF4FB" },
  "Hủy":         { color: "#E74C3C", bg: "#FDECEA" },
  "Còn hạn":     { color: "#27AE60", bg: "#E8F8EF" },
  "Sắp hết hạn": { color: "#F5A623", bg: "#FEF3DC" },
  "Quá hạn":     { color: "#E74C3C", bg: "#FDECEA" },
}

interface StatusBadgeProps {
  status: StatusKey | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as StatusKey]

  if (!style) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium",
          className
        )}
        style={{ color: "#718096", backgroundColor: "#F4F6F8" }}
      >
        {status}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium",
        className
      )}
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {status}
    </span>
  )
}
