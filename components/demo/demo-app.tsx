'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createDemoData } from '@/lib/demo/create-demo-data'
import { isDemoView } from '@/lib/demo/capabilities'
import type { DemoData } from '@/lib/demo/types'
import { DemoShell } from './demo-shell'
import { DemoReadOnlyDialog } from './demo-read-only-dialog'
import { DemoPageHeader } from './demo-ui'
import { AnalyticsPreview, DashboardPreview, ProductsPreview, SalesPreview } from './primary-sections'
import { AlertsPreview, IntakePreview, SettingsPreview, VendorsPreview } from './inventory-sections'

export function DemoApp() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const requestedView = searchParams.get('view')
  const activeView = isDemoView(requestedView) ? requestedView : 'dashboard'
  const [data, setData] = useState<DemoData | null>(null)
  const [unavailableAction, setUnavailableAction] = useState<string | null>(null)
  const [resetVersion, setResetVersion] = useState(0)

  useEffect(() => setData(createDemoData()), [])

  const reset = useCallback(() => {
    setData(createDemoData())
    setUnavailableAction(null)
    setResetVersion((value) => value + 1)
    router.replace('/demo')
  }, [router])

  if (!data) return <DemoLoading />

  const navigate = (view: string) => {
    router.push(view === 'dashboard' ? '/demo' : '/demo?view=' + view)
  }

  const primarySection = activeView === 'dashboard'
    ? <DashboardPreview data={data} onAction={setUnavailableAction} onNavigate={navigate} />
    : activeView === 'products'
      ? <ProductsPreview data={data} onAction={setUnavailableAction} />
      : activeView === 'sales'
        ? <SalesPreview data={data} onAction={setUnavailableAction} />
        : activeView === 'analytics'
          ? <AnalyticsPreview data={data} />
          : null
  const secondarySection = activeView === 'vendors'
    ? <VendorsPreview data={data} onAction={setUnavailableAction} />
    : activeView === 'intake'
      ? <IntakePreview data={data} onAction={setUnavailableAction} />
      : activeView === 'alerts'
        ? <AlertsPreview data={data} onAction={setUnavailableAction} />
        : activeView === 'settings'
          ? <SettingsPreview data={data} onAction={setUnavailableAction} />
          : null

  return (
    <DemoShell activeView={activeView} onReset={reset}>
      <div key={activeView + '-' + resetVersion}>
        {primarySection ?? secondarySection ?? <DemoPageHeader
          eyebrow="Trova interactive preview"
          title={activeView.charAt(0).toUpperCase() + activeView.slice(1)}
          description="This section is being prepared with fictional sample data. Use the navigation to explore the public preview."
          action={<button type="button" onClick={() => setUnavailableAction('Manage your store')} className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white">Try an action</button>}
        />}
        {!primarySection && !secondarySection && <div className="rounded-xl border border-dashed border-border bg-bg-card p-12 text-center text-sm text-text-muted">Preview section ready for content.</div>}
      </div>
      <DemoReadOnlyDialog action={unavailableAction} onClose={() => setUnavailableAction(null)} />
    </DemoShell>
  )
}

export function DemoLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-6 text-center">
      <div>
        <span className="mx-auto mb-4 block size-9 animate-pulse rounded-xl bg-accent-primary" />
        <p className="text-sm font-semibold text-white">Preparing the Trova preview…</p>
        <p className="mt-2 text-xs text-text-muted">Loading fictional sample data locally.</p>
      </div>
    </div>
  )
}
