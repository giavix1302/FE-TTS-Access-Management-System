import { cn } from "@/lib/utils";

interface ContractExpiredChipProps {
  /** `isExpired` do BE trả — FE không tự tính */
  isExpired?: boolean;
  className?: string;
}

// Chip chỉ để hiển thị: hợp đồng vẫn active cho đến khi nhân viên tự chuyển trạng thái
export function ContractExpiredChip({ isExpired, className }: ContractExpiredChipProps) {
  if (!isExpired) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-error-light px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-error",
        className,
      )}
    >
      Hết hạn
    </span>
  );
}
