import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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
} from "@/components/shared/MobileSheet";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { DatePicker } from "@/components/shared/DatePicker";
import { FileCard } from "@/components/shared/FileCard";
import { MobileTwoColDialog } from "@/components/shared/MobileTwoColDialog";
import {
  updateContract,
  updateExcludedDays,
  createLineItem,
  updateLineItem,
  deleteLineItem,
} from "@/api/contracts.api";
import { uploadDocument } from "@/api/documents.api";
import { getServiceCatalog } from "@/api/service-catalog.api";
import { useReplaceDocument } from "@/hooks/useReplaceDocument";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatCurrency, formatDate } from "@/utils/format";
import { getVehicleStatusBadge } from "@/constants/vehicleStatus";
import type { ContractDetail, LineItem } from "@/types/contract.types";

// ─── ContractInfoDialog ────────────────────────────────────────────────────────
const contractInfoSchema = z.object({
  contractNumber: z.string().min(1, "Bắt buộc"),
  startDate: z.string().min(1, "Bắt buộc"),
  plannedDays: z
    .number({ error: "Bắt buộc" })
    .min(1, "Phải >= 1"),
  siteAddress: z.string().min(1, "Bắt buộc"),
  excludedDays: z.number({ error: "Bắt buộc" }).min(0),
  excludedReason: z.string().optional(),
});

type ContractInfoForm = z.infer<typeof contractInfoSchema>;

