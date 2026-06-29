import Link from 'next/link'

export default function Cta() {
  return (
    <section
      className="relative overflow-hidden py-28 md:py-36 px-6 md:px-10 border-t"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* ── Radial glow rising from bottom ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 110%, rgba(245,97,10,0.09) 0%, transparent 70%)',
        }}
      />

      {/* ── Thin orange accent line centered at the top edge ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-20"
        style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.7 }}
        aria-hidden="true"
      />

      {/* ── Content ── */}
      <div className="relative max-w-2xl mx-auto text-center">

        {/* Eyebrow */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          Get started
        </p>

        {/* Headline */}
        <h2
          className="font-bold tracking-tight leading-[1.0] mb-5"
          style={{
            fontSize: 'clamp(34px, 5.5vw, 64px)',
            color: 'var(--text-primary)',
          }}
        >
          Run a tighter store.
          <br />
          <span style={{ color: 'var(--accent-primary)' }}>
            Starting today.
          </span>
        </h2>

        {/* Sub-copy */}
        <p
          className="text-[15px] leading-relaxed mb-10 max-w-sm mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Create your free Trova account. First batch logged in under a minute.
        </p>

        {/* Primary CTA */}
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2.5 text-white font-semibold px-8 py-4 rounded-xl transition-opacity duration-150 hover:opacity-90 whitespace-nowrap"
          style={{ backgroundColor: 'var(--accent-primary)', fontSize: 15 }}
        >
          Create your store — it&apos;s free
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

        {/* Trust micro-copy */}
        <p
          className="mt-5 text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          No credit card &nbsp;·&nbsp; No setup fee &nbsp;·&nbsp; Cancel anytime
        </p>
      </div>
    </section>
  )
}