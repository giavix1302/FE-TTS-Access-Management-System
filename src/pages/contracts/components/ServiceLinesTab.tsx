import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { removeContractVehicle, deleteLineItem, getAddendums, getIncidents } from "@/api/contracts.api";
import { getVehicleStatusBadge } from "@/constants/vehicleStatus";
import { getServiceErrorMessage } from "@/constants/serviceErrors";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { getApiError } from "@/utils/apiError";
import { buildLineViews, splitLinesByAddendum, type LineView } from "@/utils/contractLines";
import { formatCurrency, formatDate, toDateOnly } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { LineItemDialog } from "./LineItemDialog";
import { AssignVehicleDialog } from "./AssignVehicleDialog";
import { EditDeploymentDialog } from "./EditDeploymentDialog";
import type { Addendum, ContractDetail, ContractVehicle, LineItem } from "@/types/contract.types";

const ICON_BTN = "h-8 w-8 cursor-pointer p-0";
const SUB_LABEL = "text-[length:var(--fs-xs)] font-medium uppercase tracking-wide text-text-secondary";

// Nút bị disable không bắn hover → bọc span để vẫn hiện lý do
function WithReason({ reason, children }: { reason?: string; children: React.ReactNode }) {
  return (
    <span title={reason} className="inline-flex">
      {children}
    </span>
  );
}

interface DeploymentRowProps {
  cv: ContractVehicle;
  isCurrent: boolean;
  /** contracts.update — sửa ngày được ở MỌI trạng thái HĐ */
  canEditDates: boolean;
  /** HĐ active + contracts.update */
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onReplace?: () => void;
}

// Một ô thông số ở chân card xe
function DeploymentStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <p className="text-[length:var(--fs-xs)] uppercase tracking-wide text-text-secondary">{label}</p>
      <div className="mt-0.5 text-[length:var(--fs-base)] font-medium">{children}</div>
    </div>
  );
}

