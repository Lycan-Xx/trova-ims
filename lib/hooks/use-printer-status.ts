'use client'

/**
 * usePrinterStatus — polls the Tauri thermal printer plugin for live status.
 *
 * Returns `{ configured, online, printers, loading }`.
 *
 * - On the web (no Tauri) all flags are false and no polling occurs.
 * - Uses `invoke` directly so the npm package is only needed at runtime
 *   (not during SSR or web CI builds).
 */

import * as React from 'react'
import {
  getPrinterSettings,
  PRINTER_SETTINGS_CHANGED_EVENT,
  type PrinterSettings,
} from '@/lib/printer-settings'
import {
  PRINTER_ACTIVITY_EVENT,
  PRINTER_STATUS_REFRESH_EVENT,
  type PrinterActivityDetail,
} from '@/lib/printer-status-events'

export interface PrinterInfo {
  name: string
  identifier?: string
  status?: string
  [key: string]: unknown
}

export interface PrinterStatus {
  /** Whether a printer has been saved in settings. */
  configured: boolean
  /** Whether the saved USB printer is currently visible to the system. */
  online: boolean
  /** UI-facing status derived from configuration, polling, and print activity. */
  state: 'not_configured' | 'checking' | 'available' | 'unavailable' | 'printing' | 'error'
  /** Last printer error reported by the print command. */
  error: string | null
  /** All printers currently reported by the plugin. */
  printers: PrinterInfo[]
  /** True while the first load is in progress. */
  loading: boolean
}

const POLL_INTERVAL_MS = 20_000
const OFFLINE_STATUSES = new Set([
  'offline',
  'error',
  'out_of_paper',
  'outofpaper',
  'paper_out',
  'paperout',
  'paused',
  'unavailable',
  'unknown',
])

/** True only when running inside the Tauri webview. */
function isTauriEnv(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  )
}

async function fetchPrinters(): Promise<PrinterInfo[]> {
  try {
    // Dynamic import avoids pulling Tauri SDK into SSR/web bundles.
    const { invoke } = await import('@tauri-apps/api/core')
    const result = await invoke<PrinterInfo[]>(
      'plugin:thermal-printer|list_thermal_printers',
    )
    return Array.isArray(result) ? result : []
  } catch {
    return []
  }
}

export function usePrinterStatus(): PrinterStatus {
  const [printers, setPrinters] = React.useState<PrinterInfo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isTauri, setIsTauri] = React.useState(false)
  const [settings, setSettings] = React.useState<PrinterSettings>(() => getPrinterSettings())
  const [activity, setActivity] = React.useState<PrinterActivityDetail>({ state: 'idle' })

  // Detect Tauri once on mount (avoids SSR mismatch).
  React.useEffect(() => {
    function refreshSettings() {
      setSettings(getPrinterSettings())
      setActivity({ state: 'idle' })
    }

    window.addEventListener(PRINTER_SETTINGS_CHANGED_EVENT, refreshSettings)
    window.addEventListener('storage', refreshSettings)
    return () => {
      window.removeEventListener(PRINTER_SETTINGS_CHANGED_EVENT, refreshSettings)
      window.removeEventListener('storage', refreshSettings)
    }
  }, [])

  React.useEffect(() => {
    function handleActivity(event: Event) {
      const detail = (event as CustomEvent<PrinterActivityDetail>).detail
      if (!detail) return
      setActivity(detail)
    }

    window.addEventListener(PRINTER_ACTIVITY_EVENT, handleActivity)
    return () => window.removeEventListener(PRINTER_ACTIVITY_EVENT, handleActivity)
  }, [])

  React.useEffect(() => {
    setIsTauri(isTauriEnv())
  }, [])

  React.useEffect(() => {
    if (!isTauri) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function poll() {
      const result = await fetchPrinters()
      if (!cancelled) {
        setPrinters(result)
        setLoading(false)
      }
    }

    function refreshNow() {
      void poll()
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    window.addEventListener(PRINTER_STATUS_REFRESH_EVENT, refreshNow)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener(PRINTER_STATUS_REFRESH_EVENT, refreshNow)
    }
  }, [isTauri])

  const configured =
    (settings.type === 'usb' && !!settings.usbPrinterName) ||
    (settings.type === 'tcp' && !!settings.tcpAddress)

  const configuredName =
    settings.type === 'usb'
      ? settings.usbPrinterName
      : settings.type === 'tcp' && settings.tcpAddress
      ? `${settings.tcpAddress}:${settings.tcpPort}`
      : null

  const online = configured && !!configuredName && printers.some((printer) => {
    const target = configuredName.toLowerCase()
    const names = [printer.name, printer.identifier]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase())
    const matches = names.some((value) => value === target || value.endsWith(target))
    const status = typeof printer.status === 'string'
      ? printer.status.trim().toLowerCase().replace(/\s+/g, '_')
      : ''
    return matches && !OFFLINE_STATUSES.has(status)
  })

  const state: PrinterStatus['state'] =
    activity.state === 'printing'
      ? 'printing'
      : activity.state === 'error'
      ? 'error'
      : !configured
      ? 'not_configured'
      : loading
      ? 'checking'
      : online
      ? 'available'
      : 'unavailable'

  return { configured, online, state, error: activity.message ?? null, printers, loading }
}
