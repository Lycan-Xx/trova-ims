'use client'

import type { LucideIcon } from 'lucide-react'

export function DemoPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-primary">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function DemoStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'orange',
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: 'orange' | 'green' | 'teal' | 'yellow'
}) {
  const tones = {
    orange: ['var(--accent-primary)', 'var(--accent-primary-muted)'],
    green: ['var(--positive)', 'var(--positive-bg)'],
    teal: ['var(--accent-teal)', 'rgba(78,205,196,0.12)'],
    yellow: ['var(--accent-yellow)', 'var(--warning-bg)'],
  } as const
  const [color, background] = tones[tone]

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg" style={{ color, background }}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </div>
  )
}

export function DemoCard({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-bg-card ${className}`}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 md:px-5">
          <div>
            {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
            {description && <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function DemoActionButton({
  children,
  onClick,
  variant = 'primary',
  icon: Icon,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: LucideIcon
}) {
  const variants = {
    primary: 'border-accent-primary bg-accent-primary text-white hover:opacity-90',
    secondary: 'border-border bg-bg-input text-text-secondary hover:text-white',
    danger: 'border-danger/30 bg-danger-bg text-danger hover:border-danger/60',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${variants[variant]}`}
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  )
}

export function DemoSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <svg className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-bg-input pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent-primary"
      />
    </label>
  )
}

export function DemoSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-bg-input px-3 text-sm text-text-secondary outline-none focus:border-accent-primary"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function DemoBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'orange' | 'teal'
}) {
  const tones = {
    neutral: 'bg-bg-input text-text-secondary',
    positive: 'bg-positive-bg text-positive',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    orange: 'bg-accent-primary-muted text-accent-primary',
    teal: 'bg-[rgba(78,205,196,0.12)] text-accent-teal',
  }
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}

