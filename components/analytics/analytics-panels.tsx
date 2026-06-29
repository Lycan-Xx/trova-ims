'use client'

import * as React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Papa from 'papaparse'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/lib/currency-context'
import { getCurrencySymbol } from '@/lib/currency'
import type {
  SalesAnalytics,
  VendorAnalytics,
  ExpiryRiskItem,
} from '@/app/actions/analytics'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFmtCurrency(symbol: string) {
  return (n: number) => symbol + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-NG')
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
}

function fmtFullDate(d: string): string {
  return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function triggerCsvDownload(data: object[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Custom tooltip for bar chart ──────────────────────────────────────────────

function RevenueTooltip({ active, payload, label, fmtCurrency }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  fmtCurrency?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const fmt = fmtCurrency ?? ((n: number) => String(n))
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs shadow-lg"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <p style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-semibold mt-0.5">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── Panel header ──────────────────────────────────────────────────────────────

function PanelHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
    >
      {children}
    </section>
  )
}

function ExportButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-3 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.borderColor = 'var(--accent-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {label}
    </button>
  )
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {cols.map((c) => (
          <th
            key={c}
            className="px-5 py-3 text-left text-xs font-medium tracking-wide whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-14 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {msg}
      </td>
    </tr>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonPanel({ rows = 4 }: { rows?: number }) {
  return (
    <Panel>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-input)', width: `${60 + (i % 3) * 13}%` }} />
        ))}
      </div>
    </Panel>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface AnalyticsPanelsProps {
  sales: SalesAnalytics | null
  vendors: VendorAnalytics[]
  expiryRisk: ExpiryRiskItem[]
  dateFrom: string
  dateTo: string
  isLoading?: boolean
}

export function AnalyticsPanels({
  sales,
  vendors,
  expiryRisk,
  dateFrom,
  dateTo,
  isLoading,
}: AnalyticsPanelsProps) {
  const { currency } = useCurrency()
  const currencySymbol = getCurrencySymbol(currency)
  const fmtCurrency = makeFmtCurrency(currencySymbol)
  const rangeLabel = `${dateFrom}_${dateTo}`

  function exportProducts() {
    if (!sales) return
    triggerCsvDownload(
      sales.topProducts.map((p, i) => ({
        Rank: i + 1,
        Product: p.name,
        SKU: p.sku,
        'Units Sold': p.unitsSold,
        [`Revenue (${currency})`]: p.revenue.toFixed(2),
        'Avg Margin (%)': p.avgMargin.toFixed(2),
      })),
      `product-report_${rangeLabel}.csv`,
    )
  }

  function exportVendors() {
    triggerCsvDownload(
      vendors.map((v) => ({
        Vendor: v.vendorName,
        Type: v.vendorType,
        Batches: v.batchCount,
        'Units Received': v.totalUnitsReceived,
        [`Total Cost (${currency})`]: v.totalPurchaseCost.toFixed(2),
        'Outstanding Units': v.outstandingQty,
      })),
      `vendor-report_${rangeLabel}.csv`,
    )
  }

  function exportExpiry() {
    triggerCsvDownload(
      expiryRisk.map((e) => ({
        Product: e.productName,
        'Batch Ref': e.batchRef ?? '',
        Vendor: e.vendorName ?? '',
        'Qty Remaining': e.qtyRemaining,
        'Expiry Date': e.expiryDate,
        [`Est. Value at Risk (${currency})`]: e.estValueAtRisk.toFixed(2),
      })),
      `expiry-risk-report_${rangeLabel}.csv`,
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[12px] border border-border bg-bg-card p-4 space-y-2">
              <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
              <div className="h-7 w-28 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
            </div>
          ))}
        </div>
        <SkeletonPanel rows={5} />
        <SkeletonPanel rows={4} />
        <SkeletonPanel rows={3} />
        <SkeletonPanel rows={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Panel 1: Sales Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={sales ? fmtCurrency(sales.totalRevenue) : `${currencySymbol}0`}
        />
        <StatCard
          title="Transactions"
          value={sales ? fmtNum(sales.totalTransactions) : '0'}
        />
        <StatCard
          title="Avg Transaction"
          value={sales ? fmtCurrency(sales.avgTransactionValue) : `${currencySymbol}0`}
        />
        <StatCard
          title="Units Sold"
          value={sales ? fmtNum(sales.totalUnitsSold) : '0'}
        />
      </div>

      {/* Daily revenue bar chart */}
      <Panel>
        <PanelHeader
          title="Daily Revenue"
          subtitle={`${dateFrom} to ${dateTo}`}
        />
        <div className="p-5">
          {!sales || sales.dailyRevenue.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No sales data for this period
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales.dailyRevenue} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => currencySymbol + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip content={<RevenueTooltip fmtCurrency={fmtCurrency} />} cursor={{ fill: 'var(--bg-card-hover)' }} />
                  <Bar
                    dataKey="revenue"
                    fill="var(--accent-primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Panel>

      {/* ── Panel 2: Top Products ── */}
      <Panel>
        <PanelHeader
          title="Top Products"
          subtitle={sales ? `Top ${sales.topProducts.length} by units sold` : undefined}
          action={<ExportButton onClick={exportProducts} label="Export Product Report (CSV)" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['#', 'Product', 'Units Sold', 'Revenue', 'Avg Margin']} />
            <tbody>
              {!sales || sales.topProducts.length === 0 ? (
                <EmptyRow cols={5} msg="No sales in this period" />
              ) : (
                sales.topProducts.map((p, i) => {
                  const marginColor =
                    p.avgMargin < 0
                      ? 'var(--danger)'
                      : p.avgMargin < 15
                      ? 'var(--warning)'
                      : 'var(--positive)'
                  return (
                    <tr
                      key={p.productId}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.sku}</p>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                        {fmtNum(p.unitsSold)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {fmtCurrency(p.revenue)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold" style={{ color: marginColor }}>
                        {p.avgMargin.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Panel 3: Vendor Purchase Summary ── */}
      <Panel>
        <PanelHeader
          title="Vendor Purchase Summary"
          subtitle={`${vendors.length} active vendor${vendors.length !== 1 ? 's' : ''}`}
          action={<ExportButton onClick={exportVendors} label="Export Vendor Report (CSV)" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Vendor', 'Type', 'Batches', 'Units Received', 'Total Cost', 'Outstanding Units']} />
            <tbody>
              {vendors.length === 0 ? (
                <EmptyRow cols={6} msg="No vendor data for this period" />
              ) : (
                vendors.map((v) => (
                  <tr
                    key={v.vendorId}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {v.vendorName}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={v.vendorType === 'consignment' ? 'accent' : 'default'}>
                        {v.vendorType === 'consignment' ? 'Consignment' : 'Direct'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {fmtNum(v.batchCount)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {fmtNum(v.totalUnitsReceived)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(v.totalPurchaseCost)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums font-medium"
                      style={{ color: v.outstandingQty > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {fmtNum(v.outstandingQty)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Panel 4: Expiry Risk ── */}
      <Panel>
        <PanelHeader
          title="Expiry Risk"
          subtitle={`${expiryRisk.length} batch${expiryRisk.length !== 1 ? 'es' : ''} with upcoming expiry`}
          action={<ExportButton onClick={exportExpiry} label="Export Expiry Report (CSV)" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Product', 'Batch Ref', 'Vendor', 'Qty Remaining', 'Expiry Date', 'Est. Value at Risk']} />
            <tbody>
              {expiryRisk.length === 0 ? (
                <EmptyRow cols={6} msg="No batches with expiry dates recorded" />
              ) : (
                expiryRisk.map((e) => {
                  const days = daysUntil(e.expiryDate)
                  const dateColor =
                    days <= 7 ? 'var(--danger)' : days <= 30 ? 'var(--warning)' : 'var(--text-secondary)'
                  return (
                    <tr
                      key={e.batchId}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={(e2) => (e2.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={(e2) => (e2.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {e.productName}
                      </td>
                      <td className="px-5 py-3.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {e.batchRef ?? <span style={{ color: 'var(--text-muted)' }}> </span>}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {e.vendorName ?? <span style={{ color: 'var(--text-muted)' }}> </span>}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                        {fmtNum(e.qtyRemaining)}
                      </td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: dateColor }}>
                        {fmtFullDate(e.expiryDate)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums font-semibold" style={{ color: 'var(--danger)' }}>
                        {fmtCurrency(e.estValueAtRisk)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
