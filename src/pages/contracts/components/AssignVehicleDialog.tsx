import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { DatePicker } from "@/components/shared/DatePicker";
import { addContractVehicle } from "@/api/contracts.api";
import { getVehicles } from "@/api/vehicles.api";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { useDebounce } from "@/hooks/useDebounce";
import { getApiError } from "@/utils/apiError";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { PickList } from "./PickList";
import type { LineView } from "@/utils/contractLines";

interface VehicleOption {
  id: number;
  model: string;
  serialNumber: string;
}

interface AssignVehicleDialogProps {
  contractId: number;
  /** Dòng dịch vụ được gán xe; undefined = đóng dialog */
  line?: LineView;
  /** vehicle.id của các xe đang ở HĐ này mà chưa trả — loại khỏi danh sách để tránh 409 */
  excludeVehicleIds: number[];
  /** Có = đang gán xe thay thế cho lần giao này. */
  replacesContractVehicleId?: number;
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
  replacesContractVehicleId,
  onClose,
}: Omit<AssignVehicleDialogProps, "line"> & { line: LineView }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [vehicleId, setVehicleId] = useState<number | undefined>();
  const [deployDate, setDeployDate] = useState<string | undefined>();
  const [workDays, setWorkDays] = useState(0);
  const [note, setNote] = useState("");
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

  const options = ((vehiclesRes?.data ?? []) as VehicleOption[])
    .filter((v) => !excludeVehicleIds.includes(v.id))
    .map((v) => ({ id: v.id, primary: v.model, secondary: v.serialNumber }));

  const mutation = useMutation({
    mutationFn: () =>
      addContractVehicle(contractId, {
        lineItemId: line.id,
        vehicleId: vehicleId!,
        ...(deployDate ? { deployDate } : {}),
        workDays,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(replacesContractVehicleId ? { replacesContractVehicleId } : {}),
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
      toast.error(getServiceErrorMessage(err));
      // 409 / 404: dữ liệu đang lệch với BE → đồng bộ lại HĐ và danh sách xe
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vehicles.all });
      const code = getApiError(err).code;
      // Đóng để refetch detail ẩn nút Gán xe (cờ allowVehicle đổi giữa chừng / HĐ đã đóng / dòng bị xóa)
      if (
        code === "CONTRACT_NOT_ACTIVE" ||
        code === "LINE_ITEM_NOT_FOUND" ||
        code === "LINE_ITEM_VEHICLE_NOT_ALLOWED"
      ) {
        onClose();
      }
    },
  });

  return (
    <MobileSheetContent mobileVariant="sheet" className="min-w-0 max-w-full sm:max-w-md sm:!overflow-hidden">
      <MobileSheetHeader>
        <MobileSheetTitle>{replacesContractVehicleId ? "Gán xe thay thế" : "Gán xe vào dòng dịch vụ"}</MobileSheetTitle>
      </MobileSheetHeader>

      <form
        className="min-w-0 max-w-full overflow-x-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (vehicleId) mutation.mutate();
        }}
      >
        <MobileSheetBody className="min-w-0 max-w-full space-y-4">
          <div className="min-w-0 rounded-md bg-bg-page px-3 py-2">
            <p className="text-[length:var(--fs-sm)] text-text-secondary">Dòng dịch vụ</p>
            <p className="truncate text-[length:var(--fs-base)] font-medium text-text-primary" title={line.service.name}>
              {line.service.name}
              <span className="font-normal text-text-secondary">
                {" "}
                · {line.quantity} {line.unit}
              </span>
            </p>
          </div>

          <div className="min-w-0 max-w-full space-y-1.5 overflow-hidden">
            <Label>
              Xe <span className="text-error">*</span>
            </Label>
            <div className="relative min-w-0 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo model hoặc số serial..."
                className="w-full min-w-0 pl-9"
              />
            </div>
            <PickList
              options={options}
              value={vehicleId}
              onChange={setVehicleId}
              loading={isLoading}
              emptyText={search.trim() ? "Không tìm thấy xe phù hợp" : "Không có xe nào trong bãi"}
            />
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Chỉ hiện xe đang ở trạng thái Trong bãi. Xe đang thuộc hợp đồng khác chưa trả vẫn bị
              từ chối khi gán.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Ngày xuất bãi</Label>
            <DatePicker
              value={deployDate}
              onChange={(d) => setDeployDate(d || undefined)}
              placeholder="Chưa xuất bãi"
            />
            <p className="text-[length:var(--fs-sm)] text-text-secondary">
              Thường để trống — ngày xuất bãi tự ghi khi đổi trạng thái xe sang “Đang cho thuê”.
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
              value={workDays}
              onChange={(e) => setWorkDays(Number(e.target.value))}
            />
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
