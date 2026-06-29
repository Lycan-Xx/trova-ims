'use client'

const STEPS = [
  {
    n: '01',
    title: 'Create your store in 30 seconds',
    body: "Sign up and Trova sets up your store automatically. Add your store name, invite your cashiers and storekeepers, and assign each person a role.",
  },
  {
    n: '02',
    title: 'Add your products and suppliers',
    body: 'Build your product catalogue names, categories, selling prices, and reorder thresholds. Add the vendors you buy from, direct or consignment.',
  },
  {
    n: '03',
    title: 'Log every delivery as it arrives',
    body: 'Each incoming delivery is recorded as a batch vendor, quantity, cost per unit, expiry date. Your stock levels are always accurate because they reflect what actually came in.',
  },
  {
    n: '04',
    title: 'Sell, track, and check in daily',
    body: "Process sales at the counter, download receipts, and open your dashboard every morning. You'll know your revenue, your alerts, and your best-selling products before the first customer walks in.",
  },
]

export default function HowItWorks() {
  return (
    <section
      className="py-24 px-6 md:px-10 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-16">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            How it works
          </p>
          <h2
            className="font-bold tracking-tight leading-[1.08]"
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              color: 'var(--text-primary)',
            }}
          >
            Up and running in minutes.
          </h2>
        </div>

        {/* Steps */}
        <div>
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="grid grid-cols-[56px_1fr] md:grid-cols-[80px_1fr] gap-6 md:gap-10 py-10 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Step number */}
              <span
                className="mono text-[13px] font-bold pt-1 tabular-nums"
                style={{ color: 'var(--accent-primary)' }}
              >
                {step.n}
              </span>

              {/* Content */}
              <div>
                <h3
                  className="text-[19px] font-semibold leading-snug mb-2.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[14px] leading-relaxed max-w-2xl"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
