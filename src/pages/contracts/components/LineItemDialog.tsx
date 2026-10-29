import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { createLineItem, updateLineItem } from "@/api/contracts.api";
import { getServiceCatalog } from "@/api/service-catalog.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { usePermission } from "@/hooks/usePermission";
import { getApiError } from "@/utils/apiError";
import { formatCurrency } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { matchesSearch, sortServices } from "@/utils/serviceCatalog";
import { PickList } from "./PickList";
import { cn } from "@/lib/utils";
import type { LineItem } from "@/types/contract.types";

// Đơn giá / số lượng: > 0, decimal(18,2). Gửi JSON number, giới hạn 2 số lẻ ở ô nhập
const hasAtMost2Decimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

const lineSchema = z.object({
  serviceId: z.number().optional(),
  unit: z.string().min(1, "Vui lòng chọn đơn vị"),
  unitPrice: z.number({ error: "Bắt buộc nhập đơn giá" }).positive("Đơn giá phải lớn hơn 0"),
  quantity: z
    .number({ error: "Bắt buộc nhập số lượng" })
    .positive("Số lượng phải lớn hơn 0")
    .refine(hasAtMost2Decimals, "Tối đa 2 chữ số thập phân"),
  duration: z
    .number()
    .positive("Thời gian phải lớn hơn 0")
    .max(3650, "Tối đa 3650")
    .optional(),
  sortOrder: z.number().int("Thứ tự phải là số nguyên").optional(),
  note: z.string().trim().max(500, "Tối đa 500 ký tự").optional(),
});

type LineForm = z.infer<typeof lineSchema>;

interface LineItemDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: number;
  /** Thêm dòng vào phụ lục này; không có = dòng HĐ gốc. Bỏ qua khi sửa */
  addendum?: { id: number; addendumNumber?: string };
  /** Có = sửa dòng (chỉ đổi giá / số lượng / thứ tự / ghi chú) */
  editItem?: LineItem;
}

