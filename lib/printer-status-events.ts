export type PrinterActivityState = 'idle' | 'printing' | 'error'

export const PRINTER_ACTIVITY_EVENT = 'trova:printer-activity'
export const PRINTER_STATUS_REFRESH_EVENT = 'trova:printer-status-refresh'

export interface PrinterActivityDetail {
  state: PrinterActivityState
  message?: string
}

export function notifyPrinterActivity(detail: PrinterActivityDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<PrinterActivityDetail>(PRINTER_ACTIVITY_EVENT, { detail }))
}

export function requestPrinterStatusRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PRINTER_STATUS_REFRESH_EVENT))
}
