import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
