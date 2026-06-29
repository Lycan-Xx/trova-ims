import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'
import { getSalesAnalytics } from '@/app/actions/analytics'
import { getLowStockAlerts, getExpiryAlerts } from '@/app/actions/alerts'
import { getCurrentUser } from '@/lib/auth'
import { getOnboardingState } from '@/lib/actions/onboarding'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import { getStoreSettings } from '@/app/actions/settings'
import { getCurrencySymbol, formatCurrency } from '@/lib/currency'

function fmtCurrency(n: number, symbol: string): string {
  return symbol + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTrend(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined
  return Math.round(((current - previous) / previous) * 100)
}

// Build YYYY-MM-DD strings for date ranges
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const isOwner = user?.role === 'owner'

  const now = new Date()
  const today = toDateStr(now)
  const yesterday = toDateStr(new Date(now.getTime() - 86_400_000))

  const startOfMonth = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  // Last 7 days for the bar chart (start = 6 days ago)
  const sevenDaysAgo = toDateStr(new Date(now.getTime() - 6 * 86_400_000))

  // Fetch all data in parallel — analytics only available to owners
  const [todayResult, yesterdayResult, monthResult, weekResult, lowStockResult, expiryResult, onboardingResult, storeResult] =
    await Promise.all([
      isOwner ? getSalesAnalytics(today, today) : Promise.resolve(null),
      isOwner ? getSalesAnalytics(yesterday, yesterday) : Promise.resolve(null),
      isOwner ? getSalesAnalytics(startOfMonth, today) : Promise.resolve(null),
      isOwner ? getSalesAnalytics(sevenDaysAgo, today) : Promise.resolve(null),
      getLowStockAlerts(),
      getExpiryAlerts(7),
      isOwner ? getOnboardingState() : Promise.resolve(null),
      getStoreSettings(),
    ])

  const todayData = todayResult?.success ? todayResult.data : null
  const yesterdayData = yesterdayResult?.success ? yesterdayResult.data : null
  const monthData = monthResult?.success ? monthResult.data : null
  const weekData = weekResult?.success ? weekResult.data : null

  const onboardingState = onboardingResult?.success ? onboardingResult.data : null
  const currency = storeResult?.success ? storeResult.data.currency : 'NGN'
  const currencySymbol = getCurrencySymbol(currency)

  const lowStockCount = lowStockResult.success ? lowStockResult.data.length : 0
  const expiryCount = expiryResult.success ? expiryResult.data.length : 0
  const alertCount = lowStockCount + expiryCount

  const revenueTrend = todayData && yesterdayData
    ? fmtTrend(todayData.totalRevenue, yesterdayData.totalRevenue)
    : undefined
  const txTrend = todayData && yesterdayData
    ? fmtTrend(todayData.totalTransactions, yesterdayData.totalTransactions)
    : undefined

  const todayTopProducts = todayData?.topProducts.slice(0, 5) ?? []
  const weeklyChartData = weekData?.dailyRevenue ?? []

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1200px]">
      {/* Page header */}
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Onboarding Checklist */}
      {isOwner && onboardingState && !onboardingState.isDismissed && (
        <OnboardingChecklist state={onboardingState} />
      )}

      {/* Alert banner */}
      {alertCount > 0 && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg"
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
          }}
          role="alert"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {expiryCount > 0 && (
                <span>
                  <strong style={{ color: 'var(--warning)' }}>{expiryCount}</strong>{' '}
                  {expiryCount === 1 ? 'item' : 'items'} expiring within 7 days
                </span>
              )}
              {expiryCount > 0 && lowStockCount > 0 && ' and '}
              {lowStockCount > 0 && (
                <span>
                  <strong style={{ color: 'var(--warning)' }}>{lowStockCount}</strong>{' '}
                  {lowStockCount === 1 ? 'item' : 'items'} below reorder level
                </span>
              )}
              .
            </p>
          </div>
          <Link
            href="/alerts"
            className="text-sm font-medium whitespace-nowrap shrink-0"
            style={{ color: 'var(--warning)' }}
          >
            View all alerts &rarr;
          </Link>
        </div>
      )}

      {/* Stat cards */}
      {isOwner ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Today's Revenue"
            value={todayData ? fmtCurrency(todayData.totalRevenue, currencySymbol) : '—'}
            trend={revenueTrend}
            trendLabel="vs yesterday"
          />
          <StatCard
            title="Today's Transactions"
            value={todayData ? todayData.totalTransactions.toLocaleString() : '—'}
            trend={txTrend}
            trendLabel="vs yesterday"
          />
          <StatCard
            title="This Month's Revenue"
            value={monthData ? fmtCurrency(monthData.totalRevenue, currencySymbol) : '—'}
          />
          <div
            className="rounded-[12px] border p-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: alertCount > 0 ? 'var(--warning)' : 'var(--border)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
              Items Needing Attention
            </p>
            <p className="text-2xl font-semibold leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
              {alertCount}
            </p>
            {alertCount > 0 && (
              <span
                className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  border: '1px solid var(--warning)',
                }}
              >
                Needs review
              </span>
            )}
            {alertCount === 0 && (
              <span
                className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}
              >
                All good
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Non-owner: only show the attention card */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="rounded-[12px] border p-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: alertCount > 0 ? 'var(--warning)' : 'var(--border)',
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
              Items Needing Attention
            </p>
            <p className="text-2xl font-semibold leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
              {alertCount}
            </p>
            {alertCount > 0 ? (
              <span
                className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' }}
              >
                Needs review
              </span>
            ) : (
              <span
                className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}
              >
                All good
              </span>
            )}
          </div>
        </div>
      )}

      {/* Two-column grid — owner only */}
      {isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT — Sales This Week chart */}
          <div
            className="rounded-[12px] border p-4 flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Sales This Week
              </h2>
              <Link
                href="/analytics"
                className="text-xs"
                style={{ color: 'var(--accent-primary)' }}
              >
                Full analytics &rarr;
              </Link>
            </div>
            <WeeklyChart data={weeklyChartData} currencySymbol={currencySymbol} />
          </div>

          {/* RIGHT — Top Products Today */}
          <div
            className="rounded-[12px] border p-4 flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Top Products Today
              </h2>
              <Link
                href="/analytics"
                className="text-xs"
                style={{ color: 'var(--accent-primary)' }}
              >
                View full analytics &rarr;
              </Link>
            </div>

            {todayTopProducts.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                No sales recorded today.
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="pb-2 text-left font-medium text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', width: 28 }}>#</th>
                      <th className="pb-2 text-left font-medium text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Product</th>
                      <th className="pb-2 text-right font-medium text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Units</th>
                      <th className="pb-2 text-right font-medium text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayTopProducts.map((p, i) => (
                      <tr
                        key={p.productId}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td className="py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {i + 1}
                        </td>
                        <td className="py-2.5">
                          <Link
                            href={`/products/${p.productId}`}
                            className="text-sm hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {p.unitsSold.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right text-sm tabular-nums font-medium" style={{ color: 'var(--positive)' }}>
                          {fmtCurrency(p.revenue, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
