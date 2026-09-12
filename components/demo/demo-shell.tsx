'use client'

import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import type { DemoView } from '@/lib/demo/types'
import { DemoBanner } from './demo-banner'
import { DemoDesktopNavigation, DemoMobileNavigation } from './demo-navigation'

export function DemoShell({
  activeView,
  onReset,
  children,
}: {
  activeView: DemoView
  onReset: () => void
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <DemoDesktopNavigation activeView={activeView} />
      <div className="min-h-screen md:pl-[220px]">
        <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-bg-nav px-4 md:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-white">
            <ArrowLeft size={15} aria-hidden="true" /> Back to website
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-text-muted sm:inline">No account or setup needed</span>
            <Link href="/download" className="inline-flex h-8 items-center gap-2 rounded-lg bg-accent-primary px-3 text-xs font-semibold text-white hover:opacity-90">
              <Download size={14} aria-hidden="true" /> Download
            </Link>
          </div>
        </header>
        <DemoBanner onReset={onReset} />
        <main className="mx-auto max-w-[1500px] p-4 pb-28 md:p-6 md:pb-8">{children}</main>
      </div>
      <DemoMobileNavigation activeView={activeView} />
    </div>
  )
}
