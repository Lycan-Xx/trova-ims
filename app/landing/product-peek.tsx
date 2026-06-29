'use client'

const RECEIPT_ITEMS = [
  { name: 'Indomie 70g', qty: 6, total: '₦1,800' },
  { name: 'Milo 400g', qty: 2, total: '₦5,000' },
  { name: 'Peak Milk 170g', qty: 4, total: '₦2,800' },
]

const PROOF_POINTS = [
  'One tap to download as PDF',
  'Store name and address on every receipt',
  'Unique numbered receipt per transaction',
]

export default function ProductPeek() {
  return (
    <section
      className="py-24 px-6 md:px-10 border-b overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

        {/* ── Left: receipt visual ─────────────────────────── */}
        <div className="relative flex items-center justify-center py-12 order-2 lg:order-1">

          {/* Background glow */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="w-72 h-72 rounded-full blur-3xl"
              style={{ backgroundColor: 'rgba(245,97,10,0.06)' }}
            />
          </div>

          {/* Shadow card behind rotated opposite */}
          <div
            className="absolute w-[252px] h-[340px] rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              transform: 'rotate(4deg) translateY(8px)',
            }}
            aria-hidden="true"
          />

          {/* The actual receipt */}
          <div
            className="relative rounded-2xl shadow-2xl overflow-hidden"
            style={{
              width: 252,
              backgroundColor: '#FAFAFA',
              transform: 'rotate(-2.5deg)',
            }}
          >
            <div
              className="px-5 py-6 text-black"
              style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
            >
              {/* Store header */}
              <div className="text-center mb-5 pb-4 border-b border-dashed border-gray-300">
                <div className="text-[13px] font-bold tracking-tight mb-0.5">
                  MUSA STORES LTD
                </div>
                <div className="text-[10px] text-gray-400">22 Ibrahim Taiwo Road, Yola</div>
                <div className="text-[10px] text-gray-400">+234 802 000 0000</div>
              </div>

              {/* Receipt meta */}
              <div className="text-[10px] mb-4 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">RECEIPT</span>
                  <span className="font-semibold text-gray-700">#SS-240622-001</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span className="text-gray-700">22 Jun 2024 · 10:32</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cashier</span>
                  <span className="text-gray-700">Amina Y.</span>
                </div>
              </div>

              {/* Items */}
              <div className="pt-3 pb-3 border-t border-dashed border-gray-300 space-y-2.5">
                {RECEIPT_ITEMS.map((item) => (
                  <div key={item.name} className="flex justify-between items-start text-[10px]">
                    <div>
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-gray-400">× {item.qty}</div>
                    </div>
                    <div className="font-bold text-gray-800">{item.total}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-dashed border-gray-300 space-y-1 text-[10px]">
                <div className="flex justify-between font-bold text-[12px] text-gray-900">
                  <span>TOTAL</span>
                  <span>₦9,600</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Cash received</span>
                  <span>₦10,000</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Change</span>
                  <span>₦400</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-5 pt-4 border-t border-dashed border-gray-300 text-center text-[10px] text-gray-400 leading-relaxed">
                <div>Payment: Cash</div>
                <div className="mt-0.5">Thank you for your business!</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: copy ──────────────────────────────────── */}
        <div className="order-1 lg:order-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-5"
            style={{ color: 'var(--text-muted)' }}
          >
            Receipts
          </p>

          <h2
            className="font-bold tracking-tight leading-[1.08] mb-6"
            style={{
              fontSize: 'clamp(28px, 4vw, 46px)',
              color: 'var(--text-primary)',
            }}
          >
            Every sale,
            <br />documented instantly.
          </h2>

          <p
            className="text-[16px] leading-relaxed mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            Complete a sale and a professional receipt is ready to download
            your store name, itemised list, totals, payment method, and change.
            No manual work. No templates to fill in.
          </p>

          <ul className="space-y-3">
            {PROOF_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[14px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--positive)' }}
                >
                  <path
                    d="M3 8l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
