'use client'

import * as React from 'react'
import { listen } from '@tauri-apps/api/event'
import { CheckCircle2, ReceiptText, ShoppingBag } from 'lucide-react'
import {
  clearCustomerDisplaySnapshot,
  CUSTOMER_DISPLAY_COMPLETE_DURATION_MS,
  CUSTOMER_DISPLAY_EVENT,
  getCustomerDisplaySnapshot,
  type CustomerDisplayCart,
} from '@/lib/customer-display'

const EMPTY_CART: CustomerDisplayCart = {
  storeName: 'Trova IMS',
  currencySymbol: '\u20A6',
  items: [],
  total: 0,
  status: 'idle',
}

function money(value: number, symbol: string) {
  return `${symbol}${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function paymentLabel(method?: string) {
  if (method === 'transfer') return 'Bank transfer'
  if (method === 'pos') return 'Card payment'
  if (method === 'cash') return 'Cash payment'
  return 'Payment received'
}

function TrovaBrand() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <img
        src="/images/favicon.png"
        alt="Trova IMS"
        width={34}
        height={34}
        className="h-[34px] w-[34px] rounded-[9px]"
      />
      <div className="text-left leading-tight">
        <p className="text-[11px] font-medium uppercase" style={{ color: '#a3a3a3', letterSpacing: '0.08em' }}>
          Powered by
        </p>
        <p className="text-sm font-bold tracking-[0.08em]" style={{ color: '#ffffff' }}>TROVA IMS</p>
      </div>
    </div>
  )
}

export function CustomerDisplayView({ storeName, currencySymbol }: { storeName: string; currencySymbol: string }) {
  const [cart, setCart] = React.useState<CustomerDisplayCart>({ ...EMPTY_CART, storeName, currencySymbol })

  React.useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen<CustomerDisplayCart>(CUSTOMER_DISPLAY_EVENT, (event) => setCart(event.payload))
      .then((cleanup) => {
        unlisten = cleanup
        const snapshot = getCustomerDisplaySnapshot()
        if (snapshot) setCart(snapshot)
      })
    return () => unlisten?.()
  }, [])

  React.useEffect(() => {
    if (cart.status !== 'complete') return
    const elapsed = cart.completedAt ? Date.now() - cart.completedAt : 0
    const reset = window.setTimeout(() => {
      clearCustomerDisplaySnapshot()
      setCart({ ...EMPTY_CART, storeName: cart.storeName, currencySymbol: cart.currencySymbol })
    }, Math.max(0, CUSTOMER_DISPLAY_COMPLETE_DURATION_MS - elapsed))
    return () => window.clearTimeout(reset)
  }, [cart.completedAt, cart.currencySymbol, cart.status, cart.storeName])

  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0)
  const isComplete = cart.status === 'complete'
  const hasOrder = cart.status === 'cart' && cart.items.length > 0

  return (
    <main
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#111111', color: '#ffffff', borderTop: '6px solid #f5610a' }}
    >
      <header className="flex items-center justify-between gap-6 px-8 py-6 md:px-12" style={{ borderBottom: '1px solid #2e2e2e' }}>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase" style={{ color: '#f5610a', letterSpacing: '0.1em' }}>
            {isComplete ? 'Transaction complete' : hasOrder ? 'Current order' : 'Customer display'}
          </p>
          <h1 className="mt-1 truncate text-2xl font-bold md:text-3xl">{cart.storeName}</h1>
        </div>
        {hasOrder ? (
          <div className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: '#1f3326', color: '#86efac' }}>
            <ShoppingBag size={17} />
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </div>
        ) : null}
      </header>

      <section className="flex flex-1 flex-col px-8 py-8 md:px-12 md:py-10" aria-live="polite">
        {isComplete ? (
          <div className="m-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: '#163522', color: '#86efac' }}>
              <CheckCircle2 size={58} strokeWidth={2.2} />
            </div>
            <p className="mt-8 text-sm font-semibold uppercase" style={{ color: '#86efac', letterSpacing: '0.1em' }}>Payment received</p>
            <h2 className="mt-2 text-4xl font-bold md:text-5xl">Thank you for your purchase</h2>
            <p className="mt-4 text-lg" style={{ color: '#a3a3a3' }}>{paymentLabel(cart.paymentMethod)}</p>
            <p className="mt-8 text-4xl font-bold tabular-nums md:text-5xl" style={{ color: '#f5610a' }}>
              {money(cart.total, cart.currencySymbol)}
            </p>
            {cart.receiptNumber ? (
              <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: '#a3a3a3' }}>
                <ReceiptText size={16} />
                <span className="font-mono">{cart.receiptNumber}</span>
              </div>
            ) : null}
          </div>
        ) : hasOrder ? (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
            <div className="flex items-end justify-between gap-6 pb-5" style={{ borderBottom: '1px solid #2e2e2e' }}>
              <div>
                <h2 className="text-2xl font-bold md:text-3xl">Your order</h2>
                <p className="mt-1 text-sm" style={{ color: '#a3a3a3' }}>Please review your items before payment.</p>
              </div>
              <p className="hidden text-sm font-medium md:block" style={{ color: '#a3a3a3' }}>Amount</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cart.items.map((item) => (
                <div key={`${item.name}-${item.unitPrice}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-5" style={{ borderBottom: '1px solid #252525' }}>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold md:text-2xl">{item.name}</p>
                    <p className="mt-1 text-sm" style={{ color: '#a3a3a3' }}>
                      {item.quantity} x {money(item.unitPrice, cart.currencySymbol)}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-xl font-bold tabular-nums md:text-2xl">{money(item.total, cart.currencySymbol)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between gap-6 py-6" style={{ borderTop: '2px solid #f5610a' }}>
              <div>
                <p className="text-sm font-medium uppercase" style={{ color: '#a3a3a3', letterSpacing: '0.09em' }}>Total due</p>
                <p className="mt-1 text-sm" style={{ color: '#a3a3a3' }}>{itemCount} {itemCount === 1 ? 'item' : 'items'} in this order</p>
              </div>
              <p className="whitespace-nowrap text-3xl font-bold tabular-nums md:text-5xl" style={{ color: '#f5610a' }}>
                {money(cart.total, cart.currencySymbol)}
              </p>
            </div>
          </div>
        ) : (
          <div className="m-auto flex max-w-xl flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px]" style={{ background: '#2a1a0a' }}>
              <ShoppingBag size={48} style={{ color: '#f5610a' }} />
            </div>
            <p className="mt-8 text-sm font-semibold uppercase" style={{ color: '#f5610a', letterSpacing: '0.1em' }}>Welcome</p>
            <h2 className="mt-2 text-4xl font-bold md:text-5xl">Ready for your order</h2>
            <p className="mt-4 text-lg" style={{ color: '#a3a3a3' }}>Your items and total will appear here.</p>
          </div>
        )}
      </section>

      <footer className="px-8 py-6 text-center md:px-12" style={{ borderTop: '1px solid #2e2e2e' }}>
        <TrovaBrand />
        <p className="mt-3 text-xs" style={{ color: '#737373' }}>Trova IMS is built and managed by LycanForge.</p>
      </footer>
    </main>
  )
}