// Card 1 lần giao xe: đầu card = xe + trạng thái xe + thao tác; chân card = xuất bãi / trả xe / số ngày làm
function DeploymentRow({ cv, isCurrent, canEditDates, canRemove, onEdit, onRemove, onReplace }: DeploymentRowProps) {
  const badge = getVehicleStatusBadge(cv.vehicle.status);
  // Gỡ chỉ được khi chưa xuất bãi (và chưa có sự cố — BE kiểm tra)
  const removeBlocked = !!cv.deployDate;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        isCurrent ? "border-primary/30 bg-bg-card" : "border-border bg-bg-page",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isCurrent ? "bg-primary-light text-primary" : "bg-bg-card text-text-secondary",
          )}
        >
          <Truck size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/vehicles/${cv.vehicle.id}`}
            className="block truncate text-[length:var(--fs-base)] font-semibold text-text-primary hover:text-primary hover:underline"
          >
            {cv.vehicle.model}
          </Link>
          <p className="truncate text-[length:var(--fs-sm)] text-text-secondary">{cv.vehicle.serialNumber}</p>
          {cv.replacesContractVehicleId != null && (
            <p className="text-[length:var(--fs-xs)] text-warning">Xe thay thế cho lần giao #{cv.replacesContractVehicleId}</p>
          )}
          {cv.note && <p className="truncate text-[length:var(--fs-xs)] text-text-secondary">{cv.note}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[length:var(--fs-sm)] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
        {(canEditDates || canRemove) && (
          <div className="flex shrink-0 items-center gap-0.5">
            {canEditDates && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className={ICON_BTN}
                title="Sửa ngày xuất bãi / trả xe / số ngày làm"
              >
                <Pencil size={14} />
              </Button>
            )}
            {canRemove && (
              <WithReason
                reason={
                  removeBlocked
                    ? "Xe đã xuất bãi, không thể gỡ. Muốn kết thúc hãy ghi ngày trả"
                    : "Gỡ xe khỏi dòng dịch vụ"
                }
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeBlocked}
                  onClick={onRemove}
                  className={cn(ICON_BTN, "hover:bg-error hover:text-white")}
                >
                  <Trash2 size={14} />
                </Button>
              </WithReason>
            )}
          </div>
        )}
        {onReplace && (
          <Button variant="outline" size="sm" onClick={onReplace} className="cursor-pointer">
            Gán xe thay thế
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <DeploymentStat label="Xuất bãi">
          {cv.deployDate ? (
            <span className="text-text-primary">{formatDate(toDateOnly(cv.deployDate))}</span>
          ) : (
            <span className="text-text-secondary">Chưa xuất</span>
          )}
        </DeploymentStat>
        <DeploymentStat label="Trả xe">
          {cv.returnDate ? (
            <span className="text-success">{formatDate(toDateOnly(cv.returnDate))}</span>
          ) : (
            <span className="text-warning">Chưa trả</span>
          )}
        </DeploymentStat>
        <DeploymentStat label="Số ngày làm">
          {/* Gán xe mới luôn có workDays = 0 → nhắc nhập (endDate HĐ tính từ max workDays) */}
          {cv.workDays > 0 ? (
            <span className="text-text-primary">{cv.workDays} ngày</span>
          ) : canEditDates ? (
            <button
              type="button"
              onClick={onEdit}
              className="cursor-pointer text-warning underline-offset-2 hover:underline"
            >
              Nhập ngay
            </button>
          ) : (
            <span className="text-warning">Chưa nhập</span>
          )}
        </DeploymentStat>
      </div>
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
  replaceableVehicleIds: Set<number>;
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
  replaceableVehicleIds,
}: LineBlockProps) {
  const hasVehicles = line.deployments.length > 0;
  const deleteReason = line.deployments.some((d) => d.deployDate)
    ? "Dòng đã có xe xuất bãi, không thể xóa"
    : "Dòng đã có xe, gỡ xe trước";
  const currentIds = new Set(line.currentDeployments.map((d) => d.id));
  const history = line.deployments.filter((d) => !currentIds.has(d.id));

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[length:var(--fs-base)] font-medium text-text-primary">
            {index + 1}. {line.service.name}{" "}
            <span className="font-normal text-text-secondary">({line.unit})</span>
          </p>
          <p className="mt-0.5 text-[length:var(--fs-sm)] text-text-secondary">
            {formatCurrency(line.unitPrice)}/{line.unit} × {line.quantity} {line.unit}
            {line.duration != null ? ` × ${line.duration}` : ""}
          </p>
          {line.note && (
            <p className="mt-0.5 whitespace-pre-line text-[length:var(--fs-sm)] italic text-text-secondary">
              {line.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:items-end">
          <span className="text-[length:var(--fs-base)] font-semibold text-text-primary">
            {formatCurrency(line.lineTotal)}
          </span>
          {canWriteLines && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditLine}
                className={ICON_BTN}
                title="Sửa đơn giá / số lượng / ghi chú"
              >
                <Pencil size={14} />
              </Button>
              <WithReason reason={hasVehicles ? deleteReason : "Xóa dòng dịch vụ"}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={hasVehicles}
                  onClick={onDeleteLine}
                  className={cn(ICON_BTN, "hover:bg-error hover:text-white")}
                >
                  <Trash2 size={14} />
                </Button>
              </WithReason>
            </div>
          )}
        </div>
      </div>

      {/* Xe của dòng: hiện tại trước, lịch sử sau (theo id tăng dần) */}
      {line.currentDeployments.length > 0 && (
        <div className="space-y-1.5">
          <p className={SUB_LABEL}>Xe hiện tại ({line.currentDeployments.length}/{line.quantity})</p>
          {line.currentDeployments.map((cv) => (
            <DeploymentRow
              key={cv.id}
              cv={cv}
              isCurrent
              canEditDates={canEdit}
              canRemove={canWriteLines}
              onEdit={() => onEditCv(cv)}
              onRemove={() => onRemoveCv(cv)}
              onReplace={
                canAssign &&
                line.service.allowVehicle &&
                line.currentDeployments.length < line.quantity &&
                replaceableVehicleIds.has(cv.id)
                  ? () => onReplaceCv(cv)
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className={SUB_LABEL}>Đã giao trước đó</p>
          {history.map((cv) => (
            <DeploymentRow
              key={cv.id}
              cv={cv}
              isCurrent={false}
              canEditDates={canEdit}
              canRemove={canWriteLines}
              onEdit={() => onEditCv(cv)}
              onRemove={() => onRemoveCv(cv)}
            />
          ))}
        </div>
      )}

      {/* allowVehicle = true mà chưa gán xe lần nào → nhắc. allowVehicle = false (vận chuyển,
          nhân công…) thì ẩn hẳn vùng xe, không hiện "—" gây hiểu nhầm là còn thiếu xe.
          Dòng đã có xe dù cờ bị tắt sau đó: vẫn hiện xe đã gán ở trên (sửa ngày / ghi trả) */}
      {line.service.allowVehicle && !hasVehicles && (
        <p className="text-[length:var(--fs-sm)] text-text-secondary">Chưa gán xe</p>
      )}

      {/* Mỗi dòng có tối đa quantity xe chưa trả.
          Cờ allowVehicle tra LIVE từ danh mục (có sẵn trong detail, staff vẫn dùng được);
          không đoán theo tên dịch vụ. Cờ tắt → chặn cả gán xe thay thế */}
      {canAssign && line.service.allowVehicle && line.currentDeployments.length < line.quantity && (
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
        <span className="text-[length:var(--fs-title)] font-bold text-primary">
          {formatCurrency(totalAmount)}
        </span>
      </div>
    </div>
  );
}

interface AddendumGroup {
  id: number;
  addendum?: Addendum;
  lines: LineView[];
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

  const isActive = contract.status === "active";
  const canWriteLines = canEdit && isActive;
  // Thêm dòng cần CẢ contracts.update lẫn service_catalog.view (lấy danh sách để chọn)
  const canAddService = canWriteLines && hasPermission("service_catalog.view");
  // Picker xe gọi GET /vehicles → cần vehicles.view
  const canAssign = canWriteLines && hasPermission("vehicles.view");

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<LineItem | undefined>();
  // Thêm dòng vào phụ lục nào (undefined = HĐ gốc)
  const [addingToAddendum, setAddingToAddendum] = useState<Addendum | undefined>();
  const [deletingLine, setDeletingLine] = useState<LineView | undefined>();
  const [assigningLine, setAssigningLine] = useState<LineView | undefined>();
  const [replacementTarget, setReplacementTarget] = useState<ContractVehicle | undefined>();
  const [editingCv, setEditingCv] = useState<ContractVehicle | undefined>();
  const [removingCv, setRemovingCv] = useState<ContractVehicle | undefined>();

  // Cùng key với tab Phụ lục → dùng chung cache. Cần để lấy số phụ lục + tiền phụ lục (BE tự tính)
  const { data: addendumsRes } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), "addendums"],
    queryFn: () => getAddendums(contractId),
  });
  const { data: incidentsRes } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), "incidents"],
    queryFn: () => getIncidents(contractId),
  });

  const replaceableVehicleIds = useMemo(() => {
    const withReplacementIncident = new Set(
      (incidentsRes?.data ?? [])
        .filter((incident) => incident.incidentType === "replacement")
        .map((incident) => incident.contractVehicle.id),
    );
    const alreadyReplaced = new Set(
      contract.vehicles
        .map((vehicle) => vehicle.replacesContractVehicleId)
        .filter((id): id is number => id != null),
    );
    return new Set(
      contract.vehicles
        .filter((vehicle) => vehicle.returnDate && withReplacementIncident.has(vehicle.id) && !alreadyReplaced.has(vehicle.id))
        .map((vehicle) => vehicle.id),
    );
  }, [contract.vehicles, incidentsRes]);

  // lineItems gồm cả dòng gốc lẫn dòng phụ lục → tách nhóm theo addendumId
  const { baseLines, addendumGroups } = useMemo(() => {
    const { base, byAddendum } = splitLinesByAddendum(
      buildLineViews(contract.lineItems, contract.vehicles),
    );
    const addendums = addendumsRes?.data ?? [];
    const groups: AddendumGroup[] = addendums.map((a) => ({
      id: a.id,
      addendum: a,
      lines: byAddendum.get(a.id) ?? [],
    }));
    // Dòng của phụ lục chưa có trong danh sách (list chưa tải xong / lệch cache) → vẫn hiện
    byAddendum.forEach((lines, id) => {
      if (!addendums.some((a) => a.id === id)) groups.push({ id, lines });
    });
    return { baseLines: base, addendumGroups: groups };
  }, [contract.lineItems, contract.vehicles, addendumsRes]);

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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
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
        toast.error(message, { action: { label: "Xem sự cố", onClick: onGoToIncidents } });
      } else {
        toast.error(message);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
      setRemovingCv(undefined);
    },
  });

  const openAddLine = (addendum?: Addendum) => {
    setEditingLine(undefined);
    setAddingToAddendum(addendum);
    setLineDialogOpen(true);
  };

  const openEditLine = (line: LineItem) => {
    setEditingLine(line);
    setAddingToAddendum(undefined);
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
          replaceableVehicleIds={replaceableVehicleIds}
          onReplaceCv={(cv) => {
            setReplacementTarget(cv);
            setAssigningLine(line);
          }}
        />
      ))}
    </div>
  );

  const hasAddendums = addendumGroups.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Dòng HĐ gốc ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="font-medium text-text-primary">
            {hasAddendums ? "Hợp đồng gốc" : "Dịch vụ & xe"}
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
              Hợp đồng không còn hiệu lực: không thêm / sửa / xóa dòng hay gán / gỡ xe được. Vẫn sửa
              được ngày xuất bãi, ngày trả và số ngày làm.
              {unreturned.length > 0 &&
                ` Còn ${unreturned.length} xe chưa trả — đổi trạng thái xe sẽ không tự ghi ngày trả vì hợp đồng đã đóng, hãy ghi ngày trả thủ công.`}
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
              label={hasAddendums ? "Tổng HĐ gốc" : "Tổng cộng"}
              subtotal={contract.subtotal}
              taxAmount={contract.taxAmount}
              totalAmount={contract.totalAmount}
            />
          </>
        )}
      </div>

      {/* ── Dòng theo từng phụ lục ── */}
      {addendumGroups.map((group) => (
        <div key={group.id} className="overflow-hidden rounded-lg border border-border bg-bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <span className="font-medium text-text-primary">
              Phụ lục{" "}
              <span className="font-mono">{group.addendum?.addendumNumber || `#${group.id}`}</span>
              {group.lines.length > 0 && (
                <span className="font-normal text-text-secondary"> ({group.lines.length} dòng)</span>
              )}
            </span>
            {canAddService && group.addendum && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddLine(group.addendum)}
                className="cursor-pointer"
              >
                <Plus size={14} />
                Thêm dịch vụ
              </Button>
            )}
          </div>

          {group.lines.length === 0 ? (
            <p className="px-5 py-4 text-[length:var(--fs-sm)] text-text-secondary">
              Phụ lục chưa có dòng dịch vụ nào.
            </p>
          ) : (
            <>
              {renderLines(group.lines)}
              {/* Tiền phụ lục BE tự tính từ các dòng của phụ lục */}
              {group.addendum && (
                <TotalsFooter
                  label="Tổng phụ lục"
                  subtotal={group.addendum.subtotal}
                  taxAmount={group.addendum.taxAmount}
                  totalAmount={group.addendum.totalAmount}
                />
              )}
            </>
          )}
        </div>
      ))}

      <LineItemDialog
        open={lineDialogOpen}
        onOpenChange={(v) => {
          setLineDialogOpen(v);
          if (!v) {
            setEditingLine(undefined);
            setAddingToAddendum(undefined);
          }
        }}
        contractId={contractId}
        addendum={addingToAddendum}
        editItem={editingLine}
      />

      <AssignVehicleDialog
        contractId={contractId}
        line={assigningLine}
        excludeVehicleIds={unreturned.map((v) => v.vehicle.id)}
        replacesContractVehicleId={replacementTarget?.id}
        onClose={() => {
          setAssigningLine(undefined);
          setReplacementTarget(undefined);
        }}
      />

      <EditDeploymentDialog
        contractId={contractId}
        editItem={editingCv}
        canSwap={canAssign}
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
            ? `Xác nhận xóa dòng “${deletingLine.service.name}”? Tổng tiền ${deletingLine.addendumId != null ? "phụ lục" : "hợp đồng"} sẽ được tính lại.`
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
