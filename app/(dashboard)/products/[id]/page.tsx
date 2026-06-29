import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { getProductById } from '@/app/actions/products'
import { getStoreSettings } from '@/app/actions/settings'
import { getCurrencySymbol } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import type { Batch } from '@/lib/db/schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFormatCurrency(symbol: string) {
  return function formatCurrency(value: string | number | null): string {
    if (value === null || value === undefined) return '—'
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '—'
    return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getExpiryStyle(expiryDate: string | Date | null): React.CSSProperties {
  if (!expiryDate) return { color: 'var(--text-secondary)' }
  const msLeft = new Date(expiryDate).getTime() - Date.now()
  const daysLeft = msLeft / (1000 * 60 * 60 * 24)
  if (daysLeft <= 7) return { color: 'var(--danger)', fontWeight: 600 }
  if (daysLeft <= 30) return { color: 'var(--warning)', fontWeight: 500 }
  return { color: 'var(--text-secondary)' }
}

// ─── Batch Row ────────────────────────────────────────────────────────────────

function BatchRow({ batch, index, formatCurrency }: { batch: Batch; index: number; formatCurrency: (v: string | number | null) => string }) {
  return (
    <tr
      style={{
        background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {formatDate(batch.received_at)}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {batch.batch_ref ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-primary)' }}>
        {batch.qty_received}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right">
        <span
          style={{
            color: batch.qty_remaining === 0
              ? 'var(--danger)'
              : batch.qty_remaining <= 5
                ? 'var(--warning)'
                : 'var(--positive)',
            fontWeight: 600,
          }}
        >
          {batch.qty_remaining}
        </span>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-secondary)' }}>
        {formatCurrency(batch.cost_per_unit)}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-right" style={{ color: 'var(--text-secondary)' }}>
        {batch.selling_price_override ? formatCurrency(batch.selling_price_override) : (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>default</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm" style={getExpiryStyle(batch.expiry_date)}>
        {formatDate(batch.expiry_date)}
      </td>
      <td className="px-4 py-3">
        {batch.is_consignment ? (
          <Badge variant="accent">Consignment</Badge>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [result, storeResult] = await Promise.all([getProductById(id), getStoreSettings()])

  if (!result.success || !result.data) {
    redirect('/products')
  }

  const currencySymbol = getCurrencySymbol(storeResult?.success ? storeResult.data.currency : 'NGN')
  const formatCurrency = makeFormatCurrency(currencySymbol)

  const product = result.data
  const currentStock = product.current_stock ?? 0
  const isOut = currentStock === 0
  const isLow = !isOut && currentStock <= product.reorder_level

  const stockBadgeVariant = isOut ? 'danger' : isLow ? 'warning' : 'success'
  const stockBadgeLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} />
        Back to Products
      </Link>

      {/* ── Product info card ─────────────────────────────────────────────── */}
      <div
        className="rounded-[12px] p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'var(--accent-primary-muted)' }}
            >
              <Package size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>

            <div>
              <h1 className="text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                {product.name}
              </h1>
              <p className="mono mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {product.sku}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/products/${id}/edit`}
              className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium border transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Edit Product
            </Link>
            <Link
              href={`/intake/new?productId=${id}`}
              className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--accent-primary)' }}
            >
              + Record New Intake
            </Link>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <InfoCell label="Category">
            {product.category_name ? (
              <Badge variant="default">{product.category_name}</Badge>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Uncategorised</span>
            )}
          </InfoCell>

          <InfoCell label="Unit">
            <span className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
              {product.unit}
            </span>
          </InfoCell>

          <InfoCell label="Default Selling Price">
            <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(product.selling_price)}
            </span>
          </InfoCell>

          <InfoCell label="Reorder Level">
            <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {product.reorder_level} units
            </span>
          </InfoCell>
        </div>

        {/* Current stock — prominent */}
        <div
          className="flex items-center gap-4 rounded-lg px-5 py-4"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Current Stock
            </p>
            <p
              className="text-4xl font-bold tabular-nums leading-none"
              style={{
                color: isOut
                  ? 'var(--danger)'
                  : isLow
                    ? 'var(--warning)'
                    : 'var(--positive)',
              }}
            >
              {currentStock}
            </p>
            <p className="text-xs mt-1 capitalize" style={{ color: 'var(--text-muted)' }}>
              {product.unit}
            </p>
          </div>
          <div className="ml-2">
            <Badge variant={stockBadgeVariant}>{stockBadgeLabel}</Badge>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {product.description}
          </p>
        )}
      </div>

      {/* ── Batch history table ───────────────────────────────────────────── */}
      <div
        className="rounded-[12px] overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Stock Batches
          </h2>
          <span
            className="text-xs font-medium rounded-full px-2.5 py-0.5"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
          >
            {product.batches.length} {product.batches.length === 1 ? 'batch' : 'batches'}
          </span>
        </div>

        {product.batches.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center py-16 gap-2"
            style={{ background: 'var(--bg-card)' }}
          >
            <Package size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No stock batches recorded yet
            </p>
            <Link
              href={`/intake/new?productId=${id}`}
              className="mt-2 text-xs font-medium"
              style={{ color: 'var(--accent-primary)' }}
            >
              Record first intake
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]" style={{ background: 'var(--bg-card)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    'Date Received',
                    'Batch Ref',
                    'Qty Received',
                    'Qty Remaining',
                    `Cost / Unit (${currencySymbol})`,
                    `Selling Price (${currencySymbol})`,
                    'Expiry Date',
                    'Type',
                  ].map((col, i) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide ${i >= 2 && i <= 5 ? 'text-right' : ''}`}
                      style={{ color: 'var(--text-muted)', background: 'var(--bg-nav)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.batches.map((batch, i) => (
                  <BatchRow key={batch.id} batch={batch} index={i} formatCurrency={formatCurrency} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── InfoCell ─────────────────────────────────────────────────────────────────

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
