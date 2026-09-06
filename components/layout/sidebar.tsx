'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Truck,
  ClipboardList,
  ShoppingCart,
  Bell,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { UserRole } from '@/lib/db/schema'
import { getAccessiblePages, PageFeature } from '@/lib/auth/role-access'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products',  icon: Package,         label: 'Products',  joyrideId: 'nav-products' },
  { href: '/vendors',   icon: Truck,            label: 'Vendors',   joyrideId: 'nav-vendors'  },
  { href: '/intake',    icon: ClipboardList,    label: 'Intake',    joyrideId: 'nav-intake'   },
  { href: '/sales',     icon: ShoppingCart,     label: 'Sales',     joyrideId: 'nav-sales'    },
  { href: '/alerts',    icon: Bell,             label: 'Alerts'    },
  { href: '/analytics', icon: BarChart2,        label: 'Analytics' },
]

const EXPANDED_W = 220
const COLLAPSED_W = 64

interface NavItemProps {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  isActive: boolean
  expanded: boolean
  joyrideId?: string
}

function NavItem({ href, icon: Icon, label, isActive, expanded, joyrideId }: NavItemProps) {
  const item = (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      {...(joyrideId ? { 'data-joyride': joyrideId } : {})}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 40,
        borderRadius: 8,
        paddingLeft: expanded ? 12 : 0,
        paddingRight: expanded ? 12 : 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        backgroundColor: isActive ? 'var(--accent-primary-muted)' : 'transparent',
        color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
        transition: 'background-color 150ms, color 150ms',
        textDecoration: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} strokeWidth={isActive ? 2 : 1.75} />
      </div>
      {expanded && (
        <span
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            overflow: 'hidden',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 150ms',
          }}
        >
          {label}
        </span>
      )}
    </Link>
  )

  if (expanded) return <div style={{ width: '100%' }}>{item}</div>

  return (
    <Tooltip>
      <TooltipTrigger>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {item}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ userRole, testModeEnabled }: { userRole?: UserRole; testModeEnabled?: boolean }) {
  const pathname = usePathname()
  const [expanded, setExpanded] = React.useState(true)
  const width = expanded ? EXPANDED_W : COLLAPSED_W

  const accessiblePages = getAccessiblePages(userRole)
  const filteredNavItems = NAV_ITEMS.filter((item) =>
    accessiblePages.includes(item.href as PageFeature)
  )

  // Propagate sidebar width to the layout via CSS custom property
  React.useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${width}px`)
  }, [width])

  return (
    <aside
      style={{
        width,
        minWidth: width,
        height: '100vh',
        backgroundColor: 'var(--bg-nav)',
        borderRight: '1px solid var(--border-subtle)',
        borderTop: testModeEnabled ? '3px solid var(--accent-yellow)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: testModeEnabled ? 9 : 12,
        paddingBottom: 16,
        paddingLeft: expanded ? 12 : 0,
        paddingRight: expanded ? 12 : 0,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
        transition: 'width 150ms ease, min-width 150ms ease, padding 150ms ease',
        willChange: 'width',
        overflow: 'hidden',
      }}
    >
      {/* Test Mode indicator — unmissable while enabled: colored top border on
          the whole sidebar (visible even collapsed) plus a labeled banner. */}
      {testModeEnabled && (
        <div
          title="Test Mode is on — sales and products go to a separate test database, not your real records."
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: 6,
            width: '100%',
            marginBottom: 14,
            padding: expanded ? '5px 8px' : '5px 0',
            borderRadius: 6,
            background: 'var(--accent-yellow)',
            color: '#1a1400',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <FlaskConical size={13} strokeWidth={2.25} style={{ flexShrink: 0 }} />
          {expanded && <span>TEST MODE</span>}
        </div>
      )}

      {/* Logo mark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          width: '100%',
          gap: 10,
          marginBottom: 20,
          paddingLeft: expanded ? 4 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img src="/images/favicon.png" alt="Trova" width={30} height={30} style={{ borderRadius: 7 }} />
        </div>
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Trova
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
              v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.4'}
            </span>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav
        style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, width: '100%' }}
        aria-label="Main navigation"
      >
        {filteredNavItems.map(({ href, icon, label, joyrideId }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <NavItem
              key={href}
              href={href}
              icon={icon}
              label={label}
              isActive={isActive}
              expanded={expanded}
              joyrideId={joyrideId}
            />
          )
        })}
      </nav>

      {/* Bottom: settings + collapse toggle */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {accessiblePages.includes('/settings') && (
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            isActive={pathname === '/settings'}
            expanded={expanded}
            joyrideId="nav-settings"
          />
        )}

        {/* Collapse toggle — hidden on desktop, visible on mobile */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="md:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: 10,
            width: '100%',
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            paddingLeft: expanded ? 12 : 0,
            paddingRight: expanded ? 12 : 0,
            marginTop: 4,
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {expanded ? (
            <>
              <ChevronLeft size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Collapse</span>
            </>
          ) : (
            <ChevronRight size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>
    </aside>
  )
}
