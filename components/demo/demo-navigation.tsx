'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Bell, Boxes, ClipboardList, LayoutDashboard, Package, Settings, ShoppingCart, Truck } from 'lucide-react'
import { demoHref } from '@/lib/demo/capabilities'
import type { DemoView } from '@/lib/demo/types'

const items: Array<{ id: DemoView; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'vendors', label: 'Vendors', icon: Truck },
  { id: 'intake', label: 'Intake', icon: ClipboardList },
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function DemoDesktopNavigation({ activeView }: { activeView: DemoView }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-border-subtle bg-bg-nav p-4 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 rounded-lg p-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-primary text-white"><Boxes size={19} /></span>
        <span><strong className="block text-sm text-white">Trova</strong><span className="text-[10px] text-text-muted">INTERACTIVE PREVIEW</span></span>
      </Link>
      <nav aria-label="Preview navigation" className="flex flex-1 flex-col gap-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === activeView
          return (
            <Link key={id} href={demoHref(id)} aria-current={active ? 'page' : undefined} className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${active ? 'bg-accent-primary-muted font-semibold text-accent-primary' : 'text-text-secondary hover:bg-bg-card hover:text-white'}`}>
              <Icon size={17} aria-hidden="true" /> {label}
            </Link>
          )
        })}
      </nav>
      <div className="rounded-xl border border-border bg-bg-card p-3">
        <p className="text-xs font-semibold text-white">Ready for your store?</p>
        <Link href="https://github.com/Lycan-Xx/trova-ims/releases" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-accent-primary hover:text-white">Download Trova →</Link>
      </div>
    </aside>
  )
}

export function DemoMobileNavigation({ activeView }: { activeView: DemoView }) {
  return (
    <nav aria-label="Mobile preview navigation" className="fixed inset-x-0 bottom-0 z-50 flex overflow-x-auto border-t border-border bg-bg-nav px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === activeView
        return (
          <Link key={id} href={demoHref(id)} aria-current={active ? 'page' : undefined} className={`flex min-w-[70px] flex-1 flex-col items-center gap-1 px-2 py-3 text-[10px] font-medium ${active ? 'text-accent-primary' : 'text-text-muted'}`}>
            <Icon size={18} aria-hidden="true" /> {label}
          </Link>
        )
      })}
    </nav>
  )
}

