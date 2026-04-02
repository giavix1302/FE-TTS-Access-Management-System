import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import { Truck, FileText, Banknote, AlertCircle, CheckCircle2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
// import axiosInstance from "@/api/axios"

// ─── MOCK DATA (xóa khi backend sẵn sàng) ────────────────────────────────────
const MOCK_SUMMARY = {
  vehicles_renting: { renting: 8, total: 15 },
  contracts_active: { count: 11 },
  revenue_this_month: { amount: 87_360_000, month: "2026-03" },
  uninvoiced_debt: { amount: 42_480_000 },
}

const MOCK_CHARTS = {
  revenue_by_month: [
    { month: "2025-04", amount: 52_000_000 },
    { month: "2025-05", amount: 61_500_000 },
    { month: "2025-06", amount: 48_200_000 },
    { month: "2025-07", amount: 70_000_000 },
    { month: "2025-08", amount: 55_800_000 },
    { month: "2025-09", amount: 63_400_000 },
    { month: "2025-10", amount: 74_100_000 },
    { month: "2025-11", amount: 68_900_000 },
    { month: "2025-12", amount: 91_200_000 },
    { month: "2026-01", amount: 80_500_000 },
    { month: "2026-02", amount: 76_300_000 },
    { month: "2026-03", amount: 87_360_000 },
  ],
  top_customers_by_revenue: [
    { customer: { id: 2, display_name: "Công ty TNHH Đại Phong" }, amount: 310_320_000 },
    { customer: { id: 5, display_name: "Công ty CP Hưng Thịnh Phát" }, amount: 248_600_000 },
    { customer: { id: 1, display_name: "Công ty TNHH Minh Tiến" }, amount: 195_400_000 },
    { customer: { id: 8, display_name: "Công ty CP Vận Tải Nam Long" }, amount: 142_000_000 },
    { customer: { id: 3, display_name: "Công ty TNHH SX Bình Dương" }, amount: 98_750_000 },
  ],
}

const MOCK_ALERTS = {
  expiring_documents: [
    {
      vehicle: { id: 1, model: "AWP 20S", serial_number: "SN-2021-001" },
      document_type: "insurance" as const,
      expiry_date: "2026-04-05",
      days_remaining: 4,
    },
    {
      vehicle: { id: 3, model: "AWP 30S", serial_number: "SN-2022-003" },
      document_type: "inspection" as const,
      expiry_date: "2026-04-12",
      days_remaining: 11,
    },
    {
      vehicle: { id: 7, model: "AWP 16S", serial_number: "SN-2020-007" },
      document_type: "insurance" as const,
      expiry_date: "2026-03-28",
      days_remaining: -4,
    },
  ],
  expiring_contracts: [
    {
      id: 3,
      contract_number: "01122025/HĐTTB/TTS-DAIPHONG",
      customer: { id: 2, display_name: "Công ty TNHH Đại Phong" },
      end_date: "2026-04-05",
      days_remaining: 4,
    },
    {
      id: 7,
      contract_number: "03082025/HĐTTB/TTS-HUNGTHINHPHAT",
      customer: { id: 5, display_name: "Công ty CP Hưng Thịnh Phát" },
      end_date: "2026-04-14",
      days_remaining: 13,
    },
  ],
}
// ─── END MOCK DATA ────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardSummary {
  vehicles_renting: { renting: number; total: number }
  contracts_active: { count: number }
  revenue_this_month: { amount: number; month: string }
  uninvoiced_debt: { amount: number }
}

interface RevenueByMonth { month: string; amount: number }
interface TopCustomer { customer: { id: number; display_name: string }; amount: number }

interface ExpiringDocument {
  vehicle: { id: number; model: string; serial_number: string }
  document_type: "insurance" | "inspection"
  expiry_date: string
  days_remaining: number
}

interface ExpiringContract {
  id: number
  contract_number: string
  customer: { id: number; display_name: string }
  end_date: string
  days_remaining: number
}

