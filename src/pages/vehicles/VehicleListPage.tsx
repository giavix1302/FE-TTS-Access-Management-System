import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef, type PaginationState } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Eye, Truck, Search } from 'lucide-react'
import axiosInstance from '@/api/axios'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  VEHICLE_STATUS_OPTIONS,
  getVehicleStatusBadge,
  type VehicleStatus,
} from '@/constants/vehicleStatus'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: number
  model: string
  serial_number: string
  manufacturer: string
  manufacture_year: number
  engine_type: 'Fuel' | 'Electric'
  work_height: number
  status: VehicleStatus
  primary_image_url: string | null
  created_at: string
}

interface VehicleListResponse {
  data: Vehicle[]
  meta: { total: number; page: number; page_size: number; total_pages: number }
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const addVehicleSchema = z.object({
  model: z.string().min(1, 'Bắt buộc'),
  serial_number: z.string().min(1, 'Bắt buộc'),
  manufacturer: z.string().min(1, 'Bắt buộc'),
  engine_type: z.enum(['Fuel', 'Electric'], { required_error: 'Bắt buộc' }),
  manufacture_year: z.coerce.number().int().min(1990).max(2100).optional(),
  capacity: z.coerce.number().positive().optional(),
  occupancy: z.coerce.number().int().positive().optional(),
  platform_height: z.coerce.number().positive().optional(),
  work_height: z.coerce.number().positive().optional(),
  lifting_speed: z.coerce.number().positive().optional(),
  traveling_speed: z.coerce.number().positive().optional(),
})

type AddVehicleForm = z.infer<typeof addVehicleSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const isAdminOrManager =
    user?.roles?.includes('admin') || user?.roles?.includes('manager')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [addOpen, setAddOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 400)
  const page = pagination.pageIndex + 1

  // ── Mock data ─────────────────────────────────────────────────────────────

  const ALL_MOCK_VEHICLES: Vehicle[] = [
    { id: 1, model: 'Toyota 8FBN25', serial_number: 'TT-2021-0042', manufacturer: 'Toyota', manufacture_year: 2021, engine_type: 'Electric', work_height: 5.5, status: 'at_yard', primary_image_url: 'https://placehold.co/80x80?text=TX1', created_at: '2024-03-15T08:00:00Z' },
    { id: 2, model: 'Komatsu FB20M', serial_number: 'KM-2020-0018', manufacturer: 'Komatsu', manufacture_year: 2020, engine_type: 'Electric', work_height: 4.8, status: 'renting', primary_image_url: null, created_at: '2024-04-10T08:00:00Z' },
    { id: 3, model: 'Crown WS2300', serial_number: 'CR-2022-0005', manufacturer: 'Crown', manufacture_year: 2022, engine_type: 'Electric', work_height: 6.2, status: 'maintenance', primary_image_url: 'https://placehold.co/80x80?text=TX3', created_at: '2024-05-01T08:00:00Z' },
    { id: 4, model: 'Linde E20', serial_number: 'LD-2019-0031', manufacturer: 'Linde', manufacture_year: 2019, engine_type: 'Fuel', work_height: 5.0, status: 'broken', primary_image_url: null, created_at: '2023-11-20T08:00:00Z' },
    { id: 5, model: 'Jungheinrich EFG216', serial_number: 'JH-2023-0009', manufacturer: 'Jungheinrich', manufacture_year: 2023, engine_type: 'Electric', work_height: 7.0, status: 'at_yard', primary_image_url: 'https://placehold.co/80x80?text=TX5', created_at: '2024-07-08T08:00:00Z' },
    { id: 6, model: 'Hyster H2.5FT', serial_number: 'HY-2018-0022', manufacturer: 'Hyster', manufacture_year: 2018, engine_type: 'Fuel', work_height: 4.5, status: 'sold', primary_image_url: null, created_at: '2023-06-15T08:00:00Z' },
    { id: 7, model: 'Yale GLC050', serial_number: 'YL-2021-0014', manufacturer: 'Yale', manufacture_year: 2021, engine_type: 'Fuel', work_height: 5.2, status: 'at_yard', primary_image_url: 'https://placehold.co/80x80?text=TX7', created_at: '2024-02-28T08:00:00Z' },
    { id: 8, model: 'Mitsubishi FD25N', serial_number: 'MT-2020-0037', manufacturer: 'Mitsubishi', manufacture_year: 2020, engine_type: 'Fuel', work_height: 4.7, status: 'renting', primary_image_url: null, created_at: '2024-01-12T08:00:00Z' },
  ]

