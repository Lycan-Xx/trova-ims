/**
 * ESC/POS receipt builder for tauri-plugin-thermal-printer.
 *
 * Produces the `sections` array consumed by `printThermalPrinter()`.
 * Pure function — no Tauri imports, safe to import in any environment.
 *
 * Paper widths:
 *   80 mm  ->  48 printable characters per line
 *   58 mm  ->  32 printable characters per line
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
  size?: 'normal' | 'height' | 'width' | 'double'
}

type PrintSection =
  | { Text: { text: string; styles?: TextStyles } }
  | { Line: { character: string } }
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

function separator(symbol = '-', chars = 48): PrintSection {
  return text(symbol.repeat(chars))
}

function fitLine(value: string, chars: number): string {
  return value.length > chars ? value.slice(0, Math.max(0, chars - 1)) + '…' : value
}

function wrapWords(value: string, chars: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (word.length > chars) {
      if (current) {
        lines.push(current)
        current = ''
      }
      for (let i = 0; i < word.length; i += chars) {
        lines.push(word.slice(i, i + chars))
      }
      continue
    }

    const next = current ? `${current} ${word}` : word
    if (next.length > chars) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines
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
  if (value.length >= chars) {
    return text(value, bold ? { bold: true, align: 'right' } : { align: 'right' })
  }

  const padding = chars - label.length - value.length
  const safeLabel =
    padding < 1
      ? fitLine(label, chars - value.length - 1) + ' '
      : label + ' '.repeat(padding)
  return text(safeLabel + value, bold ? { bold: true } : undefined)
}

function itemDetailRow(
  left: string,
  right: string,
  chars: number,
): PrintSection {
  if (right.length >= chars) return text(right, { align: 'right' })

  const indent = '  '
  const safeLeft = fitLine(left, chars - right.length - indent.length - 1)
  const padding = Math.max(1, chars - indent.length - safeLeft.length - right.length)
  return text(`${indent}${safeLeft}${' '.repeat(padding)}${right}`)
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
    sections.push(text(storeName, { bold: true, align: 'center', size: paperWidth === 58 ? 'normal' : 'double' }))
  }
  if (storeAddress) {
    sections.push(text(storeAddress, { align: 'center' }))
  }
  if (storePhone) {
    sections.push(text(storePhone, { align: 'center' }))
  }

  sections.push(separator('=', chars))
  sections.push(text('RECEIPT', { bold: true, align: 'center' }))
  sections.push(separator('=', chars))

  // ── Meta ──────────────────────────────────────────────────────────
  sections.push(text(sale.receipt_number, { align: 'left' }))
  sections.push(text(fmtDate(sale.created_at), { align: 'left' }))
  if (sale.cashier_name) {
    sections.push(text(`Cashier: ${sale.cashier_name}`, { align: 'left' }))
  }

  sections.push(separator('-', chars))

  // ── Items ─────────────────────────────────────────────────────────
  sections.push(text('Items', { bold: true }))
  sections.push(separator('-', chars))

  for (const item of sale.items) {
    const unitPrice = fmt(item.unitPrice, currencySymbol)
    const lineTotal = fmt(item.lineTotal, currencySymbol)
    const detail = `${item.qtySold} x ${unitPrice}`

    for (const line of wrapWords(item.productName, chars)) {
      sections.push(text(line))
    }
    sections.push(itemDetailRow(detail, lineTotal, chars))
  }

  sections.push(separator('-', chars))

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

  sections.push(separator('=', chars))

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

  sections.push(separator('=', chars))

  // ── Footer ────────────────────────────────────────────────────────
  sections.push(text('Thank you for your purchase!', { align: 'center' }))
  sections.push(text('Powered by Trova IMS', { align: 'center' }))

  // Feed paper past the cutter
  sections.push({ Cut: { mode: 'partial', feed: 3 } })

  return sections
}