function ContractInfoDialog({
  open,
  onOpenChange,
  contract,
  contractId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: ContractDetail;
  contractId: number;
}) {
  const queryClient = useQueryClient();
  const [docFile, setDocFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ContractInfoForm>({
    resolver: zodResolver(contractInfoSchema),
    defaultValues: {
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      plannedDays: contract.plannedDays,
      siteAddress: contract.siteAddress,
      excludedDays: contract.excludedDays,
      excludedReason: contract.excludedReason ?? "",
    },
  });

  const excludedDays = watch("excludedDays");

  function handleClose(v: boolean) {
    if (!v) { reset(); setDocFile(null) }
    onOpenChange(v);
  }

  const mutation = useMutation({
    mutationFn: async (form: ContractInfoForm) => {
      // Step 1: upload file HĐ mới nếu có
      let documentId: number | undefined;
      if (docFile) {
        const doc = await uploadDocument({ file: docFile, doc_type: "contract" });
        documentId = doc.id;
      }
      // Step 2: cập nhật field cơ bản
      await updateContract(contractId, {
        contractNumber: form.contractNumber,
        startDate: form.startDate,
        plannedDays: form.plannedDays,
        siteAddress: form.siteAddress,
        documentId,
      });
      // Step 3: excluded-days là endpoint riêng (BE tách)
      await updateExcludedDays(contractId, {
        excludedDays: form.excludedDays,
        excludedReason: form.excludedReason || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      toast.success("Đã cập nhật thông tin hợp đồng");
      handleClose(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  return (
    <MobileTwoColDialog
      open={open}
      onOpenChange={handleClose}
      title="Chỉnh sửa thông tin hợp đồng"
      file={docFile}
      onFileChange={setDocFile}
      isEdit
      existingFileName={contract.document?.fileName}
      existingFileUrl={contract.document?.sasUrl}
      uploadLabel="Kéo thả hoặc nhấp để chọn file hợp đồng mới"
    >
      <form
        id="contract-info-form"
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 px-5 py-4 flex-1"
      >
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Thông tin hợp đồng
        </p>

        <div className="space-y-1">
          <Label>Số hợp đồng <span className="text-error">*</span></Label>
          <Input {...register('contractNumber')} placeholder="01012026/HĐTTB/TTS-..." />
          {errors.contractNumber && (
            <p className="text-xs text-error">{errors.contractNumber.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Ngày bắt đầu <span className="text-error">*</span></Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.startDate && (
              <p className="text-xs text-error">{errors.startDate.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Số ngày kế hoạch <span className="text-error">*</span></Label>
            <Input
              type="number"
              min={1}
              {...register("plannedDays", { valueAsNumber: true })}
            />
            {errors.plannedDays && (
              <p className="text-xs text-error">{errors.plannedDays.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Địa chỉ công trường <span className="text-error">*</span></Label>
          <Textarea rows={2} className="resize-none" {...register("siteAddress")} />
          {errors.siteAddress && (
            <p className="text-xs text-error">{errors.siteAddress.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Ngày loại trừ</Label>
          <Input
            type="number"
            min={0}
            {...register("excludedDays", { valueAsNumber: true })}
          />
        </div>

        {excludedDays > 0 && (
          <div className="space-y-1">
            <Label>Lý do loại trừ</Label>
            <Textarea rows={2} className="resize-none" {...register("excludedReason")} />
          </div>
        )}
      </form>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleClose(false)}
          className="cursor-pointer"
        >
          Hủy
        </Button>
        <Button
          type="submit"
          form="contract-info-form"
          disabled={mutation.isPending}
          className="cursor-pointer"
        >
          {mutation.isPending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </MobileTwoColDialog>
  );
}

// ─── LineItemDialog ────────────────────────────────────────────────────────────
const lineItemSchema = z.object({
  serviceId: z.number({ error: "Bắt buộc" }).min(1, "Bắt buộc"),
  vehicleId: z.number().nullable().optional(),
  unitPrice: z.number({ error: "Bắt buộc" }).min(0),
  quantity: z.number({ error: "Bắt buộc" }).min(1),
  sortOrder: z.number({ error: "Bắt buộc" }).min(0),
});

type LineItemForm = z.infer<typeof lineItemSchema>;

interface ServiceCatalogItem {
  id: number
  name: string
  unit: string
  isActive: boolean
}

function LineItemDialog({
  open,
  onOpenChange,
  contractId,
  contract,
  editItem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: number;
  contract: ContractDetail;
  editItem?: LineItem;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editItem;

  // Query service catalog — chỉ lấy active để chọn
  const { data: serviceCatalogRes } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    staleTime: 5 * 60 * 1000,
  })
  const allServices: ServiceCatalogItem[] = serviceCatalogRes?.data ?? []
  const activeServices = allServices.filter((s) => s.isActive)

  const maxOrder =
    contract.lineItems.length > 0
      ? Math.max(...contract.lineItems.map((li) => li.sortOrder)) + 1
      : 1;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LineItemForm>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: isEdit
      ? {
          serviceId: editItem.service.id,
          vehicleId: editItem.vehicleId,
          unitPrice: editItem.unitPrice,
          quantity: editItem.quantity,
          sortOrder: editItem.sortOrder,
        }
      : { sortOrder: maxOrder },
  });

  const mutation = useMutation({
    mutationFn: (body: LineItemForm) =>
      isEdit
        ? updateLineItem(contractId, editItem!.id, body)
        : createLineItem(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      toast.success(isEdit ? "Đã cập nhật dịch vụ" : "Đã thêm dịch vụ");
      onOpenChange(false);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  return (
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent mobileVariant="sheet" className="sm:max-w-md">
        <MobileSheetHeader>
          <MobileSheetTitle>
            {isEdit ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ"}
          </MobileSheetTitle>
        </MobileSheetHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <MobileSheetBody className="space-y-4">
            <div className="space-y-1">
              <Label>Dịch vụ <span className="text-error">*</span></Label>
              <Controller
                control={control}
                name="serviceId"
                render={({ field }) => (
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Chọn dịch vụ" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeServices.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}<span className="ml-1 text-text-secondary">· {s.unit}</span>
                        </SelectItem>
                      ))}
                      {activeServices.length === 0 && (
                        <div className="py-3 text-center text-xs text-text-secondary">Chưa có dịch vụ nào</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.serviceId && <p className="text-xs text-error">{errors.serviceId.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Xe gán (tùy chọn)</Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() ?? ""}
                    onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Không gán xe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không gán xe</SelectItem>
                      {contract.vehicles.map((cv) => (
                        <SelectItem key={cv.id} value={cv.vehicle.id.toString()}>
                          {cv.vehicle.model} · {cv.vehicle.serialNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Đơn giá <span className="text-error">*</span></Label>
                <Input type="number" min={0} {...register("unitPrice", { valueAsNumber: true })} />
                {errors.unitPrice && <p className="text-xs text-error">{errors.unitPrice.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Số lượng <span className="text-error">*</span></Label>
                <Input type="number" min={1} {...register("quantity", { valueAsNumber: true })} />
                {errors.quantity && <p className="text-xs text-error">{errors.quantity.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Thứ tự</Label>
              <Input type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} />
            </div>
          </MobileSheetBody>
          <MobileSheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Hủy</Button>
            <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
              {mutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </MobileSheetFooter>
        </form>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}

// ─── ContractTab ──────────────────────────────────────────────────────────────
interface ContractTabProps {
  contract: ContractDetail;
  contractId: number;
  canEdit: boolean;
}

export function ContractTab({
  contract,
  contractId,
  canEdit,
}: ContractTabProps) {
  const queryClient = useQueryClient();
  const [editInfoOpen, setEditInfoOpen] = useState(false);

  const replaceContractDoc = useReplaceDocument({
    documentId: contract.document?.id,
    entityType: "contract",
    entityId: contractId,
    queryKeys: [[...QUERY_KEYS.contracts.detail(contractId)]],
  });
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LineItem | undefined>();
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  const deleteLineItemMutation = useMutation({
    mutationFn: (itemId: number) => deleteLineItem(contractId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      toast.success("Đã xóa dịch vụ");
      setDeletingItemId(null);
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  const openAddItem = () => {
    setEditingItem(undefined);
    setLineItemDialogOpen(true);
  };

  const openEditItem = (item: LineItem) => {
    setEditingItem(item);
    setLineItemDialogOpen(true);
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Section A — Thông tin hợp đồng */}
      <div className="bg-bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-text-primary">
            Thông tin hợp đồng
          </span>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditInfoOpen(true)}
              className="cursor-pointer"
            >
              <Pencil size={14} />
              Chỉnh sửa
            </Button>
          )}
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-text-secondary">Ngày bắt đầu</p>
            <p className="text-sm font-medium text-text-primary">
              {formatDate(contract.startDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Số ngày kế hoạch</p>
            <p className="text-sm font-medium text-text-primary">
              {contract.plannedDays} ngày
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Ngày kết thúc</p>
            <p className="text-sm font-medium text-text-primary">
              {formatDate(contract.endDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Ngày loại trừ</p>
            <p className="text-sm font-medium text-text-primary">
              {contract.excludedDays} ngày
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-text-secondary">Địa chỉ công trường</p>
            <p className="text-sm font-medium text-text-primary">
              {contract.siteAddress || "—"}
            </p>
          </div>
          {contract.excludedDays > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-text-secondary">Lý do loại trừ</p>
              <p className="text-sm font-medium text-text-primary">
                {contract.excludedReason || "—"}
              </p>
            </div>
          )}
        </div>

        <Separator className="my-4" />
        <div>
          <p className="text-xs text-text-secondary mb-2">File HĐ đã ký</p>
          {contract.document ? (
            <FileCard
              fileName={contract.document?.fileName}
              url={contract.document?.sasUrl}
              documentId={contract.document?.id}
              fileSize={contract.document.fileSizeKb * 1024}
              createdAt={contract.document.uploadedAt}
              onReplace={
                canEdit ? (file) => replaceContractDoc.mutate(file) : undefined
              }
              isReplacing={replaceContractDoc.isPending}
            />
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-disabled">Chưa có file</span>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditInfoOpen(true)}
                  className="cursor-pointer"
                >
                  Upload file HĐ
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section B — Dịch vụ & Xe gán */}
      <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="font-medium text-text-primary">
            Dịch vụ & Xe gán
          </span>
          {canEdit && contract.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={openAddItem}
              className="cursor-pointer"
            >
              <Plus size={14} />
              Thêm dịch vụ
            </Button>
          )}
        </div>

        {contract.lineItems.length === 0 ? (
          <p className="text-sm text-text-secondary py-6 text-center">
            Chưa có dịch vụ nào
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-subtle border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Dịch vụ</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Xe gán</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Đơn giá</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">SL</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wide">Thành tiền</th>
                    {canEdit && contract.status === "active" && <th className="px-4 py-2.5 w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {contract.lineItems.map((item) => {
                    const cv = contract.vehicles.find((v) => v.vehicle.id === item.vehicleId);
                    const vehicleBadge = cv ? getVehicleStatusBadge(cv.vehicle.status) : null;
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-bg-subtle/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">{item.service.name}</td>
                        <td className="px-4 py-3">
                          {cv ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-text-primary">{cv.vehicle.model} · {cv.vehicle.serialNumber}</span>
                              <div className="flex items-center gap-1.5">
                                {vehicleBadge && <span className={`text-xs px-2 py-0.5 rounded-full ${vehicleBadge.className}`}>{vehicleBadge.label}</span>}
                                <span className="text-xs text-text-secondary">{formatDate(cv.deployDate)} → {cv.returnDate ? formatDate(cv.returnDate) : "Chưa thu"}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-text-disabled">Không gán xe</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-text-secondary whitespace-nowrap">
                          {formatCurrency(item.unitPrice)}<span className="text-text-disabled">/{item.service.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-text-secondary whitespace-nowrap">{item.quantity} {item.service.unit}</td>
                        <td className="px-4 py-3 text-right font-semibold text-text-primary whitespace-nowrap">{formatCurrency(item.lineTotal)}</td>
                        {canEdit && contract.status === "active" && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="sm" onClick={() => openEditItem(item)} className="cursor-pointer h-7 w-7 p-0"><Pencil size={13} /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeletingItemId(item.id)} className="cursor-pointer h-7 w-7 p-0 hover:bg-error hover:text-white"><Trash2 size={13} /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-primary-light border-t-2 border-primary/20">
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-right text-xs text-text-secondary">Tổng cộng trước thuế</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-text-primary whitespace-nowrap">{formatCurrency(contract.subtotal)}</td>
                    {canEdit && contract.status === "active" && <td />}
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-right text-xs text-text-secondary">VAT</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-text-primary whitespace-nowrap">{formatCurrency(contract.taxAmount)}</td>
                    {canEdit && contract.status === "active" && <td />}
                  </tr>
                  <tr className="border-t border-primary/20">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-text-primary">Tổng cộng sau thuế</td>
                    <td className="px-4 py-3 text-right text-base font-bold text-primary whitespace-nowrap">{formatCurrency(contract.subtotal + contract.taxAmount)}</td>
                    {canEdit && contract.status === "active" && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {contract.lineItems.map((item) => {
                const cv = contract.vehicles.find((v) => v.vehicle.id === item.vehicleId);
                const vehicleBadge = cv ? getVehicleStatusBadge(cv.vehicle.status) : null;
                return (
                  <div key={item.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-text-primary">{item.service.name}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {item.quantity} {item.service.unit} × {formatCurrency(item.unitPrice)}/{item.service.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-sm font-semibold text-text-primary">{formatCurrency(item.lineTotal)}</span>
                        {canEdit && contract.status === "active" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEditItem(item)} className="cursor-pointer h-7 w-7 p-0 ml-1"><Pencil size={13} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeletingItemId(item.id)} className="cursor-pointer h-7 w-7 p-0 hover:bg-error hover:text-white"><Trash2 size={13} /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    {cv ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-text-secondary">{cv.vehicle.model} · {cv.vehicle.serialNumber}</span>
                        {vehicleBadge && <span className={`text-xs px-2 py-0.5 rounded-full ${vehicleBadge.className}`}>{vehicleBadge.label}</span>}
                        <span className="text-xs text-text-disabled">{formatDate(cv.deployDate)} → {cv.returnDate ? formatDate(cv.returnDate) : "Chưa thu"}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-disabled">Không gán xe</span>
                    )}
                  </div>
                );
              })}
              {/* Mobile totals */}
              <div className="bg-primary-light px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Trước thuế</span><span className="font-medium text-text-primary">{formatCurrency(contract.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>VAT</span><span className="font-medium text-text-primary">{formatCurrency(contract.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-primary/20 pt-1.5">
                  <span className="text-text-primary">Tổng sau thuế</span>
                  <span className="text-primary">{formatCurrency(contract.subtotal + contract.taxAmount)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      <ContractInfoDialog
        open={editInfoOpen}
        onOpenChange={setEditInfoOpen}
        contract={contract}
        contractId={contractId}
      />

      <LineItemDialog
        open={lineItemDialogOpen}
        onOpenChange={(v) => {
          setLineItemDialogOpen(v);
          if (!v) setEditingItem(undefined);
        }}
        contractId={contractId}
        contract={contract}
        editItem={editingItem}
      />

      <ConfirmModal
        open={deletingItemId !== null}
        onOpenChange={(v) => {
          if (!v) setDeletingItemId(null);
        }}
        title="Xóa dịch vụ"
        description="Bạn có chắc muốn xóa dịch vụ này khỏi hợp đồng?"
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteLineItemMutation.isPending}
        onConfirm={() =>
          deletingItemId !== null &&
          deleteLineItemMutation.mutate(deletingItemId)
        }
      />
    </div>
  );
}
