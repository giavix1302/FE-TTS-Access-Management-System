import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  getServiceCatalog,
  createServiceCatalog,
  updateServiceCatalog,
  activateServiceCatalog,
  deactivateServiceCatalog,
} from '@/api/service-catalog.api'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, EyeOff, Eye, BookOpen } from 'lucide-react'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { usePermission } from '@/hooks/usePermission'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceCatalogItem {
  id: number
  name: string
  unit: string
  defaultPrice: number
  isActive: boolean
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z.string().min(1, 'Bắt buộc'),
  unit: z.string().min(1, 'Bắt buộc'),
  defaultPrice: z.coerce.number({ invalid_type_error: 'Phải là số' }).positive('Phải lớn hơn 0'),
})

type ServiceForm = z.infer<typeof serviceSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVND(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

// ─── Filter type ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'inactive'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canCreate = hasPermission("service_catalog.create")
  const canUpdate = hasPermission("service_catalog.update")
  const canEdit = canCreate || canUpdate

  // ── State ──────────────────────────────────────────────────────────────────

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceCatalogItem | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<ServiceCatalogItem | null>(null)

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: servicesData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
  })
  const services: ServiceCatalogItem[] = servicesData?.data ?? []

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: ServiceForm) =>
      createServiceCatalog({ name: body.name, unit: body.unit, defaultPrice: body.defaultPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all })
      toast.success('Thêm dịch vụ thành công')
      setDialogOpen(false)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: ServiceForm & { id: number }) =>
      updateServiceCatalog(body.id, { name: body.name, unit: body.unit, defaultPrice: body.defaultPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all })
      toast.success('Cập nhật dịch vụ thành công')
      setDialogOpen(false)
      setEditTarget(null)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  const toggleMutation = useMutation({
    mutationFn: (item: ServiceCatalogItem) =>
      item.isActive ? deactivateServiceCatalog(item.id) : activateServiceCatalog(item.id),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all })
      toast.success(item.isActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      setConfirmToggle(null)
    },
    onError: () => toast.error('Có lỗi xảy ra'),
  })

  // ── Form ───────────────────────────────────────────────────────────────────

  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: '', unit: '', defaultPrice: 0 },
  })

  const openCreate = () => {
    form.reset({ name: '', unit: '', defaultPrice: 0 })
    setEditTarget(null)
    setDialogOpen(true)
  }

  const openEdit = (item: ServiceCatalogItem) => {
    form.reset({ name: item.name, unit: item.unit, defaultPrice: item.defaultPrice })
    setEditTarget(item)
    setDialogOpen(true)
  }

  const onSubmit = (values: ServiceForm) => {
    if (editTarget) {
      updateMutation.mutate({ ...values, id: editTarget.id })
    } else {
      createMutation.mutate(values)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filtered = services.filter((s) => {
    if (filterTab === 'active') return s.isActive
    if (filterTab === 'inactive') return !s.isActive
    return true
  })

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<ServiceCatalogItem>[] = [
    {
      accessorKey: 'name',
      header: 'Tên dịch vụ',
      cell: ({ row }) => (
        <span className="font-medium text-[#1A202C]">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'unit',
      header: 'Đơn vị',
      cell: ({ row }) => (
        <span className="rounded-md bg-[#F4F6F8] px-2 py-0.5 text-[length:var(--fs-sm)] text-[#5A5A66]">
          {row.original.unit}
        </span>
      ),
    },
    {
      accessorKey: 'defaultPrice',
      header: 'Đơn giá mặc định',
      cell: ({ row }) => (
        <span className="font-medium text-[#1A5FAB]">
          {formatVND(row.original.defaultPrice)}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Trạng thái',
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-[#27AE60]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#27AE60]" />
            Hoạt động
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F6F8] px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium text-[#718096]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#718096]" />
            Đã ẩn
          </span>
        ),
    },
    ...(canUpdate
      ? [
          {
            id: 'actions',
            header: 'Thao tác',
            cell: ({ row }: { row: { original: ServiceCatalogItem } }) => (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-8 w-8 p-0 text-text-secondary hover:text-primary hover:bg-primary-light"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(row.original)
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Chỉnh sửa</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        row.original.isActive
                          ? 'cursor-pointer h-8 w-8 p-0 text-text-secondary hover:bg-error-light hover:text-error'
                          : 'cursor-pointer h-8 w-8 p-0 text-text-secondary hover:bg-[#DCFCE7] hover:text-success'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmToggle(row.original)
                      }}
                    >
                      {row.original.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{row.original.isActive ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}</TooltipContent>
                </Tooltip>
              </div>
            ),
          } satisfies ColumnDef<ServiceCatalogItem>,
        ]
      : []),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  const filterTabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Đã ẩn' },
  ]

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      {/* Header */}
      <PageHeader
        title="Danh mục dịch vụ"
        subtitle="Quản lý các dịch vụ dùng chung cho hợp đồng"
        actions={
          canCreate ? (
            <Button
              onClick={openCreate}
              className="cursor-pointer gap-1.5 bg-[#1A5FAB] text-[length:var(--fs-sm)] text-white hover:bg-[#154D8A] sm:text-[length:var(--fs-base)]"
            >
              <Plus size={16} />
              Thêm dịch vụ
            </Button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterTab(tab.value)}
            className={
              filterTab === tab.value
                ? 'cursor-pointer rounded-md bg-[#1A5FAB] px-3 py-1.5 text-[length:var(--fs-sm)] font-medium text-white transition-colors'
                : 'cursor-pointer rounded-md px-3 py-1.5 text-[length:var(--fs-sm)] text-[#5A5A66] transition-colors hover:bg-[#F4F6F8]'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyTitle="Chưa có dịch vụ nào"
          emptyDescription={
            filterTab !== 'all' ? 'Thử chọn bộ lọc khác' : 'Bắt đầu bằng cách thêm dịch vụ đầu tiên'
          }
        />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[#E2E8F0]" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center">
            <BookOpen size={28} className="mx-auto mb-2 text-[#CBD5E0]" />
            <p className="text-[length:var(--fs-sm)] text-[#718096]">
              {filterTab !== 'all' ? 'Thử chọn bộ lọc khác' : 'Chưa có dịch vụ nào'}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
            >
              {/* Row 1: name + badge */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-[length:var(--fs-base)] text-[#1A202C] leading-snug">
                  {item.name}
                </span>
                {item.isActive ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[length:var(--fs-xs)] font-medium text-[#27AE60]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#27AE60]" />
                    Hoạt động
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#F4F6F8] px-2 py-0.5 text-[length:var(--fs-xs)] font-medium text-[#718096]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#718096]" />
                    Đã ẩn
                  </span>
                )}
              </div>

              {/* Row 2: unit + price */}
              <div className="flex items-center gap-3 text-[length:var(--fs-sm)]">
                <span className="rounded-md bg-[#F4F6F8] px-2 py-0.5 text-[#5A5A66]">
                  {item.unit}
                </span>
                <span className="font-semibold text-[#1A5FAB]">
                  {formatVND(item.defaultPrice)}
                </span>
              </div>

              {/* Row 3: actions — chỉ hiện nếu canUpdate */}
              {canUpdate && (
                <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 cursor-pointer gap-1.5 text-[length:var(--fs-sm)] text-[#5A5A66] hover:text-[#1A5FAB]"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil size={14} />
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      item.isActive
                        ? 'flex-1 cursor-pointer gap-1.5 text-[length:var(--fs-sm)] text-[#5A5A66] hover:bg-[#FFF3F3] hover:text-[#E74C3C]'
                        : 'flex-1 cursor-pointer gap-1.5 text-[length:var(--fs-sm)] text-[#5A5A66] hover:bg-[#E8F5E9] hover:text-[#27AE60]'
                    }
                    onClick={() => setConfirmToggle(item)}
                  >
                    {item.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    {item.isActive ? 'Ẩn' : 'Hiện'}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Dialog: Thêm / Sửa ─────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false)
            setEditTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            {/* Tên dịch vụ */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[length:var(--fs-sm)] font-medium text-[#1A202C]">
                Tên dịch vụ <span className="text-[#E74C3C]">*</span>
              </Label>
              <Input
                id="name"
                placeholder="VD: Cho thuê xe nâng người"
                {...form.register('name')}
                className={form.formState.errors.name ? 'border-[#E74C3C]' : ''}
              />
              {form.formState.errors.name && (
                <p className="text-[length:var(--fs-xs)] text-[#E74C3C]">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Đơn vị */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit" className="text-[length:var(--fs-sm)] font-medium text-[#1A202C]">
                Đơn vị <span className="text-[#E74C3C]">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="unit"
                  placeholder="VD: ngày, chuyến, ca..."
                  {...form.register('unit')}
                  className={form.formState.errors.unit ? 'flex-1 border-[#E74C3C]' : 'flex-1'}
                />
                {/* Quick pick */}
                <Select onValueChange={(v) => form.setValue('unit', v, { shouldValidate: true })}>
                  <SelectTrigger className="w-[100px] shrink-0 text-[length:var(--fs-sm)] cursor-pointer">
                    <SelectValue placeholder="Gợi ý" />
                  </SelectTrigger>
                  <SelectContent>
                    {['ngày', 'chuyến', 'ca', 'lần', 'giờ', 'tháng'].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.formState.errors.unit && (
                <p className="text-[length:var(--fs-xs)] text-[#E74C3C]">
                  {form.formState.errors.unit.message}
                </p>
              )}
            </div>

            {/* Đơn giá */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default_price" className="text-[length:var(--fs-sm)] font-medium text-[#1A202C]">
                Đơn giá mặc định (VNĐ) <span className="text-[#E74C3C]">*</span>
              </Label>
              <Input
                id="default_price"
                type="number"
                min={1}
                step={1000}
                placeholder="VD: 1500000"
                {...form.register('defaultPrice')}
                className={form.formState.errors.default_price ? 'border-[#E74C3C]' : ''}
              />
              {form.formState.errors.default_price && (
                <p className="text-[length:var(--fs-xs)] text-[#E74C3C]">
                  {form.formState.errors.default_price.message}
                </p>
              )}
              {/* Preview */}
              {(() => {
                const v = form.watch('defaultPrice')
                return v > 0 ? (
                  <p className="text-[length:var(--fs-xs)] text-[#718096]">
                    = {formatVND(v)}
                  </p>
                ) : null
              })()}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setDialogOpen(false)
                  setEditTarget(null)
                }}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="cursor-pointer bg-[#1A5FAB] text-white hover:bg-[#154D8A]"
              >
                {isMutating ? 'Đang lưu...' : editTarget ? 'Cập nhật' : 'Thêm dịch vụ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm toggle ─────────────────────────────────────────────────── */}
      {confirmToggle && (
        <ConfirmModal
          open={!!confirmToggle}
          onOpenChange={(open) => { if (!open) setConfirmToggle(null) }}
          title={confirmToggle.isActive ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
          description={
            confirmToggle.isActive
              ? `Dịch vụ "${confirmToggle.name}" sẽ không còn xuất hiện trong dropdown tạo hợp đồng mới.`
              : `Dịch vụ "${confirmToggle.name}" sẽ được hiện lại trong danh mục.`
          }
          confirmLabel={confirmToggle.isActive ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
          variant={confirmToggle.isActive ? 'danger' : 'primary'}
          loading={toggleMutation.isPending}
          onConfirm={() => toggleMutation.mutate(confirmToggle)}
        />
      )}
    </div>
  )
}
