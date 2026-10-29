import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickOption {
  id: number;
  primary: string;
  secondary?: string;
  /** Nhãn nhỏ cuối dòng, vd. “Có xe” */
  badge?: string;
}

interface PickListProps {
  options: PickOption[];
  value?: number;
  onChange: (id: number) => void;
  loading?: boolean;
  emptyText: string;
  variant?: "cards" | "simple";
}

/** Danh sách chọn 1 mục, có thể cuộn — dùng cho picker dịch vụ / xe (kèm ô tìm bên ngoài). */
export function PickList({ options, value, onChange, loading, emptyText, variant = "cards" }: PickListProps) {
  if (loading) {
    return (
      <div className="rounded-md border border-border px-3 py-4 text-center text-[length:var(--fs-sm)] text-text-secondary">
        Đang tải...
      </div>
    );
  }
  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[length:var(--fs-sm)] text-text-secondary">
        {emptyText}
      </div>
    );
  }
  return (
    <div
      role="listbox"
      className={cn(
        "w-full min-w-0 max-w-full max-h-64 overflow-x-hidden overflow-y-auto",
        variant === "cards"
          ? "space-y-1 rounded-md border border-border bg-bg-page p-1"
          : "divide-y divide-border bg-bg-card",
      )}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex w-full min-w-0 max-w-full cursor-pointer items-center justify-between gap-3 overflow-hidden text-left transition-colors",
              variant === "cards"
                ? "rounded-md border bg-bg-card px-3 py-2.5 text-[length:var(--fs-base)] shadow-sm"
                : "border-0 bg-transparent px-3 py-2 text-[length:var(--fs-sm)]",
              selected
                ? variant === "cards"
                  ? "border-primary bg-primary-light text-primary ring-1 ring-primary/15"
                  : "bg-primary-light text-primary"
                : variant === "cards"
                  ? "border-border hover:border-primary/40 hover:bg-primary-light/50"
                  : "hover:bg-bg-page",
            )}
          >
            <span className="min-w-0 flex-1">
              <span title={o.primary} className={cn("truncate font-medium text-text-primary", variant === "cards" ? "block" : "inline")}>
                {o.primary}
              </span>
              {o.secondary && (
                <span className={cn(
                  "truncate text-text-secondary",
                  variant === "cards" ? "mt-0.5 block text-[length:var(--fs-sm)]" : "ml-1 inline",
                  selected && "text-primary",
                )}>
                  {variant === "simple" ? `· ${o.secondary}` : o.secondary}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {o.badge && (
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-[length:var(--fs-sm)] font-medium text-primary">
                  {o.badge}
                </span>
              )}
              {selected && (
                <span className={cn("flex items-center justify-center", variant === "cards" ? "h-5 w-5 rounded-full bg-primary text-white" : "text-primary")}>
                  <Check size={variant === "cards" ? 13 : 15} strokeWidth={2.5} />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
