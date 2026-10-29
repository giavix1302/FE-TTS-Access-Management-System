import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface PaginationProps {
  /** Trang hiện tại, bắt đầu từ 0 */
  pageIndex: number
  totalPages: number
  onPageChange: (pageIndex: number) => void
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (pageSize: number) => void
}

// 1 2 3 4 5 … 13 hoặc 1 … 6 7 8 … 13 — tối đa 7 ô
function getPageItems(pageIndex: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index)
  }

  if (pageIndex <= 3) return [0, 1, 2, 3, 4, "...", totalPages - 1]
  if (pageIndex >= totalPages - 4) {
    return [0, "...", totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1]
  }

  return [0, "...", pageIndex - 1, pageIndex, pageIndex + 1, "...", totalPages - 1]
}

// Bản rút gọn cho mobile — tối đa 5 ô để không tràn ngang.
function getCompactPageItems(pageIndex: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index)
  }

  if (pageIndex <= 1) return [0, 1, 2, "...", totalPages - 1]
  if (pageIndex >= totalPages - 2) {
    return [0, "...", totalPages - 3, totalPages - 2, totalPages - 1]
  }

  return [0, "...", pageIndex, "...", totalPages - 1]
}

interface PaginationNavProps {
  pageIndex: number
  totalPages: number
  items: (number | "...")[]
  onPageChange: (pageIndex: number) => void
  className?: string
}

function PaginationNav({
  pageIndex,
  totalPages,
  items,
  onPageChange,
  className,
}: PaginationNavProps) {
  return (
    <div className={cn("items-center gap-1.5", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0 text-text-secondary shadow-none hover:bg-bg-page"
        onClick={() => onPageChange(pageIndex - 1)}
        disabled={pageIndex <= 0}
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {items.map((item, idx) =>
        item === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-8 min-w-8 items-center justify-center px-1 text-[length:var(--fs-base)] text-text-disabled"
          >
            •••
          </span>
        ) : (
          <Button
            key={item}
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 min-w-8 cursor-pointer rounded-lg border border-transparent bg-transparent px-2 text-[length:var(--fs-base)] font-normal shadow-none",
              pageIndex === item
                ? "border-primary bg-white text-primary hover:bg-primary-light hover:text-primary"
                : "text-text-primary hover:bg-bg-page",
            )}
            onClick={() => onPageChange(item)}
          >
            {item + 1}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0 text-text-primary shadow-none hover:bg-bg-page"
        onClick={() => onPageChange(pageIndex + 1)}
        disabled={pageIndex >= totalPages - 1}
        aria-label="Trang sau"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function Pagination({
  pageIndex,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
}: PaginationProps) {
  const hasPageSizeSelector = pageSize != null && onPageSizeChange != null
  const hasPageNavigation = totalPages > 1

  if (!hasPageNavigation && !hasPageSizeSelector) return null

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 px-1">
      {hasPageNavigation && (
        <>
          <PaginationNav
            pageIndex={pageIndex}
            totalPages={totalPages}
            items={getCompactPageItems(pageIndex, totalPages)}
            onPageChange={onPageChange}
            className="flex sm:hidden"
          />
          <PaginationNav
            pageIndex={pageIndex}
            totalPages={totalPages}
            items={getPageItems(pageIndex, totalPages)}
            onPageChange={onPageChange}
            className="hidden sm:flex"
          />
        </>
      )}

      {hasPageSizeSelector && (
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger
            className="h-8 w-[112px] cursor-pointer rounded-lg border-border bg-white px-3 text-[length:var(--fs-base)] text-text-primary shadow-none"
            aria-label="Số dòng mỗi trang"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / trang
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
