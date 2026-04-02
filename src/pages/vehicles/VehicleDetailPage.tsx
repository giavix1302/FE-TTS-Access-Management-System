import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { differenceInDays, format } from 'date-fns'
import {
  Pencil, RefreshCw, Trash2, Plus, Download, Shield,
  CheckCircle2, Truck, ArrowLeft, Barcode, Star, FileText,
  History, Loader2, ImagePlus,
} from 'lucide-react'
import axiosInstance from '@/api/axios'
import { QUERY_KEYS } from '@/utils/queryKeys'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { FileUpload } from '@/components/shared/FileUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  VEHICLE_STATUS_CONFIG,
  getVehicleStatusBadge,
  type VehicleStatus,
} from '@/constants/vehicleStatus'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleDetail {
  id: number; model: string; serial_number: string; manufacturer: string
  manufacture_year: number; capacity: number; occupancy: number
  platform_height: number; work_height: number; lifting_speed: number
  traveling_speed: number; engine_type: 'Fuel' | 'Electric'
  status: VehicleStatus
  primary_image_url: string | null; created_at: string; updated_at: string
  created_by: { id: number; full_name: string }
}

interface DocumentRef {
  id: number; file_name: string; sas_url: string; sas_expires_at: string
}

interface InsuranceRecord {
  id: number; insurance_number: string; provider: string
  issue_date: string; expiry_date: string
  document: DocumentRef | null
  created_at: string; created_by: { id: number; full_name: string }
}

interface InspectionRecord {
  id: number; inspection_number: string; inspection_date: string
  expiry_date: string; result: 'passed' | 'failed'
  document: DocumentRef | null
  created_at: string; created_by: { id: number; full_name: string }
}

interface ImageItem {
  id: number; file_name: string; sas_url: string
  sas_expires_at: string; is_primary: boolean; uploaded_at: string
}

interface ImagesResponse {
  primary_image_id: number | null
  images: ImageItem[]
  total: number
  remaining_slots: number
}

interface ProfileItem {
  id: number; file_name: string; sas_url: string
  sas_expires_at: string; file_size_kb: number; uploaded_at: string
  uploaded_by: { id: number; full_name: string }
}

interface StatusLog {
  id: number
  old_status: VehicleStatus
  new_status: VehicleStatus
  reason: string | null
  changed_at: string
  changed_by: { id: number; full_name: string }
}

