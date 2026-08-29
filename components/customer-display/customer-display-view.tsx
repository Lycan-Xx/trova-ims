'use client'

import * as React from 'react'
import { listen } from '@tauri-apps/api/event'
import { CUSTOMER_DISPLAY_EVENT, type CustomerDisplayCart } from '@/lib/customer-display'

const EMPTY_CART: CustomerDisplayCart = { storeName: 'Trova IMS', currencySymbol: '\u20A6', items: [], total: 0 }

function money(value: number, symbol: string) {
  return `${symbol}${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

export function CustomerDisplayView({ storeName, currencySymbol }: { storeName: string; currencySymbol: string }) {
  const [cart, setCart] = React.useState<CustomerDisplayCart>({ ...EMPTY_CART, storeName, currencySymbol })

  React.useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen<CustomerDisplayCart>(CUSTOMER_DISPLAY_EVENT, (event) => setCart(event.payload))
      .then((cleanup) => { unlisten = cleanup })
    return () => unlisten?.()
  }, [])

  return (
    <main className="min-h-screen p-10 flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold">{cart.storeName}</h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
          {cart.items.length ? 'Your Order' : 'Welcome'}
        </p>
      </header>
      {cart.items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-2xl" style={{ color: 'var(--text-muted)' }}>
          Ready for your order
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
          <div className="flex flex-col gap-4">
            {cart.items.map((item) => (
              <div key={`${item.name}-${item.unitPrice}`} className="flex items-baseline justify-between gap-6 text-xl">
                <span className="min-w-0">{item.quantity} x {item.name}</span>
                <span className="whitespace-nowrap font-medium">{money(item.total, cart.currencySymbol)}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between text-3xl font-bold">
              <span>Total</span>
              <span>{money(cart.total, cart.currencySymbol)}</span>
            </div>
          </div>
        </div>
      )}
      <footer className="text-center mt-10 text-lg" style={{ color: 'var(--text-muted)' }}>Thank you!</footer>
    </main>
  )
}
