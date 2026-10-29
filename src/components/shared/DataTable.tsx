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
import { EmptyState } from "./EmptyState"
import { Pagination } from "./Pagination"

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

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border bg-primary-light hover:bg-primary-light">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-[52px] px-[var(--sp-card)] text-[length:var(--fs-sm)] font-semibold uppercase tracking-wide text-primary"
                    style={
                      header.column.columnDef.size
                        ? {
                            width: header.column.columnDef.size,
                            maxWidth: header.column.columnDef.size,
                          }
                        : undefined
                    }
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
                  className={`border-b border-border transition-colors hover:bg-bg-page ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="overflow-hidden px-[var(--sp-card)] py-3 text-[length:var(--fs-base)] text-[#1A202C]"
                      style={
                        cell.column.columnDef.size
                          ? {
                              width: cell.column.columnDef.size,
                              maxWidth: cell.column.columnDef.size,
                            }
                          : undefined
                      }
                    >
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
      {!loading && table.getRowModel().rows.length > 0 && (
        <Pagination
          pageIndex={pageIndex}
          totalPages={totalPages}
          onPageChange={(i) => table.setPageIndex(i)}
          pageSize={pageSize}
          onPageSizeChange={(nextPageSize) => {
            if (isControlled) {
              onPaginationChange!({ pageIndex: 0, pageSize: nextPageSize })
            } else {
              table.setPageSize(nextPageSize)
              table.setPageIndex(0)
            }
          }}
        />
      )}
    </div>
  )
}
