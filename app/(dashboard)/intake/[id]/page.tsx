import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  Calendar,
  Hash,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { getBatchById } from '@/app/actions/batches'
import { Badge } from '@/components/ui/badge'

function fmt(v: string | number | null) {
  if (v === null || v === undefined) return '—'
  return `₦${parseFloat(String(v)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getBatchById(id)

  if (!result.success) notFound()

  const batch = result.data
  const product = batch.product ?? {
    id: batch.product_id,
    name: batch.product_name,
    sku: batch.product_sku,
    unit: 'piece',
    selling_price: batch.selling_price_override ?? '0',
  }
  const vendor = batch.vendor ?? null

  const expiryDate = batch.expiry_date ? new Date(batch.expiry_date) : null
  const today = new Date()
  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30

  const stockPct = batch.qty_remaining / batch.qty_received
  const stockStatus =
    batch.qty_remaining === 0 ? 'depleted' :
    stockPct <= 0.2 ? 'low' : 'ok'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/intake"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} />
        Back to Intake
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-primary-muted)' }}
        >
          <Package size={20} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {product.name}
          </h1>
          <p className="mt-0.5 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            SKU: {product.sku}
            {batch.batch_ref && <> &middot; Ref: {batch.batch_ref}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {batch.is_consignment && <Badge variant="accent">Consignment</Badge>}
          <Badge variant={stockStatus === 'ok' ? 'success' : stockStatus === 'low' ? 'warning' : 'danger'}>
            {stockStatus === 'ok' ? 'In Stock' : stockStatus === 'low' ? 'Low Stock' : 'Depleted'}
          </Badge>
        </div>
      </div>

      {/* Stock summary bar */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center gap-6 flex-wrap"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Received</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{batch.qty_received}</span>
        </div>
        <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Remaining</span>
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: stockStatus === 'ok' ? 'var(--positive)' : stockStatus === 'low' ? 'var(--warning)' : 'var(--danger)' }}
          >
            {batch.qty_remaining}
          </span>
        </div>
        <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sold</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {batch.qty_received - batch.qty_remaining}
          </span>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${stockPct * 100}%`,
                background: stockStatus === 'ok' ? 'var(--positive)' : stockStatus === 'low' ? 'var(--warning)' : 'var(--danger)',
              }}
            />
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {Math.round(stockPct * 100)}% remaining
          </p>
        </div>
      </div>

      {/* Expiry warning */}
      {(isExpired || isExpiringSoon) && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6"
          style={{
            background: isExpired ? 'var(--danger-bg)' : 'var(--warning-bg)',
            border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--warning)'}`,
          }}
        >
          <AlertTriangle size={16} style={{ color: isExpired ? 'var(--danger)' : 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: isExpired ? 'var(--danger)' : 'var(--warning)' }}>
            {isExpired
              ? `This batch expired ${Math.abs(daysUntilExpiry!)} day${Math.abs(daysUntilExpiry!) === 1 ? '' : 's'} ago.`
              : `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} on ${fmtDate(batch.expiry_date)}.`}
          </p>
        </div>
      )}

      {/* Details card */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-nav)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Batch Details</h2>
        </div>
        <div className="px-5">
          <InfoRow label="Date Received" value={<span className="flex items-center gap-1.5"><Calendar size={13} />{fmtDate(batch.received_at)}</span>} />
          <InfoRow label="Vendor" value={vendor ? vendor.name : '—'} />
          <InfoRow label="Pack Size" value={<span className="flex items-center gap-1.5"><Layers size={13} />{batch.pack_size} {product.unit}{batch.pack_size > 1 ? 's' : ''} per pack</span>} />
          <InfoRow label="Batch Reference" value={<span className="flex items-center gap-1.5"><Hash size={13} />{batch.batch_ref ?? '—'}</span>} />
          <InfoRow label="Expiry Date" value={
            <span style={{ color: isExpired ? 'var(--danger)' : isExpiringSoon ? 'var(--warning)' : 'inherit' }}>
              {fmtDate(batch.expiry_date)}
            </span>
          } />
          <InfoRow label="Total Purchase Cost" value={fmt(batch.total_purchase_cost)} />
          <InfoRow label="Cost Per Unit" value={fmt(batch.cost_per_unit)} />
          <InfoRow label="Selling Price Override" value={batch.selling_price_override ? fmt(batch.selling_price_override) : <span style={{ color: 'var(--text-muted)' }}>Using product default ({fmt(product.selling_price)})</span>} />
          {batch.notes && <InfoRow label="Notes" value={batch.notes} />}
        </div>
      </div>
    </div>
  )
}
