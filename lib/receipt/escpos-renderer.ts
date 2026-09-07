/**
 * ESC/POS receipt builder for tauri-plugin-thermal-printer.
 *
 * Produces the `sections` array consumed by `printThermalPrinter()`.
 * The raster builder uses the browser canvas when a receipt is printed.
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
  | {
      Image: {
        data: string
        max_width: number
        align: Align
        dithering: boolean
        size: 'normal'
      }
    }
  | { Cut: { mode?: 'full' | 'partial'; feed?: number } }

export type EscPosReceipt = PrintSection[]

type RasterCommand =
  | {
      kind: 'text'
      text: string
      align: Align
      fontSize: number
      bold: boolean
      lineHeight: number
    }
  | {
      kind: 'row'
      left: string
      right: string
      fontSize: number
      bold: boolean
      lineHeight: number
    }
  | { kind: 'rule'; lineHeight: number }

const RASTER_WIDTH: Record<PaperWidth, number> = { 80: 576, 58: 384 }
// Add about 4 mm of image padding before the cutter. Some 58 mm drivers begin
// their cut/advance slightly early, which can otherwise clip the footer.
const RASTER_BOTTOM_PADDING = 32

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

function canvasFont(fontSize: number, bold: boolean): string {
  return `${bold ? 700 : 600} ${fontSize}px Inter, "Segoe UI", Arial, sans-serif`
}

function wrapPixels(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
): string[] {
  context.font = canvasFont(fontSize, bold)
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word

    if (context.measureText(current).width > maxWidth) {
      let segment = ''
      for (const character of current) {
        if (context.measureText(segment + character).width > maxWidth && segment) {
          lines.push(segment)
          segment = character
        } else {
          segment += character
        }
      }
      current = segment
    }
  }

  if (current) lines.push(current)
  return lines
}

/**
 * Rasterize the complete receipt before sending it to ESC/POS. Standard
 * printer code pages do not contain the naira symbol, while an image preserves
 * both the glyph and exact column positions on every supported printer.
 */
export function buildRasterEscPosReceipt(
  sale: SaleDetail,
  opts: EscPosOptions,
): EscPosReceipt {
  if (typeof document === 'undefined') {
    throw new Error('Thermal receipt rendering requires the desktop window.')
  }

  const paperWidth = opts.paperWidth ?? 80
  const width = RASTER_WIDTH[paperWidth]
  const margin = paperWidth === 58 ? 14 : 20
  const contentWidth = width - margin * 2
  const bodySize = paperWidth === 58 ? 20 : 22
  const scratch = document.createElement('canvas')
  const scratchContext = scratch.getContext('2d')
  if (!scratchContext) throw new Error('Could not initialize the receipt renderer.')

  const commands: RasterCommand[] = []
  const pushWrappedText = (
    value: string,
    align: Align = 'left',
    fontSize = bodySize,
    bold = false,
  ) => {
    const lineHeight = fontSize + 7
    for (const line of wrapPixels(scratchContext, value, contentWidth, fontSize, bold)) {
      commands.push({ kind: 'text', text: line, align, fontSize, bold, lineHeight })
    }
  }
  const pushRule = () => commands.push({ kind: 'rule', lineHeight: 15 })
  const pushRightValue = (right: string, bold = false, fontSize = bodySize) => {
    let fittedSize = fontSize
    while (fittedSize > 12) {
      scratchContext.font = canvasFont(fittedSize, bold)
      if (scratchContext.measureText(right).width <= contentWidth) break
      fittedSize -= 1
    }
    commands.push({ kind: 'row', left: '', right, fontSize: fittedSize, bold, lineHeight: fittedSize + 8 })
  }
  const pushResponsiveRow = (left: string, right: string, bold = false, fontSize = bodySize) => {
    scratchContext.font = canvasFont(fontSize, bold)
    const rowWidth = scratchContext.measureText(left).width + 14 + scratchContext.measureText(right).width
    if (rowWidth <= contentWidth) {
      commands.push({ kind: 'row', left, right, fontSize, bold, lineHeight: fontSize + 8 })
      return
    }

    pushWrappedText(left, 'left', fontSize, bold)
    pushRightValue(right, bold, fontSize)
  }

  if (opts.storeName) pushWrappedText(opts.storeName, 'center', paperWidth === 58 ? 24 : 27, true)
  if (opts.storeAddress) pushWrappedText(opts.storeAddress, 'center')
  if (opts.storePhone) pushWrappedText(opts.storePhone, 'center')

  pushRule()
  pushWrappedText('RECEIPT', 'center', paperWidth === 58 ? 23 : 26, true)
  pushRule()
  pushWrappedText(sale.receipt_number)
  pushWrappedText(fmtDate(sale.created_at))
  if (sale.cashier_name) pushWrappedText(`Cashier: ${sale.cashier_name}`)

  pushRule()
  pushWrappedText('Items', 'left', bodySize + 1, true)
  pushRule()

  for (const item of sale.items) {
    const amount = fmt(item.lineTotal, opts.currencySymbol)
    const itemLabel = `(${item.qtySold}) ${item.productName}`
    pushResponsiveRow(itemLabel, amount)
  }

  pushRule()
  if (sale.items.length > 1) {
    const subtotal = sale.items.reduce((sum, item) => sum + parseFloat(item.lineTotal), 0)
    pushResponsiveRow('Subtotal:', fmt(subtotal, opts.currencySymbol))
  }
  pushResponsiveRow('TOTAL:', fmt(sale.total_amount, opts.currencySymbol), true, bodySize + 2)

  pushRule()
  const paymentLabel = PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method
  pushResponsiveRow('Payment:', paymentLabel)
  if (sale.amount_paid) pushResponsiveRow('Amount Paid:', fmt(sale.amount_paid, opts.currencySymbol))
  if (sale.change_given !== null && parseFloat(sale.change_given) > 0) {
    pushResponsiveRow('Change:', fmt(sale.change_given, opts.currencySymbol))
  }

  pushRule()
  pushWrappedText('Thank you for your purchase!', 'center')
  pushWrappedText('Powered by Trova IMS', 'center')

  const height =
    margin * 2 +
    commands.reduce((sum, command) => sum + command.lineHeight, 0) +
    RASTER_BOTTOM_PADDING
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not initialize the receipt renderer.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#000000'
  context.strokeStyle = '#000000'
  context.lineWidth = 2
  context.textBaseline = 'top'

  let y = margin
  for (const command of commands) {
    if (command.kind === 'rule') {
      const ruleY = y + Math.floor(command.lineHeight / 2)
      context.beginPath()
      context.moveTo(margin, ruleY)
      context.lineTo(width - margin, ruleY)
      context.stroke()
      y += command.lineHeight
      continue
    }

    context.font = canvasFont(command.fontSize, command.bold)
    if (command.kind === 'row') {
      context.textAlign = 'left'
      context.fillText(command.left, margin, y)
      context.textAlign = 'right'
      context.fillText(command.right, width - margin, y)
    } else {
      context.textAlign = command.align
      const x = command.align === 'center' ? width / 2 : command.align === 'right' ? width - margin : margin
      context.fillText(command.text, x, y)
    }
    y += command.lineHeight
  }

  const data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  return [
    { Image: { data, max_width: width, align: 'center', dithering: false, size: 'normal' } },
    { Cut: { mode: 'partial', feed: 3 } },
  ]
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
