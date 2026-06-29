// Currency formatting utilities

const CURRENCY_CONFIG: Record<string, { symbol: string; name: string }> = {
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  GHS: { symbol: 'GH₵', name: 'Ghanaian Cedi' },
}

export const SUPPORTED_CURRENCIES = Object.entries(CURRENCY_CONFIG).map(([code, { name }]) => ({
  code,
  name,
}))

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_CONFIG[currencyCode]?.symbol ?? currencyCode
}

export function formatCurrency(amount: string | number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount)) return `${symbol}0.00`

  return symbol + numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatCurrencyPlain(amount: string | number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return '0.00'
  return numAmount.toFixed(2)
}
