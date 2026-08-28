/**
 * ESC/POS receipt builder for tauri-plugin-thermal-printer.
 *
 * Produces the `sections` array consumed by `printThermalPrinter()`.
 * Pure function — no Tauri imports, safe to import in any environment.
 *
 * Paper widths:
 *   80 mm  →  48 printable characters per line
 *   58 mm  →  32 printable characters per line
 */

import type { SaleDetail } from '@/app/actions/sales'

export type PaperWidth = 58 | 80

export interface EscPosOptions {
  storeName?: string
  storeAddress?: string
  storePhone?: string
  /** Currency symbol (e.g. "₦", "$"). */
  currencySymbol: string
  /** Physical paper width of the thermal roll. Defaults to 80mm. */
  paperWidth?: PaperWidth
}

// ---------------------------------------------------------------------------
// Section types that tauri-plugin-thermal-printer understands.
// We keep these local so we don't depend on the npm package at build-time
// (it may not be installed on the web/CI environment).
// ---------------------------------------------------------------------------

type Align = 'left' | 'center' | 'right'

interface TextStyles {
  bold?: boolean
  underline?: boolean
  align?: Align
  width?: number   // character width multiplier (1 or 2)
  height?: number  // character height multiplier (1 or 2)
}

type PrintSection =
  | { Text: { text: string; styles?: TextStyles } }
  | { Separator: { symbol?: string } }
  | { Cut: { mode?: 'full' | 'partial'; feed?: number } }

export type EscPosReceipt = PrintSection[]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARS: Record<PaperWidth, number> = { 80: 48, 58: 32 }

function fmt(value: string | number, currencySymbol: string): string {
  const n = parseFloat(String(value))
  return `${currencySymbol}${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function text(
  content: string,
  styles?: TextStyles,
): PrintSection {
  return { Text: { text: content, styles } }
}

function separator(symbol = '-'): PrintSection {
  return { Separator: { symbol } }
}

/**
 * Build a padded two-column row: label on the left, value on the right.
 * Truncates label if it would overflow.
 */
function row(
  label: string,
  value: string,
  chars: number,
  bold = false,
): PrintSection {
  const padding = chars - label.length - value.length
  const safeLabel =
    padding < 1
      ? label.slice(0, chars - value.length - 1) + ' '
      : label + ' '.repeat(padding)
  return text(safeLabel + value, bold ? { bold: true } : undefined)
}

/** Three-column row: name | qty (right-pad) | total (right-align). */
function itemRow(
  name: string,
  qty: string,
  total: string,
  chars: number,
): PrintSection {
  // Allocate: total=10, qty=5, name=rest
  const totalW = 10
  const qtyW = 5
  const nameW = chars - qtyW - totalW
  const safeName =
    name.length > nameW ? name.slice(0, nameW - 1) + '…' : name.padEnd(nameW)
  const safeQty = qty.padStart(qtyW)
  const safeTotal = total.padStart(totalW)
  return text(safeName + safeQty + safeTotal)
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Bank Transfer',
  pos: 'POS / Card',
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildEscPosReceipt(
  sale: SaleDetail,
  opts: EscPosOptions,
): EscPosReceipt {
  const {
    storeName,
    storeAddress,
    storePhone,
    currencySymbol,
    paperWidth = 80,
  } = opts

  const chars = CHARS[paperWidth]
  const sections: EscPosReceipt = []

  // ── Store header ──────────────────────────────────────────────────
  if (storeName) {
    sections.push(text(storeName, { bold: true, align: 'center', height: 2 }))
  }
  if (storeAddress) {
    sections.push(text(storeAddress, { align: 'center' }))
  }
  if (storePhone) {
    sections.push(text(storePhone, { align: 'center' }))
  }

  sections.push(separator('='))
  sections.push(text('RECEIPT', { bold: true, align: 'center' }))
  sections.push(separator('='))

  // ── Meta ──────────────────────────────────────────────────────────
  sections.push(text(sale.receipt_number, { align: 'left' }))
  sections.push(text(fmtDate(sale.created_at), { align: 'left' }))
  if (sale.cashier_name) {
    sections.push(text(`Cashier: ${sale.cashier_name}`, { align: 'left' }))
  }

  sections.push(separator('-'))

  // ── Items table header ────────────────────────────────────────────
  sections.push(itemRow('Item', 'Qty', 'Total', chars))
  sections.push(separator('-'))

  // ── Items ─────────────────────────────────────────────────────────
  for (const item of sale.items) {
    sections.push(
      itemRow(
        item.productName,
        String(item.qtySold),
        fmt(item.lineTotal, currencySymbol),
        chars,
      ),
    )
  }

  sections.push(separator('-'))

  // ── Subtotal (only if multiple items) ────────────────────────────
  if (sale.items.length > 1) {
    const subtotal = sale.items.reduce(
      (s, i) => s + parseFloat(i.lineTotal),
      0,
    )
    sections.push(
      row('Subtotal:', fmt(subtotal, currencySymbol), chars),
    )
  }

  // ── Grand total ───────────────────────────────────────────────────
  sections.push(
    row('TOTAL:', fmt(sale.total_amount, currencySymbol), chars, true),
  )

  sections.push(separator('='))

  // ── Payment details ───────────────────────────────────────────────
  const paymentLabel =
    PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method
  sections.push(row('Payment:', paymentLabel, chars))

  if (sale.amount_paid) {
    sections.push(row('Amount Paid:', fmt(sale.amount_paid, currencySymbol), chars))
  }

  if (sale.change_given !== null && parseFloat(sale.change_given) > 0) {
    sections.push(row('Change:', fmt(sale.change_given, currencySymbol), chars))
  }

  sections.push(separator('='))

  // ── Footer ────────────────────────────────────────────────────────
  sections.push(text('Thank you for your purchase!', { align: 'center' }))
  sections.push(text('Powered by Trova IMS', { align: 'center' }))

  // Feed paper past the cutter
  sections.push({ Cut: { mode: 'partial', feed: 3 } })

  return sections
}
