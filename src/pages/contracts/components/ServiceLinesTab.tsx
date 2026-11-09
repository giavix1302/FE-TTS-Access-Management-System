import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CornerDownRight, Info, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { removeContractVehicle, deleteLineItem, getIncidents } from "@/api/contracts.api";
import { getVehicleStatusBadge } from "@/constants/vehicleStatus";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { isContractOpen } from "@/constants/contractStatus";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { getApiError } from "@/utils/apiError";
import {
  buildLineViews,
  formatLineCalculation,
  getLineSlots,
  splitLinesByAddendum,
  type LineView,
} from "@/utils/contractLines";
import { formatCurrency, formatDate, toDateOnly } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { LineItemDialog } from "./LineItemDialog";
import { AssignVehicleDialog } from "./AssignVehicleDialog";
import { EditDeploymentDialog } from "./EditDeploymentDialog";
import type { ContractDetail, ContractVehicle, LineItem } from "@/types/contract.types";

const ICON_BTN = "h-8 w-8 cursor-pointer p-0";
const SUB_LABEL = "text-[length:var(--fs-xs)] font-medium uppercase tracking-wide text-text-secondary";

interface DeploymentSegmentProps {
  cv: ContractVehicle;
  /** Lần giao này là xe thay thế (nằm dưới xe bị thay trong cùng card) */
  isReplacement: boolean;
  /** Đã có xe thay thế → làm xám icon (nền xám do DeploymentCard) */
  replaced: boolean;
  /** contracts.update — mở được form ở MỌI trạng thái HĐ (HĐ đã đóng chỉ sửa ghi chú) */
  canEdit: boolean;
  /** HĐ active + contracts.update: gỡ xe, nhập số ngày làm */
  canWrite: boolean;
  /** Có sự cố replacement nhưng chưa có xe thay */
  awaiting: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onReplace?: () => void;
}

// Một cặp nhãn + giá trị trên dòng thông số
function InlineStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </span>
  );
}

const Divider = () => (
  <span aria-hidden className="text-border">
    |
  </span>
);

