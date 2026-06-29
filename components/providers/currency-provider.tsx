'use client'

import { CurrencyContext } from '@/lib/currency-context'
import type { Store } from '@/lib/db/schema'

interface CurrencyProviderProps {
  store: Store | null
  children: React.ReactNode
}

export function CurrencyProvider({ store, children }: CurrencyProviderProps) {
  const currency = store?.currency || 'NGN'

  return (
    <CurrencyContext.Provider value={{ currency, store }}>
      {children}
    </CurrencyContext.Provider>
  )
}
