export const CUSTOMER_DISPLAY_EVENT = 'trova:customer-display-cart'
export const CUSTOMER_DISPLAY_STORAGE_KEY = 'trova_customer_display_settings'

export interface CustomerDisplayItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface CustomerDisplayCart {
  storeName: string
  currencySymbol: string
  items: CustomerDisplayItem[]
  total: number
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
