import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Switch } from "@/components/shared/Switch";
import {
  activateServiceCatalog,
  createServiceCatalog,
  updateServiceCatalog,
} from "@/api/service-catalog.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { cn } from "@/lib/utils";
import { getApiError } from "@/utils/apiError";
import { QUERY_KEYS } from "@/utils/queryKeys";
import {
  SERVICE_NAME_MAX,
  SERVICE_UNIT_MAX,
  collapseSpaces,
  collectUnits,
  findDuplicateService,
} from "@/utils/serviceCatalog";
import type { ServiceCatalogItem, UpdateServiceInput } from "@/types/serviceCatalog.types";

const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên dịch vụ")
    .max(SERVICE_NAME_MAX, `Tối đa ${SERVICE_NAME_MAX} ký tự`),
  units: z
    .array(z.string().trim().min(1).max(SERVICE_UNIT_MAX, `Tối đa ${SERVICE_UNIT_MAX} ký tự`))
    .min(1, "Vui lòng nhập ít nhất một đơn vị")
    .max(10, "Tối đa 10 đơn vị")
    .refine(
      (values) => new Set(values.map((v) => v.toLocaleLowerCase("vi"))).size === values.length,
      "Các đơn vị không được trùng nhau",
    ),
  allowVehicle: z.boolean(),
});

type ServiceForm = z.infer<typeof serviceSchema>;