// 1 lần giao xe trong card: phần trên = icon (căn giữa 2 hàng) + xe/trạng thái/thao tác + Ngày xuất/trả/số ngày;
// phần dưới (tách riêng) = ghi chú + nút gán xe thay thế.
// Badge trạng thái + nút gỡ chỉ cho lần giao chưa trả — badge là trạng thái LIVE của xe, không phải của lần giao.
function DeploymentSegment({
  cv,
  isReplacement,
  replaced,
  canEdit,
  canWrite,
  awaiting,
  onEdit,
  onRemove,
  onReplace,
}: DeploymentSegmentProps) {
  const active = !cv.returnDate;
  const badge = getVehicleStatusBadge(cv.vehicle.status);
  const editLabel = canWrite ? "Sửa ngày xuất bãi / số ngày làm / ghi chú" : "Sửa ghi chú";
  // Gỡ chỉ được khi chưa xuất bãi (và chưa có sự cố — BE kiểm tra)
  const removeBlocked = !!cv.deployDate;

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {isReplacement && (
          <CornerDownRight size={22} strokeWidth={2.75} className="shrink-0 text-text-secondary" aria-hidden />
        )}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bg-card",
            active && !replaced ? "text-primary shadow-sm" : "text-text-secondary",
          )}
        >
          <Truck size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Xe đã có xe thay → làm nhạt chữ (không làm nhạt nút thao tác) */}
            <div
              className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5", replaced && "opacity-60")}
            >
              {/* Chỉ cắt tên xe (tối đa ~15rem) để serial luôn thấy đủ; tooltip hiện khi tên bị cắt.
                  Serial là tag vuông viền mảnh (khác badge trạng thái bo tròn) → tách rõ 2 loại thông tin */}
              <div className="flex min-w-0 items-center gap-2.5">
                <AppTooltip content={cv.vehicle.model} onlyWhenTruncated>
                  <Link
                    to={`/vehicles/${cv.vehicle.id}`}
                    className="block min-w-0 max-w-[15rem] truncate text-[length:var(--fs-base)] font-semibold leading-5 text-text-primary hover:text-primary hover:underline"
                  >
                    {cv.vehicle.model}
                  </Link>
                </AppTooltip>
                <span className="inline-flex h-5 shrink-0 items-center justify-center rounded border border-border bg-bg-card px-1.5 font-mono text-[length:var(--fs-xs)] leading-none text-text-secondary">
                  {cv.vehicle.serialNumber}
                </span>
              </div>
              {active && (
                <span
                  className={cn(
                    "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[length:var(--fs-xs)] font-medium leading-none",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              )}
              {isReplacement && <span className="text-[length:var(--fs-xs)] text-warning">Xe thay thế</span>}
              {awaiting && <span className="text-[length:var(--fs-xs)] text-warning">Đang chờ xe thay thế</span>}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {canEdit && (
                <AppTooltip content={editLabel}>
                  <Button variant="ghost" size="sm" onClick={onEdit} className={ICON_BTN} aria-label={editLabel}>
                    <Pencil size={14} />
                  </Button>
                </AppTooltip>
              )}
              {active && canWrite && (
                <AppTooltip
                  content={
                    removeBlocked
                      ? "Xe đã xuất bãi, không thể gỡ. Muốn kết thúc hãy đổi trạng thái xe về Trong bãi"
                      : "Gỡ xe khỏi dòng dịch vụ"
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removeBlocked}
                    onClick={onRemove}
                    className={cn(ICON_BTN, "hover:bg-error hover:text-white")}
                    aria-label="Gỡ xe khỏi dòng dịch vụ"
                  >
                    <Trash2 size={14} />
                  </Button>
                </AppTooltip>
              )}
            </div>
          </div>

          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 border-t border-dashed border-border pt-2 text-[length:var(--fs-sm)] text-text-primary",
              replaced && "opacity-60",
            )}
          >
            <InlineStat label="Ngày xuất bãi:">
              {cv.deployDate ? (
                formatDate(toDateOnly(cv.deployDate))
              ) : (
                <span className="font-normal text-text-secondary">Chưa xuất</span>
              )}
            </InlineStat>
            <Divider />
            <InlineStat label="Ngày trả xe:">
              {cv.returnDate ? (
                <span className="text-success">{formatDate(toDateOnly(cv.returnDate))}</span>
              ) : (
                <span className="font-normal text-warning">Chưa trả</span>
              )}
            </InlineStat>
            <Divider />
            {/* Gán xe mới luôn có workDays = 0 → nhắc nhập (endDate HĐ cộng workDays theo chuỗi thay xe) */}
            {cv.workDays > 0 ? (
              <InlineStat label="Số ngày làm:">{cv.workDays} ngày</InlineStat>
            ) : canWrite ? (
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer text-warning underline-offset-2 hover:underline"
              >
                Nhập số ngày làm
              </button>
            ) : (
              <span className="text-warning">Chưa nhập số ngày</span>
            )}
          </div>
        </div>
      </div>

      {/* Phần dưới tách riêng (ghi chú + gán xe thay thế) để icon chỉ căn giữa 2 hàng phía trên */}
      {(cv.note || onReplace) && (
        <div className="flex items-center gap-3 border-t border-border/70 px-3 py-2">
          <div className="min-w-0 flex-1">
            {cv.note && (
              <AppTooltip content={cv.note} onlyWhenTruncated>
                <p className={cn("truncate text-[length:var(--fs-sm)] text-text-secondary", replaced && "opacity-60")}>
                  <span className="font-medium">Ghi chú:</span> <span className="italic">{cv.note}</span>
                </p>
              </AppTooltip>
            )}
          </div>
          {onReplace && (
            <Button variant="outline" size="sm" onClick={onReplace} className="shrink-0 cursor-pointer bg-bg-card">
              <Plus size={14} />
              Gán xe thay thế
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// 1 card = 1 chuỗi thay xe: xe gốc ở trên, xe thay thế (và xe thay của xe thay…) nối bên dưới cùng card.
// Card nổi (nền xanh) khi trong chuỗi còn xe chưa trả.
function DeploymentCard({
  chain,
  renderSegment,
}: {
  chain: ContractVehicle[];
  renderSegment: (cv: ContractVehicle, isReplacement: boolean, replaced: boolean) => React.ReactNode;
}) {
  const active = chain.some((d) => !d.returnDate);
  return (
    <div
      className={cn(
        "divide-y overflow-hidden rounded-lg border",
        active ? "divide-primary/20 border-primary/30 bg-primary-light/40" : "divide-border border-border bg-bg-page",
      )}
    >
      {/* Xe đã có xe thay (mọi xe trừ cuối chuỗi) → nền xám để nổi bật xe đang thay thế */}
      {chain.map((cv, i) => {
        const replaced = i < chain.length - 1;
        return (
          <div key={cv.id} className={cn(replaced && "bg-bg-page")}>
            {renderSegment(cv, i > 0, replaced)}
          </div>
        );
      })}
    </div>
  );
}

interface LineBlockProps {
  line: LineView;
  index: number;
  canEdit: boolean;
  canWriteLines: boolean;
  canAssign: boolean;
  onEditLine: () => void;
  onDeleteLine: () => void;
  onAssign: () => void;
  onEditCv: (cv: ContractVehicle) => void;
  onRemoveCv: (cv: ContractVehicle) => void;
  onReplaceCv: (cv: ContractVehicle) => void;
  /** Id các lần giao đã có sự cố replacement */
  replacementIncidentCvIds: Set<number>;
}

function LineBlock({
  line,
  index,
  canEdit,
  canWriteLines,
  canAssign,
  onEditLine,
  onDeleteLine,
  onAssign,
  onEditCv,
  onRemoveCv,
  onReplaceCv,
  replacementIncidentCvIds,
}: LineBlockProps) {
  const hasVehicles = line.deployments.length > 0;
  const deleteReason = line.deployments.some((d) => d.deployDate)
    ? "Dòng đã có xe xuất bãi, không thể xóa"
    : "Dòng đã có xe, gỡ xe trước";
  const { occupied, awaitingIds } = getLineSlots(line.deployments, replacementIncidentCvIds);
  const canUseVehicleActions = canAssign && line.service.allowVehicle;

  // Gom chuỗi thay xe: mỗi lần giao bị thay tối đa 1 lần (1 sự cố replacement / lần giao) nên chuỗi là thẳng.
  // Gốc = lần giao không thay cho ai (hoặc xe bị thay không thuộc dòng này — phòng dữ liệu lạ).
  const chains = useMemo(() => {
    const ids = new Set(line.deployments.map((d) => d.id));
    const replacementOf = new Map<number, ContractVehicle>();
    for (const d of line.deployments) {
      if (d.replacesContractVehicleId != null && ids.has(d.replacesContractVehicleId)) {
        replacementOf.set(d.replacesContractVehicleId, d);
      }
    }
    return line.deployments
      .filter((d) => d.replacesContractVehicleId == null || !ids.has(d.replacesContractVehicleId))
      .map((root) => {
        const chain = [root];
        for (let next = replacementOf.get(root.id); next && chain.length <= ids.size; next = replacementOf.get(next.id)) {
          chain.push(next);
        }
        return chain;
      });
  }, [line.deployments]);
  // Chuỗi còn xe chưa trả → "Xe hiện tại"; mọi xe đã trả → "Đã giao trước đó"
  const currentChains = chains.filter((c) => c.some((d) => !d.returnDate));
  const historyChains = chains.filter((c) => c.every((d) => !!d.returnDate));

  const renderSegment = (cv: ContractVehicle, isReplacement: boolean, replaced: boolean) => (
    <DeploymentSegment
      cv={cv}
      isReplacement={isReplacement}
      replaced={replaced}
      canEdit={canEdit}
      canWrite={canWriteLines}
      awaiting={awaitingIds.has(cv.id)}
      onEdit={() => onEditCv(cv)}
      onRemove={() => onRemoveCv(cv)}
      // Xe thay thế nhận lại chỗ của xe bị thay nên không cần dòng còn dư chỗ; xe cũ không cần trả trước
      onReplace={canUseVehicleActions && awaitingIds.has(cv.id) ? () => onReplaceCv(cv) : undefined}
    />
  );

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
            {index + 1}. {line.service.name} <span className="font-normal text-text-secondary">({line.unit})</span>
          </p>
          <p className="mt-0.5 text-[length:var(--fs-sm)] text-text-secondary">{formatLineCalculation(line)}</p>
          {line.note && (
            <p className="mt-0.5 whitespace-pre-line text-[length:var(--fs-sm)] text-text-secondary">
              <span className="font-medium not-italic">Mô tả:</span> <span className="italic">{line.note}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:items-end">
          <span className="text-[length:var(--fs-base)] font-semibold text-text-primary">
            {formatCurrency(line.lineTotal)}
          </span>
          {canWriteLines && (
            <div className="flex items-center gap-0.5">
              <AppTooltip content="Sửa đơn giá / số lượng / ghi chú">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditLine}
                  className={ICON_BTN}
                  aria-label="Sửa đơn giá / số lượng / ghi chú"
                >
                  <Pencil size={14} />
                </Button>
              </AppTooltip>
              <AppTooltip content={hasVehicles ? deleteReason : "Xóa dòng dịch vụ"}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={hasVehicles}
                  onClick={onDeleteLine}
                  className={cn(ICON_BTN, "hover:bg-error hover:text-white")}
                  aria-label="Xóa dòng dịch vụ"
                >
                  <Trash2 size={14} />
                </Button>
              </AppTooltip>
            </div>
          )}
        </div>
      </div>

      {/* Xe của dòng: hiện tại trước, lịch sử sau (theo id tăng dần) */}
      {currentChains.length > 0 && (
        <div className="space-y-1.5">
          <p className={SUB_LABEL}>
            Xe hiện tại ({occupied}/{line.quantity})
          </p>
          <div className="space-y-2">
            {currentChains.map((chain) => (
              <DeploymentCard key={chain[0].id} chain={chain} renderSegment={renderSegment} />
            ))}
          </div>
        </div>
      )}
      {historyChains.length > 0 && (
        <div className="space-y-1.5">
          <p className={SUB_LABEL}>Đã giao trước đó ({historyChains.length})</p>
          <div className="space-y-2">
            {historyChains.map((chain) => (
              <DeploymentCard key={chain[0].id} chain={chain} renderSegment={renderSegment} />
            ))}
          </div>
        </div>
      )}

      {/* allowVehicle = true mà chưa gán xe lần nào → nhắc. allowVehicle = false (vận chuyển,
          nhân công…) thì ẩn hẳn vùng xe, không hiện "—" gây hiểu nhầm là còn thiếu xe.
          Dòng đã có xe dù cờ bị tắt sau đó: vẫn hiện xe đã gán ở trên (sửa ngày xuất bãi / số ngày làm) */}
      {line.service.allowVehicle && !hasVehicles && (
        <p className="text-[length:var(--fs-sm)] text-text-secondary">Chưa gán xe</p>
      )}

      {/* Mỗi dòng có tối đa quantity chỗ; xe chờ thay vẫn giữ chỗ (getLineSlots).
          Cờ allowVehicle tra LIVE từ danh mục (có sẵn trong detail, staff vẫn dùng được);
          không đoán theo tên dịch vụ. Cờ tắt → chặn cả gán xe thay thế */}
      {canUseVehicleActions && occupied < line.quantity && (
        <Button variant="outline" size="sm" onClick={onAssign} className="cursor-pointer">
          <Plus size={14} />
          Gán xe
        </Button>
      )}
    </div>
  );
}

function TotalsFooter({
  label,
  subtotal,
  taxAmount,
  totalAmount,
}: {
  label: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}) {
  return (
    <div className="space-y-1.5 border-t-2 border-primary/20 bg-primary-light px-5 py-3">
      <div className="flex justify-between text-[length:var(--fs-sm)] text-text-secondary">
        <span>Cộng tiền hàng</span>
        <span className="font-medium text-text-primary">{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex justify-between text-[length:var(--fs-sm)] text-text-secondary">
        <span>VAT</span>
        <span className="font-medium text-text-primary">{formatCurrency(taxAmount)}</span>
      </div>
      <div className="flex justify-between border-t border-primary/20 pt-1.5">
        <span className="text-[length:var(--fs-base)] font-semibold text-text-primary">{label}</span>
        <span className="text-[length:var(--fs-title)] font-bold text-primary">{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
}

interface ServiceLinesTabProps {
  contract: ContractDetail;
  contractId: number;
  /** contracts.update */
  canEdit: boolean;
  /** VEHICLE_HAS_INCIDENTS → dẫn sang tab Sự cố */
  onGoToIncidents?: () => void;
}

export function ServiceLinesTab({ contract, contractId, canEdit, onGoToIncidents }: ServiceLinesTabProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  // Tên "isActive" giữ nguyên: nghĩa là HĐ còn mở (active hoặc chưa bắt đầu), thao tác như nhau
  const isActive = isContractOpen(contract.status);
  const canWriteLines = canEdit && isActive;
  // Thêm dòng cần CẢ contracts.update lẫn service_catalog.view (lấy danh sách để chọn)
  const canAddService = canWriteLines && hasPermission("service_catalog.view");
  // Picker xe gọi GET /vehicles → cần vehicles.view
  const canAssign = canWriteLines && hasPermission("vehicles.view");

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<LineItem | undefined>();
  const [deletingLine, setDeletingLine] = useState<LineView | undefined>();
  const [assigningLine, setAssigningLine] = useState<LineView | undefined>();
  const [replacementTarget, setReplacementTarget] = useState<ContractVehicle | undefined>();
  const [editingCv, setEditingCv] = useState<ContractVehicle | undefined>();
  const [removingCv, setRemovingCv] = useState<ContractVehicle | undefined>();

  const { data: incidentsRes } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), "incidents"],
    queryFn: () => getIncidents(contractId),
  });

  const replacementIncidentCvIds = useMemo(
    () =>
      new Set(
        (incidentsRes?.data ?? [])
          .filter((incident) => incident.incidentType === "replacement")
          .map((incident) => incident.contractVehicle.id),
      ),
    [incidentsRes],
  );

  // lineItems gồm cả dòng gốc lẫn dòng phụ lục → mục này chỉ hiện dòng HĐ gốc (dòng phụ lục xem ở tab Phụ lục)
  const baseLines = useMemo(
    () => splitLinesByAddendum(buildLineViews(contract.lineItems, contract.vehicles)).base,
    [contract.lineItems, contract.vehicles],
  );

  const unreturned = contract.vehicles.filter((v) => !v.returnDate);

  const syncContract = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });

  const deleteLineMutation = useMutation({
    mutationFn: (itemId: number) => deleteLineItem(contractId, itemId),
    onSuccess: () => {
      syncContract();
      toast.success("Đã xóa dòng dịch vụ");
      setDeletingLine(undefined);
    },
    onError: (err) => {
      toast.error(getServiceErrorMessage(err));
      // Dữ liệu lệch với BE (đã có xe / HĐ đã đóng / dòng không còn) → đồng bộ lại
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      setDeletingLine(undefined);
    },
  });

  const removeVehicleMutation = useMutation({
    mutationFn: (cvId: number) => removeContractVehicle(contractId, cvId),
    onSuccess: () => {
      syncContract();
      toast.success("Đã gỡ xe khỏi dòng dịch vụ");
      setRemovingCv(undefined);
    },
    onError: (err) => {
      const message = getServiceErrorMessage(err);
      if (getApiError(err).code === "VEHICLE_HAS_INCIDENTS" && onGoToIncidents) {
        toast.error(message, {
          action: { label: "Xem sự cố", onClick: onGoToIncidents },
        });
      } else {
        toast.error(message);
      }
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      setRemovingCv(undefined);
    },
  });

  const openAddLine = () => {
    setEditingLine(undefined);
    setLineDialogOpen(true);
  };

  const openEditLine = (line: LineItem) => {
    setEditingLine(line);
    setLineDialogOpen(true);
  };

  const renderLines = (lines: LineView[]) => (
    <div className="divide-y divide-border">
      {lines.map((line, index) => (
        <LineBlock
          key={line.id}
          line={line}
          index={index}
          canEdit={canEdit}
          canWriteLines={canWriteLines}
          canAssign={canAssign}
          onEditLine={() => openEditLine(line)}
          onDeleteLine={() => setDeletingLine(line)}
          onAssign={() => setAssigningLine(line)}
          onEditCv={setEditingCv}
          onRemoveCv={setRemovingCv}
          replacementIncidentCvIds={replacementIncidentCvIds}
          onReplaceCv={(cv) => {
            setReplacementTarget(cv);
            setAssigningLine(line);
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Dòng HĐ gốc ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="font-medium text-text-primary">
            Dịch vụ & xe
            {baseLines.length > 0 && (
              <span className="font-normal text-text-secondary"> ({baseLines.length} dòng)</span>
            )}
          </span>
          {canAddService && (
            <Button variant="outline" size="sm" onClick={() => openAddLine()} className="cursor-pointer">
              <Plus size={14} />
              Thêm dịch vụ
            </Button>
          )}
        </div>

        {canEdit && !isActive && (
          <div className="flex gap-2 border-b border-border bg-warning-light px-5 py-2.5 text-[length:var(--fs-sm)] text-warning">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Hợp đồng không còn hiệu lực: không thêm / sửa / xóa dòng hay gán / gỡ xe được, không đổi được ngày xuất
              bãi và số ngày làm. Vẫn sửa được ghi chú của lần giao xe.
              {unreturned.length > 0 &&
                ` Còn ${unreturned.length} xe chưa trả — mở trang xe và đổi trạng thái về Trong bãi để ghi ngày trả.`}
            </p>
          </div>
        )}

        {baseLines.length === 0 ? (
          <EmptyState
            title="Chưa có dịch vụ nào"
            description={
              canAddService
                ? "Thêm dịch vụ từ danh mục để bắt đầu lập dòng và gán xe."
                : canWriteLines
                  ? "Bạn không có quyền xem danh mục dịch vụ nên chưa thể thêm dòng."
                  : undefined
            }
            action={
              canAddService ? (
                <Button size="sm" onClick={() => openAddLine()} className="cursor-pointer">
                  <Plus size={14} />
                  Thêm dịch vụ
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {renderLines(baseLines)}
            {/* Tổng tiền do BE tính, chỉ gồm dòng HĐ gốc — không cộng lại ở FE */}
            <TotalsFooter
              label="Tổng cộng"
              subtotal={contract.subtotal}
              taxAmount={contract.taxAmount}
              totalAmount={contract.totalAmount}
            />
          </>
        )}
      </div>

      <LineItemDialog
        open={lineDialogOpen}
        onOpenChange={(v) => {
          setLineDialogOpen(v);
          if (!v) setEditingLine(undefined);
        }}
        contractId={contractId}
        editItem={editingLine}
      />

      <AssignVehicleDialog
        contractId={contractId}
        line={assigningLine}
        excludeVehicleIds={unreturned.map((v) => v.vehicle.id)}
        replaces={replacementTarget}
        onClose={() => {
          setAssigningLine(undefined);
          setReplacementTarget(undefined);
        }}
      />

      <EditDeploymentDialog
        contractId={contractId}
        editItem={editingCv}
        canSwap={canAssign}
        isContractActive={isActive}
        onClose={() => setEditingCv(undefined)}
      />

      <ConfirmModal
        open={!!deletingLine}
        onOpenChange={(v) => {
          if (!v) setDeletingLine(undefined);
        }}
        title="Xóa dòng dịch vụ"
        description={
          deletingLine
            ? `Xác nhận xóa dòng “${deletingLine.service.name}”? Tổng tiền hợp đồng sẽ được tính lại.`
            : undefined
        }
        variant="danger"
        confirmLabel="Xóa"
        loading={deleteLineMutation.isPending}
        onConfirm={() => deletingLine && deleteLineMutation.mutate(deletingLine.id)}
      />

      <ConfirmModal
        open={!!removingCv}
        onOpenChange={(v) => {
          if (!v) setRemovingCv(undefined);
        }}
        title="Gỡ xe khỏi dòng dịch vụ"
        description={
          removingCv
            ? `Xác nhận gỡ xe ${removingCv.vehicle.model} · ${removingCv.vehicle.serialNumber} khỏi dòng dịch vụ này?`
            : undefined
        }
        variant="danger"
        confirmLabel="Gỡ xe"
        loading={removeVehicleMutation.isPending}
        onConfirm={() => removingCv && removeVehicleMutation.mutate(removingCv.id)}
      />
    </div>
  );
}
