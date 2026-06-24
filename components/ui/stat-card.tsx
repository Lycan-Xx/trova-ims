import * as React from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  trend?: number
  trendLabel?: string
}

export function StatCard({ title, value, trend, trendLabel, className, ...props }: StatCardProps) {
  const hasTrend = trend !== undefined && trend !== null
  const isPositive = hasTrend && trend >= 0
  const isNegative = hasTrend && trend < 0

  return (
    <div
      className={cn(
        'rounded-[12px] border border-border bg-bg-card p-4',
        className,
      )}
      {...props}
    >
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
        {title}
      </p>

      <p className="text-2xl font-semibold text-text-primary leading-none mb-2">
        {value}
      </p>

      {hasTrend && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              isPositive && 'text-positive',
              isNegative && 'text-danger',
            )}
          >
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          {trendLabel && (
            <span className="text-xs text-text-muted">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