// details[].field có thể là "name" hoặc "Name" tùy BE → chuẩn hóa về camelCase
const toFieldName = (field: string) => field.charAt(0).toLowerCase() + field.slice(1);

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = thêm mới */
  editTarget: ServiceCatalogItem | null;
  /** Toàn bộ danh mục đã tải (kể cả đã ẩn) — dùng kiểm tra trùng tên + gợi ý đơn vị */
  services: ServiceCatalogItem[];
  /** service_catalog.delete — quyền hiện lại dịch vụ đang ẩn */
  canReactivate: boolean;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  editTarget,
  services,
  canReactivate,
}: ServiceFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editTarget;

  // Tắt allowVehicle ở form sửa → chờ xác nhận (ảnh hưởng mọi HĐ ngay lập tức)
  const [pendingDisable, setPendingDisable] = useState<UpdateServiceInput | null>(null);
  const [unitDraft, setUnitDraft] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    setValue,
    getValues,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", units: [], allowVehicle: false },
  });

  // Dialog không unmount giữa các lần mở → reset thủ công mỗi khi mở
  useEffect(() => {
    if (open) {
      reset({
        name: editTarget?.name ?? "",
        units: editTarget?.units ?? [],
        allowVehicle: editTarget?.allowVehicle ?? false,
      });
    }
  }, [open, editTarget, reset]);

  const name = watch("name") ?? "";
  const selectedUnits = watch("units") ?? [];

  const commitUnitDraft = () => {
    const next = collapseSpaces(unitDraft);
    const currentUnits = getValues("units") ?? [];
    if (!next) {
      if (currentUnits.length === 0) {
        setError("units", { message: "Vui lòng nhập ít nhất một đơn vị" });
        return false;
      }
      return true;
    }
    if (next.length > SERVICE_UNIT_MAX) {
      setError("units", { message: `Mỗi đơn vị tối đa ${SERVICE_UNIT_MAX} ký tự` });
      return false;
    }
    if (currentUnits.length >= 10) {
      setError("units", { message: "Tối đa 10 đơn vị" });
      return false;
    }
    if (currentUnits.some((unit) => unit.toLocaleLowerCase("vi") === next.toLocaleLowerCase("vi"))) {
      setError("units", { message: "Đơn vị này đã có trong danh sách" });
      return false;
    }
    setValue("units", [...currentUnits, next], { shouldValidate: true, shouldDirty: true });
    clearErrors("units");
    setUnitDraft("");
    return true;
  };

  const duplicate = useMemo(
    () => findDuplicateService(services, name, editTarget?.id),
    [services, name, editTarget],
  );
  const units = useMemo(() => collectUnits(services), [services]);

  const exactDuplicate = duplicate?.kind === "exact" ? duplicate.item : undefined;
  const similarDuplicate = duplicate?.kind === "similar" ? duplicate.item : undefined;
  const hiddenExact = exactDuplicate && !exactDuplicate.isActive ? exactDuplicate : undefined;

  const nameError = exactDuplicate
    ? `Đã có dịch vụ “${exactDuplicate.name}”${exactDuplicate.isActive ? "" : " (đang bị ẩn)"}`
    : errors.name?.message;

  const refreshCatalog = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all });

  const handleServerError = (err: unknown) => {
    const { code, message, details } = getApiError(err);

    // 409 — tên trùng (so sánh đúng từng ký tự, kể cả dịch vụ đã ẩn)
    if (code === "SERVICE_NAME_EXISTS") {
      setError("name", { message: message ?? "Tên dịch vụ đã tồn tại" });
      refreshCatalog();
      return;
    }

    // 400 — map details[].field vào đúng ô
    if (code === "VALIDATION_ERROR" && details?.length) {
      let mapped = false;
      details.forEach((d) => {
        const field = toFieldName(d.field);
        if (field === "name" || field === "units") {
          setError(field, { message: d.message });
          mapped = true;
        }
      });
      if (mapped) return;
    }

    toast.error(getServiceErrorMessage(err));
    if (code === "SERVICE_NOT_FOUND") {
      refreshCatalog();
      onOpenChange(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: createServiceCatalog,
    onSuccess: () => {
      refreshCatalog();
      toast.success("Thêm dịch vụ thành công");
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateServiceInput }) =>
      updateServiceCatalog(id, body),
    onSuccess: () => {
      refreshCatalog();
      // Tên/đơn vị/allowVehicle đều LIVE trên dòng HĐ (từ 27/10) → HĐ đang mở phải thấy giá trị mới
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Cập nhật dịch vụ thành công");
      setPendingDisable(null);
      onOpenChange(false);
    },
    onError: (err) => {
      setPendingDisable(null);
      handleServerError(err);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => activateServiceCatalog(id),
    onSuccess: () => {
      refreshCatalog();
      toast.success("Đã hiện lại dịch vụ");
      onOpenChange(false);
    },
    onError: (err) => toast.error(getServiceErrorMessage(err)),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: ServiceForm) => {
    if (exactDuplicate) return;
    const next = {
      name: collapseSpaces(values.name),
      units: values.units.map(collapseSpaces),
      allowVehicle: values.allowVehicle,
    };

    if (!editTarget) {
      createMutation.mutate(next);
      return;
    }
    // PUT sửa từng phần: bỏ key = giữ nguyên
    const body: UpdateServiceInput = {};
    if (next.name !== editTarget.name) body.name = next.name;
    if (JSON.stringify(next.units) !== JSON.stringify(editTarget.units)) body.units = next.units;
    if (next.allowVehicle !== editTarget.allowVehicle) body.allowVehicle = next.allowVehicle;
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    if (editTarget.allowVehicle && body.allowVehicle === false) {
      setPendingDisable(body);
      return;
    }
    updateMutation.mutate({ id: editTarget.id, body });
  };

  return (
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent mobileVariant="sheet" className="sm:max-w-md">
        <MobileSheetHeader>
          <MobileSheetTitle>{isEdit ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ mới"}</MobileSheetTitle>
        </MobileSheetHeader>

        <form
          onSubmitCapture={(event) => {
            if (!commitUnitDraft()) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <MobileSheetBody className="space-y-4">
            {/* Tên dịch vụ */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="service-name">
                  Tên dịch vụ <span className="text-error">*</span>
                </Label>
                <span
                  className={cn(
                    "text-[length:var(--fs-sm)]",
                    name.length > SERVICE_NAME_MAX ? "text-error" : "text-text-secondary",
                  )}
                >
                  {name.length}/{SERVICE_NAME_MAX}
                </span>
              </div>
              <Input
                id="service-name"
                placeholder="VD: Thuê xe nâng người"
                autoComplete="off"
                aria-invalid={!!nameError}
                className={nameError ? "border-error" : ""}
                {...register("name")}
              />
              {nameError && (
                <p className="text-[length:var(--fs-sm)] text-error">{nameError}</p>
              )}
              {hiddenExact && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-warning-light px-3 py-2 text-[length:var(--fs-sm)] text-warning">
                  <span>Dịch vụ này đang bị ẩn.</span>
                  {canReactivate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={reactivateMutation.isPending}
                      onClick={() => reactivateMutation.mutate(hiddenExact.id)}
                      className="h-7 cursor-pointer bg-bg-card px-2.5"
                    >
                      {reactivateMutation.isPending ? "Đang hiện..." : "Hiện lại"}
                    </Button>
                  ) : (
                    <span>Liên hệ quản lý để hiện lại.</span>
                  )}
                </div>
              )}
              {!nameError && similarDuplicate && (
                <p className="text-[length:var(--fs-sm)] text-warning">
                  Đã có dịch vụ tương tự: “{similarDuplicate.name}”
                  {similarDuplicate.isActive ? "" : " (đang bị ẩn)"}
                </p>
              )}
            </div>

            {/* Danh sách đơn vị; phần tử đầu là mặc định */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="service-units">
                  Đơn vị <span className="text-error">*</span>
                </Label>
                <span
                  className={cn(
                    "text-[length:var(--fs-sm)]",
                    unitDraft.length > SERVICE_UNIT_MAX ? "text-error" : "text-text-secondary",
                  )}
                >
                  {unitDraft.length}/{SERVICE_UNIT_MAX}
                </span>
              </div>
              <Input
                id="service-units"
                value={unitDraft}
                placeholder="Nhập đơn vị, ví dụ: Lít"
                autoComplete="off"
                aria-invalid={!!errors.units}
                className={errors.units ? "border-error" : ""}
                onChange={(e) => {
                  setUnitDraft(e.target.value);
                  if (errors.units) clearErrors("units");
                }}
                onBlur={commitUnitDraft}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== ",") return;
                  e.preventDefault();
                  commitUnitDraft();
                }}
              />
              {errors.units && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.units.message}</p>
              )}
              {selectedUnits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedUnits.map((u, index) => (
                    <span
                      key={`${u}-${index}`}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const from = Number(event.dataTransfer.getData("text/plain"));
                        if (!Number.isInteger(from) || from === index) return;
                        const reordered = [...selectedUnits];
                        const [moved] = reordered.splice(from, 1);
                        reordered.splice(index, 0, moved);
                        setValue("units", reordered, { shouldValidate: true, shouldDirty: true });
                      }}
                      className="inline-flex cursor-grab items-center gap-1 rounded-full border border-primary/30 bg-primary-light px-2.5 py-1 text-[length:var(--fs-sm)] text-primary"
                    >
                      <button
                        type="button"
                        title={index === 0 ? "Đơn vị mặc định" : "Đặt làm mặc định"}
                        onClick={() => index > 0 && setValue("units", [u, ...selectedUnits.filter((_, i) => i !== index)], { shouldValidate: true, shouldDirty: true })}
                        className="cursor-pointer"
                      >
                        <Star size={13} fill={index === 0 ? "currentColor" : "none"} />
                      </button>
                      {u}
                      <button
                        type="button"
                        aria-label={`Xóa ${u}`}
                        onClick={() => setValue("units", selectedUnits.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true })}
                        className="cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[length:var(--fs-sm)] text-text-secondary">Kéo thả để sắp xếp; phần tử đầu là mặc định. Có thể nhấn sao để đưa nhanh lên đầu.</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      if (!selectedUnits.some((x) => x.toLocaleLowerCase("vi") === u.toLocaleLowerCase("vi")) && selectedUnits.length < 10) {
                        setValue("units", [...selectedUnits, u], { shouldValidate: true, shouldDirty: true });
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-0.5 text-[length:var(--fs-sm)] transition-colors",
                      selectedUnits.some((x) => x.toLocaleLowerCase("vi") === u.toLocaleLowerCase("vi"))
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border text-text-secondary hover:bg-primary-light hover:text-primary",
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Cờ gán xe — mặc định tắt khi thêm mới */}
            <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
              <div className="min-w-0">
                <Label htmlFor="service-allow-vehicle" className="cursor-pointer">
                  Cho phép gán xe
                </Label>
                <p className="mt-0.5 text-[length:var(--fs-sm)] text-text-secondary">
                  Bật cho dịch vụ thuê xe. Dòng hợp đồng thuộc dịch vụ này mới gán được xe.
                </p>
              </div>
              <Controller
                control={control}
                name="allowVehicle"
                render={({ field }) => (
                  <Switch
                    id="service-allow-vehicle"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {isEdit && (
              <p className="rounded-md bg-bg-page px-3 py-2 text-[length:var(--fs-sm)] text-text-secondary">
                Đổi tên / đơn vị chỉ áp dụng cho dòng dịch vụ thêm mới, hợp đồng đã có không bị ảnh
                hưởng. Riêng “Cho phép gán xe” có hiệu lực ngay cho mọi hợp đồng.
              </p>
            )}
          </MobileSheetBody>

          <MobileSheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isPending || !!exactDuplicate}
              className="cursor-pointer"
            >
              {isPending ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm dịch vụ"}
            </Button>
          </MobileSheetFooter>
        </form>
      </MobileSheetContent>

      <ConfirmModal
        open={!!pendingDisable}
        onOpenChange={(v) => {
          if (!v) setPendingDisable(null);
        }}
        title="Tắt cho phép gán xe?"
        description="Dòng hợp đồng thuộc dịch vụ này sẽ không gán thêm được xe (kể cả xe thay thế). Xe đã gán không bị ảnh hưởng."
        confirmLabel="Tắt gán xe"
        variant="danger"
        loading={updateMutation.isPending}
        onConfirm={() =>
          editTarget &&
          pendingDisable &&
          updateMutation.mutate({ id: editTarget.id, body: pendingDisable })
        }
      />
    </MobileSheetDialog>
  );
}
