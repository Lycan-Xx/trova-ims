// components/auth/auth-layout.tsx
import Image from 'next/image'
import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen w-full flex overflow-hidden">

      {/* ── Full-screen Background ────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/store.png"
          alt="A retail store at night"
          fill
          priority
          className="object-cover"
        />
        {/* Base scrim */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/35 to-black/65" />
        {/* Bottom gradient — strengthens text zone */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        {/* Top gradient — softens tree line */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
      </div>

      {/* ── Layout ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full min-h-screen">

        {/* ── Left Panel ─────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 flex-col justify-between p-12 xl:p-16">

          {/* Top — Wordmark */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/favicon.png"
              alt="Trova"
              width={30}
              height={30}
              className="flex-shrink-0"
              style={{ borderRadius: 7 }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
              }}
            >
              Trova
            </span>
          </div>

          {/* Bottom — Tagline */}
          <div className="max-w-md">
            {/* Accent rule */}
            <div
              style={{
                width: 48,
                height: 2,
                backgroundColor: '#F5610A',
                marginBottom: 20,
                borderRadius: 1,
              }}
            />

            {/* Main tagline */}
            <h1
              style={{
                fontSize: 'clamp(36px, 4vw, 54px)',
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Know your store,
              <br />
              <span style={{ color: '#F5610A' }}>always.</span>
            </h1>

            {/* Supporting line */}
            <p
              style={{
                marginTop: 18,
                fontSize: 13,
                fontWeight: 400,
                letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
              }}
            >
              Inventory · Sales · Vendors · Analytics
            </p>
          </div>
        </div>

        {/* ── Right Panel — Auth Card ─────────────────────────────────────── */}
        <section
          className="flex w-full lg:w-[400px] xl:w-[480px] items-center justify-center border-l px-8 py-12 lg:px-12 xl:px-16 shrink-0 min-h-screen"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="w-full max-w-md">

            {/* Mobile only — compact brand mark */}
            <div className="flex items-center gap-2 mb-10 lg:hidden">
              <Image
                src="/images/favicon.png"
                alt="Trova"
                width={26}
                height={26}
                className="flex-shrink-0"
                style={{ borderRadius: 6 }}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                Trova
              </span>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  )
}