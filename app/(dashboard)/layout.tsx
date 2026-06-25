import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ensure user exists in app DB before rendering dashboard
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Right: topbar + scrollable content */}
      <div
        style={{
          flex: 1,
          marginLeft: 64,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
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
  )
}
