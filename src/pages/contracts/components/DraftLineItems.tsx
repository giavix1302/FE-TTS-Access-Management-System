import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { getServiceCatalog } from "@/api/service-catalog.api";
import { getVehicles } from "@/api/vehicles.api";
import { usePermission } from "@/hooks/usePermission";
import {
  createEmptyLineDraft,
  getDraftTotal,
  type LineErrors,
  type LineItemDraft,
} from "@/utils/draftLineItems";
import { formatCurrency } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { ExtractedFileTotals } from "@/types/contract.types";

// Khối "Dịch vụ & xe" dạng nháp, dùng chung cho form Tạo hợp đồng và form Thêm phụ lục
// (cả hai gửi `lineItems[]` cùng dạng, BE trả cùng mã lỗi + field `lineItems[i]...`)

// ─── Types ────────────────────────────────────────────────────────────────────
interface ServiceOption {
  id: number;
  name: string;
  units: string[];
  isActive: boolean;
  allowVehicle: boolean;
}

interface VehicleOption {
  id: number;
  model: string;
  serialNumber: string;
  status: string;
  currentContract?: unknown;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface DraftLineItemsProps {
  lineItems: LineItemDraft[];
  setLineItems: Dispatch<SetStateAction<LineItemDraft[]>>;
  lineErrors: LineErrors;
  setLineErrors: Dispatch<SetStateAction<LineErrors>>;
  /** Tổng tiền ghi trong file (AI đọc) — chỉ để đối chiếu, BE tự tính lại */
  fileTotals?: ExtractedFileTotals | null;
  /** Chỉ tải xe at_yard khi dialog đang mở */
  enabled: boolean;
  /** Tiêu đề mục (mặc định "Dịch vụ & xe") */
  title?: string;
  /** Gợi ý khi chưa có dòng nào và người dùng có quyền thêm */
  emptyHint?: string;
}

export function DraftLineItems({
  lineItems,
  setLineItems,
  lineErrors,
  setLineErrors,
  fileTotals,
  enabled,
  title = "Dịch vụ & xe",
  emptyHint = "Chưa có dịch vụ nào",
}: DraftLineItemsProps) {
  // Thiếu service_catalog.view thì GET /service-catalog trả 403 → không gọi, ẩn nút thêm dịch vụ
  const { hasPermission } = usePermission();
  const canViewCatalog = hasPermission("service_catalog.view");
  const { data: serviceCatalogRes } = useQuery({
    queryKey: QUERY_KEYS.serviceCatalog.all,
    queryFn: getServiceCatalog,
    enabled: canViewCatalog,
    staleTime: 5 * 60 * 1000,
  });
  const activeServices: ServiceOption[] = (serviceCatalogRes?.data ?? []).filter(
    (s: ServiceOption) => s.isActive,
  );
  const catalogEmpty = canViewCatalog && !!serviceCatalogRes && activeServices.length === 0;

  // Xe at_yard cho dropdown gán xe
  const { data: vehiclesRes } = useQuery({
    queryKey: [...QUERY_KEYS.vehicles.all, { status: "at_yard", forContract: true }],
    queryFn: () => getVehicles({ status: "at_yard", page_size: 100 }),
    enabled,
    staleTime: 60 * 1000,
  });
  // Xe đã gán vẫn at_yard cho tới khi giao → currentContract để loại xe đang được giữ cho HĐ khác
  const vehicleOptions: VehicleOption[] = (vehiclesRes?.data ?? []).filter(
    (vehicle: VehicleOption) => !vehicle.currentContract,
  );

  const draftTotal = getDraftTotal(lineItems);

  function patchLine(key: string, patch: Partial<LineItemDraft>) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)));
    setLineErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-3 border-t border-border pt-4 pb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide">{title}</p>
        {canViewCatalog && !catalogEmpty && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLineItems((prev) => [...prev, createEmptyLineDraft()])}
            className="h-7 text-xs gap-1.5 cursor-pointer hover:bg-primary-light hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm dịch vụ
          </Button>
        )}
      </div>

      {lineItems.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 px-3 text-center border border-dashed border-border rounded-lg">
          {!canViewCatalog
            ? "Bạn không có quyền xem danh mục dịch vụ. Hãy nhờ quản lý bổ sung dịch vụ sau."
            : catalogEmpty
              ? "Danh mục chưa có dịch vụ nào đang hoạt động. Thêm dịch vụ ở mục Danh mục dịch vụ trước."
              : emptyHint}
        </p>
      ) : (
        <div className="space-y-3">
          {lineItems.map((item, index) => {
            const selectedService = activeServices.find((service) => service.id === item.service_id);
            // Một xe chỉ nằm ở 1 dòng chưa trả (BE 409 VEHICLE_ALREADY_IN_CONTRACT) → ẩn xe đã chọn ở dòng khác
            const takenVehicleIds = lineItems
              .filter((li) => li._key !== item._key)
              .flatMap((li) => li.vehicles.map((vehicle) => vehicle.vehicle_id));
            const lineVehicleOptions = vehicleOptions.filter((mv) => !takenVehicleIds.includes(mv.id));
            const lineError = lineErrors[item._key] ?? {};
            return (
              <div key={item._key} className="rounded-lg border border-border bg-bg-card overflow-hidden">
                {/* Header dòng: số thứ tự + xóa */}
                <div className="flex items-center justify-between border-b border-border bg-bg-page px-3 py-2">
                  <p className="text-sm font-medium text-text-primary">Dịch vụ {index + 1}</p>
                  <button
                    type="button"
                    aria-label="Xóa dòng dịch vụ"
                    onClick={() => setLineItems((prev) => prev.filter((li) => li._key !== item._key))}
                    className="rounded p-1 text-text-secondary hover:bg-error hover:text-white cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      Dịch vụ <span className="text-error">*</span>
                    </Label>
                    <Select
                      value={item.service_id ? String(item.service_id) : ""}
                      onValueChange={(v) => {
                        const svc = activeServices.find((s) => s.id === Number(v));
                        if (!svc) return;
                        patchLine(item._key, {
                          service_id: svc.id,
                          service_name: svc.name,
                          unit: svc.units[0] ?? "",
                          allow_vehicle: svc.allowVehicle,
                          // Dịch vụ không cho gán xe → bỏ xe đã chọn (BE 400 LINE_ITEM_VEHICLE_NOT_ALLOWED)
                          ...(svc.allowVehicle ? {} : { vehicles: [] }),
                        });
                      }}
                    >
                      <SelectTrigger className="w-full cursor-pointer border-border">
                        <SelectValue placeholder="Chọn dịch vụ" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeServices.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.units.join(", ")})
                            {s.allowVehicle && (
                              <span className="ml-1.5 rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                Có xe
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lineError.serviceId && <p className="text-xs text-error">{lineError.serviceId}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">
                        Đơn vị <span className="text-error">*</span>
                      </Label>
                      <Select value={item.unit} onValueChange={(unit) => patchLine(item._key, { unit })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn đơn vị" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedService?.units ?? (item.unit ? [item.unit] : [])).map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {lineError.unit && <p className="text-xs text-error">{lineError.unit}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Thời gian</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Không áp dụng"
                        value={item.duration ?? ""}
                        onChange={(e) =>
                          patchLine(item._key, {
                            duration: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      {lineError.duration && <p className="text-xs text-error">{lineError.duration}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">
                        Số lượng{item.unit ? ` (${item.unit})` : ""} <span className="text-error">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={item.quantity ?? ""}
                        onChange={(e) =>
                          patchLine(item._key, {
                            quantity: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      {lineError.quantity && <p className="text-xs text-error">{lineError.quantity}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">
                        Đơn giá (₫) <span className="text-error">*</span>
                      </Label>
                      <CurrencyInput
                        value={item.unit_price}
                        onChange={(v) => patchLine(item._key, { unit_price: v })}
                        placeholder="0"
                      />
                      {lineError.unitPrice && <p className="text-xs text-error">{lineError.unitPrice}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Ghi chú</Label>
                    <Textarea
                      rows={2}
                      maxLength={500}
                      placeholder="Mô tả thêm cho dòng dịch vụ (không bắt buộc)"
                      className="resize-none"
                      value={item.note}
                      onChange={(e) => patchLine(item._key, { note: e.target.value })}
                    />
                    {lineError.note && <p className="text-xs text-error">{lineError.note}</p>}
                  </div>

                  {/* Xe của dòng — có thể chọn tối đa quantity xe */}
                  {item.allow_vehicle && (
                    <div className="space-y-3 rounded-md bg-bg-page p-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm">
                          Xe ({item.vehicles.length}/{item.quantity ?? 0})
                        </Label>
                        {item.vehicles.length > 0 && (
                          <div className="space-y-2">
                            {item.vehicles.map((vehicleDraft, vehicleIndex) => {
                              const vehicle = vehicleOptions.find((option) => option.id === vehicleDraft.vehicle_id);
                              const vehicleError = lineError[`vehicles[${vehicleIndex}].vehicleId`];
                              return (
                                <div
                                  key={vehicleDraft.vehicle_id}
                                  className="space-y-2 rounded-md border border-border bg-bg-card p-2"
                                >
                                  <div className="flex items-center justify-between text-xs font-medium text-text-primary">
                                    <span>
                                      {vehicle?.model ?? "Xe"} · {vehicle?.serialNumber ?? `#${vehicleDraft.vehicle_id}`}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="Bỏ xe"
                                      className="cursor-pointer text-text-secondary hover:text-error"
                                      onClick={() =>
                                        patchLine(item._key, {
                                          vehicles: item.vehicles.filter(
                                            (entry) => entry.vehicle_id !== vehicleDraft.vehicle_id,
                                          ),
                                        })
                                      }
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={3650}
                                    step={1}
                                    value={vehicleDraft.work_days || ""}
                                    onChange={(event) =>
                                      patchLine(item._key, {
                                        vehicles: item.vehicles.map((entry) =>
                                          entry.vehicle_id === vehicleDraft.vehicle_id
                                            ? { ...entry, work_days: Number(event.target.value) }
                                            : entry,
                                        ),
                                      })
                                    }
                                    placeholder="Số ngày làm"
                                  />
                                  <Input
                                    value={vehicleDraft.note}
                                    maxLength={500}
                                    onChange={(event) =>
                                      patchLine(item._key, {
                                        vehicles: item.vehicles.map((entry) =>
                                          entry.vehicle_id === vehicleDraft.vehicle_id
                                            ? { ...entry, note: event.target.value }
                                            : entry,
                                        ),
                                      })
                                    }
                                    placeholder="Ghi chú giao xe"
                                  />
                                  {vehicleError && <p className="text-xs text-error">{vehicleError}</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-xs text-text-secondary">
                          Gán xe chỉ giữ xe cho hợp đồng. Ngày xuất bãi tự ghi khi xe chuyển sang Đang cho thuê.
                        </p>
                        <Select
                          value=""
                          onValueChange={(v) =>
                            patchLine(item._key, {
                              vehicles: [...item.vehicles, { vehicle_id: Number(v), work_days: 0, note: "" }],
                            })
                          }
                          disabled={item.vehicles.length >= (item.quantity ?? 0)}
                        >
                          <SelectTrigger className="w-full cursor-pointer border-border bg-bg-card">
                            <SelectValue placeholder="Chọn thêm xe" />
                          </SelectTrigger>
                          <SelectContent>
                            {lineVehicleOptions
                              .filter((mv) => !item.vehicles.some((entry) => entry.vehicle_id === mv.id))
                              .map((mv) => (
                                <SelectItem key={mv.id} value={String(mv.id)}>
                                  {mv.model}
                                  <span className="text-text-secondary"> · {mv.serialNumber}</span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer dòng: thành tiền */}
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
                  <span className="text-text-secondary">Thành tiền</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency((item.unit_price ?? 0) * (item.quantity ?? 0) * (item.duration ?? 1))}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Tạm tính trước VAT — tổng chính thức (kèm VAT công ty) do BE tính sau khi lưu */}
          {/* Có tổng đọc từ file → hiện thêm tiền thuế + tổng cộng theo file (gộp chung 1 khối) */}
          <div className="rounded-lg bg-primary-light px-3 py-2.5">
            {fileTotals && (
              <>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Tổng trước thuế</span>
                  <span className="font-medium text-text-primary">{formatCurrency(draftTotal)}</span>
                </div>
                {fileTotals.taxAmount != null && (
                  <div className="mt-1 flex items-center justify-between text-sm text-text-secondary">
                    <span>Tiền thuế{fileTotals.vatRate != null ? ` (${fileTotals.vatRate}%)` : ""}</span>
                    <span className="font-medium text-text-primary">{formatCurrency(fileTotals.taxAmount)}</span>
                  </div>
                )}
                <div className="my-2 border-t border-primary/15" />
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">Tổng cộng</span>
              <span className="text-base font-semibold text-primary">
                {formatCurrency(fileTotals?.totalAmount ?? draftTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
