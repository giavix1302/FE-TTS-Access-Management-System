import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { addContractVehicle } from "@/api/contracts.api";
import { getVehicles } from "@/api/vehicles.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { useDebounce } from "@/hooks/useDebounce";
import { applyApiErrors, getApiError, isConcurrentUpdateError } from "@/utils/apiError";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { PickList, type PickOption } from "./PickList";
import { cn } from "@/lib/utils";
import type { LineView } from "@/utils/contractLines";
import type { ContractVehicle } from "@/types/contract.types";

interface AssignVehicleDialogProps {
  contractId: number;
  /** Dòng dịch vụ được gán xe; undefined = đóng dialog */
  line?: LineView;
  /** vehicle.id của các xe đang ở HĐ này mà chưa trả — loại khỏi danh sách để tránh 409 */
  excludeVehicleIds: number[];
  /** Có = đang gán xe thay thế cho lần giao này. */
  replaces?: ContractVehicle;
  onClose: () => void;
}

export function AssignVehicleDialog({ line, onClose, ...rest }: AssignVehicleDialogProps) {
  return (
    <MobileSheetDialog open={!!line} onOpenChange={(v) => !v && onClose()}>
      {/* key theo dòng → form mount lại với state sạch mỗi lần mở, không cần reset trong effect */}
      {line && <AssignVehicleForm key={line.id} line={line} onClose={onClose} {...rest} />}
    </MobileSheetDialog>
  );
}

