export const CUSTOMER_DISPLAY_EVENT = 'trova:customer-display-cart'
export const CUSTOMER_DISPLAY_STORAGE_KEY = 'trova_customer_display_settings'
export const CUSTOMER_DISPLAY_SNAPSHOT_KEY = 'trova_customer_display_snapshot'
export const CUSTOMER_DISPLAY_COMPLETE_DURATION_MS = 12000

export interface CustomerDisplayItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export type CustomerDisplayStatus = 'idle' | 'cart' | 'complete'

export interface CustomerDisplayCart {
  storeName: string
  currencySymbol: string
  items: CustomerDisplayItem[]
  total: number
  status: CustomerDisplayStatus
  receiptNumber?: string
  paymentMethod?: string
  completedAt?: number
}

export interface CustomerDisplaySettings {
  enabled: boolean
  monitorIndex: number
}

export const DEFAULT_CUSTOMER_DISPLAY_SETTINGS: CustomerDisplaySettings = {
  enabled: false,
  monitorIndex: 1,
}

export function getCustomerDisplaySettings(): CustomerDisplaySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_CUSTOMER_DISPLAY_SETTINGS }
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CUSTOMER_DISPLAY_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<CustomerDisplaySettings>
    return {
      enabled: parsed.enabled === true,
      monitorIndex: Number.isInteger(parsed.monitorIndex) && (parsed.monitorIndex as number) >= 0
        ? parsed.monitorIndex as number
        : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.monitorIndex,
    }
  } catch {
    return { ...DEFAULT_CUSTOMER_DISPLAY_SETTINGS }
  }
}

export function saveCustomerDisplaySettings(patch: Partial<CustomerDisplaySettings>): CustomerDisplaySettings {
  const next = { ...getCustomerDisplaySettings(), ...patch }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function getCustomerDisplaySnapshot(): CustomerDisplayCart | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CustomerDisplayCart>
    if (!Array.isArray(parsed.items) || typeof parsed.storeName !== 'string' ||
      typeof parsed.currencySymbol !== 'string' || typeof parsed.total !== 'number') {
      return null
    }
    const status: CustomerDisplayStatus =
      parsed.status === 'complete' || parsed.status === 'cart' || parsed.status === 'idle'
        ? parsed.status
        : parsed.items.length > 0
          ? 'cart'
          : 'idle'
    if (
      status === 'complete' &&
      (typeof parsed.completedAt !== 'number' ||
        Date.now() - parsed.completedAt >= CUSTOMER_DISPLAY_COMPLETE_DURATION_MS)
    ) {
      window.localStorage.removeItem(CUSTOMER_DISPLAY_SNAPSHOT_KEY)
      return null
    }
    return { ...parsed, status } as CustomerDisplayCart
  } catch {
    return null
  }
}

export function saveCustomerDisplaySnapshot(cart: CustomerDisplayCart): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CUSTOMER_DISPLAY_SNAPSHOT_KEY, JSON.stringify(cart))
  }
}

export function clearCustomerDisplaySnapshot(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CUSTOMER_DISPLAY_SNAPSHOT_KEY)
  }
}
