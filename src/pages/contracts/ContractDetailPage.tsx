import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Building2, ChevronDown, FileText, MapPin, User } from "lucide-react";
import type { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
} from "@/components/shared/MobileSheet";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ContractExpiredChip } from "./components/ContractExpiredChip";
import { ContractTab } from "./components/ContractTab";
import { ServiceLinesTab } from "./components/ServiceLinesTab";
import { AddendumsTab } from "./components/AddendumsTab";
import { AcceptanceTab } from "./components/AcceptanceTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { IncidentsTab } from "./components/IncidentsTab";
import { ContractHistoryTab } from "./components/ContractHistoryTab";
import {
  getContractById,
  getContractSummary,
  changeContractStatus,
} from "@/api/contracts.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { getContractStatusBadge, isContractOpen } from "@/constants/contractStatus";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";
import { isConcurrentUpdateError } from "@/utils/apiError";
import { usePermission } from "@/hooks/usePermission";
import type {
  ContractDetail,
  ContractSummary,
} from "@/types/contract.types";

// ─── StatusChangeDropdown ─────────────────────────────────────────────────────
function StatusChangeDropdown({
  contract,
  contractId,
  canCancel,
}: {
  contract: ContractDetail;
  contractId: number;
  canCancel: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirmType, setConfirmType] = useState<
    "complete" | "cancel" | "reopen" | null
  >(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const mutation = useMutation({
    mutationFn: (body: { status: ContractDetail['status']; reason?: string; reopenReason?: string }) =>
      changeContractStatus(contractId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.all });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.contracts.detail(contractId), "summary"],
      });
      toast.success("Đã cập nhật trạng thái hợp đồng");
      setConfirmType(null);
      setReason("");
    },
    onError: (error: AxiosError<{ error?: { code: string; message: string } }>) => {
      const code = error.response?.data?.error?.code;
      // Message BE liệt kê số serial các xe chưa trả; HĐ giữ nguyên
      if (code === "VEHICLES_STILL_RENTING") {
        toast.error(error.response?.data?.error?.message ?? "Còn xe chưa trả về bãi");
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
        setConfirmType(null);
        setReason("");
        return;
      }
      const messages: Record<string, string> = {
        CONTRACT_NOT_ACTIVE: "Hợp đồng không ở trạng thái active",
        INVALID_STATUS_TRANSITION: "Không thể chuyển sang trạng thái này",
        REASON_REQUIRED: "Vui lòng nhập lý do hủy",
        REOPEN_REASON_REQUIRED: "Vui lòng nhập lý do mở lại",
      };
      toast.error(
        messages[code ?? ""] ??
          error.response?.data?.error?.message ??
          "Có lỗi xảy ra",
      );
      // Người khác vừa đổi trạng thái → đóng để xem trạng thái mới rồi mới chọn lại.
      // CONCURRENT_UPDATE đã được main.tsx tải lại; INVALID_STATUS_TRANSITION (đọc sau khi bên kia commit) thì chưa
      const isTransitionStale = code === "INVALID_STATUS_TRANSITION";
      if (isTransitionStale) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
      }
      if (isTransitionStale || isConcurrentUpdateError(error)) {
        setConfirmType(null);
        setReason("");
      }
    },
  });

  // Đóng HĐ: BE tự gỡ các lần giao chưa xuất bãi, mở lại không khôi phục (docs-04112026.md §11)
  const undeployedCount = contract.vehicles.filter((v) => !v.deployDate && !v.returnDate).length;
  const closeWarning =
    undeployedCount > 0
      ? `Có ${undeployedCount} xe chưa xuất bãi sẽ bị gỡ khỏi hợp đồng khi đóng. Mở lại hợp đồng không khôi phục, phải gán lại xe.`
      : undefined;

  // Xe đã xuất mà chưa trả (kể cả xe đã có xe thay) → BE trả 409 VEHICLES_STILL_RENTING nên báo và chặn trước.
  // Dữ liệu có thể cũ nên vẫn giữ xử lý 409 ở trên
  const rentingVehicles = contract.vehicles.filter((v) => !!v.deployDate && !v.returnDate);
  const closeBlocked = rentingVehicles.length > 0;

  const openCloseConfirm = (type: "complete" | "cancel") => {
    setConfirmType(type);
    // Tải lại để không chặn nhầm khi xe vừa được trả ở màn khác
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contracts.detail(contractId) });
  };

  const stillRentingWarning = (
    <div className="flex gap-2 rounded-md bg-warning-light px-3 py-2.5 text-[length:var(--fs-sm)] text-text-primary">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="font-medium">Còn {rentingVehicles.length} xe chưa trả về bãi:</p>
        <ul className="mt-1 space-y-0.5">
          {rentingVehicles.map((v) => (
            <li key={v.id} className="break-words">
              {v.vehicle.model} · {v.vehicle.serialNumber}
            </li>
          ))}
        </ul>
        <p className="mt-1">Cần trả hết xe về bãi rồi mới đóng được hợp đồng.</p>
      </div>
    </div>
  );

  const handleConfirm = () => {
    if (
      (confirmType === "cancel" || (confirmType === "reopen" && contract.status === "completed")) &&
      !reason.trim()
    ) {
      setReasonError("Bắt buộc nhập lý do");
      return;
    }
    const body: { status: ContractDetail['status']; reason?: string; reopenReason?: string } =
      confirmType === "complete"
        ? { status: "completed" }
        : confirmType === "cancel"
          ? { status: "cancelled", reason }
          : { status: "active", reopenReason: reason };
    mutation.mutate(body);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer flex-1 sm:flex-none"
          >
            <ChevronDown size={14} />
            Đổi trạng thái
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isContractOpen(contract.status) && (
            <>
              {/* Chưa bắt đầu: chỉ được Hủy, không Hoàn thành */}
              {contract.status === "active" && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => openCloseConfirm("complete")}
                >
                  Hoàn thành hợp đồng
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem
                  className="cursor-pointer text-error focus:text-error"
                  onClick={() => openCloseConfirm("cancel")}
                >
                  Hủy hợp đồng
                </DropdownMenuItem>
              )}
            </>
          )}
          {contract.status === "completed" && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setConfirmType("reopen")}
            >
              Mở lại hợp đồng (Reopen)
            </DropdownMenuItem>
          )}
          {contract.status === "cancelled" && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setConfirmType("reopen")}
            >
              Mở lại hợp đồng
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete — simple confirm */}
      <ConfirmModal
        open={confirmType === "complete"}
        onOpenChange={(v) => {
          if (!v) setConfirmType(null);
        }}
        title="Hoàn thành hợp đồng"
        description={
          closeBlocked
            ? "Chưa thể hoàn thành hợp đồng này."
            : `Xác nhận đánh dấu hợp đồng này là hoàn thành?${closeWarning ? ` ${closeWarning}` : ""}`
        }
        customContent={closeBlocked ? stillRentingWarning : undefined}
        variant="primary"
        confirmLabel="Hoàn thành"
        loading={mutation.isPending}
        confirmDisabled={closeBlocked}
        onConfirm={handleConfirm}
      />

      {/* Cancel / Reopen — with reason textarea */}
      <MobileSheetDialog
        open={confirmType === "cancel" || confirmType === "reopen"}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmType(null);
            setReason("");
            setReasonError("");
          }
        }}
      >
        <MobileSheetContent mobileVariant="sheet" className="sm:max-w-md">
          <MobileSheetHeader>
            <MobileSheetTitle>
              {confirmType === "cancel" ? "Hủy hợp đồng" : "Mở lại hợp đồng"}
            </MobileSheetTitle>
          </MobileSheetHeader>
          <MobileSheetBody>
            {confirmType === "cancel" && closeBlocked && stillRentingWarning}
            {confirmType === "cancel" && !closeBlocked && closeWarning && (
              <p className="rounded-md bg-warning-light px-3 py-2 text-[length:var(--fs-sm)] text-warning">
                {closeWarning}
              </p>
            )}
            {confirmType === "reopen" && (
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                Xe bị gỡ tự động khi đóng hợp đồng không được khôi phục, cần gán lại nếu vẫn dùng.
              </p>
            )}
            {!(confirmType === "cancel" && closeBlocked) && (
              <div className="space-y-2">
                <Label>
                  {confirmType === "cancel" ? "Lý do hủy" : "Lý do mở lại"}
                  {(confirmType === "cancel" || contract.status === "completed") && <span className="text-error"> *</span>}
                </Label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError("");
                  }}
                  placeholder="Nhập lý do..."
                />
                {reasonError && (
                  <p className="text-xs text-error">{reasonError}</p>
                )}
              </div>
            )}
          </MobileSheetBody>
          <MobileSheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmType(null);
                setReason("");
                setReasonError("");
              }}
              className="cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              variant={confirmType === "cancel" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={mutation.isPending || (confirmType === "cancel" && closeBlocked)}
              className="cursor-pointer"
            >
              {mutation.isPending
                ? "Đang xử lý..."
                : confirmType === "cancel"
                  ? "Hủy hợp đồng"
                  : "Mở lại"}
            </Button>
          </MobileSheetFooter>
        </MobileSheetContent>
      </MobileSheetDialog>
    </>
  );
}

