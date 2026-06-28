import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Topbar } from '@/components/layout/topbar'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  return (
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
        <Sidebar />
        {/* Content shifts right by sidebar width via CSS var (default 64px) */}
        <div
          style={{
            flex: 1,
            marginLeft: 'var(--sidebar-w, 64px)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            transition: 'margin-left 200ms ease',
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
        <MobileNav />
      </div>
    </>
  )
}
