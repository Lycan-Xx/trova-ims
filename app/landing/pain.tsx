'use client'

const PAINS = [
  {
    label: 'Stock',
    statement: 'You discover goods have expired after the money is already gone.',
  },
  {
    label: 'Visibility',
    statement: "Stock counts only happen when something goes wrong.",
  },
  {
    label: 'Accounting',
    statement: "Month-end numbers never match what you actually sold.",
  },
]

export default function Pain() {
  return (
    <section
      className="border-y py-20 px-6 md:px-10"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-5xl mx-auto">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-14"
          style={{ color: 'var(--text-muted)' }}
        >
          The problem
        </p>

        <div>
          {PAINS.map((pain, i) => (
            <div key={pain.label}>
              {i > 0 && (
                <div
                  className="h-px w-full"
                  style={{ backgroundColor: 'var(--border)' }}
                />
              )}
              <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 md:gap-10 py-10 md:py-12 items-start">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.1em] pt-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {pain.label}
                </span>
                <p
                  className="font-medium leading-[1.25] tracking-[-0.015em]"
                  style={{
                    fontSize: 'clamp(22px, 3.2vw, 38px)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {pain.statement}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
