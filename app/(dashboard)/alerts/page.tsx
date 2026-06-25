import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireStoreAccess } from '@/lib/auth'
import { getExpiryAlerts, getLowStockAlerts } from '@/app/actions/alerts'
import { Badge } from '@/components/ui/badge'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-NG')
}

// ── Days filter chip ──────────────────────────────────────────────────────────

interface DaysChipsProps {
  current: number
}

function DaysChips({ current }: DaysChipsProps) {
  const options = [7, 14, 30]
  return (
    <div className="flex gap-2">
      {options.map((d) => {
        const isActive = current === d
        return (
          <Link
            key={d}
            href={`/alerts?days=${d}`}
            className="h-7 px-3 rounded-full text-xs font-medium flex items-center transition-colors"
            style={{
              background: isActive ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border)'}`,
            }}
          >
            {d} days
          </Link>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface AlertsPageProps {
  searchParams: Promise<{ days?: string }>
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  try {
    await requireStoreAccess()
  } catch {
    redirect('/sign-in')
  }

  const params = await searchParams
  const daysAhead = Math.min(30, Math.max(7, parseInt(params.days ?? '30', 10) || 30))

  const [expiryResult, lowStockResult] = await Promise.all([
    getExpiryAlerts(daysAhead),
    getLowStockAlerts(),
  ])

  const expiryAlerts = expiryResult.success ? expiryResult.data : []
  const lowStockAlerts = lowStockResult.success ? lowStockResult.data : []

  // Summary counts
  const expiring7 = expiryAlerts.filter((a) => a.daysUntilExpiry <= 7).length
  const lowStock = lowStockAlerts.filter((a) => a.status === 'low_stock').length
  const outOfStock = lowStockAlerts.filter((a) => a.status === 'out_of_stock').length
  const allHealthy = expiring7 === 0 && lowStock === 0 && outOfStock === 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Stock Alerts
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Monitor expiring batches and low stock levels
        </p>
      </div>

      {/* Summary banner */}
      {allHealthy ? (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--positive-bg)',
            border: '1px solid var(--positive)',
            color: 'var(--positive)',
          }}
        >
          <span>&#10003;</span>
          <span>All stock levels are healthy.</span>
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--accent-primary-muted)',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
          }}
        >
          <span>&#9888;</span>
          {expiring7 > 0 && (
            <span>
              {expiring7} item{expiring7 !== 1 ? 's' : ''} expiring in 7 days
            </span>
          )}
          {expiring7 > 0 && (lowStock > 0 || outOfStock > 0) && (
            <span style={{ color: 'var(--border)' }}>&#183;</span>
          )}
          {lowStock > 0 && (
            <span>
              {lowStock} item{lowStock !== 1 ? 's' : ''} below reorder level
            </span>
          )}
          {lowStock > 0 && outOfStock > 0 && (
            <span style={{ color: 'var(--border)' }}>&#183;</span>
          )}
          {outOfStock > 0 && (
            <span>
              {outOfStock} item{outOfStock !== 1 ? 's' : ''} out of stock
            </span>
          )}
        </div>
      )}

      {/* Panel A — Expiring Soon */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Expiring Soon
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {expiryAlerts.length} batch{expiryAlerts.length !== 1 ? 'es' : ''} with remaining stock
            </p>
          </div>
          <DaysChips current={daysAhead} />
        </div>

        {expiryAlerts.length === 0 ? (
          <div className="py-14 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No items expiring within {daysAhead} days
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Product Name', 'SKU', 'Vendor', 'Qty Remaining', 'Expiry Date', 'Days Left'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiryAlerts.map((alert) => {
                  const isUrgent = alert.daysUntilExpiry <= 7
                  const isSoon = alert.daysUntilExpiry <= 30
                  const dateColor = isUrgent
                    ? 'var(--danger)'
                    : isSoon
                    ? 'var(--warning)'
                    : 'var(--text-secondary)'

                  return (
                    <tr
                      key={alert.batchId}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="transition-colors"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-card-hover)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                        <Link
                          href={`/products/${alert.productId}`}
                          className="hover:underline"
                          style={{ color: 'inherit' }}
                        >
                          {alert.productName}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {alert.sku}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {alert.vendorName ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {formatNumber(alert.qtyRemaining)}
                      </td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: dateColor }}>
                        {formatDate(alert.expiryDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={isUrgent ? 'danger' : 'warning'}>
                          {alert.daysUntilExpiry}d
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel B — Low Stock */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Low Stock
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {lowStockAlerts.length} product{lowStockAlerts.length !== 1 ? 's' : ''} at or below reorder level
          </p>
        </div>

        {lowStockAlerts.length === 0 ? (
          <div className="py-14 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            All products are sufficiently stocked
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Product Name', 'SKU', 'Current Stock', 'Reorder Level', 'Last Vendor', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map((alert) => {
                  const isOut = alert.status === 'out_of_stock'
                  const stockColor = isOut ? 'var(--danger)' : 'var(--warning)'

                  return (
                    <tr
                      key={alert.productId}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="transition-colors"
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-card-hover)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                        <Link
                          href={`/products/${alert.productId}`}
                          className="hover:underline"
                          style={{ color: 'inherit' }}
                        >
                          {alert.productName}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {alert.sku}
                      </td>
                      <td className="px-5 py-3.5 font-semibold tabular-nums" style={{ color: stockColor }}>
                        {formatNumber(alert.currentStock)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatNumber(alert.reorderLevel)}
                      </td>
                      <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {alert.lastVendorName ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={isOut ? 'danger' : 'warning'}>
                          {isOut ? 'Out of Stock' : 'Low Stock'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
