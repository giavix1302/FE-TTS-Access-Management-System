import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  ChevronDown,
  CalendarDays,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  FileText,
} from "lucide-react";
import type { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ContractTab } from "./components/ContractTab";
import { AddendumsTab } from "./components/AddendumsTab";
import { AcceptanceTab } from "./components/AcceptanceTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { IncidentsTab } from "./components/IncidentsTab";
import {
  getContractById,
  getContractSummary,
  changeContractStatus,
} from "@/api/contracts.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatCurrency, formatDate } from "@/utils/format";
import { getContractStatusBadge } from "@/constants/contractStatus";
import { usePermission } from "@/hooks/usePermission";
import type {
  ContractDetail,
  ContractSummary,
  ContractStatus,
} from "@/types/contract.types";

// ─── Mock sub-data P2/P3 (các Tab Addendums/Acceptance/Invoices/Incidents — chưa connect BE) ──
export const MOCK_ADDENDUMS = [
  {
    id: 1,
    addendum_number: "01012026-01/PLHĐ/TTS-DOTHANH",
    addendum_type: "extension" as const,
    start_date: "2026-02-20",
    new_end_date: "2026-03-21",
    subtotal: 16363636,
    tax_amount: 1309091,
    total_amount: 17672727,
    content:
      "Gia hạn thêm 14 ngày do tiến độ thi công chưa hoàn thành. Hai bên đồng thuận kéo dài thời gian thuê.",
    document: {
      id: 2,
      doc_type: "addendum",
      file_name: "PLHD 01 DOTHANH 01042026 - 02.04.2026.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size_kb: 310,
      note: null,
      uploaded_at: "2026-02-19T14:00:00Z",
      sas_url:
        "https://giavixblob1302.blob.core.windows.net/documents/PLHD%2001%20DOTHANH%2001042026%20-%2002.04.2026.docx",
      sas_expires_at: "2026-12-31T23:59:59Z",
    },
    created_at: "2026-02-19T14:00:00Z",
    created_by: { id: 1, full_name: "Nguyễn Văn Admin" },
  },
  {
    id: 2,
    addendum_number: "01012026-02/PLHĐ/TTS-DOTHANH",
    addendum_type: "add_service" as const,
    start_date: null,
    new_end_date: null,
    subtotal: 3636364,
    tax_amount: 290909,
    total_amount: 3927273,
    content:
      "Bổ sung dịch vụ vệ sinh, bảo dưỡng định kỳ xe nâng tại công trường (2 lần/tháng).",
    document: null,
    created_at: "2026-01-20T10:00:00Z",
    created_by: { id: 1, full_name: "Nguyễn Văn Admin" },
  },
];

export const MOCK_ACCEPTANCE_RECORDS = [
  {
    id: 1,
    record_number: "BBNT-2026-001",
    record_date: "2026-02-05",
    actual_start_date: "2026-01-05",
    actual_end_date: "2026-02-04",
    subtotal: 29090909,
    tax_amount: 2327273,
    total_amount: 31418182,
    document: {
      id: 3,
      doc_type: "acceptance",
      file_name: "1775209939178-oflpcq.xlsx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      file_size_kb: 512,
      note: "Đã ký đầy đủ 2 bên",
      uploaded_at: "2026-02-06T08:00:00Z",
      sas_url:
        "https://giavixblob1302.blob.core.windows.net/documents/1775209939178-oflpcq.xlsx",
      sas_expires_at: "2026-12-31T23:59:59Z",
    },
    created_at: "2026-02-06T08:00:00Z",
    created_by: { id: 1, full_name: "Nguyễn Văn Admin" },
  },
];

export const MOCK_INVOICES = [
  {
    id: 1,
    invoice_number: "0001234",
    invoice_date: "2026-02-07",
    amount: 32400000,
    note: "Hóa đơn GTGT đợt 1 — tháng 01/2026",
    document: {
      id: 4,
      doc_type: "invoice",
      file_name: "3604019619-C26TTS121.pdf",
      mime_type: "application/pdf",
      file_size_kb: 280,
      note: null,
      uploaded_at: "2026-02-07T11:00:00Z",
      sas_url:
        "https://giavixblob1302.blob.core.windows.net/documents/3604019619-C26TTS121.pdf",
      sas_expires_at: "2026-12-31T23:59:59Z",
    },
    created_at: "2026-02-07T11:00:00Z",
    created_by: { id: 1, full_name: "Trần Thị Kế Toán" },
  },
  {
    id: 2,
    invoice_number: null,
    invoice_date: "2026-03-07",
    amount: 32400000,
    note: "Hóa đơn GTGT đợt 2 — tháng 02/2026 (chờ xuất trên MISA)",
    document: null,
    created_at: "2026-03-07T09:00:00Z",
    created_by: { id: 1, full_name: "Trần Thị Kế Toán" },
  },
];

