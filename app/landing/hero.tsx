'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const BARS = [
  { day: 'M', pct: 42 },
  { day: 'T', pct: 67 },
  { day: 'W', pct: 54 },
  { day: 'T', pct: 88 },
  { day: 'F', pct: 71 },
  { day: 'S', pct: 95 },
  { day: 'S', pct: 58 },
]

const CURRENCIES = [
  { symbol: '₦', code: 'NGN', name: 'Nigerian Naira' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
]

export default function Hero() {
  const [currentCurrencyIndex, setCurrentCurrencyIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCurrencyIndex((prev) => (prev + 1) % CURRENCIES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const currentCurrency = CURRENCIES[currentCurrencyIndex]

  return (
    <section className="relative overflow-hidden min-h-[calc(100vh-56px)] flex items-center">
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-16 xl:gap-24 items-center">

        {/* ── Left: headline ─────────────────────────────────── */}
        <div className="flex flex-col items-start">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)] mb-8">
            Inventory Management System
          </p>

          <h1
            className="font-bold leading-[0.94] tracking-[-0.035em] text-[var(--text-primary)] mb-6"
            style={{ fontSize: 'clamp(54px, 7.5vw, 92px)' }}
          >
            Know your<br />
            store,{' '}
            <span className="text-[var(--accent-primary)] italic">always.</span>
          </h1>

          <p
            className="leading-relaxed text-[var(--text-secondary)] max-w-[360px] mb-10"
            style={{ fontSize: 'clamp(15px, 1.8vw, 17px)' }}
          >
            Trova tracks every item, every batch, every{' '}
            <span 
              className="inline-block min-w-[28px] transition-all duration-300 font-semibold text-[var(--accent-primary)]"
              title={currentCurrency.name}
            >
              {currentCurrency.symbol}
            </span>
            {' '} from the moment goods arrive to the moment a receipt is printed.
          </p>

          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[14px] font-semibold px-6 py-3.5 rounded-xl transition-colors duration-150"
          >
            Start for free
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="mt-8 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" aria-hidden="true" />
            No credit card required &nbsp;·&nbsp; Free to start
          </div>
        </div>

        {/* ── Right: live dashboard card ──────────────────────── */}
        <div className="relative flex flex-col items-center lg:items-end">

          {/* Soft glow behind card */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="w-72 h-72 rounded-full blur-3xl"
              style={{ backgroundColor: 'rgba(245,97,10,0.08)' }}
            />
          </div>

          {/* Stat card */}
          <div
            className="relative w-full max-w-[340px] rounded-2xl border border-[var(--border)] p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-card)' }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Today&apos;s Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--positive)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] animate-pulse" />
                Live
              </span>
            </div>

            {/* Big number */}
            <div className="mb-1">
              <span className="text-[40px] font-bold tracking-tight text-[var(--text-primary)] leading-none">
                ₦124,500
              </span>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[12px] font-semibold text-[var(--positive)]">+12.4%</span>
              <span className="text-[12px] text-[var(--text-muted)]">vs yesterday</span>
            </div>

            {/* Mini bar chart */}
            <div className="flex items-end gap-[5px] h-14 mb-2" aria-hidden="true">
              {BARS.map(({ day, pct }, i) => (
                <div key={`${day}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: pct === 95 ? 'var(--accent-primary)' : 'rgba(245,97,10,0.22)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-[5px] mb-5" aria-hidden="true">
              {BARS.map(({ day }, i) => (
                <div
                  key={`label-${i}`}
                  className="flex-1 text-center text-[9px] text-[var(--text-muted)]"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Footer stats */}
            <div
              className="pt-4 flex items-center gap-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <div className="text-[22px] font-bold text-[var(--text-primary)] leading-none">47</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Sales</div>
              </div>
              <div className="w-px h-8 bg-[var(--border)]" />
              <div>
                <div className="text-[22px] font-bold text-[var(--text-primary)] leading-none">12</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Products</div>
              </div>
              <div className="w-px h-8 bg-[var(--border)]" />
              <div>
                <div className="text-[22px] font-bold text-[var(--warning)] leading-none">3</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Alerts</div>
              </div>
            </div>
          </div>

          {/* Floating alert chip */}
          <div
            className="absolute -bottom-3 left-0 lg:-left-6 flex items-center gap-2 text-[11px] font-medium rounded-xl px-3 py-2 shadow-xl border"
            style={{
              backgroundColor: 'var(--warning-bg)',
              borderColor: 'var(--warning)',
              color: 'var(--warning)',
            }}
            aria-label="3 items expiring this week"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1.5L1.2 10h9.6L6 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
              <path d="M6 5v2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              <circle cx="6" cy="8.8" r="0.55" fill="currentColor" />
            </svg>
            3 items expiring this week
          </div>
        </div>
      </div>
    </section>
  )
}
