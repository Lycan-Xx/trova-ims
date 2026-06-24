// ============================================================
// DB helper utilities — SKU and receipt number generation
// ============================================================

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a product SKU.
 * Format: {CATEGORY_CODE}-{6-char random alphanumeric uppercase}
 * e.g. "BEV-A3XK9M"
 */
export function generateSKU(categoryName: string): string {
  const categoryCode = categoryName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X') // ensure exactly 3 chars even for short names

  const random = Array.from({ length: 6 }, () =>
    ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)],
  ).join('')

  return `${categoryCode}-${random}`
}

/**
 * Generates a sale receipt number.
 * Format: SS-{YYYYMMDD}-{4-digit sequence padded}
 * The sequence is based on milliseconds within the day for uniqueness in the
 * absence of a DB sequence — the caller should verify uniqueness on insert.
 * e.g. "SS-20240612-0047"
 */
export function generateReceiptNumber(sequence?: number): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`

  // If no explicit sequence is passed, derive one from ms-within-day (0–86399999)
  // and compress to a 4-digit range (0–9999) by taking modulo
  const seq = sequence !== undefined
    ? sequence
    : Math.floor((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 8.64)

  const seqStr = String(seq % 10000).padStart(4, '0')

  return `SS-${dateStr}-${seqStr}`
}