export const MOCK_INCIDENTS = [
  {
    id: 1,
    contract_vehicle: {
      id: 1,
      vehicle: { id: 1, model: "AWP 20S", serial_number: "SN-2021-001" },
    },
    incident_date: "2026-01-20",
    incident_type: "breakdown" as const,
    description:
      "Xe AWP 20S bị hỏng bộ điều khiển điện tử, không nâng được sàn. Kỹ thuật viên đã kiểm tra và xác nhận cần thay linh kiện.",
    downtime_days: 2,
    cost_amount: 3500000,
    charged_to: "company" as const,
    replacement_contract_vehicle: null,
    resolved_at: "2026-01-22T16:00:00Z",
    created_at: "2026-01-20T14:00:00Z",
    created_by: { id: 2, full_name: "Lê Văn Kỹ Thuật" },
  },
  {
    id: 2,
    contract_vehicle: {
      id: 1,
      vehicle: { id: 1, model: "AWP 20S", serial_number: "SN-2021-001" },
    },
    incident_date: "2026-02-10",
    incident_type: "replacement" as const,
    description:
      "Xe AWP 20S bị hỏng nặng hệ thống thủy lực, không thể sửa tại chỗ. Thay thế bằng JLG 260MRT.",
    downtime_days: 1,
    cost_amount: null,
    charged_to: null,
    replacement_contract_vehicle: {
      id: 2,
      vehicle: { id: 2, model: "JLG 260MRT", serial_number: "SN-2022-002" },
    },
    resolved_at: "2026-02-11T08:00:00Z",
    created_at: "2026-02-10T10:00:00Z",
    created_by: { id: 2, full_name: "Lê Văn Kỹ Thuật" },
  },
  {
    id: 3,
    contract_vehicle: {
      id: 2,
      vehicle: { id: 2, model: "JLG 260MRT", serial_number: "SN-2022-002" },
    },
    incident_date: "2026-02-25",
    incident_type: "repair_onsite" as const,
    description:
      "Lốp xe JLG 260MRT bị thủng do đinh tại công trường. Thay lốp tại chỗ trong buổi sáng.",
    downtime_days: 0.5,
    cost_amount: 800000,
    charged_to: "customer" as const,
    replacement_contract_vehicle: null,
    resolved_at: "2026-02-25T12:00:00Z",
    created_at: "2026-02-25T08:30:00Z",
    created_by: { id: 2, full_name: "Lê Văn Kỹ Thuật" },
  },
];

