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
import { getPrinterSettings } from '@/lib/printer-settings'

export interface PrinterInfo {
  name: string
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

  // Detect Tauri once on mount (avoids SSR mismatch).
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

  const settings = React.useMemo(getPrinterSettings, [])

  const configured =
    (settings.type === 'usb' && !!settings.usbPrinterName) ||
    (settings.type === 'tcp' && !!settings.tcpAddress)

  const online =
    configured &&
    settings.type === 'usb' &&
    !!settings.usbPrinterName &&
    printers.some(
      (p) =>
        p.name?.toLowerCase() ===
        settings.usbPrinterName!.toLowerCase(),
    )

  return { configured, online, printers, loading }
}
