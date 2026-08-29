'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrency } from '@/lib/currency-context'
import { formatCurrency } from '@/lib/currency'
import { SalesCsvButton } from '@/components/sales/sales-csv-button'
import type { SaleRow } from '@/app/actions/sales'

interface SalesListProps {
  sales: SaleRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  isOwner: boolean
  cashiers: { id: string; name: string }[]
  dateFrom?: string
  dateTo?: string
  // Summary totals (owner only)
  summary?: {
    totalRevenue: number
    transactionCount: number
    avgTransactionValue: number
    totalUnitsSold: number
  }
  summaryLabel?: string
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function getDayKey(value: string): string {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayHeading(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getPaymentBadgeVariant(method: string): 'default' | 'accent' | 'success' {
  if (method === 'transfer') return 'accent'
  if (method === 'pos') return 'success'
  return 'default'
}

function getPaymentLabel(method: string): string {
  if (method === 'transfer') return 'Bank Transfer'
  if (method === 'pos') return 'POS Terminal'
  return 'Cash'
}

export function SalesList({
  sales,
  totalCount,
  totalPages,
  currentPage,
  isOwner,
  cashiers,
  dateFrom,
  dateTo,
  summary,
  summaryLabel = 'Selected Range',
}: SalesListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { currency } = useCurrency()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    if (key !== 'page') params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handlePage(next: number) {
    updateParam('page', String(next))
  }

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * 20 + 1
  const rangeEnd = Math.min(currentPage * 20, totalCount)

  const TABLE_COLS = [
    'Receipt No.',
    'Date & Time',
    'Items',
    'Total Amount',
    'Payment',
    'Cashier',
    '',
  ]

  const visibleDayTotals = sales.reduce<Record<string, { count: number; revenue: number; firstDate: string }>>(
    (acc, sale) => {
      const key = getDayKey(sale.created_at)
      const existing = acc[key] ?? { count: 0, revenue: 0, firstDate: sale.created_at }
      existing.count += 1
      existing.revenue += parseFloat(sale.total_amount)
      acc[key] = existing
      return acc
    },
    {},
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Owner summary strip */}
      {isOwner && summary && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border p-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {summaryLabel} Revenue
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--positive)' }}>
              {formatCurrency(summary.totalRevenue, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Transactions
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {summary.transactionCount.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Items Sold
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {summary.totalUnitsSold.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Avg. Transaction
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--accent-teal)' }}>
              {formatCurrency(summary.avgTransactionValue, currency)}
            </span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date from */}
        <input
          type="date"
          defaultValue={dateFrom ?? ''}
          onChange={(e) => updateParam('dateFrom', e.target.value)}
          className="h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            colorScheme: 'dark',
          }}
          aria-label="From date"
        />

        {/* Date to */}
        <input
          type="date"
          defaultValue={dateTo ?? ''}
          onChange={(e) => updateParam('dateTo', e.target.value)}
          className="h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            colorScheme: 'dark',
          }}
          aria-label="To date"
        />

        {/* Payment method */}
        <Select
          defaultValue={searchParams.get('paymentMethod') ?? 'all'}
          onValueChange={(val) => updateParam('paymentMethod', val === 'all' ? '' : val)}
        >
          <SelectTrigger
            className="w-[160px] h-9 text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <SelectValue placeholder="All Methods" />
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <SelectItem value="all" style={{ color: 'var(--text-secondary)' }}>All Methods</SelectItem>
            <SelectItem value="cash" style={{ color: 'var(--text-primary)' }}>Cash</SelectItem>
            <SelectItem value="transfer" style={{ color: 'var(--text-primary)' }}>Bank Transfer</SelectItem>
            <SelectItem value="pos" style={{ color: 'var(--text-primary)' }}>POS Terminal</SelectItem>
          </SelectContent>
        </Select>

        {/* Cashier filter — owners only */}
        {isOwner && cashiers.length > 0 && (
          <Select
            defaultValue={searchParams.get('cashierId') ?? 'all'}
            onValueChange={(val) => updateParam('cashierId', val === 'all' ? '' : val)}
          >
            <SelectTrigger
              className="w-[160px] h-9 text-sm"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <SelectValue placeholder="All Cashiers" />
            </SelectTrigger>
            <SelectContent style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <SelectItem value="all" style={{ color: 'var(--text-secondary)' }}>All Cashiers</SelectItem>
              {cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id} style={{ color: 'var(--text-primary)' }}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* New Sale CTA */}
        {isOwner && (
          <SalesCsvButton
            dateFrom={dateFrom}
            dateTo={dateTo}
            cashierId={searchParams.get('cashierId') ?? undefined}
            paymentMethod={searchParams.get('paymentMethod') ?? undefined}
          />
        )}
        <Link href="/sales/new" className="ml-auto">
          <Button
            className="h-9 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
          >
            + New Sale
          </Button>
        </Link>
      </div>

      {/* Table or empty state */}
      {sales.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-24 rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <ShoppingBag size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No sales yet. Make your first sale.
          </p>
          <Link href="/sales/new">
            <Button
              className="h-9 rounded-lg px-4 text-sm font-medium text-white"
              style={{ background: 'var(--accent-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
            >
              New Sale
            </Button>
          </Link>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, index) => {
                const dayKey = getDayKey(sale.created_at)
                const previousDayKey = index > 0 ? getDayKey(sales[index - 1].created_at) : null
                const showDayHeader = dayKey !== previousDayKey
                const dayTotal = visibleDayTotals[dayKey]

                return (
                  <React.Fragment key={sale.id}>
                    {showDayHeader && (
                      <tr>
                        <td colSpan={TABLE_COLS.length} className="px-4 py-2.5" style={{ background: 'var(--bg-nav)' }}>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                              {formatDayHeading(sale.created_at)}
                            </span>
                            <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {dayTotal.count} {dayTotal.count === 1 ? 'transaction' : 'transactions'} - {formatCurrency(dayTotal.revenue, currency)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className="border-t transition-colors"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
                    >
                  {/* Receipt Number */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="mono text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {sale.receipt_number}
                    </span>
                  </td>

                  {/* Date & Time */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateTime(sale.created_at)}
                    </span>
                  </td>

                  {/* Items count */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {sale.items_count} {sale.items_count === 1 ? 'item' : 'items'}
                    </span>
                  </td>

                  {/* Total Amount */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(sale.total_amount, currency)}
                    </span>
                  </td>

                  {/* Payment Method */}
                  <td className="px-4 py-3">
                    <Badge variant={getPaymentBadgeVariant(sale.payment_method)}>
                      {getPaymentLabel(sale.payment_method)}
                    </Badge>
                  </td>

                  {/* Cashier */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {sale.cashier_name ?? '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/sales/${sale.id}`}
                      className="text-[12px] font-medium transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                    >
                      View Receipt
                    </Link>
                  </td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Showing {rangeStart}–{rangeEnd} of {totalCount} sale{totalCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePage(currentPage - 1)}
              className="h-8 w-8 p-0 hover:bg-bg-input disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="text-[13px] min-w-[60px] text-center" style={{ color: 'var(--text-secondary)' }}>
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePage(currentPage + 1)}
              className="h-8 w-8 p-0 hover:bg-bg-input disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
