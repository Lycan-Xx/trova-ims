'use client'

import Link from 'next/link'

export default function Cta() {
  return (
    <section className="py-32 px-6 md:px-10">
      <div className="max-w-3xl mx-auto text-center">

        <h2
          className="font-bold tracking-tight leading-[1.0] mb-6"
          style={{
            fontSize: 'clamp(36px, 5.5vw, 68px)',
            color: 'var(--text-primary)',
          }}
        >
          Ready to run a<br />
          <span style={{ color: 'var(--accent-primary)' }}>tighter store?</span>
        </h2>

        <p
          className="text-[16px] mb-10 max-w-xs mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Create your free Trova account. First batch logged in under a minute.
        </p>

        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2.5 text-white text-[15px] font-semibold px-8 py-4 rounded-xl transition-colors duration-150"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')
          }
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

        {/* Trust line */}
        <div
          className="mt-8 flex items-center justify-center gap-5 flex-wrap"
          style={{ color: 'var(--text-muted)' }}
        >
          {['No credit card required', 'Free to start', 'Cancel anytime'].map(
            (t, i) => (
              <span key={t} className="flex items-center gap-4 text-[12px]">
                {i > 0 && (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--border)' }}
                    aria-hidden="true"
                  />
                )}
                {t}
              </span>
            )
          )}
        </div>
      </div>
    </section>
  )
}