export function LineItemDialog({
  open,
  onOpenChange,
  contractId,
  addendum,
  editItem,
}: LineItemDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const isEdit = !!editItem;
  const canCreateService = hasPermission("service_catalog.create");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  // Đóng dialog luôn xóa ô tìm → lần mở sau không còn từ khóa cũ
  const closeDialog = () => {
    setServiceSearch("");
    setServicePickerOpen(false);
    onOpenChange(false);
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<LineForm>({ resolver: zodResolver(lineSchema) });

  // Dialog không unmount giữa các lần mở → reset thủ công mỗi khi mở
  useEffect(() => {
    if (!open) return;
    reset(
      editItem
        ? {
            unitPrice: editItem.unitPrice,
            quantity: editItem.quantity,
            unit: editItem.unit,
            duration: editItem.duration,
            sortOrder: editItem.sortOrder,
            note: editItem.note ?? "",
          }
        : { serviceId: undefined, unit: "", unitPrice: undefined, quantity: undefined, duration: undefined, note: "" },
    );
  }, [open, editItem, reset]);

  // Picker: chỉ dịch vụ đang hoạt động. Chỉ gọi khi thêm dòng (cần service_catalog.view)
  const { data: catalogRes, isLoading: loadingCatalog } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    enabled: open && !isEdit,
    staleTime: 5 * 60 * 1000,
  });
  const activeServices = useMemo(
    () => sortServices((catalogRes?.data ?? []).filter((s) => s.isActive)),
    [catalogRes],
  );
  const visibleServices = useMemo(
    () => activeServices.filter((s) => matchesSearch(s.name, serviceSearch)),
    [activeServices, serviceSearch],
  );

  const serviceId = watch("serviceId");
  const unitPrice = watch("unitPrice");
  const quantity = watch("quantity");
  const duration = watch("duration");
  const unit = watch("unit");
  const selectedService = activeServices.find((s) => s.id === serviceId);
  const availableUnits = isEdit ? editItem.service.units : (selectedService?.units ?? []);

  useEffect(() => {
    if (!isEdit && selectedService && !selectedService.units.includes(unit)) {
      setValue("unit", selectedService.units[0] ?? "", { shouldValidate: true });
    }
  }, [isEdit, selectedService, setValue, unit]);

  const previewTotal =
    typeof unitPrice === "number" && typeof quantity === "number" && !Number.isNaN(unitPrice * quantity)
      ? Math.round(unitPrice * quantity * (duration ?? 1) * 100) / 100
      : undefined;

  const mutation = useMutation({
    mutationFn: (v: LineForm) =>
      editItem
        ? updateLineItem(contractId, editItem.id, {
            unitPrice: v.unitPrice,
            quantity: v.quantity,
            ...(v.unit !== editItem.unit ? { unit: v.unit } : {}),
            ...((v.duration ?? 0) !== (editItem.duration ?? 0) ? { duration: v.duration ?? 0 } : {}),
            ...(v.sortOrder != null ? { sortOrder: v.sortOrder } : {}),
            // Không gửi = giữ nguyên, "" = xóa → chỉ gửi khi đổi
            ...((v.note ?? "") !== (editItem.note ?? "") ? { note: v.note ?? "" } : {}),
          })
        : createLineItem(contractId, {
            serviceId: v.serviceId!,
            unitPrice: v.unitPrice,
            quantity: v.quantity,
            unit: v.unit,
            ...(v.duration != null ? { duration: v.duration } : {}),
            ...(addendum ? { addendumId: addendum.id } : {}),
            ...(v.note ? { note: v.note } : {}),
          }),
    onSuccess: () => {
      // Tiền HĐ / phụ lục do BE tính lại → refetch detail + addendums + list + summary + history
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success(isEdit ? "Đã cập nhật dòng dịch vụ" : "Đã thêm dòng dịch vụ");
      closeDialog();
    },
    onError: (err) => {
      const { code, details } = getApiError(err);

      if (code === "VALIDATION_ERROR" && details?.length) {
        let mapped = false;
        details.forEach((d) => {
          const field = d.field.charAt(0).toLowerCase() + d.field.slice(1);
          if (field === "unit" || field === "unitPrice" || field === "quantity" || field === "duration" || field === "sortOrder" || field === "note") {
            setError(field, { message: d.message });
            mapped = true;
          }
        });
        if (mapped) return;
      }

      toast.error(getServiceErrorMessage(err));

      if (code === "SERVICE_NOT_FOUND") {
        // Dịch vụ vừa bị ẩn / xóa khi picker đang mở → làm mới danh mục, bỏ lựa chọn
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceCatalog.all });
        setValue("serviceId", undefined);
      } else if (
        code === "CONTRACT_NOT_ACTIVE" ||
        code === "CONTRACT_NOT_FOUND" ||
        code === "LINE_ITEM_NOT_FOUND" ||
        code === "ADDENDUM_NOT_FOUND"
      ) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
        closeDialog();
      }
    },
  });

  const onSubmit = handleSubmit((v) => {
    if (!isEdit && !v.serviceId) {
      setError("serviceId", { message: "Vui lòng chọn dịch vụ" });
      return;
    }
    const serviceAllowsVehicle = isEdit ? editItem.service.allowVehicle : selectedService?.allowVehicle;
    if (serviceAllowsVehicle && !Number.isInteger(v.quantity)) {
      setError("quantity", { message: "Dòng thuê xe yêu cầu số lượng xe là số nguyên" });
      return;
    }
    mutation.mutate(v);
  });

  const noActiveService = !isEdit && !loadingCatalog && activeServices.length === 0;

  return (
    <MobileSheetDialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : closeDialog())}>
      <MobileSheetContent mobileVariant="sheet" className="sm:max-w-md">
        <MobileSheetHeader>
          <MobileSheetTitle>{isEdit ? "Chỉnh sửa dòng dịch vụ" : "Thêm dòng dịch vụ"}</MobileSheetTitle>
        </MobileSheetHeader>

        <form onSubmit={onSubmit} noValidate>
          <MobileSheetBody className="space-y-4">
            {!isEdit && (
              <p className="rounded-md bg-bg-page px-3 py-2 text-[length:var(--fs-sm)] text-text-secondary">
                {addendum
                  ? `Thuộc phụ lục ${addendum.addendumNumber || `#${addendum.id}`} — tiền tính vào phụ lục, không cộng vào tổng hợp đồng gốc.`
                  : "Thuộc hợp đồng gốc."}
              </p>
            )}

            {/* Dịch vụ */}
            {isEdit ? (
              <div className="space-y-1">
                <Label>Dịch vụ</Label>
                <div className="rounded-md bg-bg-page px-3 py-2">
                  <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
                    {editItem.service.name}
                  </p>
                  <p className="text-[length:var(--fs-sm)] text-text-secondary">
                    Đơn vị hiện tại: {editItem.unit}
                  </p>
                </div>
                <p className="text-[length:var(--fs-sm)] text-text-secondary">
                  Không đổi được dịch vụ. Muốn đổi, hãy xóa dòng và thêm lại.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>
                  Dịch vụ <span className="text-error">*</span>
                </Label>
                {noActiveService ? (
                  <div className="space-y-2 rounded-md border border-dashed border-border px-3 py-4 text-center text-[length:var(--fs-sm)] text-text-secondary">
                    {canCreateService ? (
                      <>
                        <p>Danh mục chưa có dịch vụ nào đang hoạt động.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => {
                            closeDialog();
                            navigate("/service-catalog");
                          }}
                        >
                          Thêm dịch vụ vào danh mục
                        </Button>
                      </>
                    ) : (
                      <p>Chưa có dịch vụ nào đang hoạt động. Liên hệ quản lý để thêm vào danh mục.</p>
                    )}
                  </div>
                ) : (
                  <Controller
                    control={control}
                    name="serviceId"
                    render={({ field }) => (
                      <Popover
                        open={servicePickerOpen}
                        onOpenChange={(nextOpen) => {
                          setServicePickerOpen(nextOpen);
                          if (!nextOpen) setServiceSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                            <Input
                              role="combobox"
                              aria-expanded={servicePickerOpen}
                              value={servicePickerOpen ? serviceSearch : (selectedService?.name ?? "")}
                              onFocus={() => {
                                setServiceSearch("");
                                setServicePickerOpen(true);
                              }}
                              onChange={(event) => {
                                setServiceSearch(event.target.value);
                                setServicePickerOpen(true);
                              }}
                              placeholder="Tìm hoặc chọn dịch vụ..."
                              className="cursor-pointer pl-9 pr-10"
                            />
                            <ChevronDown
                              className={cn(
                                "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary transition-transform",
                                servicePickerOpen && "rotate-180",
                              )}
                            />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          sideOffset={4}
                          className="w-[var(--radix-popover-trigger-width)] min-w-0 overflow-hidden border-border p-0 shadow-sm"
                          onOpenAutoFocus={(event) => event.preventDefault()}
                        >
                        <PickList
                          variant="simple"
                          options={visibleServices.map((s) => ({
                            id: s.id,
                            primary: s.name,
                            secondary: s.units.join(", "),
                            // Biết trước dòng nào sẽ gán xe được
                            badge: s.allowVehicle ? "Có xe" : undefined,
                          }))}
                          value={field.value}
                          onChange={(id) => {
                            field.onChange(id);
                            setServiceSearch("");
                            setServicePickerOpen(false);
                          }}
                          loading={loadingCatalog}
                          emptyText="Không tìm thấy dịch vụ"
                        />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                )}
                {errors.serviceId && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.serviceId.message}</p>
                )}
              </div>
            )}

            {/* Đơn vị của dòng */}
            {availableUnits.length > 0 && (
              <div className="space-y-1">
                <Label>Đơn vị</Label>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
                      <SelectContent>
                        {availableUnits.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-[length:var(--fs-sm)] text-error">{errors.unit.message}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="line-unit-price">
                  Đơn giá (₫) <span className="text-error">*</span>
                </Label>
                <Controller
                  control={control}
                  name="unitPrice"
                  render={({ field }) => (
                    <CurrencyInput
                      id="line-unit-price"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="0"
                    />
                  )}
                />
                {errors.unitPrice && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.unitPrice.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="line-quantity">
                  Số lượng <span className="text-error">*</span>
                </Label>
                <Input
                  id="line-quantity"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  {...register("quantity", {
                    setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                  })}
                />
                {errors.quantity && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.quantity.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="line-duration">Thời gian</Label>
              <Input
                id="line-duration"
                type="number"
                step="any"
                min="0"
                placeholder="Không tính theo thời gian"
                {...register("duration", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
              {errors.duration && <p className="text-[length:var(--fs-sm)] text-error">{errors.duration.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="line-note">Ghi chú</Label>
              <Textarea
                id="line-note"
                rows={2}
                maxLength={500}
                className="resize-none"
                {...register("note")}
              />
              {errors.note && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.note.message}</p>
              )}
            </div>

            {isEdit && (
              <div className="space-y-1">
                <Label htmlFor="line-sort-order">Thứ tự hiển thị</Label>
                <Input
                  id="line-sort-order"
                  type="number"
                  step={1}
                  {...register("sortOrder", {
                    setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                  })}
                />
                {errors.sortOrder && (
                  <p className="text-[length:var(--fs-sm)] text-error">{errors.sortOrder.message}</p>
                )}
              </div>
            )}

            {previewTotal !== undefined && (
              <div className="flex items-center justify-between rounded-md bg-primary-light px-3 py-2">
                <span className="text-[length:var(--fs-sm)] text-text-secondary">
                  Thành tiền (tạm tính)
                </span>
                <span className="text-[length:var(--fs-base)] font-semibold text-primary">
                  {formatCurrency(previewTotal)}
                </span>
              </div>
            )}
          </MobileSheetBody>

          <MobileSheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => closeDialog()}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || noActiveService}
              className="cursor-pointer"
            >
              {mutation.isPending ? "Đang lưu..." : isEdit ? "Lưu" : "Thêm dòng"}
            </Button>
          </MobileSheetFooter>
        </form>
      </MobileSheetContent>
    </MobileSheetDialog>
  );
}