// ─── ContractDetailPage ───────────────────────────────────────────────────────
export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contractId = Number(id);
  const { hasPermission } = usePermission();

  const canEdit = hasPermission("contracts.update");
  const canCancel = hasPermission("contracts.delete");
  const canFinance = hasPermission("contracts.finance");
  const canViewAudit = hasPermission("audit.view");
  const canViewCustomer = hasPermission("customers.view");

  const [activeTab, setActiveTab] = useState("contract");

  const { data: contractRes, isLoading } = useQuery({
    queryKey: QUERY_KEYS.contracts.detail(contractId),
    queryFn: () => getContractById(contractId),
    enabled: !Number.isNaN(contractId),
  });
  const { data: summaryRes } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), "summary"],
    queryFn: () => getContractSummary(contractId),
    enabled: !Number.isNaN(contractId) && canFinance,
  });

  const contract: ContractDetail | undefined = contractRes?.data;
  const summary: ContractSummary | undefined = summaryRes?.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16 text-text-secondary">
        Không tìm thấy hợp đồng
      </div>
    );
  }

  const { label: statusLabel, className: statusClass } = getContractStatusBadge(
    contract.status,
  );
  // GET /contracts/{id} không trả displayName (chỉ list có) → lấy theo loại khách
  const isBusiness = contract.customer.customerType === "business";
  const CustomerIcon = isBusiness ? Building2 : User;
  const customerName =
    (contract.customer.customerType === "business"
      ? contract.customer.internationalName
      : contract.customer.fullName) || "—";

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate("/contracts")}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary hover:bg-primary-light transition-colors w-fit cursor-pointer px-3 py-1.5 rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách hợp đồng
      </button>

      {/* ── Header card — cùng bố cục với CustomerDetailPage ── */}
      <div className="mt-2 rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: icon + info */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1 break-all text-[length:var(--fs-heading)] font-semibold text-text-primary">
                {contract.contractNumber || "Chưa có số HĐ"}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--fs-sm)] font-medium ${statusClass}`}
                >
                  {statusLabel}
                </span>
                <ContractExpiredChip isExpired={contract.isExpired} />
                {canViewCustomer ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/customers/${contract.customer.id}`)}
                    className="flex cursor-pointer items-center gap-1 text-[length:var(--fs-sm)] font-medium text-text-primary hover:text-primary hover:underline"
                  >
                    <CustomerIcon size={12} className="text-text-secondary" />
                    {customerName}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[length:var(--fs-sm)] font-medium text-text-primary">
                    <CustomerIcon size={12} className="text-text-secondary" />
                    {customerName}
                  </span>
                )}
                {contract.siteAddress && (
                  <span className="flex min-w-0 items-center gap-1 text-[length:var(--fs-sm)] text-text-secondary">
                    <MapPin size={12} className="shrink-0" />
                    <AppTooltip content={contract.siteAddress} onlyWhenTruncated>
                      <span className="truncate max-w-[360px]">
                        {contract.siteAddress}
                      </span>
                    </AppTooltip>
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-sm)] text-text-secondary">
                <span>
                  Thời gian:{" "}
                  <span className="font-medium text-text-primary">
                    {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                  </span>
                </span>
                <span>
                  Giá trị HĐ:{" "}
                  <span className="font-medium text-text-primary">
                    {formatCurrency(contract.totalAmount)}
                  </span>
                </span>
                <span>
                  Ngày tạo:{" "}
                  <span className="font-medium text-text-primary">
                    {formatDateTime(contract.createdAt)}
                  </span>
                  {contract.createdBy && ` · ${contract.createdBy.fullName}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions — mobile xuống dưới, border-t phân tách */}
          {/* Chưa bắt đầu chỉ có "Hủy" → không có quyền hủy thì khỏi hiện menu rỗng */}
          {canEdit && !(contract.status === "not_started" && !canCancel) && (
            <div className="flex items-center gap-2 border-t border-border pt-3 sm:shrink-0 sm:border-0 sm:pt-0">
              <StatusChangeDropdown
                contract={contract}
                contractId={contractId}
                canCancel={canCancel}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1 overflow-x-auto">
          {[
            { value: "contract", label: "Hợp đồng" },
            {
              value: "addendums",
              label: "Phụ lục",
              count: summary?.addendumCount,
            },
            ...(canFinance ? [{
              value: "acceptance",
              label: "BBNT",
              count: summary?.acceptanceRecordCount,
            },
            {
              value: "invoices",
              label: "Hóa đơn",
              count: summary?.invoiceCount,
            }] : []),
            { value: "incidents", label: "Sự cố" },
            ...(canViewAudit ? [{ value: "history", label: "Lịch sử" }] : []),
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-background data-[state=active]:shadow-sm text-text-secondary px-4 py-2.5 text-[length:var(--fs-base)] font-medium gap-1.5 cursor-pointer"
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-primary-light text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Hợp đồng: thông tin HĐ + dịch vụ & xe chia 50/50 (xl), xếp chồng ở màn nhỏ */}
        <TabsContent value="contract">
          <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <ContractTab
                contract={contract}
                contractId={contractId}
                canEdit={canEdit}
              />
            </div>
            <div className="min-w-0">
              <ServiceLinesTab
                contract={contract}
                contractId={contractId}
                canEdit={canEdit}
                onGoToIncidents={() => setActiveTab("incidents")}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="addendums">
          <AddendumsTab
            contractId={contractId}
            contractStatus={contract.status}
            contractStartDate={contract.startDate}
            canEdit={canEdit}
          />
        </TabsContent>
        {canFinance && <TabsContent value="acceptance">
          <AcceptanceTab
            contractId={contractId}
            canEdit={canFinance}
          />
        </TabsContent>}
        {canFinance && <TabsContent value="invoices">
          <InvoicesTab
            contractId={contractId}
            canEdit={canFinance}
          />
        </TabsContent>}
        <TabsContent value="incidents">
          <IncidentsTab
            contractId={contractId}
            contractStatus={contract.status}
            contractVehicles={contract.vehicles}
            canEdit={canEdit}
          />
        </TabsContent>
        {canViewAudit && (
          <TabsContent value="history">
            <ContractHistoryTab contractId={contractId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
