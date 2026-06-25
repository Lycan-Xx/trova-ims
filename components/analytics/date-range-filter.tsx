'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

interface DateRangeFilterProps {
  preset: string
  from?: string
  to?: string
  dateFrom: string
  dateTo: string
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom' },
]

export function DateRangeFilter({ preset, from, to, dateFrom, dateTo }: DateRangeFilterProps) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = React.useState(from ?? dateFrom)
  const [customTo, setCustomTo] = React.useState(to ?? dateTo)

  function navigate(newPreset: string, f?: string, t?: string) {
    const params = new URLSearchParams({ preset: newPreset })
    if (newPreset === 'custom' && f && t) {
      params.set('from', f)
      params.set('to', t)
    }
    router.push(`/analytics?${params.toString()}`)
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      navigate('custom', customFrom, customTo)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset chips */}
      {PRESETS.map((p) => {
        const isActive = preset === p.key
        return (
          <button
            key={p.key}
            onClick={() => p.key !== 'custom' ? navigate(p.key) : navigate('custom', customFrom, customTo)}
            className="h-7 px-3 rounded-full text-xs font-medium transition-colors"
            style={{
              background: isActive ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border)'}`,
            }}
          >
            {p.label}
          </button>
        )
      })}

      {/* Custom date inputs */}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-7 px-2 rounded-lg text-xs"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              colorScheme: 'dark',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-7 px-2 rounded-lg text-xs"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              colorScheme: 'dark',
            }}
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="h-7 px-3 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--text-primary)',
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
