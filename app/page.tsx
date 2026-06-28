import Link from 'next/link'
import {
  Package,
  BarChart2,
  Bell,
  ShoppingCart,
  Truck,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Package,
    title: 'Inventory Tracking',
    desc: 'Real-time stock levels across every product and batch. Know exactly what you have and where it is.',
  },
  {
    icon: ClipboardList,
    title: 'Stock Intake',
    desc: 'Log supplier deliveries with batch tracking, expiry dates, and per-unit cost calculations.',
  },
  {
    icon: ShoppingCart,
    title: 'Point of Sale',
    desc: 'Fast checkout with automatic inventory deduction, receipt generation, and payment tracking.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Proactive low-stock and expiry warnings so you never miss a reorder or sell expired goods.',
  },
  {
    icon: Truck,
    title: 'Vendor Management',
    desc: 'Maintain supplier records, track direct and consignment relationships, and export purchase history.',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    desc: 'Revenue trends, top products, daily sales charts, and margin insights — all in one view.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Create your store',
    desc: 'Sign up and Trova automatically sets up your store. Invite team members with role-based access.',
  },
  {
    n: '02',
    title: 'Add your inventory',
    desc: 'Create product categories, add products with SKUs and reorder thresholds, then log your first intake.',
  },
  {
    n: '03',
    title: 'Start selling',
    desc: 'Process sales at the counter. Inventory updates instantly. Receipts are generated automatically.',
  },
  {
    n: '04',
    title: 'Stay informed',
    desc: 'Review daily analytics, act on alerts, and keep your store running without gaps or surprises.',
  },
]

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0D0D0D',
        color: '#FFFFFF',
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 56,
          backgroundColor: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1E1E1E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          maxWidth: '100%',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              backgroundColor: '#F5610A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
              <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Trova
          </span>
        </div>

        {/* Right CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/sign-in"
            style={{ fontSize: 13, color: '#A3A3A3', textDecoration: 'none' }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#F5610A',
              padding: '7px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '96px 24px 80px',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        {/* Eyebrow */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#F5610A',
            backgroundColor: 'rgba(245,97,10,0.1)',
            border: '1px solid rgba(245,97,10,0.25)',
            borderRadius: 999,
            padding: '4px 14px',
            marginBottom: 28,
          }}
        >
          Inventory. Reimagined.
        </span>

        <h1
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            marginBottom: 20,
          }}
          className="text-balance"
        >
          Stock management
          <br />
          <span style={{ color: '#F5610A' }}>without the noise.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            lineHeight: 1.65,
            color: '#A3A3A3',
            maxWidth: 520,
            marginBottom: 40,
          }}
          className="text-pretty"
        >
          Trova gives retail stores a single system for inventory, sales, vendors,
          and analytics — clean, fast, and built for the way you actually work.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href="/sign-up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#F5610A',
              padding: '12px 24px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Start for free
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <Link
            href="/sign-in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 14,
              fontWeight: 500,
              color: '#A3A3A3',
              border: '1px solid #2E2E2E',
              backgroundColor: 'transparent',
              padding: '12px 24px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Sign in to your store
          </Link>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, backgroundColor: '#1E1E1E', margin: '0 24px' }} />

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
            Everything in one place
          </p>
          <h2
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.025em', color: '#FFFFFF' }}
            className="text-balance"
          >
            Built for the full retail cycle
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 2,
          }}
        >
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              style={{
                padding: '28px 28px',
                borderRadius: 0,
                border: '1px solid #1E1E1E',
                backgroundColor: '#111111',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#161616')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111111')}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  backgroundColor: 'rgba(245,97,10,0.12)',
                  border: '1px solid rgba(245,97,10,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Icon size={18} strokeWidth={1.75} style={{ color: '#F5610A' }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>
                {title}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: '#666666' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, backgroundColor: '#1E1E1E', margin: '0 24px' }} />

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
            How it works
          </p>
          <h2
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.025em', color: '#FFFFFF' }}
            className="text-balance"
          >
            Up and running in minutes
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 24,
          }}
        >
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#F5610A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {n}
              </span>
              <div style={{ height: 1, backgroundColor: '#F5610A', opacity: 0.3 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', marginTop: 4 }}>
                {title}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: '#666666' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 1, backgroundColor: '#1E1E1E', margin: '0 24px' }} />

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '80px 24px 100px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: '#FFFFFF',
            marginBottom: 16,
          }}
          className="text-balance"
        >
          Ready to run a tighter store?
        </h2>
        <p style={{ fontSize: 15, color: '#666666', marginBottom: 36 }}>
          Create your free Trova account and have your first inventory set up today.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Link
            href="/sign-up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#F5610A',
              padding: '14px 32px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Create your store — it&apos;s free
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>

          <ul style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', listStyle: 'none', padding: 0, margin: 0 }}>
            {['No credit card required', 'Full-featured trial', 'Cancel anytime'].map((t) => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666' }}>
                <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#4ADE80', flexShrink: 0 }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid #1E1E1E',
          padding: '28px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#F5610A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-hidden="true"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
              <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Trova</span>
        </div>
        <p style={{ fontSize: 12, color: '#444' }}>
          &copy; {new Date().getFullYear()} Trova. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
