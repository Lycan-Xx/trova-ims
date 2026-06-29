import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Topbar } from '@/components/layout/topbar'
import { CurrencyProvider } from '@/components/providers/currency-provider'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  // Fetch store info for currency context
  const storeResult = await query(
    'SELECT id, name, address, phone, currency, created_at FROM stores WHERE id = $1 LIMIT 1',
    [user.store_id],
  )
  const store = storeResult.rows[0] || null

  return (
    <CurrencyProvider store={store}>
      <>
        {/* Desktop layout: fixed sidebar + content column */}
        <div
          className="hidden md:flex"
          style={{
            height: '100vh',
            backgroundColor: 'var(--bg-base)',
            overflow: 'hidden',
          }}
        >
          <Sidebar userRole={user.role} />
          {/* Content area — sidebar is fixed-position so we pad-left to avoid overlap */}
          <div
            style={{
              flex: 1,
              paddingLeft: 'var(--sidebar-w, 64px)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              transition: 'padding-left 150ms ease',
              willChange: 'padding-left',
            }}
          >
            <Topbar />
            <main
              style={{
                flex: 1,
                overflowY: 'auto',
                backgroundColor: 'var(--bg-base)',
              }}
            >
              {children}
            </main>
          </div>
        </div>

        {/* Mobile layout: topbar + scrollable content + bottom nav */}
        <div
          className="flex flex-col md:hidden"
          style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}
        >
          <Topbar />
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: 'var(--bg-base)',
              paddingBottom: 72,
            }}
          >
            {children}
          </main>
          <MobileNav userRole={user.role} />
        </div>
      </>
    </CurrencyProvider>
  )
}
