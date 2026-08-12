'use client'

// WeeklyChart pulls in recharts, which is a meaningfully large library for
// a single bar chart. Since this is the very first page every user sees
// after logging in, shipping recharts in the initial bundle costs everyone
// load time up front for a chart most people glance at, not stare at.
// Loading it dynamically (ssr: false) keeps recharts out of the critical
// first paint — it fetches in the background and swaps in once ready,
// while the rest of the dashboard (stats, alerts, top products) is already
// interactive.

import dynamic from 'next/dynamic'
import type { DailyRevenue } from '@/app/actions/analytics'

const WeeklyChart = dynamic(
  () => import('./weekly-chart').then((m) => m.WeeklyChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[220px] rounded-lg animate-pulse"
        style={{ background: 'var(--bg-input)' }}
      />
    ),
  },
)

interface WeeklyChartLoaderProps {
  data: DailyRevenue[]
  currencySymbol: string
}

export function WeeklyChartLoader({ data, currencySymbol }: WeeklyChartLoaderProps) {
  return <WeeklyChart data={data} currencySymbol={currencySymbol} />
}
