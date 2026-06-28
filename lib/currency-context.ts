import { createContext, useContext } from 'react'
import type { Store } from '@/lib/db/schema'

interface CurrencyContextValue {
  currency: string
  store: Store | null
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}
