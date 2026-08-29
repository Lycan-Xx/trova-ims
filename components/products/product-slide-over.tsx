'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, ScanBarcode } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetCloseButton,
  SheetBody,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// Select still used for the Unit field above
import { CategorySelect } from '@/components/products/category-select'
import { useCurrency } from '@/lib/currency-context'
import { getCurrencySymbol } from '@/lib/currency'
import { createProduct, updateProduct, getProductByBarcode } from '@/app/actions/products'
import type { ProductWithStock } from '@/app/actions/products'
import type { Category, Product, UnitType } from '@/lib/db/schema'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductSlideOverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  /** If provided, panel opens in edit mode pre-populated with this product */
  product?: ProductWithStock | null
  /**
   * Pre-fills the Barcode field on open — e.g. the code from a scan that
   * didn't match any existing product on the POS or Intake screen. If the
   * code turns out to match a product after all (typed by hand, or scanned
   * again), the panel loads that product's details instead of staying in
   * create mode. Ignored when `product` is also provided.
   */
  defaultBarcode?: string
  /**
   * Called right after a new product is successfully created (not on edit).
   * Lets an embedding form — e.g. Stock Intake — select the new product
   * immediately, without waiting for router.refresh() to re-fetch the page.
   */
  onCreated?: (product: Product) => void
}

interface FormErrors {
  name?: string
  sellingPrice?: string
  reorderLevel?: string
  description?: string
}

const UNITS: UnitType[] = ['piece', 'pack', 'kg', 'litre', 'carton', 'dozen', 'bag']

// ─── Input styles ───────────────────────────────────────────────────────────────

const inputClass = [
  'w-full h-10 rounded-lg px-3 text-sm outline-none transition-all',
  'bg-[var(--bg-input)] border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
].join(' ')

const labelClass = 'block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5'
const errorClass = 'mt-1 text-[11px] text-[var(--danger)]'