interface StatusLogsResponse {
  data: StatusLog[]
  meta: { total: number; page: number; page_size: number; total_pages: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExpiryBadge(expiry_date: string) {
  const days = differenceInDays(new Date(expiry_date), new Date())
  if (days < 0)   return { label: 'Đã hết hạn',     className: 'bg-error-light text-error' }
  if (days <= 7)  return { label: `Còn ${days} ngày`, className: 'bg-error-light text-error' }
  if (days <= 30) return { label: `Còn ${days} ngày`, className: 'bg-warning-light text-warning' }
  return { label: `Còn ${days} ngày`, className: 'bg-success-light text-success' }
}

const VALID_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  at_yard:     ['renting', 'maintenance', 'sold'],
  renting:     ['at_yard', 'broken'],
  maintenance: ['at_yard'],
  broken:      ['at_yard', 'maintenance'],
  sold:        [],
}

const DOT_COLOR: Record<VehicleStatus, string> = {
  at_yard:     'ring-success bg-success',
  renting:     'ring-primary bg-primary',
  maintenance: 'ring-warning bg-warning',
  broken:      'ring-error bg-error',
  sold:        'ring-text-secondary bg-text-secondary',
}

function formatFileSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const editSchema = z.object({
  model: z.string().min(1, 'Bắt buộc'),
  manufacturer: z.string().min(1, 'Bắt buộc'),
  engine_type: z.enum(['Fuel', 'Electric']),
  manufacture_year: z.coerce.number().int().min(1990).max(2100).optional(),
  capacity: z.coerce.number().positive().optional(),
  occupancy: z.coerce.number().int().positive().optional(),
  platform_height: z.coerce.number().positive().optional(),
  work_height: z.coerce.number().positive().optional(),
  lifting_speed: z.coerce.number().positive().optional(),
  traveling_speed: z.coerce.number().positive().optional(),
})
type EditForm = z.infer<typeof editSchema>

const insuranceSchema = z.object({
  insurance_number: z.string().optional(),
  provider: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Bắt buộc'),
})
type InsuranceForm = z.infer<typeof insuranceSchema>

const inspectionSchema = z.object({
  inspection_number: z.string().optional(),
  inspection_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Bắt buộc'),
  result: z.enum(['passed', 'failed']).optional(),
})
type InspectionForm = z.infer<typeof inspectionSchema>

// ─── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-[length:var(--fs-base)] text-text-secondary shrink-0">{label}</span>
      <span className="text-[length:var(--fs-base)] text-text-primary font-medium text-right">{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const vehicleId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const isAdmin = user?.roles?.includes('admin')
  const isAdminOrManager = isAdmin || user?.roles?.includes('manager')
  const canChangeStatus = isAdmin || isAdminOrManager || user?.roles?.includes('staff')

  const [activeTab, setActiveTab] = useState('info')

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  // Status modal
  const [statusOpen, setStatusOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<VehicleStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')
  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Images (Tab 4)
  const [imgModalOpen, setImgModalOpen] = useState(false)
  const [imgFiles, setImgFiles] = useState<File[]>([])
  const [imgUploading, setImgUploading] = useState(false)
  const [deleteImgId, setDeleteImgId] = useState<number | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  // Profile (Tab 4)
  const [profileUploading, setProfileUploading] = useState(false)
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false)
  const profileInputRef = useRef<HTMLInputElement>(null)
  // Status logs (Tab 4)
  const [statusLogsPage, setStatusLogsPage] = useState(1)

  // Insurance modal
  const [insOpen, setInsOpen] = useState(false)
  const [insFile, setInsFile] = useState<File | null>(null)
  const [insDocId, setInsDocId] = useState<number | null>(null)
  const [insUploading, setInsUploading] = useState(false)
  const [deleteInsId, setDeleteInsId] = useState<number | null>(null)
  const [viewIns, setViewIns] = useState<InsuranceRecord | null>(null)
  // Inspection modal
  const [inspecOpen, setInspecOpen] = useState(false)
  const [inspecFile, setInspecFile] = useState<File | null>(null)
  const [inspecDocId, setInspecDocId] = useState<number | null>(null)
  const [inspecUploading, setInspecUploading] = useState(false)
  const [deleteInspecId, setDeleteInspecId] = useState<number | null>(null)
  const [viewInspec, setViewInspec] = useState<InspectionRecord | null>(null)

  // ── Mock data ─────────────────────────────────────────────────────────────

  const MOCK_VEHICLE: VehicleDetail = {
    id: vehicleId,
    model: 'Toyota 8FBN25',
    serial_number: 'TT-2021-0042',
    manufacturer: 'Toyota',
    manufacture_year: 2021,
    capacity: 2500,
    occupancy: 1,
    platform_height: 3.3,
    work_height: 5.5,
    lifting_speed: 0.45,
    traveling_speed: 16,
    engine_type: 'Electric',
    status: 'at_yard',
    primary_image_url: 'https://placehold.co/320x240?text=Toyota+8FBN25',
    created_at: '2024-03-15T08:00:00Z',
    updated_at: '2025-01-20T14:30:00Z',
    created_by: { id: 1, full_name: 'Nguyễn Văn Admin' },
  }

  const MOCK_INSURANCE: InsuranceRecord[] = [
    {
      id: 1,
      insurance_number: 'BH-2024-001',
      provider: 'Bảo Việt',
      issue_date: '2024-01-01',
      expiry_date: '2025-12-31',
      document: {
        id: 10,
        file_name: 'bao-hiem-2024.pdf',
        sas_url: '#',
        sas_expires_at: '2025-12-31T23:59:59Z',
      },
      created_at: '2024-01-05T09:00:00Z',
      created_by: { id: 1, full_name: 'Nguyễn Văn Admin' },
    },
    {
      id: 2,
      insurance_number: 'BH-2023-007',
      provider: 'PVI',
      issue_date: '2023-01-01',
      expiry_date: '2023-12-31',
      document: null,
      created_at: '2023-01-10T09:00:00Z',
      created_by: { id: 1, full_name: 'Nguyễn Văn Admin' },
    },
  ]

  const MOCK_INSPECTION: InspectionRecord[] = [
    {
      id: 1,
      inspection_number: 'DK-2024-001',
      inspection_date: '2024-06-15',
      expiry_date: '2026-06-14',
      result: 'passed',
      document: {
        id: 20,
        file_name: 'dang-kiem-2024.pdf',
        sas_url: '#',
        sas_expires_at: '2026-06-14T23:59:59Z',
      },
      created_at: '2024-06-16T10:00:00Z',
      created_by: { id: 1, full_name: 'Nguyễn Văn Admin' },
    },
  ]

  const MOCK_IMAGES: ImagesResponse = {
    primary_image_id: 1,
    total: 3,
    remaining_slots: 7,
    images: [
      { id: 1, file_name: 'xe-chinh.jpg', sas_url: 'https://placehold.co/320x240?text=Anh+1', sas_expires_at: '2026-12-31T23:59:59Z', is_primary: true, uploaded_at: '2024-03-15T08:00:00Z' },
      { id: 2, file_name: 'xe-ben-canh.jpg', sas_url: 'https://placehold.co/320x240?text=Anh+2', sas_expires_at: '2026-12-31T23:59:59Z', is_primary: false, uploaded_at: '2024-03-15T08:05:00Z' },
      { id: 3, file_name: 'xe-phia-sau.jpg', sas_url: 'https://placehold.co/320x240?text=Anh+3', sas_expires_at: '2026-12-31T23:59:59Z', is_primary: false, uploaded_at: '2024-03-15T08:10:00Z' },
    ],
  }

  const MOCK_PROFILE: ProfileItem[] = [
    {
      id: 1,
      file_name: 'ly-lich-xe-TT2021-0042.pdf',
      sas_url: '#',
      sas_expires_at: '2026-12-31T23:59:59Z',
      file_size_kb: 1240,
      uploaded_at: '2024-03-15T09:00:00Z',
      uploaded_by: { id: 1, full_name: 'Nguyễn Văn Admin' },
    },
  ]

  const MOCK_STATUS_LOGS: StatusLogsResponse = {
    data: [
      { id: 4, old_status: 'maintenance', new_status: 'at_yard', reason: 'Bảo dưỡng định kỳ hoàn thành', changed_at: '2025-01-20T14:30:00Z', changed_by: { id: 2, full_name: 'Trần Thị Manager' } },
      { id: 3, old_status: 'renting', new_status: 'maintenance', reason: 'Xe trả về — cần kiểm tra định kỳ', changed_at: '2024-12-10T09:15:00Z', changed_by: { id: 2, full_name: 'Trần Thị Manager' } },
      { id: 2, old_status: 'at_yard', new_status: 'renting', reason: null, changed_at: '2024-10-01T08:00:00Z', changed_by: { id: 3, full_name: 'Lê Văn Staff' } },
      { id: 1, old_status: 'at_yard', new_status: 'at_yard', reason: 'Nhập kho lần đầu', changed_at: '2024-03-15T08:00:00Z', changed_by: { id: 1, full_name: 'Nguyễn Văn Admin' } },
    ],
    meta: { total: 4, page: 1, page_size: 20, total_pages: 1 },
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const vehicleQuery = useQuery<VehicleDetail>({
    queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
    queryFn: () => Promise.resolve(MOCK_VEHICLE),
    enabled: !!vehicleId,
  })

  const insuranceQuery = useQuery<InsuranceRecord[]>({
    queryKey: QUERY_KEYS.vehicles.insurance(vehicleId),
    queryFn: () => Promise.resolve(MOCK_INSURANCE),
    enabled: activeTab === 'insurance',
  })

  const inspectionQuery = useQuery<InspectionRecord[]>({
    queryKey: QUERY_KEYS.vehicles.inspection(vehicleId),
    queryFn: () => Promise.resolve(MOCK_INSPECTION),
    enabled: activeTab === 'inspection',
  })

  const imagesQuery = useQuery<ImagesResponse>({
    queryKey: QUERY_KEYS.vehicles.images(vehicleId),
    queryFn: () => Promise.resolve(MOCK_IMAGES),
    enabled: activeTab === 'documents',
  })

  const profileQuery = useQuery<ProfileItem[]>({
    queryKey: QUERY_KEYS.vehicles.profile(vehicleId),
    queryFn: () => Promise.resolve(MOCK_PROFILE),
    enabled: activeTab === 'documents',
  })

  const statusLogsQuery = useQuery<StatusLogsResponse>({
    queryKey: [...QUERY_KEYS.vehicles.statusLogs(vehicleId), statusLogsPage],
    queryFn: () => Promise.resolve(MOCK_STATUS_LOGS),
    enabled: activeTab === 'documents',
  })

  const vehicle = vehicleQuery.data

  // ── Edit mutation ────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: (_body: EditForm) => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.detail(vehicleId) })
      toast.success('Cập nhật xe thành công')
      setEditOpen(false)
    },
  })

  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  const openEdit = () => {
    if (!vehicle) return
    editForm.reset({
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      engine_type: vehicle.engine_type,
      manufacture_year: vehicle.manufacture_year,
      capacity: vehicle.capacity,
      occupancy: vehicle.occupancy,
      platform_height: vehicle.platform_height,
      work_height: vehicle.work_height,
      lifting_speed: vehicle.lifting_speed,
      traveling_speed: vehicle.traveling_speed,
    })
    setEditOpen(true)
  }

  // ── Status mutation ──────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: () => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.detail(vehicleId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all })
      toast.success('Đổi trạng thái thành công')
      setStatusOpen(false)
      setNewStatus('')
      setStatusReason('')
    },
  })

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all })
      toast.success('Đã xóa xe')
      navigate('/vehicles')
    },
  })

  // ── Insurance mutations ──────────────────────────────────────────────────

  const insForm = useForm<InsuranceForm>({ resolver: zodResolver(insuranceSchema) })

  const uploadInsFile = async (_file: File) => {
    setInsUploading(true)
    await new Promise((res) => setTimeout(res, 800))
    setInsDocId(99)
    setInsUploading(false)
  }

  const addInsMutation = useMutation({
    mutationFn: (_body: InsuranceForm) => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.insurance(vehicleId) })
      toast.success('Thêm bảo hiểm thành công')
      setInsOpen(false)
      insForm.reset()
      setInsFile(null)
      setInsDocId(null)
    },
  })

  const deleteInsMutation = useMutation({
    mutationFn: (_insId: number) => new Promise<void>((res) => setTimeout(res, 400)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.insurance(vehicleId) })
      toast.success('Đã xóa bảo hiểm')
      setDeleteInsId(null)
    },
  })

  // ── Inspection mutations ─────────────────────────────────────────────────

  const inspecForm = useForm<InspectionForm>({ resolver: zodResolver(inspectionSchema) })

  const uploadInspecFile = async (_file: File) => {
    setInspecUploading(true)
    await new Promise((res) => setTimeout(res, 800))
    setInspecDocId(98)
    setInspecUploading(false)
  }

  const addInspecMutation = useMutation({
    mutationFn: (_body: InspectionForm) => new Promise<void>((res) => setTimeout(res, 500)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.inspection(vehicleId) })
      toast.success('Thêm đăng kiểm thành công')
      setInspecOpen(false)
      inspecForm.reset()
      setInspecFile(null)
      setInspecDocId(null)
    },
  })

  const deleteInspecMutation = useMutation({
    mutationFn: (_inspecId: number) => new Promise<void>((res) => setTimeout(res, 400)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.inspection(vehicleId) })
      toast.success('Đã xóa đăng kiểm')
      setDeleteInspecId(null)
    },
  })

  // ── Tab 4: Images mutations ──────────────────────────────────────────────

  const uploadImagesMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setImgUploading(true)
      await new Promise((res) => setTimeout(res, 800))
      return files
    },
    onSuccess: (_, files) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.images(vehicleId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.detail(vehicleId) })
      toast.success(`Đã thêm ${files.length} ảnh`)
      setImgModalOpen(false)
      setImgFiles([])
    },
    onSettled: () => setImgUploading(false),
  })

  const setPrimaryMutation = useMutation({
    mutationFn: (_docId: number) => new Promise<void>((res) => setTimeout(res, 400)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.images(vehicleId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.detail(vehicleId) })
      toast.success('Đã đặt ảnh đại diện')
    },
  })

  const deleteImageMutation = useMutation({
    mutationFn: (_docId: number) => new Promise<void>((res) => setTimeout(res, 400)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.images(vehicleId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.detail(vehicleId) })
      toast.success('Đã xóa ảnh')
      setDeleteImgId(null)
    },
  })

  // ── Tab 4: Profile mutations ─────────────────────────────────────────────

  const uploadProfile = async (_file: File) => {
    setProfileUploading(true)
    try {
      await new Promise((res) => setTimeout(res, 800))
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.profile(vehicleId) })
      toast.success('Đã cập nhật lý lịch xe')
    } catch {
      toast.error('Có lỗi xảy ra')
    } finally {
      setProfileUploading(false)
    }
  }

  const deleteProfileMutation = useMutation({
    mutationFn: () => new Promise<void>((res) => setTimeout(res, 400)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.profile(vehicleId) })
      toast.success('Đã xóa lý lịch xe')
      setDeleteProfileOpen(false)
    },
  })

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (vehicleQuery.isLoading) {
    return (
      <div className="flex flex-col gap-[var(--sp-section)]">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Truck className="h-12 w-12 text-text-secondary" />
        <p className="text-[length:var(--fs-title)] text-text-secondary">Không tìm thấy xe</p>
        <Button variant="outline" onClick={() => navigate('/vehicles')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
      </div>
    )
  }

  const { label: statusLabel, className: statusClass } = getVehicleStatusBadge(vehicle.status)
  const validNextStatuses = VALID_TRANSITIONS[vehicle.status] ?? []

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      {/* Back */}
      <button
        onClick={() => navigate('/vehicles')}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách xe
      </button>

      {/* ── Header card ── */}
      <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-6">
        {/* Row 1: ảnh + info */}
        <div className="flex gap-3 lg:gap-5">
          {vehicle.primary_image_url ? (
            <img
              src={vehicle.primary_image_url}
              alt={vehicle.model}
              className="h-16 w-16 lg:h-24 lg:w-24 rounded-lg object-cover border border-border shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 lg:h-24 lg:w-24 items-center justify-center rounded-lg bg-bg-page border border-border shrink-0">
              <Truck className="h-7 w-7 lg:h-10 lg:w-10 text-text-secondary" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Model + badge */}
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="text-[length:var(--fs-heading)] font-semibold text-text-primary leading-tight">
                {vehicle.model}
              </h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            {/* Serial */}
            <p className="flex items-center gap-1 text-[length:var(--fs-sm)] text-text-secondary mb-0.5">
              <Barcode className="h-3.5 w-3.5 shrink-0" />
              {vehicle.serial_number}
            </p>
            {/* Hãng · năm */}
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              {vehicle.manufacturer} · {vehicle.manufacture_year}
            </p>
          </div>
        </div>

        {/* Row 2: actions — full width, dưới ảnh+info */}
        {(isAdmin || (canChangeStatus && validNextStatuses.length > 0)) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="border-border flex-1 sm:flex-none"
                onClick={openEdit}
              >
                <Pencil className="h-4 w-4 mr-1" /> Chỉnh sửa
              </Button>
            )}
            {canChangeStatus && validNextStatuses.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-border flex-1 sm:flex-none"
                onClick={() => setStatusOpen(true)}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Đổi trạng thái
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="border-error text-error hover:bg-error hover:text-white sm:ml-auto"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Xóa
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1 overflow-x-auto">
          {[
            { value: 'info', label: 'Thông tin kỹ thuật' },
            { value: 'insurance', label: 'Bảo hiểm' },
            { value: 'inspection', label: 'Đăng kiểm' },
            { value: 'documents', label: 'Hồ sơ & Lịch sử' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-white text-text-secondary px-4 py-2.5 text-[length:var(--fs-base)] font-medium"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── TAB 1: Thông tin kỹ thuật ─── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card thông số */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
                Thông số kỹ thuật
              </p>
              <InfoRow
                label="Loại động cơ"
                value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${vehicle.engine_type === 'Electric' ? 'bg-info-light text-info' : 'bg-warning-light text-warning'}`}>
                    {vehicle.engine_type === 'Electric' ? 'Điện' : 'Xăng/Dầu'}
                  </span>
                }
              />
              <InfoRow label="Tải trọng" value={`${vehicle.capacity} kg`} />
              <InfoRow label="Số người" value={`${vehicle.occupancy} người`} />
              <InfoRow label="Chiều cao sàn" value={`${vehicle.platform_height} m`} />
              <InfoRow label="Chiều cao làm việc" value={`${vehicle.work_height} m`} />
              <InfoRow label="Tốc độ nâng" value={`${vehicle.lifting_speed} m/s`} />
              <InfoRow label="Tốc độ di chuyển" value={`${vehicle.traveling_speed} km/h`} />
            </div>

            {/* Card quản lý */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
                Thông tin quản lý
              </p>
              <InfoRow
                label="Trạng thái"
                value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}>
                    {statusLabel}
                  </span>
                }
              />
              <InfoRow
                label="Ngày tạo"
                value={format(new Date(vehicle.created_at), 'dd/MM/yyyy')}
              />
              <InfoRow
                label="Cập nhật lần cuối"
                value={format(new Date(vehicle.updated_at), 'dd/MM/yyyy HH:mm')}
              />
              <InfoRow label="Người tạo" value={vehicle.created_by.full_name} />
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: Bảo hiểm ─── */}
        <TabsContent value="insurance" className="mt-4">
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            {isAdminOrManager && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white"
                  onClick={() => setInsOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm bảo hiểm
                </Button>
              </div>
            )}

            {/* List */}
            {insuranceQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : !insuranceQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 bg-bg-card rounded-lg border border-border">
                <Shield className="h-8 w-8 text-text-secondary" />
                <p className="text-[length:var(--fs-base)] text-text-secondary">Chưa có hồ sơ bảo hiểm</p>
              </div>
            ) : (
              insuranceQuery.data.map((ins) => {
                const expiry = getExpiryBadge(ins.expiry_date)
                return (
                  <div key={ins.id} onClick={() => setViewIns(ins)} className="bg-bg-card rounded-lg border border-border p-4 flex flex-wrap gap-4 items-center cursor-pointer hover:border-primary hover:shadow-sm transition-all">
                    {/* Trái */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Shield className="h-8 w-8 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary truncate">{ins.insurance_number || '—'}</p>
                        <p className="text-[length:var(--fs-sm)] text-text-secondary truncate">{ins.provider || '—'}</p>
                      </div>
                    </div>
                    {/* Giữa */}
                    <div className="text-[length:var(--fs-sm)] text-text-secondary">
                      {ins.issue_date ? format(new Date(ins.issue_date), 'dd/MM/yyyy') : '—'}
                      {' → '}
                      {format(new Date(ins.expiry_date), 'dd/MM/yyyy')}
                    </div>
                    {/* Phải */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${expiry.className}`}>
                        {expiry.label}
                      </span>
                      {ins.document && (
                        <a
                          href={ins.document.sas_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded text-text-secondary hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                          title={ins.document.file_name}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {isAdminOrManager && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteInsId(ins.id) }}
                          className="p-1.5 rounded text-text-secondary hover:text-white hover:bg-error transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* ─── TAB 3: Đăng kiểm ─── */}
        <TabsContent value="inspection" className="mt-4">
          <div className="flex flex-col gap-4">
            {isAdminOrManager && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white"
                  onClick={() => setInspecOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm đăng kiểm
                </Button>
              </div>
            )}

            {inspectionQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : !inspectionQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 bg-bg-card rounded-lg border border-border">
                <CheckCircle2 className="h-8 w-8 text-text-secondary" />
                <p className="text-[length:var(--fs-base)] text-text-secondary">Chưa có hồ sơ đăng kiểm</p>
              </div>
            ) : (
              inspectionQuery.data.map((ins) => {
                const expiry = getExpiryBadge(ins.expiry_date)
                const resultBadge = ins.result === 'passed'
                  ? { label: 'Đạt', className: 'bg-success-light text-success' }
                  : { label: 'Không đạt', className: 'bg-error-light text-error' }
                return (
                  <div key={ins.id} onClick={() => setViewInspec(ins)} className="bg-bg-card rounded-lg border border-border p-4 flex flex-wrap gap-4 items-center cursor-pointer hover:border-primary hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary truncate">{ins.inspection_number || '—'}</p>
                        <p className="text-[length:var(--fs-sm)] text-text-secondary">
                          Ngày kiểm: {ins.inspection_date ? format(new Date(ins.inspection_date), 'dd/MM/yyyy') : '—'}
                          {' — Hết hạn: '}
                          {format(new Date(ins.expiry_date), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {ins.result && (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${resultBadge.className}`}>
                          {resultBadge.label}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${expiry.className}`}>
                        {expiry.label}
                      </span>
                      {ins.document && (
                        <a
                          href={ins.document.sas_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded text-text-secondary hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                          title={ins.document.file_name}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {isAdminOrManager && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteInspecId(ins.id) }}
                          className="p-1.5 rounded text-text-secondary hover:text-white hover:bg-error transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* ─── TAB 4: Hồ sơ & Lịch sử ─── */}
        <TabsContent value="documents" className="mt-4">
          <div className="flex flex-col gap-6">

            {/* ── Section 1: Thư viện ảnh ── */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">Thư viện ảnh</p>
                {isAdminOrManager && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary-dark text-white"
                    onClick={() => { setImgFiles([]); setImgModalOpen(true) }}
                    disabled={
                      imagesQuery.isLoading ||
                      (imagesQuery.data?.remaining_slots ?? 1) <= 0
                    }
                  >
                    <ImagePlus className="h-4 w-4 mr-1" /> Thêm ảnh
                  </Button>
                )}
              </div>

              {imagesQuery.isLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : !imagesQuery.data?.images?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-lg bg-bg-page border border-dashed border-border">
                  <ImagePlus className="h-8 w-8 text-text-secondary" />
                  <p className="text-[length:var(--fs-base)] text-text-secondary">Chưa có ảnh nào</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {imagesQuery.data.images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      <img
                        src={img.sas_url}
                        alt={img.file_name}
                        className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${
                          img.is_primary ? 'border-primary' : 'border-border'
                        }`}
                      />
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                          <Star className="h-2.5 w-2.5 fill-white" /> Chính
                        </span>
                      )}
                      {isAdminOrManager && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          {!img.is_primary && (
                            <button
                              onClick={() => setPrimaryMutation.mutate(img.id)}
                              disabled={setPrimaryMutation.isPending}
                              className="p-1.5 bg-white rounded-full text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                              title="Đặt làm ảnh chính"
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteImgId(img.id)}
                            className="p-1.5 bg-white rounded-full text-error hover:bg-error hover:text-white transition-colors cursor-pointer"
                            title="Xóa ảnh"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {imagesQuery.data && (
                <p className="mt-3 text-[length:var(--fs-sm)] text-text-secondary">
                  {imagesQuery.data.total} ảnh · còn {imagesQuery.data.remaining_slots} slot trống
                </p>
              )}
            </div>

            {/* ── Section 2: Lý lịch xe (PDF) ── */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">Lý lịch xe</p>
              </div>

              {profileQuery.isLoading ? (
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : !profileQuery.data?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-lg bg-bg-page border border-dashed border-border">
                  <FileText className="h-8 w-8 text-text-secondary" />
                  <p className="text-[length:var(--fs-base)] text-text-secondary">Chưa có lý lịch xe</p>
                  {isAdminOrManager && (
                    <>
                      <input
                        ref={profileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadProfile(f)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        disabled={profileUploading}
                        onClick={() => profileInputRef.current?.click()}
                      >
                        {profileUploading ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang upload...</>
                        ) : (
                          <><Plus className="h-4 w-4 mr-1" /> Tải lên lý lịch (PDF)</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                profileQuery.data.map((profile) => (
                  <div key={profile.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-page">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[length:var(--fs-base)] font-medium text-text-primary truncate">{profile.file_name}</p>
                      <p className="text-[length:var(--fs-sm)] text-text-secondary">
                        {formatFileSize(profile.file_size_kb)} · Cập nhật: {format(new Date(profile.uploaded_at), 'dd/MM/yyyy')} bởi {profile.uploaded_by.full_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={profile.sas_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-text-secondary hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                        title="Tải xuống"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      {isAdminOrManager && (
                        <>
                          <input
                            ref={profileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) uploadProfile(f)
                              e.target.value = ''
                            }}
                          />
                          <button
                            onClick={() => profileInputRef.current?.click()}
                            disabled={profileUploading}
                            className="p-1.5 rounded text-text-secondary hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                            title="Thay thế file"
                          >
                            {profileUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteProfileOpen(true)}
                            className="p-1.5 rounded text-text-secondary hover:text-white hover:bg-error transition-colors cursor-pointer"
                            title="Xóa lý lịch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Section 3: Lịch sử trạng thái ── */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-4">Lịch sử trạng thái</p>

              {statusLogsQuery.isLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : !statusLogsQuery.data?.data?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-lg bg-bg-page border border-dashed border-border">
                  <History className="h-8 w-8 text-text-secondary" />
                  <p className="text-[length:var(--fs-base)] text-text-secondary">Chưa có lịch sử thay đổi</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

                  <div className="flex flex-col gap-0">
                    {statusLogsQuery.data.data.map((log, idx) => {
                      const newCfg = VEHICLE_STATUS_CONFIG[log.new_status]
                      const oldCfg = VEHICLE_STATUS_CONFIG[log.old_status]
                      const dotColor = DOT_COLOR[log.new_status]
                      return (
                        <div key={log.id} className={`relative flex gap-4 ${idx !== statusLogsQuery.data!.data.length - 1 ? 'pb-5' : ''}`}>
                          {/* Dot */}
                          <div className={`relative z-10 mt-1 h-4.5 w-4.5 rounded-full ring-2 ring-offset-2 shrink-0 ${dotColor}`} style={{ width: '18px', height: '18px', marginTop: '2px' }} />
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${oldCfg?.className ?? 'bg-bg-page text-text-secondary'}`}>
                                {oldCfg?.label ?? log.old_status}
                              </span>
                              <span className="text-text-secondary text-[length:var(--fs-sm)]">→</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${newCfg?.className ?? 'bg-bg-page text-text-secondary'}`}>
                                {newCfg?.label ?? log.new_status}
                              </span>
                            </div>
                            {log.reason && (
                              <p className="text-[length:var(--fs-sm)] text-text-primary">{log.reason}</p>
                            )}
                            <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5">
                              {format(new Date(log.changed_at), 'HH:mm dd/MM/yyyy')} · {log.changed_by.full_name}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {statusLogsQuery.data.meta.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <p className="text-[length:var(--fs-sm)] text-text-secondary">
                        Trang {statusLogsQuery.data.meta.page} / {statusLogsQuery.data.meta.total_pages}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border h-8 px-3"
                          disabled={statusLogsPage <= 1}
                          onClick={() => setStatusLogsPage((p) => p - 1)}
                        >
                          Trước
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border h-8 px-3"
                          disabled={statusLogsPage >= statusLogsQuery.data.meta.total_pages}
                          onClick={() => setStatusLogsPage((p) => p + 1)}
                        >
                          Tiếp
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </TabsContent>
      </Tabs>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Modal Chỉnh sửa */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold">Chỉnh sửa xe</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((v) => editMutation.mutate(v))} className="mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Model <span className="text-error">*</span></Label>
                  <Input {...editForm.register('model')} className="border-border" />
                  {editForm.formState.errors.model && <p className="text-[length:var(--fs-sm)] text-error">{editForm.formState.errors.model.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Hãng SX <span className="text-error">*</span></Label>
                  <Input {...editForm.register('manufacturer')} className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Năm SX</Label>
                  <Input {...editForm.register('manufacture_year')} type="number" className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Loại động cơ <span className="text-error">*</span></Label>
                  <Select
                    defaultValue={vehicle.engine_type}
                    onValueChange={(v) => editForm.setValue('engine_type', v as 'Fuel' | 'Electric')}
                  >
                    <SelectTrigger className="border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electric">Điện</SelectItem>
                      <SelectItem value="Fuel">Xăng/Dầu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Tải trọng (kg)</Label>
                  <Input {...editForm.register('capacity')} type="number" className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Số người</Label>
                  <Input {...editForm.register('occupancy')} type="number" className="border-border" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[length:var(--fs-base)] font-medium">Chiều cao sàn (m)</Label>
                  <Input {...editForm.register('platform_height')} type="number" step="0.1" className="border-border" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Cao LV (m)</Label>
                <Input {...editForm.register('work_height')} type="number" step="0.1" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Tốc độ nâng (m/s)</Label>
                <Input {...editForm.register('lifting_speed')} type="number" step="0.01" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Tốc độ di chuyển (km/h)</Label>
                <Input {...editForm.register('traveling_speed')} type="number" step="0.1" className="border-border" />
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" className="border-border" onClick={() => setEditOpen(false)} disabled={editMutation.isPending}>Hủy</Button>
              <Button type="submit" className="bg-primary hover:bg-primary-dark text-white" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Đổi trạng thái */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold">Đổi trạng thái</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--fs-base)] text-text-secondary">Hiện tại:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}>{statusLabel}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Trạng thái mới <span className="text-error">*</span></Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as VehicleStatus)}>
                <SelectTrigger className="border-border"><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                <SelectContent>
                  {validNextStatuses.map((s) => {
                    const cfg = VEHICLE_STATUS_CONFIG[s]
                    return <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Lý do (tùy chọn)</Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Nhập lý do đổi trạng thái..."
                className="border-border resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" className="border-border" onClick={() => setStatusOpen(false)} disabled={statusMutation.isPending}>Hủy</Button>
            <Button
              className="bg-primary hover:bg-primary-dark text-white"
              onClick={() => statusMutation.mutate()}
              disabled={!newStatus || statusMutation.isPending}
            >
              {statusMutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Thêm bảo hiểm */}
      <Dialog open={insOpen} onOpenChange={(o) => { setInsOpen(o); if (!o) { insForm.reset(); setInsFile(null); setInsDocId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold">Thêm bảo hiểm</DialogTitle>
          </DialogHeader>
          <form onSubmit={insForm.handleSubmit((v) => addInsMutation.mutate(v))} className="flex flex-col gap-4 mt-2">
            <FileUpload
              value={insFile}
              onChange={(f) => { setInsFile(f); if (f) uploadInsFile(f) }}
              label="Kéo thả hoặc chọn file bảo hiểm (PDF, JPEG, PNG)"
              disabled={insUploading}
            />
            {insUploading && <p className="text-[length:var(--fs-sm)] text-text-secondary">Đang upload...</p>}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Số bảo hiểm</Label>
              <Input {...insForm.register('insurance_number')} placeholder="VD: BH-2024-001" className="border-border" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Công ty BH</Label>
              <Input {...insForm.register('provider')} placeholder="VD: Bảo Việt" className="border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Ngày cấp</Label>
                <Input {...insForm.register('issue_date')} type="date" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Ngày hết hạn <span className="text-error">*</span></Label>
                <Input {...insForm.register('expiry_date')} type="date" className="border-border" />
                {insForm.formState.errors.expiry_date && <p className="text-[length:var(--fs-sm)] text-error">{insForm.formState.errors.expiry_date.message}</p>}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-border" onClick={() => setInsOpen(false)} disabled={addInsMutation.isPending}>Hủy</Button>
              <Button type="submit" className="bg-primary hover:bg-primary-dark text-white" disabled={addInsMutation.isPending || insUploading}>
                {addInsMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Thêm đăng kiểm */}
      <Dialog open={inspecOpen} onOpenChange={(o) => { setInspecOpen(o); if (!o) { inspecForm.reset(); setInspecFile(null); setInspecDocId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold">Thêm đăng kiểm</DialogTitle>
          </DialogHeader>
          <form onSubmit={inspecForm.handleSubmit((v) => addInspecMutation.mutate(v))} className="flex flex-col gap-4 mt-2">
            <FileUpload
              value={inspecFile}
              onChange={(f) => { setInspecFile(f); if (f) uploadInspecFile(f) }}
              label="Kéo thả hoặc chọn file đăng kiểm (PDF, JPEG, PNG)"
              disabled={inspecUploading}
            />
            {inspecUploading && <p className="text-[length:var(--fs-sm)] text-text-secondary">Đang upload...</p>}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Số kiểm định</Label>
              <Input {...inspecForm.register('inspection_number')} placeholder="VD: DK-2024-001" className="border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Ngày kiểm</Label>
                <Input {...inspecForm.register('inspection_date')} type="date" className="border-border" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--fs-base)] font-medium">Ngày hết hạn <span className="text-error">*</span></Label>
                <Input {...inspecForm.register('expiry_date')} type="date" className="border-border" />
                {inspecForm.formState.errors.expiry_date && <p className="text-[length:var(--fs-sm)] text-error">{inspecForm.formState.errors.expiry_date.message}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">Kết quả</Label>
              <Select onValueChange={(v) => inspecForm.setValue('result', v as 'passed' | 'failed')}>
                <SelectTrigger className="border-border"><SelectValue placeholder="Chọn kết quả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Đạt</SelectItem>
                  <SelectItem value="failed">Không đạt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-border" onClick={() => setInspecOpen(false)} disabled={addInspecMutation.isPending}>Hủy</Button>
              <Button type="submit" className="bg-primary hover:bg-primary-dark text-white" disabled={addInspecMutation.isPending || inspecUploading}>
                {addInspecMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm xóa xe */}
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa xe này?"
        description={`Xe ${vehicle.model} (${vehicle.serial_number}) sẽ bị xóa vĩnh viễn.`}
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {/* Detail bảo hiểm */}
      <Dialog open={viewIns !== null} onOpenChange={(o) => { if (!o) setViewIns(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Chi tiết bảo hiểm
            </DialogTitle>
          </DialogHeader>
          {viewIns && (
            <div className="flex flex-col gap-0 mt-2">
              <InfoRow label="Số bảo hiểm" value={viewIns.insurance_number || '—'} />
              <InfoRow label="Công ty BH" value={viewIns.provider || '—'} />
              <InfoRow label="Ngày cấp" value={viewIns.issue_date ? format(new Date(viewIns.issue_date), 'dd/MM/yyyy') : '—'} />
              <InfoRow label="Ngày hết hạn" value={format(new Date(viewIns.expiry_date), 'dd/MM/yyyy')} />
              <InfoRow
                label="Trạng thái"
                value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${getExpiryBadge(viewIns.expiry_date).className}`}>
                    {getExpiryBadge(viewIns.expiry_date).label}
                  </span>
                }
              />
              <InfoRow label="Tài liệu" value={
                viewIns.document
                  ? <a href={viewIns.document.sas_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3.5 w-3.5" /> {viewIns.document.file_name}
                    </a>
                  : '—'
              } />
              <InfoRow label="Ngày tạo" value={format(new Date(viewIns.created_at), 'dd/MM/yyyy')} />
              <InfoRow label="Người tạo" value={viewIns.created_by.full_name} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail đăng kiểm */}
      <Dialog open={viewInspec !== null} onOpenChange={(o) => { if (!o) setViewInspec(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Chi tiết đăng kiểm
            </DialogTitle>
          </DialogHeader>
          {viewInspec && (
            <div className="flex flex-col gap-0 mt-2">
              <InfoRow label="Số kiểm định" value={viewInspec.inspection_number || '—'} />
              <InfoRow label="Ngày kiểm" value={viewInspec.inspection_date ? format(new Date(viewInspec.inspection_date), 'dd/MM/yyyy') : '—'} />
              <InfoRow label="Ngày hết hạn" value={format(new Date(viewInspec.expiry_date), 'dd/MM/yyyy')} />
              <InfoRow
                label="Kết quả"
                value={viewInspec.result
                  ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${viewInspec.result === 'passed' ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
                      {viewInspec.result === 'passed' ? 'Đạt' : 'Không đạt'}
                    </span>
                  : '—'
                }
              />
              <InfoRow
                label="Trạng thái"
                value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${getExpiryBadge(viewInspec.expiry_date).className}`}>
                    {getExpiryBadge(viewInspec.expiry_date).label}
                  </span>
                }
              />
              <InfoRow label="Tài liệu" value={
                viewInspec.document
                  ? <a href={viewInspec.document.sas_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Download className="h-3.5 w-3.5" /> {viewInspec.document.file_name}
                    </a>
                  : '—'
              } />
              <InfoRow label="Ngày tạo" value={format(new Date(viewInspec.created_at), 'dd/MM/yyyy')} />
              <InfoRow label="Người tạo" value={viewInspec.created_by.full_name} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm xóa bảo hiểm */}
      <ConfirmModal
        open={deleteInsId !== null}
        onOpenChange={(o) => { if (!o) setDeleteInsId(null) }}
        title="Xóa bảo hiểm này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteInsMutation.isPending}
        onConfirm={() => deleteInsId !== null && deleteInsMutation.mutate(deleteInsId)}
      />

      {/* Confirm xóa đăng kiểm */}
      <ConfirmModal
        open={deleteInspecId !== null}
        onOpenChange={(o) => { if (!o) setDeleteInspecId(null) }}
        title="Xóa đăng kiểm này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteInspecMutation.isPending}
        onConfirm={() => deleteInspecId !== null && deleteInspecMutation.mutate(deleteInspecId)}
      />

      {/* Confirm xóa ảnh */}
      <ConfirmModal
        open={deleteImgId !== null}
        onOpenChange={(o) => { if (!o) setDeleteImgId(null) }}
        title="Xóa ảnh này?"
        description="Ảnh sẽ bị xóa vĩnh viễn và không thể khôi phục."
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteImageMutation.isPending}
        onConfirm={() => deleteImgId !== null && deleteImageMutation.mutate(deleteImgId)}
      />

      {/* Confirm xóa lý lịch xe */}
      <ConfirmModal
        open={deleteProfileOpen}
        onOpenChange={setDeleteProfileOpen}
        title="Xóa lý lịch xe?"
        description="File lý lịch sẽ bị xóa vĩnh viễn."
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteProfileMutation.isPending}
        onConfirm={() => deleteProfileMutation.mutate()}
      />

      {/* Modal thêm ảnh */}
      <Dialog open={imgModalOpen} onOpenChange={(o) => { setImgModalOpen(o); if (!o) setImgFiles([]) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[length:var(--fs-title)] font-semibold">Thêm ảnh xe</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <input
              ref={imgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                setImgFiles((prev) => {
                  const merged = [...prev, ...files]
                  const maxSlots = imagesQuery.data?.remaining_slots ?? 10
                  return merged.slice(0, maxSlots)
                })
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-text-secondary hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-[length:var(--fs-base)]">Chọn ảnh (JPEG, PNG, WEBP)</span>
              <span className="text-[length:var(--fs-sm)]">Tối đa {imagesQuery.data?.remaining_slots ?? 10} ảnh</span>
            </button>

            {imgFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {imgFiles.map((f, i) => (
                  <div key={i} className="relative aspect-square group">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="w-full h-full object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setImgFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => { setImgModalOpen(false); setImgFiles([]) }}
              disabled={imgUploading}
            >
              Hủy
            </Button>
            <Button
              className="bg-primary hover:bg-primary-dark text-white"
              disabled={imgFiles.length === 0 || imgUploading}
              onClick={() => uploadImagesMutation.mutate(imgFiles)}
            >
              {imgUploading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang upload...</>
              ) : (
                `Tải lên ${imgFiles.length > 0 ? `(${imgFiles.length})` : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
