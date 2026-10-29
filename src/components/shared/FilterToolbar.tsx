import { useState, type ReactNode } from "react";
import { ListFilter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  showFilters?: boolean;
  children: ReactNode;
}

export function FilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  activeFilterCount = 0,
  onClearFilters,
  showFilters = true,
  children,
}: FilterToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-bg-card p-3 shadow-card">
      <div className="flex w-full items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="border-border pl-9"
          />
        </div>

        {showFilters && <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="relative ml-auto shrink-0 cursor-pointer border-border"
            >
              <ListFilter className="h-4 w-4" />
              <span>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[calc(100vw-2rem)] max-w-md border-border p-0 shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="font-semibold text-text-primary">Bộ lọc</p>
              <p className="mt-0.5 text-[length:var(--fs-sm)] text-text-secondary">
                Chọn điều kiện để thu hẹp kết quả.
              </p>
            </div>

            <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
              {children}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClearFilters}
                disabled={!onClearFilters || activeFilterCount === 0}
                className="cursor-pointer border-border"
              >
                Xóa bộ lọc
              </Button>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer bg-primary text-white hover:bg-primary-dark"
              >
                Áp dụng
              </Button>
            </div>
          </PopoverContent>
        </Popover>}
      </div>
    </div>
  );
}
