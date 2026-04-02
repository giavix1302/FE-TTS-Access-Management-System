import { ReactNode } from "react"
import { Inbox } from "lucide-react"

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon,
  title = "Chưa có dữ liệu",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F4F6F8]">
        {icon ?? <Inbox className="h-7 w-7 text-[#718096]" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-medium text-[#1A202C]">{title}</p>
        {description && (
          <p className="text-[14px] text-[#718096] max-w-[320px]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
