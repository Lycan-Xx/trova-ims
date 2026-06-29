'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const BARS = [
  { day: 'M', h: 42 },
  { day: 'T', h: 67 },
  { day: 'W', h: 54 },
  { day: 'T', h: 88 },
  { day: 'F', h: 71 },
  { day: 'S', h: 95 },
  { day: 'S', h: 58 },
]

const CURRENCIES = [
  { symbol: '₦', name: 'Nigerian Naira' },
  { symbol: '$', name: 'US Dollar' },
  { symbol: '€', name: 'Euro' },
  { symbol: '£', name: 'British Pound' },
  { symbol: '¥', name: 'Japanese Yen' },
  { symbol: '₹', name: 'Indian Rupee' },
]

export default function Hero() {
  const [currIdx, setCurrIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(
      () => setCurrIdx((i) => (i + 1) % CURRENCIES.length),
      2000
    )
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative min-h-[calc(100vh-56px)] flex items-center">

      {/* ── Grid texture ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* ── Ambient glow top-right ── */}
      <div
        className="absolute top-0 right-0 w-[700px] h-[700px] pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(245,97,10,0.07) 0%, transparent 60%)',
        }}
      />

      {/* ── Main grid ── */}
      <div className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-24 lg:py-20 grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-16 xl:gap-28 items-center">

        {/* ── LEFT: Copy ────────────────────────────────────── */}
        <div className="flex flex-col items-start">

          {/* Eyebrow pill */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-10"
            style={{
              backgroundColor: 'var(--accent-primary-muted)',
              borderColor: 'rgba(245,97,10,0.3)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{ backgroundColor: 'var(--accent-primary)' }}
              aria-hidden="true"
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--accent-primary)' }}
            >
              Inventory Management System
            </span>
          </div>

          {/* H1 */}
          <h1
            className="font-bold leading-[0.92] tracking-[-0.035em] mb-7"
            style={{
              fontSize: 'clamp(50px, 7.5vw, 90px)',
              color: 'var(--text-primary)',
            }}
          >
            Know your
            <br />
            store,{' '}
            <span
              className="italic"
              style={{ color: 'var(--accent-primary)' }}
            >
              always.
            </span>
          </h1>

          {/* Body */}
          <p
            className="leading-relaxed mb-10"
            style={{
              fontSize: 'clamp(15px, 1.8vw, 17px)',
              color: 'var(--text-secondary)',
              maxWidth: 400,
            }}
          >
            Trova tracks every item, every batch, every{' '}
            <span
              className="font-semibold tabular-nums"
              style={{
                color: 'var(--accent-primary)',
                display: 'inline-block',
                minWidth: '1.2em',
                textAlign: 'center',
              }}
              aria-live="polite"
              aria-label={CURRENCIES[currIdx].name}
            >
              {CURRENCIES[currIdx].symbol}
            </span>{' '}
            from the moment goods arrive to the moment a receipt prints.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2.5 text-white font-semibold px-6 py-3.5 rounded-xl transition-opacity duration-150 hover:opacity-90 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent-primary)',
                fontSize: 14,
              }}
            >
              Start for free
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 7h8M8 4l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-white"
              style={{ fontSize: 14, color: 'var(--text-muted)' }}
            >
              Sign in to your store
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 6.5h8M7.5 4l3 2.5-3 2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Trust note */}
          <div
            className="mt-7 flex items-center gap-2"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--positive)' }}
              aria-hidden="true"
            />
            No credit card required · Free to start
          </div>
        </div>

        {/* ── RIGHT: Dashboard card ──────────────────────────── */}
        {/*
          Extra vertical padding on this column so the floating
          chips (-top-4 / -bottom-5) are not clipped on any screen size.
        */}
        <div className="relative flex justify-center lg:justify-end pt-8 pb-10">

          {/* Orange ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="w-72 h-72 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(245,97,10,0.09) 0%, transparent 70%)',
                filter: 'blur(48px)',
              }}
            />
          </div>

          {/* Card stack wrapper — constrains width on mobile */}
          <div className="relative w-full max-w-[340px]">

            {/* ── Floating top-right chip: last sale ── */}
            <div
              className="absolute -top-5 -right-3 sm:-right-5 z-10 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
              aria-label="Last sale recorded"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--positive-bg)' }}
                aria-hidden="true"
              >
                {/* receipt lines icon */}
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M2 2.5h7M2 5h7M2 7.5h4"
                    stroke="#4ADE80"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-[11px] font-semibold leading-none mb-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Sale #SS-240629
                </p>
                <p className="text-[10px]" style={{ color: 'var(--positive)' }}>
                  ₦9,600 · just now
                </p>
              </div>
            </div>

            {/* ── Main stat card ── */}
            <div
              className="relative rounded-2xl border p-6 shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-5">
                <span
                  className="text-[11px] font-medium uppercase tracking-[0.1em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Today's Revenue
                </span>
                <span
                  className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: 'var(--positive)' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--positive)' }}
                    aria-hidden="true"
                  />
                  Live
                </span>
              </div>

              {/* Revenue figure */}
              <div
                className="text-[38px] font-bold leading-none tracking-tight mb-1 tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                ₦124,500
              </div>
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: 'var(--positive)' }}
                >
                  +12.4%
                </span>
                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  vs yesterday
                </span>
              </div>

              {/* Bar chart */}
              <div
                className="flex items-end gap-1.5 h-16 mb-2"
                aria-hidden="true"
              >
                {BARS.map(({ h, day }, i) => (
                  <div key={`bar-${i}`} className="flex-1">
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor:
                          h === 95
                            ? 'var(--accent-primary)'
                            : i === 5
                            ? 'rgba(245,97,10,0.4)'
                            : 'rgba(245,97,10,0.18)',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mb-5" aria-hidden="true">
                {BARS.map(({ day }, i) => (
                  <div
                    key={`label-${i}`}
                    className="flex-1 text-center"
                    style={{ fontSize: 9, color: 'var(--text-muted)' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Footer stats row */}
              <div
                className="pt-4 grid grid-cols-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                {[
                  { val: '47', label: 'Sales', color: 'var(--text-primary)' },
                  { val: '312', label: 'Units', color: 'var(--text-primary)' },
                  { val: '3', label: 'Alerts', color: 'var(--warning)' },
                ].map(({ val, label, color }) => (
                  <div key={label}>
                    <div
                      className="text-[20px] font-bold leading-none tabular-nums"
                      style={{ color }}
                    >
                      {val}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Floating bottom-left chip: expiry alert ── */}
            <div
              className="absolute -bottom-6 -left-3 sm:-left-5 z-10 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
              aria-label="3 items expiring this week"
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--warning-bg)' }}
                aria-hidden="true"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 1.5L1.2 10h9.6L6 1.5z"
                    stroke="#FBBF24"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 4.8v2"
                    stroke="#FBBF24"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <circle cx="6" cy="8.2" r="0.5" fill="#FBBF24" />
                </svg>
              </div>
              <div>
                <p
                  className="text-[11px] font-semibold leading-none mb-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  3 items expiring
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  within 7 days
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}