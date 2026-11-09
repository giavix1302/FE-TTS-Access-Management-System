import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { applyApiErrors, getApiError, isConcurrentUpdateError } from "@/utils/apiError";
import { formatDate, toDateOnly } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { ContractVehicle, UpdateContractVehicleInput } from "@/types/contract.types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const editSchema = z.object({
  deployDate: z.string().nullable().optional(),
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
});

type EditForm = z.infer<typeof editSchema>;

interface EditDeploymentDialogProps {
  contractId: number;
  /** Lần giao đang sửa (contractVehicle); undefined = đóng dialog */
  editItem?: ContractVehicle;
  /** Đổi xe cần hợp đồng active, quyền sửa hợp đồng và quyền xem xe. */
  canSwap: boolean;
  /** HĐ đã đóng chỉ sửa được ghi chú; đổi workDays / deployDate → 400 CONTRACT_NOT_ACTIVE */
  isContractActive: boolean;
  onClose: () => void;
}

export function EditDeploymentDialog({ contractId, editItem, canSwap, isContractActive, onClose }: EditDeploymentDialogProps) {
  const queryClient = useQueryClient();

  // Chưa xuất bãi mà xe chưa renting: gửi ngày lên sẽ bị 400 VEHICLE_NOT_DEPLOYED
  const waitingForDeploy = !!editItem && !editItem.deployDate && editItem.vehicle.status !== "renting";
  const deployDateLocked = !isContractActive || waitingForDeploy;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  // Dialog không unmount giữa các lần mở → reset theo editItem mỗi khi mở
  useEffect(() => {
    if (editItem) {
      reset({
        deployDate: toDateOnly(editItem.deployDate) ?? null,
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
    // Xe đã gán vẫn at_yard cho tới khi giao → loại xe đang được giữ cho hợp đồng khác
    select: (res) => ({ ...res, data: res.data.filter((vehicle) => !vehicle.currentContract) }),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateContractVehicleInput) =>
      updateContractVehicle(contractId, editItem!.id, body),
    onSuccess: () => {
      // workDays đổi → endDate của HĐ đổi theo → tải lại detail + list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Đã cập nhật lần giao xe");
      onClose();
    },
    onError: (err) => {
      applyApiErrors(
        err,
        setError,
        ["deployDate", "workDays", "note", "vehicleId"],
        getServiceErrorMessage(err),
      );
      const { code } = getApiError(err);
      // Dữ liệu trên màn hình đã cũ → đồng bộ để ô bị khóa đúng theo trạng thái mới
      if (code === "VEHICLE_NOT_DEPLOYED" || code === "CONTRACT_NOT_ACTIVE") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
      }
      if (code === "CONTRACT_VEHICLE_NOT_FOUND") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
        onClose();
      } else if (isConcurrentUpdateError(err)) onClose();
      // Xe vừa chọn không còn gán được → làm mới danh sách để chọn xe khác
      else if (code === "VEHICLE_NOT_ASSIGNABLE" || code === "VEHICLE_ALREADY_IN_CONTRACT") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      }
    },
  });

  const onSubmit = handleSubmit((form) => {
    if (!editItem) return;
    // Bỏ key = giữ nguyên; BE không có cách xóa ngày đã ghi → chỉ gửi giá trị đã đổi
    const body: UpdateContractVehicleInput = {};
    if (!deployDateLocked && form.deployDate && form.deployDate !== toDateOnly(editItem.deployDate)) {
      body.deployDate = form.deployDate;
    }
    if (isContractActive && form.workDays != null && form.workDays !== editItem.workDays) {
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
          <MobileSheetTitle>{isContractActive ? "Cập nhật lần giao xe" : "Cập nhật ghi chú lần giao xe"}</MobileSheetTitle>
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
                {errors.vehicleId && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.vehicleId.message}</p>
                )}
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
                      maxDate={toDateOnly(editItem?.returnDate)}
                      disabled={deployDateLocked}
                    />
                  )}
                />
                {errors.deployDate && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.deployDate.message}</p>
                )}
              </div>
              {/* Chỉ đọc — BE tự ghi khi xe rời công trường, PUT lần giao xe không nhận returnDate */}
              <div className="space-y-1">
                <Label>Ngày trả xe</Label>
                <p className="flex h-9 items-center rounded-md bg-bg-page px-3 text-[length:var(--fs-base)] text-text-primary">
                  {editItem?.returnDate ? formatDate(toDateOnly(editItem.returnDate)) : "Chưa trả"}
                </p>
              </div>
            </div>
            <p className="-mt-2 text-[length:var(--fs-sm)] text-text-secondary">
              {!isContractActive
                ? "Hợp đồng đã đóng nên không đổi được ngày xuất bãi và số ngày làm, chỉ sửa được ghi chú."
                : waitingForDeploy
                  ? "Ngày xuất bãi được ghi khi xe chuyển sang đang cho thuê."
                  : "Ngày xuất bãi đã ghi không xóa được, chỉ đổi sang ngày khác."}{" "}
              Ngày trả được ghi khi đổi trạng thái xe ở trang xe và không sửa được sau đó.
            </p>

            <div className="space-y-1">
              <Label htmlFor="deployment-work-days">Số ngày làm</Label>
              <Input
                id="deployment-work-days"
                type="number"
                min={0}
                max={3650}
                step={1}
                disabled={!isContractActive}
                {...register("workDays", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  // Ô đang có sẵn số 0 → gõ tiếp không được ra "030"
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/^0+(?=\d)/, "");
                  },
                })}
              />
              {errors.workDays && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.workDays.message}</p>
              )}
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                0 = chưa nhập. Là số ngày xe này làm: xe thay thế chỉ nhập phần của nó, không cộng dồn
                với xe được thay. Xe của hợp đồng gốc tính từ ngày bắt đầu hợp đồng, xe của phụ lục tính từ
                ngày bắt đầu phụ lục. Ngày kết thúc hợp đồng là ngày kết thúc muộn nhất trong các xe/chuỗi xe thay thế.
                Không làm đổi tiền — muốn thu thêm, hãy sửa số lượng của dòng dịch vụ (hoặc lập phụ lục).
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