interface DashboardCharts {
  revenue_by_month: RevenueByMonth[]
  top_customers_by_revenue: TopCustomer[]
}

interface DashboardAlerts {
  expiring_documents: ExpiringDocument[]
  expiring_contracts: ExpiringContract[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M₫`
  }
  return amount.toLocaleString("vi-VN") + "₫"
}

function formatCurrencyFull(amount: number): string {
  return amount.toLocaleString("vi-VN") + "₫"
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-")
  return `T${parseInt(month)}/${year.slice(2)}`
}

function getDaysChipClass(days: number): string {
  if (days < 0) return "bg-error-light text-error"
  if (days <= 7) return "bg-error-light text-error"
  if (days <= 15) return "bg-warning-light text-warning"
  return "bg-success-light text-success"
}

function getDaysLabel(days: number): string {
  if (days < 0) return "Đã hết hạn"
  return `Còn ${days} ngày`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <div className="bg-bg-card rounded-lg border border-border shadow-card p-4 flex flex-col gap-3">
      <Skeleton className="h-4 w-28 rounded" />
      <Skeleton className="h-8 w-20 rounded" />
      <Skeleton className="h-3 w-36 rounded" />
    </div>
  )
}

function EmptyAlert({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-success" />
      <p className="text-[14px] text-text-secondary">{label}</p>
    </div>
  )
}

// Custom tooltip cho Recharts
function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: RevenueByMonth }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const [year, month] = d.month.split("-")
  return (
    <div className="rounded-lg border border-border bg-bg-card px-3 py-2 shadow-card text-[13px]">
      <p className="font-medium text-text-primary">
        Tháng {parseInt(month)}/{year}
      </p>
      <p className="text-primary font-semibold">{formatCurrencyFull(d.amount)}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()

  const now = new Date()
  const subtitleMonth = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`

  // --- MOCK (thay bằng axiosInstance khi backend sẵn sàng) ---
  const summaryQuery = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => Promise.resolve(MOCK_SUMMARY),
    // queryFn: () => axiosInstance.get("/dashboard/summary").then(r => r.data.data[0]),
  })

  const chartsQuery = useQuery<DashboardCharts>({
    queryKey: ["dashboard", "charts"],
    queryFn: () => Promise.resolve(MOCK_CHARTS),
    // queryFn: () => axiosInstance.get("/dashboard/charts").then(r => r.data.data[0]),
  })

  const alertsQuery = useQuery<DashboardAlerts>({
    queryKey: ["dashboard", "alerts"],
    queryFn: () => Promise.resolve(MOCK_ALERTS),
    // queryFn: () => axiosInstance.get("/dashboard/alerts").then(r => r.data.data[0]),
    staleTime: 1000 * 30,
  })

  const summary = summaryQuery.data
  const charts = chartsQuery.data
  const alerts = alertsQuery.data

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Top customer max amount để tính % bar width
  const topCustomers = charts?.top_customers_by_revenue ?? []
  const maxCustomerAmount = topCustomers.length > 0
    ? Math.max(...topCustomers.map(c => c.amount))
    : 1

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      {/* Page title */}
      <div>
        <h1 className="text-[length:var(--fs-heading)] font-semibold text-text-primary leading-tight">Dashboard</h1>
        <p className="text-[length:var(--fs-nav)] text-text-secondary mt-1">
          Tổng quan hệ thống — Tháng {subtitleMonth}
        </p>
      </div>

      {/* ── Section 1: Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {summaryQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            {/* Card 1 — Xe đang cho thuê */}
            <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--fs-sm)] font-medium text-text-secondary uppercase tracking-wide">
                  Xe đang cho thuê
                </p>
                <Truck className="h-4 w-4 lg:h-5 lg:w-5 text-primary shrink-0" />
              </div>
              <p className="text-[length:var(--fs-display)] font-bold text-text-primary leading-none">
                {summary?.vehicles_renting.renting ?? 0}
                <span className="text-[length:var(--fs-title)] font-normal text-text-secondary ml-1">
                  / {summary?.vehicles_renting.total ?? 0}
                </span>
              </p>
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                {summary && summary.vehicles_renting.total > 0
                  ? `${Math.round((summary.vehicles_renting.renting / summary.vehicles_renting.total) * 100)}% đang hoạt động`
                  : "—"}
              </p>
            </div>

            {/* Card 2 — Hợp đồng hiệu lực */}
            <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--fs-sm)] font-medium text-text-secondary uppercase tracking-wide">
                  Hợp đồng hiệu lực
                </p>
                <FileText className="h-4 w-4 lg:h-5 lg:w-5 text-success shrink-0" />
              </div>
              <p className="text-[length:var(--fs-display)] font-bold text-text-primary leading-none">
                {summary?.contracts_active.count ?? 0}
              </p>
              <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[length:var(--fs-sm)] font-medium bg-success-light text-success">
                Đang hiệu lực
              </span>
            </div>

            {/* Card 3 — Doanh thu tháng này */}
            <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--fs-sm)] font-medium text-text-secondary uppercase tracking-wide">
                  Doanh thu tháng này
                </p>
                <Banknote className="h-4 w-4 lg:h-5 lg:w-5 text-success shrink-0" />
              </div>
              <p className="text-[length:var(--fs-display)] font-bold text-success leading-none">
                {summary ? formatCurrency(summary.revenue_this_month.amount) : "—"}
              </p>
              <p className="text-[length:var(--fs-sm)] text-text-secondary">
                {summary?.revenue_this_month.month
                  ? (() => {
                      const [y, m] = summary.revenue_this_month.month.split("-")
                      return `Tháng ${parseInt(m)}/${y}`
                    })()
                  : "—"}
              </p>
            </div>

            {/* Card 4 — Công nợ chưa xuất HĐ */}
            <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--fs-sm)] font-medium text-text-secondary uppercase tracking-wide">
                  Công nợ chưa xuất HĐ
                </p>
                <AlertCircle className="h-4 w-4 lg:h-5 lg:w-5 text-error shrink-0" />
              </div>
              <p
                className={`text-[length:var(--fs-display)] font-bold leading-none ${
                  (summary?.uninvoiced_debt.amount ?? 0) > 0 ? "text-error" : "text-text-primary"
                }`}
              >
                {summary ? formatCurrency(summary.uninvoiced_debt.amount) : "—"}
              </p>
              <p className="text-[length:var(--fs-sm)] text-text-secondary">Chưa xuất hoá đơn</p>
            </div>
          </>
        )}
      </div>

      {/* ── Section 2: Charts ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Chart trái — Bar chart doanh thu 12 tháng */}
        <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)]">
          <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
            Doanh thu 12 tháng gần nhất
          </p>
          {chartsQuery.isLoading ? (
            <Skeleton className="h-[220px] w-full rounded-md" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={charts?.revenue_by_month ?? []}
                margin={{ top: 4, right: 8, left: 0, bottom: 24 }}
                barCategoryGap="30%"
              >
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11, fill: "#718096" }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
                  tick={{ fontSize: 11, fill: "#718096" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <RechartsTooltip content={<RevenueTooltip />} cursor={{ fill: "#F4F6F8" }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {(charts?.revenue_by_month ?? []).map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={entry.month === currentMonth ? "#1A5FAB" : "#B5D4F4"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart phải — Top 5 khách hàng (Tailwind div bars) */}
        <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)]">
          <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
            Top 5 khách hàng theo doanh thu
          </p>
          {chartsQuery.isLoading ? (
            <div className="flex flex-col gap-4 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-40 rounded" />
                  <Skeleton className="h-5 rounded-full" style={{ width: `${80 - i * 12}%` }} />
                </div>
              ))}
            </div>
          ) : topCustomers.length === 0 ? (
            <EmptyAlert label="Chưa có dữ liệu khách hàng" />
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              {topCustomers.map((item, idx) => {
                const pct = Math.round((item.amount / maxCustomerAmount) * 100)
                return (
                  <div key={item.customer.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[length:var(--fs-body)] font-medium text-text-primary truncate">
                        <span className="text-text-secondary mr-1.5">{idx + 1}.</span>
                        {item.customer.display_name}
                      </span>
                      <span className="text-[length:var(--fs-body)] font-semibold text-success shrink-0">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="h-[8px] w-full rounded-full bg-success-light overflow-hidden">
                      <div
                        className="h-full rounded-full bg-success transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Alert Tables ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Bảng trái — Bảo hiểm / Đăng kiểm sắp hết hạn */}
        <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)]">
          <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
            Bảo hiểm / Đăng kiểm sắp hết hạn
          </p>
          {alertsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !alerts?.expiring_documents.length ? (
            <EmptyAlert label="Không có cảnh báo hết hạn" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[length:var(--fs-base)]">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-border">
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Xe</th>
                    {/* Ẩn cột Loại trên mobile */}
                    <th className="hidden sm:table-cell text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Loại</th>
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Ngày HH</th>
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.expiring_documents.map((doc, i) => (
                    <tr
                      key={`${doc.vehicle.id}-${doc.document_type}-${i}`}
                      className="border-b border-border last:border-0 hover:bg-[#F4F6F8] transition-colors"
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-text-primary leading-tight">{doc.vehicle.model}</p>
                        <p className="text-[length:var(--fs-sm)] text-text-secondary">{doc.vehicle.serial_number}</p>
                      </td>
                      {/* Ẩn cột Loại trên mobile */}
                      <td className="hidden sm:table-cell px-3 py-2">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--fs-sm)] font-medium bg-[#EAF4FB] text-[#2980B9]">
                          {doc.document_type === "insurance" ? "Bảo hiểm" : "Đăng kiểm"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-primary whitespace-nowrap">
                        {new Date(doc.expiry_date).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--fs-sm)] font-medium whitespace-nowrap ${getDaysChipClass(doc.days_remaining)}`}>
                          {getDaysLabel(doc.days_remaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bảng phải — Hợp đồng sắp hết hạn */}
        <div className="bg-bg-card rounded-lg border border-border shadow-card p-[var(--sp-card)]">
          <p className="text-[length:var(--fs-nav)] font-semibold text-text-primary mb-3">
            Hợp đồng sắp hết hạn
          </p>
          {alertsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !alerts?.expiring_contracts.length ? (
            <EmptyAlert label="Không có cảnh báo hết hạn" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[length:var(--fs-base)]">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-border">
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Số HĐ</th>
                    {/* Ẩn cột Khách hàng trên mobile */}
                    <th className="hidden sm:table-cell text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Khách hàng</th>
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Ngày HH</th>
                    <th className="text-left px-3 py-2 text-[length:var(--fs-sm)] font-semibold text-text-secondary uppercase tracking-wide">Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.expiring_contracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="border-b border-border last:border-0 hover:bg-[#F4F6F8] transition-colors cursor-pointer"
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                    >
                      <td className="px-3 py-2 max-w-[120px]">
                        <p className="font-medium text-primary truncate" title={contract.contract_number}>
                          {contract.contract_number}
                        </p>
                        {/* Hiện tên KH inline trên mobile thay vì cột riêng */}
                        <p className="sm:hidden text-[length:var(--fs-sm)] text-text-secondary truncate mt-0.5">
                          {contract.customer.display_name}
                        </p>
                      </td>
                      {/* Ẩn cột Khách hàng trên mobile */}
                      <td className="hidden sm:table-cell px-3 py-2 text-text-primary">
                        <span className="truncate block max-w-[120px]">{contract.customer.display_name}</span>
                      </td>
                      <td className="px-3 py-2 text-text-primary whitespace-nowrap">
                        {new Date(contract.end_date).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--fs-sm)] font-medium whitespace-nowrap ${getDaysChipClass(contract.days_remaining)}`}>
                          {getDaysLabel(contract.days_remaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
