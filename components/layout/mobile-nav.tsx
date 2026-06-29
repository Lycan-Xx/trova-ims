'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Bell,
  MoreHorizontal,
} from 'lucide-react'
import * as React from 'react'
import { Truck, ClipboardList, BarChart2, Settings } from 'lucide-react'
import type { UserRole } from '@/lib/db/schema'
import { getAccessiblePages, PageFeature } from '@/lib/auth/role-access'

const PRIMARY_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home'    },
  { href: '/products',  icon: Package,         label: 'Products'},
  { href: '/sales',     icon: ShoppingCart,    label: 'Sales'   },
  { href: '/alerts',    icon: Bell,            label: 'Alerts'  },
]

const MORE_NAV = [
  { href: '/vendors',   icon: Truck,        label: 'Vendors'   },
  { href: '/intake',    icon: ClipboardList, label: 'Intake'    },
  { href: '/analytics', icon: BarChart2,    label: 'Analytics' },
  { href: '/settings',  icon: Settings,     label: 'Settings'  },
]

export function MobileNav({ userRole }: { userRole?: UserRole }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)

  const accessiblePages = getAccessiblePages(userRole)
  const filteredPrimary = PRIMARY_NAV.filter((n) => accessiblePages.includes(n.href as PageFeature))
  const filteredMore = MORE_NAV.filter((n) => accessiblePages.includes(n.href as PageFeature))

  const isMoreActive = filteredMore.some(
    (n) => pathname === n.href || pathname.startsWith(n.href + '/'),
  )

  return (
    <>
      {/* More drawer */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <nav
            aria-label="More navigation"
            className="fixed bottom-[72px] left-0 right-0 z-50 rounded-t-2xl"
            style={{
              background: 'var(--bg-nav)',
              borderTop: '1px solid var(--border)',
              padding: '16px 16px 8px',
            }}
          >
            <div className="grid grid-cols-4 gap-3">
              {filteredMore.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '12px 8px',
                      borderRadius: 12,
                      background: active ? 'var(--accent-primary-muted)' : 'var(--bg-card)',
                      color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={20} strokeWidth={active ? 2 : 1.75} />
                    <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </>
      )}

      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: 72,
          backgroundColor: 'var(--bg-nav)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {filteredPrimary.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                height: '100%',
                color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                textDecoration: 'none',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.75} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          )
        })}

        {/* More button */}
        {filteredMore.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: isMoreActive || moreOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={20} strokeWidth={isMoreActive || moreOpen ? 2 : 1.75} />
            <span style={{ fontSize: 10, fontWeight: isMoreActive || moreOpen ? 600 : 400 }}>More</span>
          </button>
        )}
      </nav>
    </>
  )
}
