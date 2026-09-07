'use client'

import * as React from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SaleDetail } from '@/app/actions/sales'
import {
  getPrinterSettings,
  isPrinterConfigured,
} from '@/lib/printer-settings'
import {
  notifyPrinterActivity,
  requestPrinterStatusRefresh,
} from '@/lib/printer-status-events'
import { buildRasterEscPosReceipt } from '@/lib/receipt/escpos-renderer'
import { getCurrencySymbol } from '@/lib/currency'
import { useCurrency } from '@/lib/currency-context'

type PrintJobRequest = {
  printer: string
  paper_size: 'Mm58' | 'Mm80'
  options: { code_page: number; encode: string; use_gbk: boolean }
  sections: unknown[]
}

interface PrintReceiptButtonProps {
  sale: SaleDetail
  storeName?: string
  storeAddress?: string
  storePhone?: string
}

export function PrintReceiptButton({
  sale,
  storeName,
  storeAddress,
  storePhone,
}: PrintReceiptButtonProps) {
  const { currency } = useCurrency()

  // Detect Tauri environment — avoids SSR mismatch, renders null on web.
  const [isTauri, setIsTauri] = React.useState(false)
  const [printing, setPrinting] = React.useState(false)

  React.useEffect(() => {
    setIsTauri(
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
    )
  }, [])

  // Don't render anything on web.
  if (!isTauri) return null

  async function handlePrint() {
    if (printing) return

    const settings = getPrinterSettings()

    // No printer configured — send user to settings.
    if (!isPrinterConfigured(settings)) {
      toast.info('No printer configured. Set one up in Settings → Printer Setup.')
      return
    }

    setPrinting(true)
    notifyPrinterActivity({ state: 'printing' })
    try {
      const sections = buildRasterEscPosReceipt(sale, {
        storeName,
        storeAddress,
        storePhone,
        currencySymbol: getCurrencySymbol(currency),
        paperWidth: settings.paperWidth,
      })

      // Dynamic import keeps Tauri SDK out of the web bundle.
      const { invoke } = await import('@tauri-apps/api/core')

      const printer =
        settings.type === 'usb'
          ? settings.usbPrinterName
          : `${settings.tcpAddress}:${settings.tcpPort}`

      if (!printer) {
        throw new Error('The selected printer is no longer configured.')
      }

      const printJobRequest: PrintJobRequest = {
        printer,
        paper_size: settings.paperWidth === 58 ? 'Mm58' : 'Mm80',
        // Text is rasterized so unsupported printer code pages cannot corrupt it.
        options: { code_page: 0, encode: 'WINDOWS_1252', use_gbk: false },
        sections,
      }

      await invoke('plugin:thermal-printer|print_thermal_printer', {
        printJobRequest,
      })

      notifyPrinterActivity({ state: 'idle' })
      requestPrinterStatusRefresh()
      toast.success('Receipt printed.')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Unknown printer error'
      notifyPrinterActivity({ state: 'error', message })
      requestPrinterStatusRefresh()
      toast.error(`Printer error: ${message}`)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <button
      id="print-receipt-btn"
      type="button"
      onClick={handlePrint}
      disabled={printing}
      className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: printing
          ? 'var(--accent-primary-muted)'
          : 'var(--accent-primary)',
        color: '#ffffff',
      }}
      onMouseEnter={(e) => {
        if (!printing)
          e.currentTarget.style.background = 'var(--accent-primary-hover)'
      }}
      onMouseLeave={(e) => {
        if (!printing)
          e.currentTarget.style.background = 'var(--accent-primary)'
      }}
    >
      {printing ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Printing…
        </>
      ) : (
        <>
          <Printer size={16} />
          Print Receipt
        </>
      )}
    </button>
  )
}
