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
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products',  icon: Package,         label: 'Products'  },
  { href: '/vendors',   icon: Truck,            label: 'Vendors'   },
  { href: '/intake',    icon: ClipboardList,    label: 'Intake'    },
  { href: '/sales',     icon: ShoppingCart,     label: 'Sales'     },
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
}

function NavItem({ href, icon: Icon, label, isActive, expanded }: NavItemProps) {
  const item = (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
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
      <Icon size={18} strokeWidth={isActive ? 2 : 1.75} style={{ flexShrink: 0 }} />
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
      <TooltipTrigger asChild>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {item}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = React.useState(false)
  const width = expanded ? EXPANDED_W : COLLAPSED_W

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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 16,
        paddingLeft: expanded ? 12 : 0,
        paddingRight: expanded ? 12 : 0,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
        transition: 'width 200ms ease, min-width 200ms ease, padding 200ms ease',
        overflow: 'hidden',
      }}
    >
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
            borderRadius: 7,
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
            <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
          </svg>
        </div>
        {expanded && (
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Trova
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav
        style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, width: '100%' }}
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <NavItem
              key={href}
              href={href}
              icon={icon}
              label={label}
              isActive={isActive}
              expanded={expanded}
            />
          )
        })}
      </nav>

      {/* Bottom: settings + collapse toggle */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          isActive={pathname === '/settings'}
          expanded={expanded}
        />

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
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
