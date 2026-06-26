import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'
import { getVendorById } from '@/app/actions/vendors'
import { Badge } from '@/components/ui/badge'
import { VendorDetailClient } from '@/components/vendors/vendor-detail-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(value: string | number | null): string {
  if (value === null || value === undefined) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(num)
}

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getVendorById(id)

  if (!result.success || !result.data) {
    redirect('/vendors')
  }

  const vendor = result.data
  const isConsignment = vendor.type === 'consignment'

  // Outstanding consignment batches (qty_remaining > 0)
  const outstandingBatches = isConsignment
    ? vendor.batches.filter((b) => b.is_consignment && b.qty_remaining > 0)
    : []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/vendors"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} />
        Back to Vendors
      </Link>

      {/* ── Vendor info card ───────────────────────────────────────────────── */}
      <div
        className="rounded-[12px] p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'var(--accent-primary-muted)' }}
            >
              <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                {vendor.name}
              </h1>
              {vendor.contact && (
                <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {vendor.contact}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons — client component for deactivate + edit */}
          <VendorDetailClient vendor={vendor} />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <InfoCell label="Type">
            <Badge variant={isConsignment ? 'accent' : 'default'}>
              {isConsignment ? 'Consignment' : 'Direct'}
            </Badge>
          </InfoCell>

          <InfoCell label="Batches Supplied">
            <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
              {vendor.batches.length}
            </span>
          </InfoCell>

          {isConsignment && (
            <InfoCell label="Units Outstanding">
              <span
                className="text-sm tabular-nums font-semibold"
                style={{ color: vendor.outstanding_consignment_qty > 0 ? 'var(--warning)' : 'var(--positive)' }}
              >
                {vendor.outstanding_consignment_qty}
              </span>
            </InfoCell>
          )}

          <InfoCell label="Status">
            <Badge variant={vendor.is_active ? 'success' : 'danger'}>
              {vendor.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </InfoCell>
        </div>

        {/* Address */}
        {vendor.address && (
          <div className="mb-3">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Address
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {vendor.address}
            </p>
          </div>
        )}

        {/* Notes */}
        {vendor.notes && (
          <div
            className="mt-3 rounded-lg px-4 py-3"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Notes
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {vendor.notes}
            </p>
          </div>
        )}
      </div>

      {/* ── Batch history table ───────────────────────────────────────────── */}
      <div
        className="rounded-[12px] overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Header with CSV export button */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Stock Batches
            </h2>
            <span
              className="text-xs font-medium rounded-full px-2.5 py-0.5"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
            >
              {vendor.batches.length}
            </span>
          </div>

          {/* CSV export — client component */}
          <VendorCsvButton vendorName={vendor.name} batches={vendor.batches} />
        </div>

        {vendor.batches.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-2"
            style={{ background: 'var(--bg-card)' }}
          >
            <Building2 size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No stock batches recorded yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]" style={{ background: 'var(--bg-card)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Product', 'Qty Received', 'Qty Remaining', 'Total Cost (₦)'].map((col, i) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide ${i >= 2 ? 'text-right' : ''}`}
                      style={{ color: 'var(--text-muted)', background: 'var(--bg-nav)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendor.batches.map((batch, i) => (
                  <tr
                    key={batch.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(batch.received_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {batch.product_name}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-primary)' }}>
                      {batch.qty_received}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-right">
                      <span style={{
                        color: batch.qty_remaining === 0
                          ? 'var(--danger)'
                          : batch.qty_remaining <= 5
                            ? 'var(--warning)'
                            : 'var(--positive)',
                        fontWeight: 600,
                      }}>
                        {batch.qty_remaining}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatNaira(batch.total_purchase_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Outstanding consignment section ───────────────────────────────── */}
      {isConsignment && outstandingBatches.length > 0 && (
        <OutstandingSection batches={outstandingBatches} />
      )}
    </div>
  )
}

// ─── Outstanding consignment section (server) ─────────────────────────────────

function OutstandingSection({
  batches,
}: {
  batches: import('@/app/actions/vendors').VendorBatchRow[]
}) {
  // We don't have selling price on VendorBatchRow; use total_purchase_cost / qty_received as estimate
  const totalValue = batches.reduce((sum, b) => {
    const costPerUnit = parseFloat(b.total_purchase_cost) / (b.qty_received || 1)
    return sum + costPerUnit * b.qty_remaining
  }, 0)

  function formatNaira(value: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(value)
  }

  function formatDate(value: string | Date | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: '1px solid var(--warning)', background: 'var(--warning-bg)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
            Consignment Items Not Yet Sold
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Stock still held from this vendor that has not been sold
          </p>
        </div>
        <span
          className="text-xs font-medium rounded-full px-2.5 py-0.5"
          style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--warning)' }}
        >
          {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
              {['Product', 'Batch Date', 'Qty Remaining', 'Est. Value (₦)'].map((col, i) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide ${i >= 2 ? 'text-right' : ''}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((batch, i) => {
              const costPerUnit = parseFloat(batch.total_purchase_cost) / (batch.qty_received || 1)
              const estValue = costPerUnit * batch.qty_remaining
              return (
                <tr
                  key={batch.id}
                  style={{
                    borderBottom: i < batches.length - 1 ? '1px solid rgba(251,191,36,0.1)' : 'none',
                  }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {batch.product_name}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(batch.received_at)}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-semibold" style={{ color: 'var(--warning)' }}>
                    {batch.qty_remaining}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatNaira(estValue)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Total row */}
          <tfoot>
            <tr style={{ borderTop: '1px solid rgba(251,191,36,0.3)' }}>
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-right" style={{ color: 'var(--text-secondary)' }}>
                Total outstanding value
              </td>
              <td className="px-4 py-3 text-sm tabular-nums text-right font-bold" style={{ color: 'var(--warning)' }}>
                {formatNaira(totalValue)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Client CSV button (imported inline) ──────────────────────────────────────
// Declared here to avoid a separate file for a small component
import { VendorCsvButton } from '@/components/vendors/vendor-csv-button'