  // ── Query ────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<VehicleListResponse>({
    queryKey: [...QUERY_KEYS.vehicles.all, { search: debouncedSearch, status: statusFilter, page }],
    queryFn: () => {
      const filtered = ALL_MOCK_VEHICLES.filter((v) => {
        const matchSearch = !debouncedSearch ||
          v.model.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          v.serial_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          v.manufacturer.toLowerCase().includes(debouncedSearch.toLowerCase())
        const matchStatus = !statusFilter || v.status === statusFilter
        return matchSearch && matchStatus
      })
      const pageSize = pagination.pageSize
      const start = (page - 1) * pageSize
      const paged = filtered.slice(start, start + pageSize)
      return Promise.resolve({
        data: paged,
        meta: {
          total: filtered.length,
          page,
          page_size: pageSize,
          total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        },
      })
    },
  })

  // ── Mutation ─────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (_body: AddVehicleForm) => new Promise<void>((res) => setTimeout(res, 600)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all })
      toast.success('Thêm xe thành công')
      setAddOpen(false)
      reset()
    },
  })

  // ── Form ─────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddVehicleForm>({ resolver: zodResolver(addVehicleSchema) })

  const onSubmit = (values: AddVehicleForm) => addMutation.mutate(values)

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<Vehicle>[] = [
    {
      id: 'image',
      header: 'Ảnh',
      cell: ({ row }) =>
        row.original.primary_image_url ? (
          <img
            src={row.original.primary_image_url}
            alt={row.original.model}
            className="h-12 w-12 rounded-lg object-cover border border-border"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-bg-page border border-border">
            <Truck className="h-5 w-5 text-text-secondary" />
          </div>
        ),
    },
    {
      id: 'model',
      header: 'Model / Serial',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-text-primary">{row.original.model}</p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary">{row.original.serial_number}</p>
        </div>
      ),
    },
    {
      id: 'manufacturer',
      header: 'Hãng SX',
      cell: ({ row }) => (
        <div>
          <p className="text-text-primary">{row.original.manufacturer}</p>
          <p className="text-[length:var(--fs-sm)] text-text-secondary">{row.original.manufacture_year}</p>
        </div>
      ),
    },
    {
      id: 'engine_type',
      header: 'Động cơ',
      cell: ({ row }) => {
        const isElectric = row.original.engine_type === 'Electric'
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${
              isElectric ? 'bg-info-light text-info' : 'bg-warning-light text-warning'
            }`}
          >
            {isElectric ? 'Điện' : 'Xăng/Dầu'}
          </span>
        )
      },
    },
    {
      id: 'work_height',
      header: 'Cao LV',
      cell: ({ row }) => (
        <span className="text-text-primary">{row.original.work_height}m</span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const { label, className } = getVehicleStatusBadge(row.original.status)
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${className}`}>
            {label}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary hover:bg-primary-light"
          onClick={() => navigate(`/vehicles/${row.original.id}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Xem
        </Button>
      ),
    },
  ]

  const vehicles = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader
        title="Quản lý xe nâng"
        subtitle="Danh sách toàn bộ xe nâng người"
        actions={
          isAdminOrManager ? (
            <Button
              className="bg-primary hover:bg-primary-dark text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm xe
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Tìm theo model, số chế tạo, hãng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            className="pl-9 border-border"
          />
        </div>

        <Select
          value={statusFilter || '_all'}
          onValueChange={(v) => {
            setStatusFilter(v === '_all' ? '' : v)
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        >
          <SelectTrigger className="w-full sm:w-48 border-border">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả</SelectItem>
            {VEHICLE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {meta && (
          <p className="ml-auto text-[length:var(--fs-base)] text-text-secondary">
            Tổng <span className="font-medium text-text-primary">{meta.total}</span> xe
            {meta.total_pages > 1 && (
              <>
                {' '}— Trang{' '}
                <span className="font-medium text-text-primary">{meta.page}</span> /{' '}
                {meta.total_pages}
              </>
            )}
          </p>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={vehicles}
        loading={isLoading}
        pagination={pagination}
        pageCount={meta?.total_pages ?? 1}
        onPaginationChange={setPagination}
        emptyTitle="Không tìm thấy xe nào"
        emptyDescription="Thử thay đổi bộ lọc hoặc thêm xe mới"
        emptyAction={
          isAdminOrManager ? (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary-dark text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm xe
            </Button>
          ) : undefined
        }
      />

      {/* ── Modal Thêm xe ── */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold text-text-primary">
              Thêm xe mới
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cột 1 */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Model <span className="text-error">*</span>
                  </Label>
                  <Input {...register('model')} placeholder="VD: AWP 20S" className="border-border" />
                  {errors.model && <p className="text-[length:var(--fs-sm)] text-error">{errors.model.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Serial Number <span className="text-error">*</span>
                  </Label>
                  <Input {...register('serial_number')} placeholder="VD: SN-2021-001" className="border-border" />
                  {errors.serial_number && <p className="text-[length:var(--fs-sm)] text-error">{errors.serial_number.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Hãng SX <span className="text-error">*</span>
                  </Label>
                  <Input {...register('manufacturer')} placeholder="VD: Genie" className="border-border" />
                  {errors.manufacturer && <p className="text-[length:var(--fs-sm)] text-error">{errors.manufacturer.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Năm SX</Label>
                  <Input {...register('manufacture_year')} type="number" placeholder="VD: 2021" className="border-border" />
                </div>
              </div>

              {/* Cột 2 */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">
                    Loại động cơ <span className="text-error">*</span>
                  </Label>
                  <Select onValueChange={(v) => setValue('engine_type', v as 'Fuel' | 'Electric')}>
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="Chọn loại động cơ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electric">Điện</SelectItem>
                      <SelectItem value="Fuel">Xăng/Dầu</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.engine_type && <p className="text-[length:var(--fs-sm)] text-error">{errors.engine_type.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Tải trọng (kg)</Label>
                  <Input {...register('capacity')} type="number" placeholder="VD: 230" className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Số người</Label>
                  <Input {...register('occupancy')} type="number" placeholder="VD: 1" className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Chiều cao sàn (m)</Label>
                  <Input {...register('platform_height')} type="number" step="0.1" placeholder="VD: 7.79" className="border-border" />
                </div>
              </div>
            </div>

            {/* Full width */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Chiều cao LV (m)</Label>
                <Input {...register('work_height')} type="number" step="0.1" placeholder="VD: 9.8" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Tốc độ nâng (m/s)</Label>
                <Input {...register('lifting_speed')} type="number" step="0.01" placeholder="VD: 0.20" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Tốc độ di chuyển (km/h)</Label>
                <Input {...register('traveling_speed')} type="number" step="0.1" placeholder="VD: 4.0" className="border-border" />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-border text-text-secondary"
                onClick={() => { setAddOpen(false); reset() }}
                disabled={addMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark text-white"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
