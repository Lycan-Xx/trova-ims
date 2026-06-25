'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyRevenue } from '@/app/actions/analytics'

function fmtCurrency(n: number): string {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
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
      <p className="font-semibold mt-0.5">{fmtCurrency(payload[0].value)}</p>
    </div>
  )
}

interface WeeklyChartProps {
  data: DailyRevenue[]
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' }),
    revenue: d.revenue,
  }))

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 200, color: 'var(--text-muted)', fontSize: 13 }}
      >
        No sales data for this period.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border)"
        />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? '₦' + (v / 1000).toFixed(0) + 'k' : '₦' + v
          }
        />
        <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--bg-card-hover)' }} />
        <Bar
          dataKey="revenue"
          fill="var(--accent-primary)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
