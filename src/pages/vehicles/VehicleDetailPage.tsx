import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatDate, formatDateTime } from "@/utils/format";
import { getApiError, getApiErrorMessage } from "@/utils/apiError";
import {
  Pencil,
  RefreshCw,
  Trash2,
  Plus,
  Shield,
  CheckCircle2,
  Truck,
  ArrowLeft,
  Barcode,
  Star,
  FileText,
  History,
  Loader2,
  ImagePlus,
  ZoomIn,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  LocateFixed,
  Copy,
} from "lucide-react";
import {
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  changeVehicleStatus,
  getVehicleStatusLogs,
  getVehicleInsurance,
  createVehicleInsurance,
  deleteVehicleInsurance,
  getVehicleInspection,
  createVehicleInspection,
  deleteVehicleInspection,
  getVehicleImages,
  setPrimaryImage,
  deleteDocument,
  uploadDocuments,
  getVehicleProfile,
  upsertVehicleProfile,
  deleteVehicleProfile,
  updateVehicleLocation,
  regenerateVehicleQrCode,
} from "@/api/vehicles.api";
import { getAuditLogs } from "@/api/audit-logs.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { DatePicker } from "@/components/shared/DatePicker";
import { MobileTwoColDialog } from "@/components/shared/MobileTwoColDialog";
import { FileCard } from "@/components/shared/FileCard";
import { DocumentExtractButton } from "@/components/shared/DocumentExtractButton";
import { uploadDocument } from "@/api/documents.api";
import { useReplaceDocument } from "@/hooks/useReplaceDocument";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
  MobileSheetFullscreenHeader,
} from "@/components/shared/MobileSheet";
import {
  VEHICLE_STATUS_CONFIG,
  getVehicleStatusBadge,
} from "@/constants/vehicleStatus";
import { getVehicleTypeLabel } from "@/constants/vehicleType";
import type {
  InspectionRecord,
  InsuranceRecord,
  VehicleStatus,
  VehicleStatusLogsResponse,
} from "@/types/vehicle.types";
import { VehicleFormFields } from "@/pages/vehicles/components/VehicleForm";
import {
  applyVehicleServerError,
  getCurrentPosition,
  makeVehicleSchema,
  toVehicleBody,
  vehicleToFormValues,
  type VehicleFormInput,
  type VehicleFormValues,
} from "@/pages/vehicles/components/vehicleForm.schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// expiryDate là DateOnly (yyyy-MM-dd) → parseISO ra 00:00 giờ local, so theo ngày lịch
function getExpiryBadge(expiryDate: string) {
  const days = differenceInCalendarDays(parseISO(expiryDate), new Date());
  if (days < 0)
    return { label: "Đã hết hạn", className: "bg-error-light text-error" };
  if (days <= 7)
    return {
      label: `Còn ${days} ngày`,
      className: "bg-error-light text-error",
    };
  if (days <= 30)
    return {
      label: `Còn ${days} ngày`,
      className: "bg-warning-light text-warning",
    };
  return {
    label: `Còn ${days} ngày`,
    className: "bg-success-light text-success",
  };
}

// Spec §3.1 — đổi sai luồng BE trả 400 INVALID_TRANSITION
const VALID_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  at_yard: ["renting", "maintenance", "sold"],
  renting: ["at_yard", "broken"],
  maintenance: ["at_yard"],
  broken: ["at_yard", "maintenance"],
  sold: [],
};

// Đích cần thêm quyền vehicles.status_all (thiếu → 403)
const STATUS_ALL_TARGETS: VehicleStatus[] = ["maintenance", "sold"];

const DOT_COLOR: Record<VehicleStatus, string> = {
  at_yard: "ring-success bg-success",
  renting: "ring-primary bg-primary",
  maintenance: "ring-warning bg-warning",
  broken: "ring-error bg-error",
  sold: "ring-text-secondary bg-text-secondary",
};

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const editVehicleSchema = makeVehicleSchema("edit");

const insuranceSchema = z
  .object({
    insuranceNumber: z.string().trim().max(100, "Tối đa 100 ký tự").optional(),
    provider: z.string().trim().max(200, "Tối đa 200 ký tự").optional(),
    issueDate: z.string().optional(),
    expiryDate: z.string().min(1, "Bắt buộc"),
  })
  .refine((v) => !v.issueDate || v.expiryDate > v.issueDate, {
    path: ["expiryDate"],
    message: "Ngày hết hạn phải sau ngày cấp",
  });
type InsuranceForm = z.infer<typeof insuranceSchema>;
interface InsuranceAutofillFields extends Partial<InsuranceForm> { documentId: number }

const inspectionSchema = z
  .object({
    inspectionNumber: z.string().trim().max(100, "Tối đa 100 ký tự").optional(),
    inspectionDate: z.string().optional(),
    expiryDate: z.string().min(1, "Bắt buộc"),
    result: z.enum(["passed", "failed"]).optional(),
  })
  .refine((v) => !v.inspectionDate || v.expiryDate > v.inspectionDate, {
    path: ["expiryDate"],
    message: "Ngày hết hạn phải sau ngày kiểm định",
  });
type InspectionForm = z.infer<typeof inspectionSchema>;
interface InspectionAutofillFields extends Partial<InspectionForm> { documentId: number }

// ─── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-[length:var(--fs-base)] text-text-secondary shrink-0">
        {label}
      </span>
      <span className="text-[length:var(--fs-base)] text-text-primary font-medium text-right">
        {value}
      </span>
    </div>
  );
}

