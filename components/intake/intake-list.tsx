'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, InboxIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BatchWithRefs } from '@/app/actions/batches'
import type { VendorWithStats } from '@/app/actions/vendors'

interface IntakeListProps {
  batches: BatchWithRefs[]
  vendors: VendorWithStats[]
  totalPages: number
  currentPage: number
  totalCount: number
  currencySymbol: string
}

function formatCurrencyStr(value: string | number, symbol: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return symbol + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getExpiryDisplay(expiryDate: string | null): React.ReactNode {
  if (!expiryDate) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  const now = new Date()
  const expiry = new Date(expiryDate)
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const formatted = formatDate(expiryDate)

  if (daysLeft <= 7) {
    return <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{formatted}</span>
  }
  if (daysLeft <= 30) {
    return <span style={{ color: 'var(--warning)', fontWeight: 500 }}>{formatted}</span>
  }
  return <span style={{ color: 'var(--text-secondary)' }}>{formatted}</span>
}

function getQtyRemainingStyle(qtyRemaining: number, qtyReceived: number): React.CSSProperties {
  const ratio = qtyReceived > 0 ? qtyRemaining / qtyReceived : 1
  if (ratio < 0.2) return { color: 'var(--warning)', fontWeight: 600 }
  return { color: 'var(--text-primary)' }
}

export function IntakeList({
  batches,
  vendors,
  totalPages,
  currentPage,
  totalCount,
  currencySymbol,
}: IntakeListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParam('search', e.target.value)
    }, 300)
  }

  function handlePage(next: number) {
    updateParam('page', String(next))
  }

  function handleConsignmentToggle(e: React.ChangeEvent<HTMLInputElement>) {
    updateParam('consignment', e.target.checked ? 'true' : '')
  }

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * 20 + 1
  const rangeEnd = Math.min(currentPage * 20, totalCount)

  const TABLE_COLS = [
    'Date Received',
    'Batch Reference',
    'Product',
    'Vendor',
    'Qty Received',
    'Qty Remaining',
    'Cost / Unit',
    'Expiry Date',
    'Type',
    '',
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Product search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by product name or SKU…"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={handleSearch}
            className="w-full h-9 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Vendor filter */}
        <Select
          defaultValue={searchParams.get('vendorId') ?? 'all'}
          onValueChange={(val) => updateParam('vendorId', val === 'all' ? '' : val)}
        >
          <SelectTrigger
            className="w-[180px] h-9 text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <SelectValue placeholder="All Vendors" />
          </SelectTrigger>
          <SelectContent style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <SelectItem value="all" style={{ color: 'var(--text-secondary)' }}>All Vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id} style={{ color: 'var(--text-primary)' }}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date from */}
        <input
          type="date"
          defaultValue={searchParams.get('dateFrom') ?? ''}
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
          defaultValue={searchParams.get('dateTo') ?? ''}
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

        {/* Consignment toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none h-9 px-3 rounded-lg"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <input
            type="checkbox"
            defaultChecked={searchParams.get('consignment') === 'true'}
            onChange={handleConsignmentToggle}
            className="w-4 h-4 rounded accent-accent-primary"
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Consignment only</span>
        </label>

        {/* Record intake CTA */}
        <Link href="/intake/new" className="ml-auto">
          <Button
            className="h-9 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
          >
            + Record Stock Intake
          </Button>
        </Link>
      </div>

      {/* Table */}
      {batches.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-24 rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <InboxIcon size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No stock batches yet. Record your first intake.
          </p>
          <Link href="/intake/new">
            <Button
              className="h-9 rounded-lg px-4 text-sm font-medium text-white"
              style={{ background: 'var(--accent-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
            >
              Record Stock Intake
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
              {batches.map((batch) => (
                <tr
                  key={batch.id}
                  className="border-t transition-colors"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
                >
                  {/* Date Received */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(batch.received_at)}
                    </span>
                  </td>

                  {/* Batch Reference */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="mono text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {batch.reference_number || batch.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>

                  {/* Product */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                      {batch.product_name}
                    </span>
                    <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {batch.product_sku}
                    </span>
                  </td>

                  {/* Vendor */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {batch.vendor_name ?? '—'}
                    </span>
                  </td>

                  {/* Qty Received */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {batch.qty_received}
                    </span>
                  </td>

                  {/* Qty Remaining */}
                  <td className="px-4 py-3">
                    <span
                      className="text-sm"
                      style={getQtyRemainingStyle(batch.qty_remaining, batch.qty_received)}
                    >
                      {batch.qty_remaining}
                    </span>
                  </td>

                  {/* Cost / Unit */}
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrencyStr(batch.cost_per_unit, currencySymbol)}
                    </span>
                  </td>

                  {/* Expiry Date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getExpiryDisplay(batch.expiry_date)}
                  </td>

                  {/* Consignment badge */}
                  <td className="px-4 py-3">
                    {batch.is_consignment ? (
                      <Badge variant="accent">Consignment</Badge>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/intake/${batch.id}`}
                      className="text-[12px] font-medium transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Showing {rangeStart}–{rangeEnd} of {totalCount} batch{totalCount !== 1 ? 'es' : ''}
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