function AssignVehicleForm({
  contractId,
  line,
  excludeVehicleIds,
  replaces,
  onClose,
}: Omit<AssignVehicleDialogProps, "line"> & { line: LineView }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Giữ cả option đã chọn: danh sách lọc từ server nên xe đã chọn có thể không còn trong trang kết quả
  const [selectedVehicle, setSelectedVehicle] = useState<PickOption | undefined>();
  const vehicleId = selectedVehicle?.id;
  const [workDays, setWorkDays] = useState(0);
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const debouncedSearch = useDebounce(search.trim(), 300);

  // Chỉ xe đang ở bãi (xe maintenance / broken / sold không nên gán)
  const { data: vehiclesRes, isLoading } = useQuery({
    queryKey: [
      ...QUERY_KEYS.vehicles.all,
      { status: "at_yard", forContract: true, search: debouncedSearch },
    ],
    queryFn: () =>
      getVehicles({
        status: "at_yard",
        page_size: 50,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // Xe đã gán vẫn at_yard cho tới khi giao → currentContract để loại xe đang được giữ cho HĐ khác
  const options = (vehiclesRes?.data ?? [])
    .filter((v) => !excludeVehicleIds.includes(v.id) && !v.currentContract)
    .map((v) => ({ id: v.id, primary: v.model, secondary: v.serialNumber }));

  const mutation = useMutation({
    mutationFn: () =>
      addContractVehicle(contractId, {
        lineItemId: line.id,
        vehicleId: vehicleId!,
        workDays,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(replaces ? { replacesContractVehicleId: replaces.id } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      toast.success("Đã gán xe vào dòng dịch vụ", {
        ...(workDays === 0
          ? { description: "Nhớ nhập số ngày làm cho xe để tính ngày kết thúc hợp đồng." }
          : {}),
      });
      onClose();
    },
    onError: (err) => {
      // Xe không ở bãi / còn lần giao chưa trả → lỗi nằm ở ô chọn xe (map theo field, không theo 400 / 409)
      applyApiErrors(
        err,
        (name: string, { message }) => setFieldErrors((current) => ({ ...current, [name]: message })),
        ["vehicleId", "workDays", "note"],
        getServiceErrorMessage(err),
      );
      // 409 / 404: dữ liệu đang lệch với BE → đồng bộ lại HĐ và danh sách xe
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      const code = getApiError(err).code;
      // Đóng để refetch detail ẩn nút Gán xe (cờ allowVehicle đổi giữa chừng / HĐ đã đóng / dòng bị xóa)
      if (
        isConcurrentUpdateError(err) ||
        code === "CONTRACT_NOT_ACTIVE" ||
        code === "LINE_ITEM_NOT_FOUND" ||
        code === "LINE_ITEM_VEHICLE_NOT_ALLOWED" ||
        code === "LINE_ITEM_VEHICLE_ON_SITE" ||
        code === "VEHICLE_ALREADY_REPLACED"
      ) {
        onClose();
      }
    },
  });

  return (
    <MobileSheetContent mobileVariant="sheet" className="min-w-0 max-w-full sm:max-w-md sm:!overflow-hidden">
      <MobileSheetHeader>
        <MobileSheetTitle>{replaces ? "Gán xe thay thế" : "Gán xe vào dòng dịch vụ"}</MobileSheetTitle>
      </MobileSheetHeader>

      <form
        className="min-w-0 max-w-full overflow-x-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (!vehicleId) return;
          setFieldErrors({});
          mutation.mutate();
        }}
      >
        <MobileSheetBody className="min-w-0 max-w-full space-y-4">
          <div className="min-w-0 rounded-md bg-bg-page px-3 py-2">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">Dòng dịch vụ</p>
            <AppTooltip content={line.service.name} onlyWhenTruncated>
              <p className="truncate text-[length:var(--fs-base)] font-medium text-text-primary">
                {line.service.name}
                <span className="font-normal text-text-secondary">
                  {" "}
                  · {line.quantity} {line.unit}
                </span>
              </p>
            </AppTooltip>
            {replaces && (
              <p className="mt-1 truncate text-[length:var(--fs-sm)] text-text-secondary">
                Thay cho xe {replaces.vehicle.model} · {replaces.vehicle.serialNumber}
              </p>
            )}
          </div>

          <div className="min-w-0 max-w-full space-y-1.5">
            <Label>
              Xe <span className="text-error">*</span>
            </Label>
            <Popover
              open={pickerOpen}
              onOpenChange={(nextOpen) => {
                setPickerOpen(nextOpen);
                if (!nextOpen) setSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <div className="relative min-w-0 max-w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                  <Input
                    role="combobox"
                    aria-expanded={pickerOpen}
                    value={
                      pickerOpen
                        ? search
                        : selectedVehicle
                          ? `${selectedVehicle.primary} · ${selectedVehicle.secondary}`
                          : ""
                    }
                    onFocus={() => {
                      setSearch("");
                      setPickerOpen(true);
                    }}
                    // preventDefault: chặn PopoverTrigger toggle đóng lại ngay sau khi focus vừa mở
                    onClick={(e) => {
                      e.preventDefault();
                      setPickerOpen(true);
                    }}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPickerOpen(true);
                    }}
                    // Enter khi đang tìm không được submit form với xe đã chọn trước đó
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    placeholder="Tìm theo model hoặc số serial..."
                    className="w-full min-w-0 cursor-pointer pl-9 pr-10"
                  />
                  <ChevronDown
                    className={cn(
                      "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary transition-transform",
                      pickerOpen && "rotate-180",
                    )}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={4}
                className="w-[var(--radix-popover-trigger-width)] min-w-0 overflow-hidden border-border p-0 shadow-sm"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <PickList
                  variant="simple"
                  options={options}
                  value={vehicleId}
                  onChange={(id) => {
                    setSelectedVehicle(options.find((o) => o.id === id));
                    setFieldErrors((current) => ({ ...current, vehicleId: "" }));
                    setSearch("");
                    setPickerOpen(false);
                  }}
                  loading={isLoading}
                  emptyText={search.trim() ? "Không tìm thấy xe phù hợp" : "Không có xe nào trong bãi"}
                />
              </PopoverContent>
            </Popover>
            {fieldErrors.vehicleId && (
              <p className="text-[length:var(--fs-sm)] text-error">{fieldErrors.vehicleId}</p>
            )}
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Chỉ hiện xe Trong bãi và chưa gán vào hợp đồng nào. Gán xe chỉ giữ xe cho hợp đồng, ngày
              xuất bãi tự ghi khi xe chuyển sang Đang cho thuê.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="assign-work-days">Số ngày làm</Label>
            <Input
              id="assign-work-days"
              type="number"
              min={0}
              max={3650}
              step={1}
              placeholder="0"
              // 0 hiện thành ô trống: giữ số 0 trong ô thì gõ tiếp sẽ ra "030"
              value={workDays || ""}
              onChange={(e) => setWorkDays(Number(e.target.value))}
            />
            {fieldErrors.workDays && (
              <p className="text-[length:var(--fs-sm)] text-error">{fieldErrors.workDays}</p>
            )}
            {replaces && (
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                Nhập số ngày xe này làm, không cộng dồn với xe được thay.
              </p>
            )}
            {line.addendumId != null && (
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                Dòng thuộc phụ lục: số ngày được tính từ ngày bắt đầu phụ lục.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="assign-note">Ghi chú</Label>
            <Textarea
              id="assign-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {fieldErrors.note && (
              <p className="text-[length:var(--fs-sm)] text-error">{fieldErrors.note}</p>
            )}
          </div>
        </MobileSheetBody>

        <MobileSheetFooter>
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !vehicleId}
            className="cursor-pointer"
          >
            {mutation.isPending ? "Đang lưu..." : "Gán xe"}
          </Button>
        </MobileSheetFooter>
      </form>
    </MobileSheetContent>
  );
}
