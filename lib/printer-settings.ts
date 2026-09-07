/**
 * Trova IMS — printer preference storage.
 *
 * Reads/writes to localStorage (available natively in Tauri's WebView).
 * No Tauri API imports — safe to import anywhere including SSR, where
 * all `localStorage` calls are guarded by `typeof window !== 'undefined'`.
 */

export type PrinterConnectionType = 'usb' | 'tcp' | null

export interface PrinterSettings {
  /** Connection type selected by the user. */
  type: PrinterConnectionType
  /** USB: the printer "name" string returned by listThermalPrinters(). */
  usbPrinterName: string | null
  /** TCP: IP address of the network printer. */
  tcpAddress: string | null
  /** TCP: port number (default 9100). */
  tcpPort: number
  /** Physical paper roll width, in mm. Defaults to 80. */
  paperWidth: 58 | 80
}

const KEYS = {
  type: 'trova_printer_type',
  usbPrinterName: 'trova_printer_usb_name',
  tcpAddress: 'trova_printer_tcp_address',
  tcpPort: 'trova_printer_tcp_port',
  paperWidth: 'trova_printer_paper_width',
} as const

export const PRINTER_SETTINGS_CHANGED_EVENT = 'trova:printer-settings-changed'

const DEFAULTS: PrinterSettings = {
  type: null,
  usbPrinterName: null,
  tcpAddress: null,
  tcpPort: 9100,
  paperWidth: 80,
}

function ls(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function notifySettingsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRINTER_SETTINGS_CHANGED_EVENT))
  }
}

export function getPrinterSettings(): PrinterSettings {
  const store = ls()
  if (!store) return { ...DEFAULTS }

  const raw = store.getItem(KEYS.type)
  const type: PrinterConnectionType =
    raw === 'usb' || raw === 'tcp' ? raw : null

  return {
    type,
    usbPrinterName: store.getItem(KEYS.usbPrinterName) ?? null,
    tcpAddress: store.getItem(KEYS.tcpAddress) ?? null,
    tcpPort: parseInt(store.getItem(KEYS.tcpPort) ?? '9100', 10) || 9100,
    paperWidth:
      store.getItem(KEYS.paperWidth) === '58' ? 58 : 80,
  }
}

export function savePrinterSettings(patch: Partial<PrinterSettings>): void {
  const store = ls()
  if (!store) return

  if ('type' in patch) {
    if (patch.type == null) {
      store.removeItem(KEYS.type)
    } else {
      store.setItem(KEYS.type, patch.type)
    }
  }
  if ('usbPrinterName' in patch) {
    if (patch.usbPrinterName == null) {
      store.removeItem(KEYS.usbPrinterName)
    } else {
      store.setItem(KEYS.usbPrinterName, patch.usbPrinterName)
    }
  }
  if ('tcpAddress' in patch) {
    if (patch.tcpAddress == null) {
      store.removeItem(KEYS.tcpAddress)
    } else {
      store.setItem(KEYS.tcpAddress, patch.tcpAddress)
    }
  }
  if ('tcpPort' in patch && patch.tcpPort != null) {
    store.setItem(KEYS.tcpPort, String(patch.tcpPort))
  }
  if ('paperWidth' in patch && patch.paperWidth != null) {
    store.setItem(KEYS.paperWidth, String(patch.paperWidth))
  }
  notifySettingsChanged()
}

export function clearPrinterSettings(): void {
  const store = ls()
  if (!store) return
  Object.values(KEYS).forEach((k) => store.removeItem(k))
  notifySettingsChanged()
}

/**
 * Returns true when a printer has been configured and enough detail
 * exists to attempt a print job.
 */
export function isPrinterConfigured(settings: PrinterSettings): boolean {
  if (settings.type === 'usb') return !!settings.usbPrinterName
  if (settings.type === 'tcp') return !!settings.tcpAddress
  return false
}
