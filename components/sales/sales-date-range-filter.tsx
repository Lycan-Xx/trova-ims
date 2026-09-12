'use client'

import * as React from 'react'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'

type DateRange = { from: string | null; to: string | null }

interface SalesDateRangeFilterProps {
  dateFrom?: string
  dateTo?: string
  onChange: (range: DateRange) => void
}

function todayInLagos(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function displayDate(value?: string): string {
  if (!value) return 'All dates'
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export function SalesDateRangeFilter({ dateFrom, dateTo, onChange }: SalesDateRangeFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customFrom, setCustomFrom] = React.useState(dateFrom ?? '')
  const [customTo, setCustomTo] = React.useState(dateTo ?? '')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const today = todayInLagos()

  React.useEffect(() => {
    if (!open) return
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const presets = [
    { label: 'Today', range: { from: null, to: null } },
    { label: 'Yesterday', range: { from: shiftDate(today, -1), to: shiftDate(today, -1) } },
    { label: 'Last 7 days', range: { from: shiftDate(today, -6), to: today } },
    { label: 'This month', range: { from: `${today.slice(0, 8)}01`, to: today } },
    { label: 'Last 30 days', range: { from: shiftDate(today, -29), to: today } },
  ]

  const isToday = (dateFrom ?? today) === today && (dateTo ?? today) === today
  const label = isToday
    ? 'Today'
    : dateFrom && dateTo && dateFrom === dateTo
      ? displayDate(dateFrom)
      : dateFrom || dateTo
        ? `${displayDate(dateFrom)} – ${displayDate(dateTo)}`
        : 'All dates'

  function choosePreset(range: DateRange) {
    onChange(range)
    setCustomOpen(false)
    setOpen(false)
  }

  function applyCustomRange() {
    if (!customFrom || !customTo || customFrom > customTo) return
    onChange({ from: customFrom, to: customTo })
    setCustomOpen(false)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-9 min-w-[190px] items-center justify-between gap-3 rounded-lg px-3 text-sm transition-colors"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2"><CalendarDays size={14} />{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-64 rounded-xl border p-2 shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} role="menu">
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Show sales from</p>
          {presets.map((preset) => {
            const selected = preset.label === 'Today' ? isToday : preset.range.from === dateFrom && preset.range.to === dateTo
            return (
              <button key={preset.label} type="button" role="menuitem" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-bg-input" style={{ color: 'var(--text-primary)' }} onClick={() => choosePreset(preset.range)}>
                {preset.label}
                {selected && <Check size={15} style={{ color: 'var(--accent-primary)' }} />}
              </button>
            )
          })}
          <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
          <button type="button" role="menuitem" className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-bg-input" style={{ color: 'var(--text-primary)' }} onClick={() => { setCustomFrom(dateFrom ?? today); setCustomTo(dateTo ?? today); setCustomOpen((value) => !value) }}>
            Custom date range…
          </button>
          {customOpen && (
            <div className="mt-2 space-y-2 rounded-lg p-2" style={{ background: 'var(--bg-input)' }}>
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Start date<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }} /></label>
              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>End date<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }} /></label>
              <button type="button" className="h-9 w-full rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent-primary)' }} disabled={!customFrom || !customTo || customFrom > customTo} onClick={applyCustomRange}>Apply date range</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
