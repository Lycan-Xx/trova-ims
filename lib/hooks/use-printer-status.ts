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
  /** All printers currently reported by the plugin. */
  printers: PrinterInfo[]
  /** True while the first load is in progress. */
  loading: boolean
}

const POLL_INTERVAL_MS = 10_000
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

  // Detect Tauri once on mount (avoids SSR mismatch).
  React.useEffect(() => {
    function refreshSettings() {
      setSettings(getPrinterSettings())
    }

    window.addEventListener(PRINTER_SETTINGS_CHANGED_EVENT, refreshSettings)
    window.addEventListener('storage', refreshSettings)
    return () => {
      window.removeEventListener(PRINTER_SETTINGS_CHANGED_EVENT, refreshSettings)
      window.removeEventListener('storage', refreshSettings)
    }
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

    async function poll() {
      const result = await fetchPrinters()
      if (!cancelled) {
        setPrinters(result)
        setLoading(false)
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
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

  return { configured, online, printers, loading }
}
