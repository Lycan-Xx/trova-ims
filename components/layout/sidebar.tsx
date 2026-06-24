'use client'

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
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/vendors', icon: Truck, label: 'Vendors' },
  { href: '/intake', icon: ClipboardList, label: 'Intake' },
  { href: '/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/alerts', icon: Bell, label: 'Alerts' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
]

function NavIcon({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  isActive: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <Link
          href={href}
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: isActive ? 'var(--accent-primary-muted)' : 'transparent',
            color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
            transition: 'background-color 150ms, color 150ms',
          }}
        >
          <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{
        width: 64,
        minWidth: 64,
        height: '100vh',
        backgroundColor: 'var(--bg-nav)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {/* Main nav */}
      <nav
        style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}
        aria-label="Main navigation"
      >
        {navItems.map(({ href, icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <NavIcon
              key={href}
              href={href}
              icon={icon}
              label={label}
              isActive={isActive}
            />
          )
        })}
      </nav>

      {/* Bottom: settings */}
      <NavIcon
        href="/settings"
        icon={Settings}
        label="Settings"
        isActive={pathname === '/settings'}
      />
    </aside>
  )
}
