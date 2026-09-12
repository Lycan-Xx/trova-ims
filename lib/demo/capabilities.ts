import type { DemoView } from './types'

export const DEMO_VIEWS: ReadonlyArray<{
  id: DemoView
  label: string
}> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'intake', label: 'Intake' },
  { id: 'sales', label: 'Sales' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

export const DEMO_CAPABILITIES = {
  reads: true,
  search: true,
  filters: true,
  receiptPreview: true,
  writes: false,
  authentication: false,
  database: false,
  printing: false,
  teamManagement: false,
} as const

export function isDemoView(value: string | null): value is DemoView {
  return DEMO_VIEWS.some((view) => view.id === value)
}

export function demoHref(view: DemoView): string {
  return view === 'dashboard' ? '/demo' : `/demo?view=${view}`
}