function StatusHistoryCard({
  isLoading,
  response,
  page,
  onPrevious,
  onNext,
}: {
  isLoading: boolean;
  response?: VehicleStatusLogsResponse;
  page: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="h-full bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
      <p className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">
        Lịch sử trạng thái
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !response?.data?.length ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-lg bg-bg-page border border-dashed border-border">
          <History className="h-8 w-8 text-text-secondary" />
          <p className="text-[length:var(--fs-base)] text-text-secondary">
            Chưa có lịch sử thay đổi
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {response.data.map((log, idx) => {
              const newCfg = VEHICLE_STATUS_CONFIG[log.toStatus];
              const oldCfg = VEHICLE_STATUS_CONFIG[log.fromStatus];
              const dotColor = DOT_COLOR[log.toStatus];
              return (
                <div
                  key={log.id}
                  className={`relative flex gap-3 ${idx !== response.data.length - 1 ? "pb-3" : ""}`}
                >
                  <div
                    className={`relative z-10 mt-1 h-4.5 w-4.5 rounded-full ring-2 ring-offset-2 shrink-0 ${dotColor}`}
                    style={{ width: "18px", height: "18px", marginTop: "2px" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${oldCfg?.className ?? "bg-bg-page text-text-secondary"}`}
                      >
                        {oldCfg?.label ?? log.fromStatus}
                      </span>
                      <span className="text-text-secondary text-[length:var(--fs-sm)]">→</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${newCfg?.className ?? "bg-bg-page text-text-secondary"}`}
                      >
                        {newCfg?.label ?? log.toStatus}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-[length:var(--fs-sm)] text-text-primary">{log.reason}</p>
                    )}
                    <p className="text-[length:var(--fs-sm)] text-text-secondary mt-0.5">
                      {formatDateTime(log.changedAt)}
                      {log.changedByName ? ` · ${log.changedByName}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {response.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                Trang {response.meta.page} / {response.meta.totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border h-8 px-3"
                  disabled={page <= 1}
                  onClick={onPrevious}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border h-8 px-3"
                  disabled={page >= response.meta.totalPages}
                  onClick={onNext}
                >
                  Tiếp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── InsuranceFileCard ────────────────────────────────────────────────────────

function InsuranceFileCard({
  document,
  insuranceId,
  vehicleId,
  canReplace,
}: {
  document: InsuranceRecord["document"];
  insuranceId: number;
  vehicleId: number;
  canReplace: boolean;
}) {
  const replace = useReplaceDocument({
    documentId: document?.id,
    entityType: "insurance",
    entityId: insuranceId,
    queryKeys: [[...QUERY_KEYS.vehicles.insurance(vehicleId)]],
  });
  if (!document)
    return (
      <span className="text-xs text-text-disabled">Chưa có file đính kèm</span>
    );
  return (
    <FileCard
      fileName={document.fileName}
      url={document.sasUrl}
      documentId={document.id}
      onReplace={canReplace ? (file) => replace.mutate(file) : undefined}
      isReplacing={replace.isPending}
    />
  );
}

// ─── InspectionFileCard ───────────────────────────────────────────────────────

function InspectionFileCard({
  document,
  inspectionId,
  vehicleId,
  canReplace,
}: {
  document: InspectionRecord["document"];
  inspectionId: number;
  vehicleId: number;
  canReplace: boolean;
}) {
  const replace = useReplaceDocument({
    documentId: document?.id,
    entityType: "inspection",
    entityId: inspectionId,
    queryKeys: [[...QUERY_KEYS.vehicles.inspection(vehicleId)]],
  });
  if (!document)
    return (
      <span className="text-xs text-text-disabled">Chưa có file đính kèm</span>
    );
  return (
    <FileCard
      fileName={document.fileName}
      url={document.sasUrl}
      documentId={document.id}
      onReplace={canReplace ? (file) => replace.mutate(file) : undefined}
      isReplacing={replace.isPending}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  // Spec §6
  const canUpdate = hasPermission("vehicles.update");
  const canDelete = hasPermission("vehicles.delete");
  const canChangeStatus = hasPermission("vehicles.status");
  const canStatusAll = hasPermission("vehicles.status_all");
  const canUploadFile = canUpdate && hasPermission("documents.upload");
  const canDeleteFile = canUpdate && hasPermission("documents.delete");
  const canViewAudit = hasPermission("audit.view");

  const [activeTab, setActiveTab] = useState("info");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  // Status modal
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<VehicleStatus | "">("");
  const [statusReason, setStatusReason] = useState("");
  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  // QR
  const [regenQrOpen, setRegenQrOpen] = useState(false);
  // Images (shown in the technical information tab)
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [imgFiles, setImgFiles] = useState<File[]>([]);
  const [imgUploading, setImgUploading] = useState(false);
  const [deleteImgId, setDeleteImgId] = useState<number | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Profile (shown in the technical information tab)
  const [profileUploading, setProfileUploading] = useState(false);
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  // Status logs (shown in the technical information tab)
  const [statusLogsPage, setStatusLogsPage] = useState(1);

  // Insurance modal
  const [insOpen, setInsOpen] = useState(false);
  const [insFile, setInsFile] = useState<File | null>(null);
  const [insUploadedDoc, setInsUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null);
  const [insUploading, setInsUploading] = useState(false);
  const [insExtracting, setInsExtracting] = useState(false);
  const [deleteInsId, setDeleteInsId] = useState<number | null>(null);
  // Inspection modal
  const [inspecOpen, setInspecOpen] = useState(false);
  const [inspecFile, setInspecFile] = useState<File | null>(null);
  const [inspecUploadedDoc, setInspecUploadedDoc] = useState<{ id: number; fileName: string; sasUrl: string } | null>(null);
  const [inspecUploading, setInspecUploading] = useState(false);
  const [inspecExtracting, setInspecExtracting] = useState(false);
  const [deleteInspecId, setDeleteInspecId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const vehicleQuery = useQuery({
    queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
    queryFn: () => getVehicleById(vehicleId).then((r) => r.data),
    enabled: !!vehicleId,
  });

  const insuranceQuery = useQuery({
    queryKey: QUERY_KEYS.vehicles.insurance(vehicleId),
    queryFn: () => getVehicleInsurance(vehicleId).then((r) => r.data),
    enabled: activeTab === "insurance",
  });

  const inspectionQuery = useQuery({
    queryKey: QUERY_KEYS.vehicles.inspection(vehicleId),
    queryFn: () => getVehicleInspection(vehicleId).then((r) => r.data),
    enabled: activeTab === "inspection",
  });

  const imagesQuery = useQuery({
    queryKey: QUERY_KEYS.vehicles.images(vehicleId),
    queryFn: () => getVehicleImages(vehicleId).then((r) => r.data),
    enabled: activeTab === "info",
  });

  const profileQuery = useQuery({
    queryKey: QUERY_KEYS.vehicles.profile(vehicleId),
    queryFn: () => getVehicleProfile(vehicleId).then((r) => r.data),
    enabled: activeTab === "info",
  });

  const statusLogsQuery = useQuery({
    queryKey: [...QUERY_KEYS.vehicles.statusLogs(vehicleId), statusLogsPage],
    queryFn: () =>
      getVehicleStatusLogs(vehicleId, { page: statusLogsPage, page_size: 20 }),
    enabled: activeTab === "info",
  });

  const lastVehicleUpdateQuery = useQuery({
    queryKey: [
      ...QUERY_KEYS.auditLogs.all,
      { entityType: "vehicles", entityId: String(vehicleId), page: 1, pageSize: 1 },
    ],
    queryFn: () =>
      getAuditLogs({
        entityType: "vehicles",
        entityId: String(vehicleId),
        page: 1,
        page_size: 1,
      }),
    enabled: activeTab === "info" && canViewAudit,
  });

  const vehicle = vehicleQuery.data;

  // ── Edit mutation ────────────────────────────────────────────────────────

  const editForm = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(editVehicleSchema),
  });

  const editMutation = useMutation({
    // Không gửi lat/lng → BE giữ vị trí cũ
    mutationFn: (values: VehicleFormValues) => updateVehicle(vehicleId, toVehicleBody(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      toast.success("Cập nhật xe thành công");
      setEditOpen(false);
    },
    onError: (err: unknown) => {
      if (!applyVehicleServerError(err, editForm)) toast.error(getApiErrorMessage(err));
    },
  });

  const openEdit = () => {
    if (!vehicle) return;
    editForm.reset(vehicleToFormValues(vehicle));
    setEditOpen(true);
  };

  // ── Status mutation ──────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: () =>
      changeVehicleStatus(vehicleId, {
        newStatus: newStatus as VehicleStatus,
        reason: statusReason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.statusLogs(vehicleId),
      });
      // Đổi → renting / renting → at_yard|broken: BE tự ghi ngày xuất / trả xe trong HĐ
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Đổi trạng thái thành công");
      setStatusOpen(false);
      setNewStatus("");
      setStatusReason("");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Location + QR mutations ───────────────────────────────────────────────

  const [locating, setLocating] = useState(false);

  const locationMutation = useMutation({
    mutationFn: (pos: { lat: number; lng: number }) => updateVehicleLocation(vehicleId, pos),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      toast.success("Đã cập nhật vị trí xe");
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  });

  const updateLocationFromDevice = async () => {
    setLocating(true);
    try {
      locationMutation.mutate(await getCurrentPosition());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const regenQrMutation = useMutation({
    mutationFn: () => regenerateVehicleQrCode(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      toast.success("Đã sinh mã QR mới — nhớ in lại tem");
      setRegenQrOpen(false);
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  });

  const copyQrLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/vehicles/qr/${encodeURIComponent(code)}`,
      );
      toast.success("Đã sao chép link QR");
    } catch {
      toast.error("Không sao chép được");
    }
  };

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => deleteVehicle(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      toast.success("Đã xóa xe");
      navigate("/vehicles");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Insurance mutations ──────────────────────────────────────────────────

  const insForm = useForm<InsuranceForm>({
    resolver: zodResolver(insuranceSchema),
  });

  const uploadInsFile = async (file: File) => {
    setInsUploading(true);
    try {
      const doc = await uploadDocument({ file, doc_type: "insurance", is_temp: true });
      setInsUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl });
    } catch {
      toast.error("Upload file thất bại");
      setInsFile(null);
    } finally {
      setInsUploading(false);
    }
  };

  const addInsMutation = useMutation({
    mutationFn: (body: InsuranceForm) =>
      createVehicleInsurance(vehicleId, {
        insuranceNumber: body.insuranceNumber || undefined,
        provider: body.provider || undefined,
        issueDate: body.issueDate || undefined,
        expiryDate: body.expiryDate,
        documentId: insUploadedDoc?.id ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.insurance(vehicleId),
      });
      toast.success("Thêm bảo hiểm thành công");
      setInsOpen(false);
      insForm.reset();
      setInsFile(null);
      setInsUploadedDoc(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  const deleteInsMutation = useMutation({
    mutationFn: (insId: number) => deleteVehicleInsurance(vehicleId, insId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.insurance(vehicleId),
      });
      toast.success("Đã xóa bảo hiểm");
      setDeleteInsId(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Inspection mutations ─────────────────────────────────────────────────

  const inspecForm = useForm<InspectionForm>({
    resolver: zodResolver(inspectionSchema),
  });

  const uploadInspecFile = async (file: File) => {
    setInspecUploading(true);
    try {
      const doc = await uploadDocument({ file, doc_type: "inspection", is_temp: true });
      setInspecUploadedDoc({ id: doc.id, fileName: doc.fileName, sasUrl: doc.sasUrl });
    } catch {
      toast.error("Upload file thất bại");
      setInspecFile(null);
    } finally {
      setInspecUploading(false);
    }
  };

  const addInspecMutation = useMutation({
    mutationFn: (body: InspectionForm) =>
      createVehicleInspection(vehicleId, {
        inspectionNumber: body.inspectionNumber || undefined,
        inspectionDate: body.inspectionDate || undefined,
        expiryDate: body.expiryDate,
        result: body.result,
        documentId: inspecUploadedDoc?.id ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.inspection(vehicleId),
      });
      toast.success("Thêm kiểm định thành công");
      setInspecOpen(false);
      inspecForm.reset();
      setInspecFile(null);
      setInspecUploadedDoc(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  const deleteInspecMutation = useMutation({
    mutationFn: (inspecId: number) =>
      deleteVehicleInspection(vehicleId, inspecId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.inspection(vehicleId),
      });
      toast.success("Đã xóa kiểm định");
      setDeleteInspecId(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Tab 4: Images mutations ──────────────────────────────────────────────

  const uploadImagesMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setImgUploading(true);
      const fd = new FormData();
      files.forEach((f) => fd.append("files[]", f));
      fd.append("doc_type", "vehicle_image");
      fd.append("vehicle_id", String(vehicleId));
      return uploadDocuments(fd);
    },
    onSuccess: (_, files) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.images(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      toast.success(`Đã thêm ${files.length} ảnh`);
      setImgModalOpen(false);
      setImgFiles([]);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
    onSettled: () => setImgUploading(false),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (docId: number) => setPrimaryImage(vehicleId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.images(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      toast.success("Đã đặt ảnh đại diện");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (docId: number) => deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.images(vehicleId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.detail(vehicleId),
      });
      toast.success("Đã xóa ảnh");
      setDeleteImgId(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Tab 4: Profile mutations ─────────────────────────────────────────────

  const uploadProfile = async (file: File) => {
    setProfileUploading(true);
    try {
      await upsertVehicleProfile(vehicleId, file);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.profile(vehicleId),
      });
      toast.success("Đã cập nhật lý lịch xe");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    } finally {
      setProfileUploading(false);
    }
  };

  const deleteProfileMutation = useMutation({
    mutationFn: () => deleteVehicleProfile(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.vehicles.profile(vehicleId),
      });
      toast.success("Đã xóa lý lịch xe");
      setDeleteProfileOpen(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Có lỗi xảy ra";
      toast.error(msg);
    },
  });

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (vehicleQuery.isLoading) {
    return (
      <div className="flex flex-col gap-[var(--sp-section)]">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Truck className="h-12 w-12 text-text-secondary" />
        <p className="text-[length:var(--fs-title)] text-text-secondary">
          {getApiError(vehicleQuery.error).code === "VEHICLE_NOT_FOUND" || !vehicleQuery.error
            ? "Xe không tồn tại hoặc đã bị xóa"
            : getApiErrorMessage(vehicleQuery.error, "Không tải được thông tin xe")}
        </p>
        <Button variant="outline" onClick={() => navigate("/vehicles")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
      </div>
    );
  }

  const { label: statusLabel, className: statusClass } = getVehicleStatusBadge(
    vehicle.status,
  );
  const validNextStatuses = (VALID_TRANSITIONS[vehicle.status] ?? []).filter(
    (s) => canStatusAll || !STATUS_ALL_TARGETS.includes(s),
  );
  const hasLocation = vehicle.lat != null && vehicle.lng != null;
  const qrUrl = `${window.location.origin}/vehicles/qr/${encodeURIComponent(vehicle.qrCode)}`;
  const lastVehicleUpdate = lastVehicleUpdateQuery.data?.data[0];
  const lastUpdatedBy = lastVehicleUpdate
    ? lastVehicleUpdate.userName ??
      (lastVehicleUpdate.userId ? `Người dùng #${lastVehicleUpdate.userId}` : "Hệ thống")
    : "—";

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Back */}
      <button
        onClick={() => navigate("/vehicles")}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary hover:bg-primary-light transition-colors w-fit cursor-pointer px-3 py-1.5 rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách xe
      </button>

      {/* ── Header card ── */}
      <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-6">
        {/* Row 1: ảnh + info */}
        <div className="flex gap-3 lg:gap-5">
          {vehicle.primaryImageUrl ? (
            <img
              src={vehicle.primaryImageUrl}
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
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>
            {/* Serial */}
            <p className="flex items-center gap-1 text-[length:var(--fs-sm)] text-text-secondary mb-0.5">
              <Barcode className="h-3.5 w-3.5 shrink-0" />
              {vehicle.serialNumber}
            </p>
            {/* Hãng · năm */}
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              {vehicle.manufacturer} · {vehicle.manufactureYear}
            </p>
          </div>
        </div>

        {/* Row 2: actions — full width, dưới ảnh+info */}
        {(canUpdate || canDelete || (canChangeStatus && validNextStatuses.length > 0)) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
            {canUpdate && (
              <Button
                size="sm"
                variant="outline"
                className="border-border flex-1 sm:flex-none cursor-pointer"
                onClick={openEdit}
              >
                <Pencil className="h-4 w-4 mr-1" /> Chỉnh sửa
              </Button>
            )}
            {canChangeStatus && validNextStatuses.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-border flex-1 sm:flex-none cursor-pointer"
                onClick={() => setStatusOpen(true)}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Đổi trạng thái
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="border-error text-error hover:bg-error hover:text-white sm:ml-auto cursor-pointer"
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
            { value: "info", label: "Thông tin kỹ thuật" },
            { value: "insurance", label: "Bảo hiểm" },
            { value: "inspection", label: "Kiểm định" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-white text-text-secondary px-4 py-2.5 text-[length:var(--fs-base)] font-medium cursor-pointer"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── TAB 1: Thông tin kỹ thuật ─── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-6 gap-4">
            {/* Card thông số */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5 xl:col-span-2">
              <p className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">
                Thông số kỹ thuật
              </p>
              <InfoRow label="Loại xe" value={getVehicleTypeLabel(vehicle.vehicleType)} />
              <InfoRow
                label="Loại động cơ"
                value={
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${vehicle.engineType === "Electric" ? "bg-info-light text-info" : "bg-warning-light text-warning"}`}
                  >
                    {vehicle.engineType === "Electric" ? "Điện" : "Xăng/Dầu"}
                  </span>
                }
              />
              <InfoRow label="Tải trọng" value={vehicle.capacity != null ? `${vehicle.capacity} kg` : "—"} />
              <InfoRow label="Số người" value={vehicle.occupancy != null ? `${vehicle.occupancy} người` : "—"} />
              <InfoRow
                label="Chiều cao sàn"
                value={vehicle.platformHeight != null ? `${vehicle.platformHeight} m` : "—"}
              />
              <InfoRow
                label="Chiều cao làm việc"
                value={vehicle.workHeight != null ? `${vehicle.workHeight} m` : "—"}
              />
              <InfoRow
                label="Tốc độ nâng"
                value={vehicle.liftingSpeed != null ? `${vehicle.liftingSpeed} m/s` : "—"}
              />
              <InfoRow
                label="Tốc độ di chuyển"
                value={vehicle.travelingSpeed != null ? `${vehicle.travelingSpeed} km/h` : "—"}
              />
            </div>

            {/* Card quản lý */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5 xl:col-span-2">
              <p className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">
                Thông tin quản lý
              </p>
              <InfoRow
                label="Trạng thái"
                value={
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                }
              />
              <InfoRow label="Ngày tạo" value={formatDate(vehicle.createdAt)} />
              <InfoRow
                label="Cập nhật lần cuối"
                value={formatDateTime(vehicle.updatedAt)}
              />
              <InfoRow label="Người cập nhật cuối" value={lastUpdatedBy} />
              <InfoRow
                label="Ghi chú"
                value={
                  vehicle.note ? (
                    <span className="whitespace-pre-line font-normal">{vehicle.note}</span>
                  ) : (
                    "—"
                  )
                }
              />
            </div>

            <div className="h-full xl:col-span-2 xl:row-span-2">
              <StatusHistoryCard
                isLoading={statusLogsQuery.isLoading}
                response={statusLogsQuery.data}
                page={statusLogsPage}
                onPrevious={() => setStatusLogsPage((page) => page - 1)}
                onNext={() => setStatusLogsPage((page) => page + 1)}
              />
            </div>

            {/* Card mã QR */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">
                  Mã QR (tem xe)
                </p>
                {canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border cursor-pointer"
                    onClick={() => setRegenQrOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" /> Sinh lại mã
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div className="shrink-0 rounded-lg border border-border bg-white p-2">
                  <QRCode
                    value={qrUrl}
                    size={180}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                    title={`Mã QR xe ${vehicle.serialNumber}`}
                  />
                </div>
                <div className="min-w-0 flex-1 self-stretch sm:self-center">
                  <p className="font-mono text-[length:var(--fs-base)] font-semibold tracking-wider text-text-primary break-all">
                    {vehicle.qrCode}
                  </p>
                  <p className="text-[length:var(--fs-sm)] text-text-secondary break-all">
                    {qrUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyQrLink(vehicle.qrCode)}
                  className="p-1.5 rounded-md text-text-secondary hover:bg-primary-light hover:text-primary cursor-pointer transition-colors shrink-0"
                  title="Sao chép link QR"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Card vị trí */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">
                  Vị trí
                </p>
                {canChangeStatus && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border cursor-pointer"
                    onClick={updateLocationFromDevice}
                    disabled={locating || locationMutation.isPending}
                  >
                    {locating || locationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <LocateFixed className="h-4 w-4 mr-1" />
                    )}
                    Lấy vị trí hiện tại
                  </Button>
                )}
              </div>
              {hasLocation ? (
                <div className="flex items-center gap-3">
                  <MapPin className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`https://www.google.com/maps?q=${vehicle.lat},${vehicle.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[length:var(--fs-base)] font-medium text-primary hover:underline cursor-pointer"
                    >
                      {vehicle.lat}, {vehicle.lng}
                    </a>
                    <p className="text-[length:var(--fs-sm)] text-text-secondary">
                      Cập nhật: {formatDateTime(vehicle.locationUpdatedAt)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[length:var(--fs-base)] text-text-secondary">
                  Chưa có vị trí
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: Bảo hiểm ─── */}
        <TabsContent value="insurance" className="mt-4">
          <div className="flex flex-col gap-4">
            {/* Toolbar */}
            {canUploadFile && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                  onClick={() => setInsOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm bảo hiểm
                </Button>
              </div>
            )}

            {/* List */}
            {insuranceQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : !insuranceQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 bg-bg-card rounded-lg border border-border">
                <Shield className="h-8 w-8 text-text-secondary" />
                <p className="text-[length:var(--fs-base)] text-text-secondary">
                  Chưa có hồ sơ bảo hiểm
                </p>
              </div>
            ) : (
              insuranceQuery.data.map((ins) => {
                const expiry = getExpiryBadge(ins.expiryDate);
                return (
                  <div
                    key={ins.id}
                    className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3"
                  >
                    {/* Row 1: info + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Shield className="h-8 w-8 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate">
                            {ins.insuranceNumber || "—"}
                          </p>
                          <p className="text-[length:var(--fs-sm)] text-text-secondary truncate">
                            {ins.provider || "—"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                              {formatDate(ins.issueDate)} → {formatDate(ins.expiryDate)}
                            </span>
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full ${expiry.className}`}
                            >
                              {expiry.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      {canUpdate && (
                        <div className="flex items-center gap-0.5 flex-none">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteInsId(ins.id)}
                                className="p-1.5 rounded-md text-text-secondary hover:bg-error hover:text-white cursor-pointer transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Xóa</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                    {/* Row 2: file */}
                    <div className="pt-3 border-t border-border">
                      <InsuranceFileCard
                        document={ins.document}
                        insuranceId={ins.id}
                        vehicleId={vehicleId}
                        canReplace={canUploadFile}
                      />
                      {ins.createdByName && (
                        <p className="mt-2 text-[length:var(--fs-sm)] text-text-secondary">
                          Tạo bởi {ins.createdByName} · {formatDateTime(ins.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ─── TAB 3: Kiểm định ─── */}
        <TabsContent value="inspection" className="mt-4">
          <div className="flex flex-col gap-4">
            {canUploadFile && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                  onClick={() => setInspecOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Thêm kiểm định
                </Button>
              </div>
            )}

            {inspectionQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : !inspectionQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 bg-bg-card rounded-lg border border-border">
                <CheckCircle2 className="h-8 w-8 text-text-secondary" />
                <p className="text-[length:var(--fs-base)] text-text-secondary">
                  Chưa có hồ sơ kiểm định
                </p>
              </div>
            ) : (
              inspectionQuery.data.map((ins) => {
                const expiry = getExpiryBadge(ins.expiryDate);
                const resultBadge =
                  ins.result === "passed"
                    ? {
                        label: "Đạt",
                        className: "bg-success-light text-success",
                      }
                    : {
                        label: "Không đạt",
                        className: "bg-error-light text-error",
                      };
                return (
                  <div
                    key={ins.id}
                    className="bg-bg-card rounded-lg border border-border p-4 mb-3 space-y-3"
                  >
                    {/* Row 1: info + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-text-primary truncate">
                            {ins.inspectionNumber || "—"}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full">
                              Ngày kiểm: {formatDate(ins.inspectionDate)} →{" "}
                              {formatDate(ins.expiryDate)}
                            </span>
                            {ins.result && (
                              <span
                                className={`text-xs px-2.5 py-1 rounded-full ${resultBadge.className}`}
                              >
                                {resultBadge.label}
                              </span>
                            )}
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full ${expiry.className}`}
                            >
                              {expiry.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      {canUpdate && (
                        <div className="flex items-center gap-0.5 flex-none">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteInspecId(ins.id)}
                                className="p-1.5 rounded-md text-text-secondary hover:bg-error hover:text-white cursor-pointer transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Xóa</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                    {/* Row 2: file */}
                    <div className="pt-3 border-t border-border">
                      <InspectionFileCard
                        document={ins.document}
                        inspectionId={ins.id}
                        vehicleId={vehicleId}
                        canReplace={canUploadFile}
                      />
                      {ins.createdByName && (
                        <p className="mt-2 text-[length:var(--fs-sm)] text-text-secondary">
                          Tạo bởi {ins.createdByName} · {formatDateTime(ins.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ─── Hồ sơ & lịch sử — gộp vào tab Thông tin kỹ thuật ─── */}
        {activeTab === "info" && <div className="mt-4">
          <div className="flex flex-col gap-4">
            {/* ── Section 1: Thư viện ảnh ── */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">
                  Thư viện ảnh
                </p>
                {canUploadFile && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                    onClick={() => {
                      setImgFiles([]);
                      setImgModalOpen(true);
                    }}
                    disabled={
                      imagesQuery.isLoading ||
                      (imagesQuery.data?.remainingSlots ?? 1) <= 0
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
                  <p className="text-[length:var(--fs-base)] text-text-secondary">
                    Chưa có ảnh nào
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {imagesQuery.data.images.map((img, idx) => (
                    <div key={img.id} className="relative group aspect-square">
                      <img
                        src={img.sasUrl}
                        alt={img.fileName}
                        className={`w-full h-full object-cover rounded-lg border-2 transition-colors ${
                          img.isPrimary ? "border-primary" : "border-border"
                        }`}
                      />
                      {img.isPrimary && (
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 bg-primary text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                          <Star className="h-2.5 w-2.5 fill-white" /> Chính
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <button
                          onClick={() => setLightboxIndex(idx)}
                          className="p-1.5 bg-white rounded-full text-text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                          title="Xem ảnh"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        {canUpdate && !img.isPrimary && (
                          <button
                            onClick={() => setPrimaryMutation.mutate(img.id)}
                            disabled={setPrimaryMutation.isPending}
                            className="p-1.5 bg-white rounded-full text-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
                            title="Đặt làm ảnh chính"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteFile && (
                          <button
                            onClick={() => setDeleteImgId(img.id)}
                            className="p-1.5 bg-white rounded-full text-error hover:bg-error hover:text-white transition-colors cursor-pointer"
                            title="Xóa ảnh"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {imagesQuery.data && (
                <p className="mt-3 text-[length:var(--fs-sm)] text-text-secondary">
                  {imagesQuery.data.total} ảnh · còn{" "}
                  {imagesQuery.data.remainingSlots} slot trống
                </p>
              )}
            </div>

            {/* ── Section 2: Lý lịch xe (PDF) ── */}
            <div className="bg-bg-card rounded-lg border border-border p-[var(--sp-card)] lg:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary">
                  Lý lịch xe
                </p>
              </div>

              {profileQuery.isLoading ? (
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : !profileQuery.data?.length ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-lg bg-bg-page border border-dashed border-border">
                  <FileText className="h-8 w-8 text-text-secondary" />
                  <p className="text-[length:var(--fs-base)] text-text-secondary">
                    Chưa có lý lịch xe
                  </p>
                  {canUpdate && (
                    <>
                      <input
                        ref={profileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadProfile(f);
                          e.target.value = "";
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
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                            Đang upload...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" /> Tải lên lý lịch
                            (PDF)
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                profileQuery.data.map((profile) => (
                  <FileCard
                    key={profile.id}
                    fileName={profile.fileName}
                    url={profile.sasUrl}
                    documentId={profile.id}
                    fileSize={profile.fileSizeKb * 1024}
                    createdAt={profile.uploadedAt}
                    createdBy={profile.uploadedByName ?? undefined}
                    accept=".pdf"
                    onReplace={canUpdate ? uploadProfile : undefined}
                    isReplacing={profileUploading}
                    onDelete={
                      canUpdate ? () => setDeleteProfileOpen(true) : undefined
                    }
                  />
                ))
              )}
            </div>

          </div>
        </div>}
      </Tabs>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Modal Chỉnh sửa */}
      <MobileSheetDialog open={editOpen} onOpenChange={setEditOpen}>
        <MobileSheetContent mobileVariant="fullscreen" className="sm:max-w-2xl">
          <MobileSheetFullscreenHeader title="Chỉnh sửa xe" />
          <MobileSheetHeader className="hidden sm:flex">
            <MobileSheetTitle>Chỉnh sửa xe</MobileSheetTitle>
          </MobileSheetHeader>
          <form onSubmit={editForm.handleSubmit((v) => editMutation.mutate(v))}>
            <MobileSheetBody>
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                Serial: <span className="font-medium text-text-primary">{vehicle.serialNumber}</span>{" "}
                (không sửa được)
              </p>
              <VehicleFormFields form={editForm} mode="edit" />
            </MobileSheetBody>
            <MobileSheetFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border cursor-pointer"
                onClick={() => setEditOpen(false)}
                disabled={editMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </MobileSheetFooter>
          </form>
        </MobileSheetContent>
      </MobileSheetDialog>

      {/* Modal Đổi trạng thái */}
      <MobileSheetDialog open={statusOpen} onOpenChange={setStatusOpen}>
        <MobileSheetContent mobileVariant="sheet" className="sm:max-w-sm">
          <MobileSheetHeader>
            <MobileSheetTitle>Đổi trạng thái</MobileSheetTitle>
          </MobileSheetHeader>
          <MobileSheetBody>
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--fs-base)] text-text-secondary">
                Hiện tại:
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Trạng thái mới <span className="text-error">*</span>
              </Label>
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as VehicleStatus)}
              >
                <SelectTrigger className="border-border cursor-pointer">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  {validNextStatuses.map((s) => {
                    const cfg = VEHICLE_STATUS_CONFIG[s];
                    return (
                      <SelectItem key={s} value={s}>
                        {cfg.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Lý do (tùy chọn)
              </Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Nhập lý do đổi trạng thái..."
                className="border-border resize-none"
                rows={3}
              />
            </div>
          </MobileSheetBody>
          <MobileSheetFooter>
            <Button
              variant="outline"
              className="border-border cursor-pointer"
              onClick={() => setStatusOpen(false)}
              disabled={statusMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
              onClick={() => statusMutation.mutate()}
              disabled={!newStatus || statusMutation.isPending}
            >
              {statusMutation.isPending ? "Đang lưu..." : "Xác nhận"}
            </Button>
          </MobileSheetFooter>
        </MobileSheetContent>
      </MobileSheetDialog>

      {/* Modal Thêm bảo hiểm */}
      <MobileTwoColDialog
        open={insOpen}
        onOpenChange={(o) => {
          if (!o) {
            setInsOpen(false);
            insForm.reset();
            setInsFile(null);
            setInsUploadedDoc(null);
          }
        }}
        title="Thêm bảo hiểm"
        file={insUploadedDoc ? null : insFile}
        onFileChange={(f) => {
          setInsFile(f);
          setInsUploadedDoc(null);
          if (f) uploadInsFile(f);
        }}
        isEdit={!!insUploadedDoc}
        existingFileName={insUploadedDoc?.fileName}
        existingFileUrl={insUploadedDoc?.sasUrl}
        uploadLabel="Kéo thả hoặc chọn file bảo hiểm (PDF, JPEG, PNG)"
      >
        <form
          id="insurance-form"
          onSubmit={insForm.handleSubmit((v) => addInsMutation.mutate(v))}
          className="flex flex-col gap-4 px-5 py-4 flex-1"
        >
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Thông tin bảo hiểm
          </p>
          <DocumentExtractButton<InsuranceAutofillFields>
            documentId={insUploadedDoc?.id}
            docType="insurance"
            disabled={insUploading}
            onBusyChange={setInsExtracting}
            onExtract={(fields) => {
              if (fields.insuranceNumber !== undefined) insForm.setValue("insuranceNumber", fields.insuranceNumber)
              if (fields.provider !== undefined) insForm.setValue("provider", fields.provider)
              if (fields.issueDate !== undefined) insForm.setValue("issueDate", fields.issueDate)
              if (fields.expiryDate !== undefined) insForm.setValue("expiryDate", fields.expiryDate)
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-[length:var(--fs-base)] font-medium">
              Số bảo hiểm
            </Label>
            <Input
              {...insForm.register("insuranceNumber")}
              placeholder="VD: BH-2024-001"
              className="border-border"
            />
            {insForm.formState.errors.insuranceNumber && (
              <p className="text-[length:var(--fs-sm)] text-error">
                {insForm.formState.errors.insuranceNumber.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[length:var(--fs-base)] font-medium">
              Công ty BH
            </Label>
            <Input
              {...insForm.register("provider")}
              placeholder="VD: Bảo Việt"
              className="border-border"
            />
            {insForm.formState.errors.provider && (
              <p className="text-[length:var(--fs-sm)] text-error">
                {insForm.formState.errors.provider.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Ngày cấp
              </Label>
              <Controller
                control={insForm.control}
                name="issueDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Ngày hết hạn <span className="text-error">*</span>
              </Label>
              <Controller
                control={insForm.control}
                name="expiryDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                  />
                )}
              />
              {insForm.formState.errors.expiryDate && (
                <p className="text-[length:var(--fs-sm)] text-error">
                  {insForm.formState.errors.expiryDate.message}
                </p>
              )}
            </div>
          </div>
          {insUploading && (
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Đang upload...
            </p>
          )}
        </form>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="border-border cursor-pointer"
            onClick={() => {
              setInsOpen(false);
              insForm.reset();
              setInsFile(null);
              setInsUploadedDoc(null);
            }}
            disabled={addInsMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="insurance-form"
            className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
            disabled={
              addInsMutation.isPending || insUploading || insExtracting || !insUploadedDoc
            }
          >
            {addInsMutation.isPending ? "Đang lưu..." : insUploading ? "Đang tải file..." : "Lưu"}
          </Button>
        </div>
      </MobileTwoColDialog>

      {/* Modal Thêm kiểm định */}
      <MobileTwoColDialog
        open={inspecOpen}
        onOpenChange={(o) => {
          if (!o) {
            setInspecOpen(false);
            inspecForm.reset();
            setInspecFile(null);
            setInspecUploadedDoc(null);
          }
        }}
        title="Thêm kiểm định"
        file={inspecUploadedDoc ? null : inspecFile}
        onFileChange={(f) => {
          setInspecFile(f);
          setInspecUploadedDoc(null);
          if (f) uploadInspecFile(f);
        }}
        isEdit={!!inspecUploadedDoc}
        existingFileName={inspecUploadedDoc?.fileName}
        existingFileUrl={inspecUploadedDoc?.sasUrl}
        uploadLabel="Kéo thả hoặc chọn file kiểm định (PDF, JPEG, PNG)"
      >
        <form
          id="inspection-form"
          onSubmit={inspecForm.handleSubmit((v) => addInspecMutation.mutate(v))}
          className="flex flex-col gap-4 px-5 py-4 flex-1"
        >
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Thông tin kiểm định
          </p>
          <DocumentExtractButton<InspectionAutofillFields>
            documentId={inspecUploadedDoc?.id}
            docType="inspection"
            disabled={inspecUploading}
            onBusyChange={setInspecExtracting}
            onExtract={(fields) => {
              if (fields.inspectionNumber !== undefined) inspecForm.setValue("inspectionNumber", fields.inspectionNumber)
              if (fields.inspectionDate !== undefined) inspecForm.setValue("inspectionDate", fields.inspectionDate)
              if (fields.expiryDate !== undefined) inspecForm.setValue("expiryDate", fields.expiryDate)
              if (fields.result !== undefined) inspecForm.setValue("result", fields.result)
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-[length:var(--fs-base)] font-medium">
              Số kiểm định
            </Label>
            <Input
              {...inspecForm.register("inspectionNumber")}
              placeholder="VD: KD-2024-001"
              className="border-border"
            />
            {inspecForm.formState.errors.inspectionNumber && (
              <p className="text-[length:var(--fs-sm)] text-error">
                {inspecForm.formState.errors.inspectionNumber.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Ngày kiểm
              </Label>
              <Controller
                control={inspecForm.control}
                name="inspectionDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[length:var(--fs-base)] font-medium">
                Ngày hết hạn <span className="text-error">*</span>
              </Label>
              <Controller
                control={inspecForm.control}
                name="expiryDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                  />
                )}
              />
              {inspecForm.formState.errors.expiryDate && (
                <p className="text-[length:var(--fs-sm)] text-error">
                  {inspecForm.formState.errors.expiryDate.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[length:var(--fs-base)] font-medium">
              Kết quả
            </Label>
            <Controller
              control={inspecForm.control}
              name="result"
              render={({ field }) => (
                <Select
                  value={field.value ?? "_none"}
                  onValueChange={(v) =>
                    field.onChange(v === "_none" ? undefined : v)
                  }
                >
                  <SelectTrigger className="border-border cursor-pointer">
                    <SelectValue placeholder="Chọn kết quả" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Chưa có</SelectItem>
                    <SelectItem value="passed">Đạt</SelectItem>
                    <SelectItem value="failed">Không đạt</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {inspecUploading && (
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Đang upload...
            </p>
          )}
        </form>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="border-border cursor-pointer"
            onClick={() => {
              setInspecOpen(false);
              inspecForm.reset();
              setInspecFile(null);
              setInspecUploadedDoc(null);
            }}
            disabled={addInspecMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="inspection-form"
            className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
            disabled={
              addInspecMutation.isPending ||
              inspecUploading ||
              inspecExtracting ||
              !inspecUploadedDoc
            }
          >
            {addInspecMutation.isPending ? "Đang lưu..." : inspecUploading ? "Đang tải file..." : "Lưu"}
          </Button>
        </div>
      </MobileTwoColDialog>

      {/* Confirm xóa xe */}
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa xe này?"
        description={`Xe ${vehicle.model} (${vehicle.serialNumber}) sẽ bị ẩn khỏi hệ thống. Kiểm tra xe không còn nằm trong hợp đồng đang hiệu lực trước khi xóa.`}
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {/* Confirm sinh lại QR */}
      <ConfirmModal
        open={regenQrOpen}
        onOpenChange={setRegenQrOpen}
        title="Sinh lại mã QR?"
        description="Tem cũ sẽ không dùng được nữa. Cần in và dán lại tem mới cho xe."
        variant="danger"
        confirmLabel="Sinh lại"
        loading={regenQrMutation.isPending}
        onConfirm={() => regenQrMutation.mutate()}
      />

      {/* Confirm xóa bảo hiểm */}
      <ConfirmModal
        open={deleteInsId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteInsId(null);
        }}
        title="Xóa bảo hiểm này?"
        description="Nhắc hạn liên quan cũng bị xóa. Nếu nhập sai, xóa rồi tạo lại."
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteInsMutation.isPending}
        onConfirm={() =>
          deleteInsId !== null && deleteInsMutation.mutate(deleteInsId)
        }
      />

      {/* Confirm xóa kiểm định */}
      <ConfirmModal
        open={deleteInspecId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteInspecId(null);
        }}
        title="Xóa kiểm định này?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteInspecMutation.isPending}
        onConfirm={() =>
          deleteInspecId !== null && deleteInspecMutation.mutate(deleteInspecId)
        }
      />

      {/* Confirm xóa ảnh */}
      <ConfirmModal
        open={deleteImgId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteImgId(null);
        }}
        title="Xóa ảnh này?"
        description="Ảnh sẽ bị xóa vĩnh viễn và không thể khôi phục."
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteImageMutation.isPending}
        onConfirm={() =>
          deleteImgId !== null && deleteImageMutation.mutate(deleteImgId)
        }
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

      {/* Lightbox */}
      {lightboxIndex !== null && imagesQuery.data?.images && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <img
            src={imagesQuery.data.images[lightboxIndex].sasUrl}
            alt={imagesQuery.data.images[lightboxIndex].fileName}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < imagesQuery.data.images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightboxIndex + 1} / {imagesQuery.data.images.length}
          </span>
        </div>
      )}

      {/* Modal thêm ảnh */}
      <MobileSheetDialog
        open={imgModalOpen}
        onOpenChange={(o) => {
          setImgModalOpen(o);
          if (!o) setImgFiles([]);
        }}
      >
        <MobileSheetContent mobileVariant="sheet" className="sm:max-w-lg">
          <MobileSheetHeader>
            <MobileSheetTitle>Thêm ảnh xe</MobileSheetTitle>
          </MobileSheetHeader>
          <MobileSheetBody>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setImgFiles((prev) => {
                  const merged = [...prev, ...files];
                  const maxSlots = imagesQuery.data?.remainingSlots ?? 10;
                  return merged.slice(0, maxSlots);
                });
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-text-secondary hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-[length:var(--fs-base)]">
                Chọn ảnh (JPEG, PNG)
              </span>
              <span className="text-[length:var(--fs-sm)]">
                Tối đa {imagesQuery.data?.remainingSlots ?? 10} ảnh
              </span>
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
                      onClick={() =>
                        setImgFiles((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </MobileSheetBody>
          <MobileSheetFooter>
            <Button
              variant="outline"
              className="border-border cursor-pointer"
              onClick={() => {
                setImgModalOpen(false);
                setImgFiles([]);
              }}
              disabled={imgUploading}
            >
              Hủy
            </Button>
            <Button
              className="bg-primary hover:bg-primary-dark text-white cursor-pointer"
              disabled={imgFiles.length === 0 || imgUploading}
              onClick={() => uploadImagesMutation.mutate(imgFiles)}
            >
              {imgUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang
                  upload...
                </>
              ) : (
                `Tải lên ${imgFiles.length > 0 ? `(${imgFiles.length})` : ""}`
              )}
            </Button>
          </MobileSheetFooter>
        </MobileSheetContent>
      </MobileSheetDialog>
    </div>
  );
}
