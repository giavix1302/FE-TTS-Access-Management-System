import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { DatePicker } from "@/components/shared/DatePicker";
import { updateContractVehicle } from "@/api/contracts.api";
import { getVehicles } from "@/api/vehicles.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { usePermission } from "@/hooks/usePermission";
import { getApiError } from "@/utils/apiError";
import { toDateOnly } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { ContractVehicle, UpdateContractVehicleInput } from "@/types/contract.types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const editSchema = z
  .object({
    deployDate: z.string().nullable().optional(),
    returnDate: z.string().nullable().optional(),
    // Số ngày làm — BE nhận int ≥ 0
    workDays: z
      .number()
      .int("Số ngày phải là số nguyên")
      .min(0, "Số ngày làm phải >= 0")
      .max(3650, "Tối đa 3650 ngày")
      .nullable()
      .optional(),
    note: z.string().max(500, "Tối đa 500 ký tự").optional(),
    vehicleId: z.number().optional(),
  })
  .refine((d) => !d.deployDate || !d.returnDate || d.returnDate >= d.deployDate, {
    message: "Ngày trả phải sau hoặc bằng ngày xuất bãi",
    path: ["returnDate"],
  });

type EditForm = z.infer<typeof editSchema>;

interface EditDeploymentDialogProps {
  contractId: number;
  /** Lần giao đang sửa (contractVehicle); undefined = đóng dialog */
  editItem?: ContractVehicle;
  /** Đổi xe cần hợp đồng active, quyền sửa hợp đồng và quyền xem xe. */
  canSwap: boolean;
  onClose: () => void;
}

export function EditDeploymentDialog({ contractId, editItem, canSwap, onClose }: EditDeploymentDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  // Dialog không unmount giữa các lần mở → reset theo editItem mỗi khi mở
  useEffect(() => {
    if (editItem) {
      reset({
        deployDate: toDateOnly(editItem.deployDate) ?? null,
        returnDate: toDateOnly(editItem.returnDate) ?? null,
        workDays: editItem.workDays,
        note: editItem.note ?? "",
        vehicleId: editItem.vehicle.id,
      });
    }
  }, [editItem, reset]);

  const { data: vehiclesRes } = useQuery({
    queryKey: [...QUERY_KEYS.vehicles.all, { status: "at_yard", forSwap: true }],
    queryFn: () => getVehicles({ status: "at_yard", page_size: 100 }),
    enabled: canSwap && !!editItem && !editItem.deployDate,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateContractVehicleInput) =>
      updateContractVehicle(contractId, editItem!.id, body),
    onSuccess: (_res, body) => {
      // workDays đổi → endDate của HĐ đổi theo → tải lại detail + list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Đã cập nhật lần giao xe");

      // Endpoint này KHÔNG đổi vehicle.status → xe vẫn "Đang cho thuê" dù đã ghi ngày trả
      if (body.returnDate && editItem?.vehicle.status === "renting" && hasPermission("vehicles.status")) {
        const vehicleId = editItem.vehicle.id;
        toast.warning("Xe vẫn đang ở trạng thái “Đang cho thuê”. Hãy đổi trạng thái xe về Trong bãi.", {
          action: { label: "Mở trang xe", onClick: () => navigate(`/vehicles/${vehicleId}`) },
        });
      }
      onClose();
    },
    onError: (err) => {
      toast.error(getServiceErrorMessage(err));
      if (getApiError(err).code === "CONTRACT_VEHICLE_NOT_FOUND") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
        onClose();
      }
    },
  });

  const onSubmit = handleSubmit((form) => {
    if (!editItem) return;
    // Bỏ key = giữ nguyên; BE không có cách xóa ngày đã ghi → chỉ gửi giá trị đã đổi
    const body: UpdateContractVehicleInput = {};
    if (form.deployDate && form.deployDate !== toDateOnly(editItem.deployDate)) {
      body.deployDate = form.deployDate;
    }
    if (form.returnDate && form.returnDate !== toDateOnly(editItem.returnDate)) {
      body.returnDate = form.returnDate;
    }
    if (form.workDays != null && form.workDays !== editItem.workDays) {
      body.workDays = form.workDays;
    }
    if ((form.note ?? "") !== (editItem.note ?? "")) body.note = form.note ?? "";
    if (!editItem.deployDate && form.vehicleId && form.vehicleId !== editItem.vehicle.id) {
      body.vehicleId = form.vehicleId;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(body);
  });

  return (
    <MobileSheetDialog open={!!editItem} onOpenChange={(v) => !v && onClose()}>
      <MobileSheetContent mobileVariant="sheet" className="sm:max-w-md">
        <MobileSheetHeader>
          <MobileSheetTitle>Cập nhật ngày xe</MobileSheetTitle>
        </MobileSheetHeader>

        <form onSubmit={onSubmit} noValidate>
          <MobileSheetBody className="space-y-4">
            {editItem && (
              <div className="rounded-md bg-bg-page px-3 py-2">
                <p className="text-[length:var(--fs-sm)] text-text-secondary">Xe</p>
                <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
                  {editItem.vehicle.model} · {editItem.vehicle.serialNumber}
                </p>
              </div>
            )}

            {canSwap && editItem && !editItem.deployDate && (
              <div className="space-y-1">
                <Label>Đổi xe còn ở bãi</Label>
                <Controller
                  control={control}
                  name="vehicleId"
                  render={({ field }) => (
                    <Select value={String(field.value ?? editItem.vehicle.id)} onValueChange={(value) => field.onChange(Number(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={String(editItem.vehicle.id)}>{editItem.vehicle.model} · {editItem.vehicle.serialNumber}</SelectItem>
                        {(vehiclesRes?.data ?? []).filter((vehicle) => vehicle.id !== editItem.vehicle.id).map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>{vehicle.model} · {vehicle.serialNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Ngày xuất bãi</Label>
                <Controller
                  control={control}
                  name="deployDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      placeholder="Chưa xuất bãi"
                    />
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Ngày trả xe</Label>
                <Controller
                  control={control}
                  name="returnDate"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      placeholder="Chưa trả"
                    />
                  )}
                />
                {errors.returnDate && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.returnDate.message}</p>
                )}
              </div>
            </div>
            <p className="-mt-2 text-[length:var(--fs-sm)] text-text-secondary">
              Ngày đã ghi không xóa được, chỉ đổi sang ngày khác.
            </p>

            <div className="space-y-1">
              <Label htmlFor="deployment-work-days">Số ngày làm</Label>
              <Input
                id="deployment-work-days"
                type="number"
                min={0}
                max={3650}
                step={1}
                {...register("workDays", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
              />
              {errors.workDays && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.workDays.message}</p>
              )}
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                0 = chưa nhập. Ngày kết thúc hợp đồng = ngày bắt đầu + số ngày làm lớn nhất trong các
                xe − 1 (tính cả ngày đầu: bắt đầu 19/10, làm 8 ngày → kết thúc 26/10). Không làm đổi
                tiền — muốn thu thêm, hãy sửa số lượng của dòng dịch vụ (hoặc lập phụ lục).
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="deployment-note">Ghi chú</Label>
              <Textarea id="deployment-note" rows={2} maxLength={500} {...register("note")} />
              {errors.note && <p className="text-[length:var(--fs-sm)] text-error">{errors.note.message}</p>}
            </div>
          </MobileSheetBody>

          <MobileSheetFooter>
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
              {mutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </MobileSheetFooter>
        </form>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}
