import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { EmptyState } from "./EmptyState"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  pagination?: PaginationState
  pageCount?: number
  onPaginationChange?: (updater: PaginationState) => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  pagination,
  pageCount,
  onPaginationChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const isControlled = pagination !== undefined && onPaginationChange !== undefined

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(isControlled
      ? {
          manualPagination: true,
          pageCount: pageCount ?? -1,
          state: { pagination },
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function" ? updater(pagination!) : updater
            onPaginationChange!(next)
          },
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
        }),
  })

  const { pageIndex, pageSize } = isControlled
    ? pagination!
    : table.getState().pagination

  const totalPages = isControlled
    ? (pageCount ?? 1)
    : table.getPageCount()

  const from = pageIndex * pageSize + 1
  const to = Math.min(
    (pageIndex + 1) * pageSize,
    isControlled ? (pageCount ?? 1) * pageSize : data.length
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-[#1A5FAB] hover:bg-[#1A5FAB] border-b border-[#154D8A]">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-[length:var(--fs-sm)] font-semibold text-white uppercase tracking-wide h-11 px-[var(--sp-card)]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: pageSize ?? 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-[var(--sp-card)] py-3">
                      <Skeleton className="h-5 w-full rounded-md" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-60 text-center p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`border-b border-[#E2E8F0] hover:bg-[#E8F0FB] transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-[var(--sp-card)] py-3 text-[length:var(--fs-base)] text-[#1A202C]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && table.getRowModel().rows.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[length:var(--fs-base)] text-[#718096]">
            Hiển thị {from}–{to} bản ghi
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-[#E2E8F0] text-[#5A5A66] hover:bg-[#F4F6F8]"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {(() => {
              const pages: (number | "...")[] = []
              if (totalPages <= 7) {
                for (let i = 0; i < totalPages; i++) pages.push(i)
              } else {
                pages.push(0)
                if (pageIndex > 2) pages.push("...")
                for (let i = Math.max(1, pageIndex - 1); i <= Math.min(totalPages - 2, pageIndex + 1); i++) pages.push(i)
                if (pageIndex < totalPages - 3) pages.push("...")
                pages.push(totalPages - 1)
              }
              return pages.map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-[#718096] text-[length:var(--fs-base)]">…</span>
                ) : (
                  <Button
                    key={item}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 text-[length:var(--fs-base)] border-[#E2E8F0] cursor-pointer"
                    style={
                      pageIndex === item
                        ? { backgroundColor: "#1A5FAB", color: "#fff", borderColor: "#1A5FAB" }
                        : { color: "#5A5A66" }
                    }
                    onClick={() => table.setPageIndex(item)}
                  >
                    {item + 1}
                  </Button>
                )
              )
            })()}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-[#E2E8F0] text-[#5A5A66] hover:bg-[#F4F6F8]"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