// ─── SummaryCard ──────────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  sub,
  valueClass,
  Icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  Icon: React.ElementType;
  iconClass?: string;
}) {
  return (
    <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[length:var(--fs-sm)] font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </p>
        <Icon
          className={`h-4 w-4 lg:h-5 lg:w-5 shrink-0 ${iconClass ?? "text-primary"}`}
        />
      </div>
      <p
        className={`text-[length:var(--fs-display)] font-bold leading-none text-text-primary ${valueClass ?? ""}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[length:var(--fs-sm)] text-text-secondary">{sub}</p>
      )}
    </div>
  );
}

// ─── StatusChangeDropdown ─────────────────────────────────────────────────────
function StatusChangeDropdown({
  contract,
  contractId,
}: {
  contract: ContractDetail;
  contractId: number;
}) {
  const queryClient = useQueryClient();
  const [confirmType, setConfirmType] = useState<
    "complete" | "cancel" | "reopen" | null
  >(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const mutation = useMutation({
    mutationFn: (body: unknown) => changeContractStatus(contractId, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.contracts.detail(contractId),
      });
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.contracts.detail(contractId), "summary"],
      });
      toast.success("Đã cập nhật trạng thái hợp đồng");
      if (
        data?.warnings?.some(
          (w: { code: string }) => w.code === "VEHICLES_STILL_RENTING",
        )
      ) {
        toast.warning("Còn xe chưa trả — vui lòng cập nhật trạng thái xe");
      }
      setConfirmType(null);
      setReason("");
    },
    onError: (error: AxiosError<{ code: string; message: string }>) => {
      const code = error.response?.data?.code;
      const messages: Record<string, string> = {
        CONTRACT_NOT_ACTIVE: "Hợp đồng không ở trạng thái active",
        VEHICLES_STILL_RENTING:
          "Còn xe chưa trả — vui lòng cập nhật trạng thái xe",
      };
      toast.error(
        messages[code ?? ""] ??
          error.response?.data?.message ??
          "Có lỗi xảy ra",
      );
    },
  });

  const handleConfirm = () => {
    if (
      (confirmType === "cancel" || confirmType === "reopen") &&
      !reason.trim()
    ) {
      setReasonError("Bắt buộc nhập lý do");
      return;
    }
    const body =
      confirmType === "complete"
        ? { status: "completed" }
        : confirmType === "cancel"
          ? { status: "cancelled", reason }
          : { status: "active", reopenReason: reason };
    mutation.mutate(body);
  };

  if (contract.status === "cancelled") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="flex-1 sm:flex-none"
      >
        <ChevronDown size={14} />
        Đổi trạng thái
      </Button>
    );
  }

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
          {contract.status === "active" && (
            <>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setConfirmType("complete")}
              >
                Hoàn thành hợp đồng
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-error focus:text-error"
                onClick={() => setConfirmType("cancel")}
              >
                Hủy hợp đồng
              </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete — simple confirm */}
      <ConfirmModal
        open={confirmType === "complete"}
        onOpenChange={(v) => {
          if (!v) setConfirmType(null);
        }}
        title="Hoàn thành hợp đồng"
        description="Xác nhận đánh dấu hợp đồng này là hoàn thành?"
        variant="primary"
        confirmLabel="Hoàn thành"
        loading={mutation.isPending}
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
            <div className="space-y-2">
              <Label>
                {confirmType === "cancel" ? "Lý do hủy" : "Lý do mở lại"}
                <span className="text-error"> *</span>
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
              disabled={mutation.isPending}
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

  const [activeTab, setActiveTab] = useState("contract");

  const { data: contractRes, isLoading } = useQuery({
    queryKey: QUERY_KEYS.contracts.detail(contractId),
    queryFn: () => getContractById(contractId),
    enabled: !Number.isNaN(contractId),
  });
  const { data: summaryRes } = useQuery({
    queryKey: [...QUERY_KEYS.contracts.detail(contractId), "summary"],
    queryFn: () => getContractSummary(contractId),
    enabled: !Number.isNaN(contractId),
  });

  const contract: ContractDetail | undefined = contractRes?.data;
  const summary: ContractSummary | undefined = summaryRes?.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
        </div>
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

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate("/contracts")}
        className="flex items-center gap-1.5 text-[length:var(--fs-base)] text-text-secondary hover:text-primary hover:bg-primary-light transition-colors w-fit cursor-pointer px-3 py-1.5 rounded-md"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách hợp đồng
      </button>

      {/* Header card */}
      <div className="bg-bg-card rounded-lg border border-border shadow-card p-5 mt-2">
        {/* Title row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h1 className="font-mono font-bold text-base text-text-primary leading-tight">
            {contract.contractNumber}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
        </div>

        <Separator className="mb-4" />

        {/* Customer info grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <div className="col-span-2">
            <p className="text-xs text-text-secondary">Khách hàng</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {contract.customer.customerType === "business" ? (
                <Building2 size={13} className="text-text-secondary shrink-0" />
              ) : (
                <User size={13} className="text-text-secondary shrink-0" />
              )}
              <p className="text-sm font-medium text-text-primary">
                {contract.customer.displayName}
              </p>
            </div>
          </div>

          {contract.customer.customerType === "business" &&
            contract.customer.taxCode && (
              <div>
                <p className="text-xs text-text-secondary">Mã số thuế</p>
                <p className="text-sm font-medium text-text-primary">
                  {contract.customer.taxCode}
                </p>
              </div>
            )}

          {contract.customer.customerType === "business" &&
            contract.customer.representative && (
              <div>
                <p className="text-xs text-text-secondary">Người đại diện</p>
                <p className="text-sm font-medium text-text-primary">
                  {contract.customer.representative}
                </p>
              </div>
            )}

          {contract.customer.phone && (
            <div>
              <p className="text-xs text-text-secondary">Điện thoại</p>
              <p className="text-sm font-medium text-text-primary">
                {contract.customer.phone}
              </p>
            </div>
          )}

          {contract.customer.email && (
            <div>
              <p className="text-xs text-text-secondary">Email</p>
              <p className="text-sm font-medium text-text-primary break-all">
                {contract.customer.email}
              </p>
            </div>
          )}

          {contract.customer.customerType === "business" &&
            contract.customer.officeAddress && (
              <div className="col-span-2">
                <p className="text-xs text-text-secondary">Địa chỉ văn phòng</p>
                <p className="text-sm font-medium text-text-primary">
                  {contract.customer.officeAddress}
                </p>
              </div>
            )}

          {contract.customer.customerType === "individual" &&
            contract.customer.permanentAddress && (
              <div className="col-span-2">
                <p className="text-xs text-text-secondary">
                  Địa chỉ thường trú
                </p>
                <p className="text-sm font-medium text-text-primary">
                  {contract.customer.permanentAddress}
                </p>
              </div>
            )}
        </div>

        {/* Row actions */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            <StatusChangeDropdown contract={contract} contractId={contractId} />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {!summary ? (
          Array(4)
            .fill(0)
            .map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
        ) : (
          <>
            <SummaryCard
              Icon={CalendarDays}
              iconClass="text-primary"
              label="Kế hoạch"
              value={`${contract.plannedDays} ngày`}
              sub={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`}
            />
            <SummaryCard
              Icon={DollarSign}
              iconClass="text-text-secondary"
              label="Phải thanh toán"
              value={formatCurrency(summary.amountPayable)}
              sub={`${summary.invoiceCount} hóa đơn`}
            />
            <SummaryCard
              Icon={CheckCircle2}
              iconClass="text-success"
              label="Đã thanh toán"
              value={formatCurrency(summary.amountPaid)}
              valueClass="text-success"
              sub={
                summary.amountPaid > 0
                  ? `${Math.round((summary.amountPaid / summary.amountPayable) * 100)}% tổng giá trị`
                  : "—"
              }
            />
            <SummaryCard
              Icon={AlertCircle}
              iconClass={
                summary.amountRemaining > 0 ? "text-error" : "text-success"
              }
              label="Còn lại"
              value={formatCurrency(summary.amountRemaining)}
              valueClass={
                summary.amountRemaining > 0 ? "text-error" : "text-success"
              }
              sub={
                summary.amountRemaining > 0
                  ? "Chưa thanh toán đủ"
                  : "Đã thanh toán đủ"
              }
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1 overflow-x-auto">
          {[
            { value: "contract", label: "Hợp đồng" },
            {
              value: "addendums",
              label: "Phụ lục",
              count: summary?.addendum_count,
            },
            {
              value: "acceptance",
              label: "BBNT",
              count: summary?.acceptance_record_count,
            },
            {
              value: "invoices",
              label: "Hóa đơn",
              count: summary?.invoice_count,
            },
            { value: "incidents", label: "Sự cố" },
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

        <TabsContent value="contract">
          <ContractTab
            contract={contract}
            contractId={contractId}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="addendums">
          <AddendumsTab
            contractId={contractId}
            contractStatus={contract.status}
            canEdit={canEdit}
            initialData={MOCK_ADDENDUMS}
          />
        </TabsContent>
        <TabsContent value="acceptance">
          <AcceptanceTab
            contractId={contractId}
            canEdit={canEdit}
            initialData={MOCK_ACCEPTANCE_RECORDS}
          />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab
            contractId={contractId}
            summary={summary}
            canEdit={canEdit}
            initialData={MOCK_INVOICES}
          />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentsTab
            contractId={contractId}
            contractStatus={contract.status}
            contractVehicles={contract.vehicles}
            canEdit={canEdit}
            initialData={MOCK_INCIDENTS}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