// ─── Field wrapper ──────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProductSlideOver({
  open,
  onOpenChange,
  categories,
  product,
  defaultBarcode,
  onCreated,
}: ProductSlideOverProps) {
  const router = useRouter()
  const { currency } = useCurrency()

  // A barcode scanned/typed into the field below can match an existing
  // product even when the panel was opened in "create" mode (e.g. from a
  // POS/Intake scan that initially came up empty, or a cashier just typing
  // a code they recognize). When that happens we load that product's
  // details and submit treats it as an edit — matching the explicit
  // `product` prop path used when opening the panel from the product list.
  const [matchedProduct, setMatchedProduct] = React.useState<ProductWithStock | null>(null)
  const activeProduct = product ?? matchedProduct
  const isEditing = !!activeProduct

  // Category list (may grow via inline creation)
  const [localCategories, setLocalCategories] = React.useState<Category[]>(categories)
  React.useEffect(() => { setLocalCategories(categories) }, [categories])

  // Form state
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string>('')
  const [unit, setUnit] = React.useState<UnitType>('piece')
  const [sellingPrice, setSellingPrice] = React.useState('')
  const [trackInventory, setTrackInventory] = React.useState(true)
  const [reorderLevel, setReorderLevel] = React.useState('10')
  const [description, setDescription] = React.useState('')
  const [barcode, setBarcode] = React.useState('')
  const [checkingBarcode, setCheckingBarcode] = React.useState(false)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [loading, setLoading] = React.useState(false)

  // Populate form when product changes (edit mode) or the panel is
  // (re)opened for a fresh scan.
  React.useEffect(() => {
    if (product) {
      setName(product.name)
      setCategoryId(product.category_id ?? ''  )
      setUnit(product.unit)
      setSellingPrice(product.selling_price)
      setTrackInventory(product.track_inventory)
      setReorderLevel(String(product.reorder_level))
      setDescription(product.description ?? '')
      setBarcode(product.barcode ?? '')
    } else {
      setName('')
      setCategoryId('')
      setUnit('piece')
      setSellingPrice('')
      setTrackInventory(true)
      setReorderLevel('10')
      setDescription('')
      setBarcode(defaultBarcode ?? '')
    }
    setMatchedProduct(null)
    setErrors({})
  }, [product, open, defaultBarcode])

  // Barcode scan/typing lookup — only while the panel is in create mode.
  // When editing an explicit product (opened via the product list), the
  // barcode field just edits that product's own barcode directly.
  React.useEffect(() => {
    if (product) return
    const trimmed = barcode.trim()

    if (!trimmed) {
      setMatchedProduct(null)
      return
    }

    setCheckingBarcode(true)
    const handle = setTimeout(async () => {
      const result = await getProductByBarcode(trimmed)
      if (result.success && result.data) {
        setMatchedProduct(result.data)
        setName(result.data.name)
        setCategoryId(result.data.category_id ?? '')
        setUnit(result.data.unit)
        setSellingPrice(result.data.selling_price)
        setTrackInventory(result.data.track_inventory)
        setReorderLevel(String(result.data.reorder_level))
        setDescription(result.data.description ?? '')
      } else {
        setMatchedProduct((prev) => {
          if (prev) {
            // Was showing a matched product's details; the barcode has
            // since changed to something that no longer matches, so go
            // back to a blank slate rather than leaving stale data behind.
            setName('')
            setCategoryId('')
            setUnit('piece')
            setSellingPrice('')
            setTrackInventory(true)
            setReorderLevel('10')
            setDescription('')
          }
          return null
        })
      }
      setCheckingBarcode(false)
    }, 350)

    return () => clearTimeout(handle)
  }, [barcode, product])

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: FormErrors = {}
    if (!name.trim()) next.name = 'Product name is required.'
    if (name.trim().length > 100) next.name = 'Max 100 characters.'
    const price = parseFloat(sellingPrice)
    if (!sellingPrice || isNaN(price) || price <= 0)
      next.sellingPrice = 'Enter a valid price greater than 0.'
    const reorder = parseInt(reorderLevel, 10)
    if (trackInventory && (isNaN(reorder) || reorder < 0))
      next.reorderLevel = 'Reorder level must be 0 or more.'
    if (description.length > 300)
      next.description = 'Max 300 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent, keepOpen = false) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const payload = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      unit,
      sellingPrice: parseFloat(sellingPrice),
      reorderLevel: trackInventory ? parseInt(reorderLevel, 10) : 0,
      trackInventory,
      description: description.trim() || undefined,
      barcode: barcode.trim() || undefined,
    }

    try {
      if (isEditing && activeProduct) {
        const result = await updateProduct(activeProduct.id, payload)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success('Product updated.')
        onOpenChange(false)
        router.refresh()
        return
      }

      const result = await createProduct(payload)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      if (onCreated) {
        // Embedded usage (e.g. Stock Intake form) — let the caller react
        // immediately instead of waiting on a full page refresh.
        onCreated(result.data)
        toast.success(`Product added. SKU: ${result.data.sku}`)
      } else {
        // Standalone usage (Products page) — nudge toward stocking it,
        // since a brand-new product has zero stock and can't be sold yet.
        toast.success(`Product added. SKU: ${result.data.sku}`, {
          action: {
            label: 'Record stock intake',
            onClick: () => router.push(`/intake/new?productId=${result.data.id}`),
          },
        })
      }

      router.refresh()

      if (keepOpen) {
        // Save & Add Another — reset the form but keep the panel open and
        // the category selected, since bulk entry is usually similar items.
        setName('')
        setSellingPrice('')
        setTrackInventory(true)
        setReorderLevel('10')
        setDescription('')
        setBarcode('')
        setMatchedProduct(null)
        setErrors({})
      } else {
        onOpenChange(false)
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Product' : 'Add Product'}</SheetTitle>
          <SheetCloseButton onClick={() => onOpenChange(false)} />
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full">
          <SheetBody>
            <div className="flex flex-col gap-5">

              {/* SKU — edit mode only (explicit edit, or a scanned barcode matched an existing product) */}
              {isEditing && activeProduct && (
                <Field label="SKU">
                  <div
                    className="flex items-center gap-2 h-10 rounded-lg px-3"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                    <span className="mono text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {activeProduct.sku}
                    </span>
                  </div>
                </Field>
              )}

              {/* Barcode — scan directly into the field, or type one in.
                  A USB/Bluetooth scanner acts like a keyboard: it types
                  the digits and hits Enter, which just moves focus along
                  like a normal Tab/Enter would. */}
              <Field label="Barcode (optional)">
                <div className="relative">
                  <ScanBarcode
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      // A scanner's trailing Enter would otherwise submit
                      // the form mid-lookup — swallow it here.
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    placeholder="Scan or type UPC/EAN"
                    autoComplete="off"
                    className={inputClass + ' pl-9'}
                  />
                  {checkingBarcode && (
                    <Loader2
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  )}
                </div>
                {matchedProduct && !product && (
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--accent-primary)' }}>
                    Matches an existing product — details loaded below.
                  </p>
                )}
              </Field>

              {/* Product Name */}
              <Field label="Product Name *" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Indomie Noodles (Pack of 40)"
                  maxLength={100}
                  className={inputClass}
                  style={errors.name ? { borderColor: 'var(--danger)' } : undefined}
                />
              </Field>

              {/* Category */}
              <Field label="Category">
                <CategorySelect
                  categories={localCategories}
                  value={categoryId}
                  onChange={(id, updatedList) => {
                    setCategoryId(id)
                    setLocalCategories(updatedList)
                  }}
                />
              </Field>

              {/* Unit */}
              <Field label="Unit">
                <Select value={unit} onValueChange={(v) => setUnit(v as UnitType)}>
                  <SelectTrigger
                    className="w-full h-10 rounded-lg text-sm"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="text-text-primary capitalize">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Selling Price */}
              <Field label="Selling Price *" error={errors.sellingPrice}>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {getCurrencySymbol(currency)}
                  </span>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                    className={inputClass + ' pl-7'}
                    style={errors.sellingPrice ? { borderColor: 'var(--danger)' } : undefined}
                  />
                </div>
              </Field>

              {/* Track inventory */}
              <div
                className="flex items-start justify-between gap-4 rounded-lg px-3 py-3"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Track stock
                  </p>
                  <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--text-muted)' }}>
                    {activeProduct?.track_inventory === false
                      ? 'Record fresh stock intake to turn tracking back on for this product.'
                      : 'Turn off for services or made-to-order items that should stay sellable without stock intake.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackInventory}
                  disabled={activeProduct?.track_inventory === false}
                  onClick={() => setTrackInventory((value) => !value)}
                  className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: trackInventory ? 'var(--accent-primary)' : 'var(--border)',
                    border: 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-1 h-4 w-4 rounded-full bg-white transition-transform"
                    style={{
                      left: 4,
                      transform: trackInventory ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </button>
              </div>

              {/* Reorder Level */}
              {trackInventory && (
                <Field label="Reorder Level" error={errors.reorderLevel}>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    placeholder="10"
                    min={0}
                    className={inputClass}
                    style={errors.reorderLevel ? { borderColor: 'var(--danger)' } : undefined}
                  />
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    You&apos;ll get a low-stock alert once quantity on hand drops to this number or below.
                  </p>
                </Field>
              )}

              {/* Description */}
              <Field label="Description (optional)" error={errors.description}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief product description…"
                  maxLength={300}
                  rows={3}
                  className={[
                    'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-none',
                    'bg-[var(--bg-input)] border border-[var(--border)]',
                    'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                    'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
                  ].join(' ')}
                  style={errors.description ? { borderColor: 'var(--danger)' } : undefined}
                />
                <p className="mt-1 text-[11px] text-right" style={{ color: 'var(--text-muted)' }}>
                  {description.length}/300
                </p>
              </Field>

            </div>
          </SheetBody>

          {/* Footer */}
          <SheetFooter>
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: loading ? 'var(--accent-primary-hover)' : 'var(--accent-primary)' }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-primary-hover)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-primary)' }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Saving…' : 'Save Product'}
              </button>
              {!isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-9 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-input"
                  onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                  disabled={loading}
                >
                  Save &amp; Add Another
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full h-9 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-input"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
