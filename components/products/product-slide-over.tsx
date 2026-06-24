'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
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
import { createProduct, updateProduct } from '@/app/actions/products'
import type { ProductWithStock } from '@/app/actions/products'
import type { Category, UnitType } from '@/lib/db/schema'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductSlideOverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  /** If provided, panel opens in edit mode pre-populated with this product */
  product?: ProductWithStock | null
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
}: ProductSlideOverProps) {
  const router = useRouter()
  const isEditing = !!product

  // Form state
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string>('')
  const [unit, setUnit] = React.useState<UnitType>('piece')
  const [sellingPrice, setSellingPrice] = React.useState('')
  const [reorderLevel, setReorderLevel] = React.useState('10')
  const [description, setDescription] = React.useState('')
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [loading, setLoading] = React.useState(false)

  // Populate form when product changes (edit mode)
  React.useEffect(() => {
    if (product) {
      setName(product.name)
      setCategoryId(product.category_id ?? ''  )
      setUnit(product.unit)
      setSellingPrice(product.selling_price)
      setReorderLevel(String(product.reorder_level))
      setDescription(product.description ?? '')
    } else {
      setName('')
      setCategoryId('')
      setUnit('piece')
      setSellingPrice('')
      setReorderLevel('10')
      setDescription('')
    }
    setErrors({})
  }, [product, open])

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: FormErrors = {}
    if (!name.trim()) next.name = 'Product name is required.'
    if (name.trim().length > 100) next.name = 'Max 100 characters.'
    const price = parseFloat(sellingPrice)
    if (!sellingPrice || isNaN(price) || price <= 0)
      next.sellingPrice = 'Enter a valid price greater than 0.'
    const reorder = parseInt(reorderLevel, 10)
    if (isNaN(reorder) || reorder < 0)
      next.reorderLevel = 'Reorder level must be 0 or more.'
    if (description.length > 300)
      next.description = 'Max 300 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const payload = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      unit,
      sellingPrice: parseFloat(sellingPrice),
      reorderLevel: parseInt(reorderLevel, 10),
      description: description.trim() || undefined,
    }

    try {
      if (isEditing && product) {
        const result = await updateProduct(product.id, payload)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success('Product updated.')
      } else {
        const result = await createProduct(payload)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success(`Product added. SKU: ${result.data.sku}`)
      }
      onOpenChange(false)
      router.refresh()
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

              {/* SKU — edit mode only */}
              {isEditing && product && (
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
                      {product.sku}
                    </span>
                  </div>
                </Field>
              )}

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
                <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : (v ?? ''))  }>
                  <SelectTrigger
                    className="w-full h-10 rounded-lg text-sm"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      color: categoryId ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <SelectItem value="none" className="text-text-muted">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-text-primary">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    ₦
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

              {/* Reorder Level */}
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
              </Field>

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
