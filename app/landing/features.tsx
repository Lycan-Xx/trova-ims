'use client'

import { useState } from 'react'
import {
  Package,
  ClipboardList,
  ShoppingCart,
  Truck,
  Bell,
  BarChart2,
} from 'lucide-react'

const FEATURES = [
  {
    Icon: Package,
    name: 'Inventory Control',
    headline: 'Always know what is in stock.',
    body: 'Stock levels are computed live from batch data — never from a manually updated number. When something sells, the shelf count drops. When a batch arrives, it rises. The number you see is always real.',
  },
  {
    Icon: ClipboardList,
    name: 'Batch Tracking',
    headline: 'Every delivery has a full record.',
    body: 'Each intake is logged as a batch — which vendor, what it cost per unit, how many arrived, and when it expires. When you sell, Trova pulls from the oldest batch first so nothing sits too long and spoils.',
  },
  {
    Icon: ShoppingCart,
    name: 'Point of Sale',
    headline: 'Checkout in seconds, receipt in one click.',
    body: 'Search for a product, set the quantity, confirm the payment. Trova calculates the change, decrements the stock, and generates a professional PDF receipt — all before the customer reaches for their bag.',
  },
  {
    Icon: Truck,
    name: 'Vendor Management',
    headline: 'Know exactly what you owe every supplier.',
    body: 'Track direct purchases and consignment vendors separately. For consignment, Trova shows exactly how many units from each vendor are still unsold on your shelf — so payment conversations have receipts.',
  },
  {
    Icon: Bell,
    name: 'Smart Alerts',
    headline: 'Problems surface before they cost you.',
    body: 'Every morning your dashboard shows items expiring within 30 days and products below their reorder level. You will know to run a promotion or place an order before the damage is done.',
  },
  {
    Icon: BarChart2,
    name: 'Analytics',
    headline: 'Understand what is making you money.',
    body: 'Top products by units and revenue, daily sales charts, profit margins per product, vendor spend summaries — all filterable by any date range and exportable to CSV with one click.',
  },
]

export default function Features() {
  const [active, setActive] = useState(0)
  const current = FEATURES[active]

  return (
    <section
      className="py-24 px-6 md:px-10 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <div className="mb-16">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Everything you need
          </p>
          <h2
            className="font-bold tracking-tight leading-[1.08]"
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              color: 'var(--text-primary)',
            }}
          >
            Built for the full retail cycle.
          </h2>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left: feature list */}
          <nav aria-label="Feature list">
            {FEATURES.map((feature, i) => {
              const { Icon, name } = feature
              const isActive = i === active
              return (
                <button
                  key={name}
                  onClick={() => setActive(i)}
                  aria-pressed={isActive}
                  className="w-full text-left flex items-center gap-4 py-5 border-b transition-colors duration-150 group"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Active indicator bar */}
                  <span
                    className="w-0.5 h-7 rounded-full flex-shrink-0 transition-colors duration-150"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--accent-primary)'
                        : 'transparent',
                    }}
                    aria-hidden="true"
                  />

                  {/* Icon */}
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className="flex-shrink-0 transition-colors duration-150"
                    style={{
                      color: isActive
                        ? 'var(--accent-primary)'
                        : 'var(--text-muted)',
                    }}
                  />

                  {/* Label */}
                  <span
                    className="text-[15px] font-medium transition-colors duration-150 flex-1"
                    style={{
                      color: isActive
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {name}
                  </span>

                  {/* Arrow on active */}
                  {isActive && (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 13 13"
                      fill="none"
                      aria-hidden="true"
                      className="flex-shrink-0"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      <path
                        d="M2.5 6.5h8M7 3.5l3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right: active detail card */}
          <div className="lg:sticky lg:top-24">
            <div
              className="rounded-2xl border p-8"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 border"
                style={{
                  backgroundColor: 'var(--accent-primary-muted)',
                  borderColor: 'rgba(245,97,10,0.2)',
                }}
                aria-hidden="true"
              >
                <current.Icon
                  size={22}
                  strokeWidth={1.75}
                  style={{ color: 'var(--accent-primary)' }}
                />
              </div>

              {/* Headline */}
              <h3
                className="font-bold leading-snug mb-4"
                style={{
                  fontSize: 'clamp(18px, 2.2vw, 24px)',
                  color: 'var(--text-primary)',
                }}
              >
                {current.headline}
              </h3>

              {/* Body */}
              <p
                className="text-[15px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {current.body}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
