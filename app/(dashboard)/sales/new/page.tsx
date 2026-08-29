'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { X, Search, ShoppingCart, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/currency-context'
import { getCurrencySymbol } from '@/lib/currency'
import { getProducts, getProductByBarcode } from '@/app/actions/products'
import { createSale, getEffectiveUnitPrices } from '@/app/actions/sales'
import type { ProductWithStock } from '@/app/actions/products'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CartEntry {
  product: ProductWithStock
  qty: number
  qtyError: string | null
}

type PaymentMethod = 'cash' | 'transfer' | 'pos'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function tracksInventory(product: ProductWithStock): boolean {
  return product.track_inventory !== false
}

function productIsOutOfStock(product: ProductWithStock): boolean {
  return tracksInventory(product) && product.current_stock === 0
}

function getQtyError(product: ProductWithStock, qty: number): string | null {
  if (!tracksInventory(product)) return null
  return qty > product.current_stock ? `Max ${product.current_stock} available` : null
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NewSalePage() {
  const router = useRouter()
  const { currency } = useCurrency()

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<ProductWithStock[]>([])
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [notFoundBarcode, setNotFoundBarcode] = React.useState<string | null>(null)
  const searchRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = React.useRef(0)

  // Cart state
  const [cart, setCart] = React.useState<CartEntry[]>([])

  // Effective per-unit prices, keyed by product id. This is the price that
  // will actually be charged (the next FEFO batch's override, if any) — it
  // can differ from product.selling_price, so it's what the cart and search
  // dropdown must display to avoid showing a total that doesn't match the
  // receipt. Falls back to product.selling_price until it loads.
  const [effectivePrices, setEffectivePrices] = React.useState<Record<string, number>>({})

  function getPrice(product: ProductWithStock): number {
    const loaded = effectivePrices[product.id]
    return loaded !== undefined ? loaded : parseFloat(product.selling_price as string)
  }

  // Payment state
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = React.useState('')

  // Submit state
  const [submitting, setSubmitting] = React.useState(false)

  // Mobile drawer state
  const [mobileCheckoutOpen, setMobileCheckoutOpen] = React.useState(false)

  // Autofocus on mount
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close dropdown on outside click
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Debounced product search
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const requestId = ++searchRequestRef.current
    setNotFoundBarcode(null)

    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await getProducts({ search: searchQuery.trim(), page: 1 })
        if (requestId !== searchRequestRef.current) return
        if (res.success) {
          setSearchResults(res.data.products.slice(0, 8))
          setSearchOpen(true)
        } else {
          // Action returned a handled error (e.g. DB unavailable)
          setSearchResults([])
          setSearchOpen(false)
          toast.error(`Search failed: ${res.error}`)
        }
      } catch {
        if (requestId !== searchRequestRef.current) return
        // Unexpected / network-level error — clear results silently
        setSearchResults([])
        setSearchOpen(false)
        toast.error('Could not search products. Please try again.')
      } finally {
        // Always clear the loading spinner, even if the action throws
        if (requestId === searchRequestRef.current) setSearchLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (requestId === searchRequestRef.current) {
        searchRequestRef.current += 1
        setSearchLoading(false)
      }
    }
  }, [searchQuery])

  // Keep effective prices in sync with whatever's currently visible: the
  // search dropdown and the cart. Re-fetches on every change to those sets
  // so a price never goes stale mid-checkout.
  const cartIds = cart.map((e) => e.product.id).join(',')
  const searchIds = searchResults.map((p) => p.id).join(',')
  React.useEffect(() => {
    const ids = Array.from(new Set([...cartIds.split(','), ...searchIds.split(',')].filter(Boolean)))
    if (ids.length === 0) return
    getEffectiveUnitPrices(ids).then((res) => {
      if (res.success) {
        setEffectivePrices((prev) => ({ ...prev, ...res.data }))
      }
    })
  }, [cartIds, searchIds])

  // ── Cart helpers ──────────────────────────────────────────────────────────────

  function addToCart(product: ProductWithStock) {
    if (productIsOutOfStock(product)) return
    setCart((prev) => {
      const existing = prev.find((e) => e.product.id === product.id)
      if (existing) {
        const newQty = existing.qty + 1
        const qtyError = getQtyError(product, newQty)
        return prev.map((e) =>
          e.product.id === product.id ? { ...e, qty: newQty, qtyError } : e,
        )
      }
      return [...prev, { product, qty: 1, qtyError: null }]
    })
    setSearchQuery('')
    setSearchOpen(false)
    setNotFoundBarcode(null)
    inputRef.current?.focus()
  }

  function updateQty(productId: string, value: string) {
    const parsed = parseInt(value, 10)
    setCart((prev) =>
      prev.map((e) => {
        if (e.product.id !== productId) return e
        if (isNaN(parsed) || parsed < 1) return { ...e, qty: 1, qtyError: null }
        const qtyError = getQtyError(e.product, parsed)
        return { ...e, qty: parsed, qtyError }
      }),
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((e) => e.product.id !== productId))
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const cartTotal = cart.reduce(
    (sum, e) => sum + e.qty * getPrice(e.product),
    0,
  )

  const amountPaidNum = parseFloat(amountPaid) || 0
  const change = paymentMethod === 'cash' ? amountPaidNum - cartTotal : null

  const hasQtyErrors = cart.some((e) => e.qtyError !== null)
  const insufficientCash =
    paymentMethod === 'cash' && amountPaidNum < cartTotal
  const canSubmit =
    cart.length > 0 && !hasQtyErrors && !submitting &&
    (paymentMethod !== 'cash' || amountPaidNum >= cartTotal)

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await createSale(
        cart.map((e) => ({ productId: e.product.id, qtySold: e.qty })),
        paymentMethod,
        amountPaidNum,
      )
      if (res.success) {
        toast.success(`Sale recorded — ${res.data.receiptNumber}`)
        router.push(`/sales/${res.data.saleId}`)
      } else {
        toast.error(res.error)
        setSubmitting(false)
      }
    } catch {
      toast.error('An unexpected error occurred.')
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col md:flex-row h-[calc(100vh-48px)] overflow-hidden relative"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── LEFT COLUMN ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col w-full md:w-[55%]"
        style={{
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-base)',
        }}
      >
        {/* Page header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3" data-joyride="sale">
            <Link
              href="/sales"
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--bg-input)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Back to sales"
            >
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              New Sale
            </h1>
          </div>
          <Link
            href="/sales"
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Discard
          </Link>
        </div>

        {/* Search bar */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          <div ref={searchRef} className="relative">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              {searchLoading && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                  style={{ color: 'var(--text-muted)' }}
                />
              )}
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const raw = searchQuery.trim()
                    if (!raw) return

                    // A scanner sends Enter right after the digits, often
                    // before the debounced name/SKU search below has even
                    // resolved — so Enter needs its own authoritative,
                    // exact-match barcode check rather than trusting
                    // whatever's currently in the dropdown.
                    const barcodeResult = await getProductByBarcode(raw)
                    if (barcodeResult.success && barcodeResult.data) {
                      if (!productIsOutOfStock(barcodeResult.data)) {
                        addToCart(barcodeResult.data)
                      } else {
                        toast.error(`${barcodeResult.data.name} is out of stock.`)
                      }
                      return
                    }

                    // Not a barcode match — fall back to the normal
                    // search-dropdown behavior for a typed name/SKU.
                    // The debounce may not have completed yet when a user
                    // presses Enter after typing a name/SKU. Resolve the
                    // normal search directly so manual lookup remains a
                    // reliable fallback to barcode lookup.
                    let typedResults = searchResults
                    if (typedResults.length === 0) {
                      const typedResult = await getProducts({ search: raw, page: 1 })
                      if (!typedResult.success) {
                        toast.error(typedResult.error)
                        return
                      }
                      typedResults = typedResult.data.products.slice(0, 8)
                    }

                    if (typedResults.length > 0) {
                      const first = typedResults.find((p) => !productIsOutOfStock(p))
                      if (first) {
                        addToCart(first)
                        return
                      }
                      toast.error('All matching products are out of stock.')
                      return
                    }

                    // Nothing matched at all — most likely a scanned code
                    // for a product that hasn't been added yet.
                    setSearchOpen(false)
                    setNotFoundBarcode(raw)
                  }
                  if (e.key === 'Escape') {
                    setSearchOpen(false)
                    setSearchQuery('')
                    setNotFoundBarcode(null)
                  }
                }}
                placeholder="Search or scan barcode..."
                className="w-full h-10 pl-9 pr-9 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                autoComplete="off"
              />
            </div>

            {/* Dropdown results */}
            {searchOpen && searchResults.length > 0 && (
              <div
                className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-lg"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}
              >
                {searchResults.map((product) => {
                  const outOfStock = productIsOutOfStock(product)
                  return (
                    <button
                      key={product.id}
                      disabled={outOfStock}
                      onClick={() => addToCart(product)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{
                        opacity: outOfStock ? 0.45 : 1,
                        cursor: outOfStock ? 'not-allowed' : 'pointer',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      onMouseEnter={(e) => {
                        if (!outOfStock) e.currentTarget.style.background = 'var(--bg-card-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {product.name}
                        </span>
                        <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          {product.sku}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 ml-4 shrink-0">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {getCurrencySymbol(currency)}{fmt(getPrice(product))}
                        </span>
                        {outOfStock ? (
                          <span className="text-xs" style={{ color: 'var(--danger)' }}>Out of stock</span>
                        ) : !tracksInventory(product) ? (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Stock not tracked
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {product.current_stock} {product.unit} avail.
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Unmatched barcode prompt */}
            {notFoundBarcode && (
              <div
                className="mt-2 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  No product matches <span className="mono">{notFoundBarcode}</span>.
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push(`/intake/new?barcode=${encodeURIComponent(notFoundBarcode)}`)}
                    className="text-sm font-semibold whitespace-nowrap"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Add new product?
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotFoundBarcode(null)}
                    aria-label="Dismiss"
                    className="flex items-center justify-center"
                  >
                    <X size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={15} style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Cart
            </span>
            {cart.length > 0 && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
              >
                {cart.length}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl"
              style={{ border: '1px dashed var(--border)' }}
            >
              <ShoppingCart size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                Search for products above to add them
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Header row */}
              <div
                className="grid text-xs font-medium px-3 pb-1"
                style={{
                  gridTemplateColumns: '1fr 100px 90px 80px 28px',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Product</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {cart.map((entry) => {
                const lineTotal = entry.qty * getPrice(entry.product)
                return (
                  <div key={entry.product.id}>
                    <div
                      className="grid items-center px-3 py-3 rounded-lg"
                      style={{
                        gridTemplateColumns: '1fr 100px 90px 80px 28px',
                        background: 'var(--bg-card)',
                        border: `1px solid ${entry.qtyError ? 'var(--danger)' : 'var(--border)'}`,
                      }}
                    >
                      {/* Product name */}
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {entry.product.name}
                        </p>
                        <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {entry.product.sku}
                        </p>
                      </div>

                      {/* Qty input */}
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min={1}
                          max={tracksInventory(entry.product) ? entry.product.current_stock : undefined}
                          value={entry.qty}
                          onChange={(e) => updateQty(entry.product.id, e.target.value)}
                          className="w-16 h-8 text-center text-sm rounded-md outline-none"
                          style={{
                            background: 'var(--bg-input)',
                            border: `1px solid ${entry.qtyError ? 'var(--danger)' : 'var(--border)'}`,
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>

                      {/* Unit price */}
                      <p className="text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                        {getCurrencySymbol(currency)}{fmt(getPrice(entry.product))}
                      </p>

                      {/* Line total */}
                      <p className="text-sm font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                        {getCurrencySymbol(currency)}{fmt(lineTotal)}
                      </p>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromCart(entry.product.id)}
                        className="flex items-center justify-center w-7 h-7 rounded-md ml-auto transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger)'
                          e.currentTarget.style.background = 'var(--danger-bg)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)'
                          e.currentTarget.style.background = 'transparent'
                        }}
                        aria-label={`Remove ${entry.product.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Inline qty error */}
                    {entry.qtyError && (
                      <p className="text-xs mt-1 ml-3" style={{ color: 'var(--danger)' }}>
                        {entry.qtyError}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobile Checkout Button */}
        <div className="md:hidden mt-auto px-6 py-4 shrink-0" style={{ background: 'var(--bg-nav)', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setMobileCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full flex items-center justify-between px-4 rounded-xl font-semibold transition-colors"
            style={{
              height: 48,
              fontSize: 16,
              background: cart.length > 0 ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: cart.length > 0 ? '#ffffff' : 'var(--text-muted)',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <span>Checkout</span>
            <span>{getCurrencySymbol(currency)}{fmt(cartTotal)}</span>
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN ───────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 flex flex-col md:static md:w-[45%] md:z-auto transition-transform duration-300 ${mobileCheckoutOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}
        style={{ background: 'var(--bg-nav)' }}
      >
        {/* Mobile Drawer Header */}
        <div className="md:hidden flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Checkout</h2>
          <button onClick={() => setMobileCheckoutOpen(false)} className="p-2 -mr-2" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        {/* Order summary */}
        <div
          className="flex-1 overflow-y-auto px-6 pt-6 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Order Summary
          </h2>

          {cart.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No items added yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {cart.map((entry) => {
                const unitPrice = getPrice(entry.product)
                const lineTotal = entry.qty * unitPrice
                return (
                  <div key={entry.product.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs truncate min-w-0" style={{ color: 'var(--text-secondary)' }}>
                      {entry.product.name}
                    </span>
                    <span className="text-xs whitespace-nowrap shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {entry.qty} × {getCurrencySymbol(currency)}{fmt(unitPrice)}
                    </span>
                    <span className="text-xs font-medium whitespace-nowrap shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {getCurrencySymbol(currency)}{fmt(lineTotal)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Divider + Total */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Total
              </span>
              <span
                className="font-bold"
                style={{ fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}
              >
                {getCurrencySymbol(currency)}{fmt(cartTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment section */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Payment method toggle */}
          <div>
            <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--text-secondary)' }}>
              Payment Method
            </p>
            <div className="flex gap-2">
              {(['cash', 'transfer', 'pos'] as PaymentMethod[]).map((method) => {
                const labels: Record<PaymentMethod, string> = {
                  cash: 'Cash',
                  transfer: 'Bank Transfer',
                  pos: 'POS Terminal',
                }
                const active = paymentMethod === method
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className="flex-1 h-9 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border)'}`,
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {labels[method]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount received (cash only) */}
          {paymentMethod === 'cash' && (
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Amount Received ({getCurrencySymbol(currency)})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: `1px solid ${insufficientCash && amountPaid !== '' ? 'var(--danger)' : 'var(--border)'}`,
                  color: 'var(--text-primary)',
                }}
              />

              {/* Change display */}
              {amountPaid !== '' && change !== null && (
                <div className="flex items-center justify-between mt-3 px-3 py-2.5 rounded-lg"
                  style={{
                    background: change >= 0 ? 'var(--positive-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${change >= 0 ? 'var(--positive)' : 'var(--danger)'}`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: change >= 0 ? 'var(--positive)' : 'var(--danger)' }}>
                    {change >= 0 ? 'Change' : 'Shortfall'}
                  </span>
                  <span
                    className="font-bold"
                    style={{
                      fontSize: 18,
                      color: change >= 0 ? 'var(--positive)' : 'var(--danger)',
                      lineHeight: 1,
                    }}
                  >
                    {getCurrencySymbol(currency)}{fmt(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Complete Sale button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors"
            style={{
              height: 48,
              fontSize: 16,
              background: canSubmit ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: canSubmit ? '#ffffff' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              if (canSubmit) e.currentTarget.style.background = 'var(--accent-primary-hover)'
            }}
            onMouseLeave={(e) => {
              if (canSubmit) e.currentTarget.style.background = 'var(--accent-primary)'
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Complete Sale'
            )}
          </button>

          {/* Disabled hint */}
          {cart.length > 0 && !canSubmit && !submitting && (
            <p className="text-xs text-center -mt-2" style={{ color: 'var(--text-muted)' }}>
              {hasQtyErrors
                ? 'Fix quantity errors above'
                : insufficientCash
                ? 'Amount received is less than total'
                : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
