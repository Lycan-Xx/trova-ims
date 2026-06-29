import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { getSalesAnalytics, getVendorAnalytics, getExpiryRisk } from '@/app/actions/analytics'
import { AnalyticsPanels } from '@/components/analytics/analytics-panels'
import { DateRangeFilter } from '@/components/analytics/date-range-filter'

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function resolveRange(preset: string, from?: string, to?: string): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const today = toDateStr(now)

  switch (preset) {
    case 'today':
      return { dateFrom: today, dateTo: today }
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return { dateFrom: toDateStr(start), dateTo: today }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { dateFrom: toDateStr(start), dateTo: today }
    }
    case 'custom':
      if (from && to) return { dateFrom: from, dateTo: to }
      break
    default:
      break
  }
  // last30 (default)
  const start = new Date(now)
  start.setDate(now.getDate() - 29)
  return { dateFrom: toDateStr(start), dateTo: today }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface AnalyticsPageProps {
  searchParams: Promise<{
    preset?: string
    from?: string
    to?: string
  }>
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await requireOwner()

  const params = await searchParams
  const preset = params.preset ?? 'last30'
  const { dateFrom, dateTo } = resolveRange(preset, params.from, params.to)

  const [salesResult, vendorsResult, expiryResult] = await Promise.all([
    getSalesAnalytics(dateFrom, dateTo),
    getVendorAnalytics(dateFrom, dateTo),
    getExpiryRisk(),
  ])

  const sales = salesResult.success ? salesResult.data : null
  const vendors = vendorsResult.success ? vendorsResult.data : []
  const expiryRisk = expiryResult.success ? expiryResult.data : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Analytics
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Sales performance, vendor activity, and stock risk
          </p>
        </div>

        <DateRangeFilter
          preset={preset}
          from={params.from}
          to={params.to}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>

      <AnalyticsPanels
        sales={sales}
        vendors={vendors}
        expiryRisk={expiryRisk}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}
