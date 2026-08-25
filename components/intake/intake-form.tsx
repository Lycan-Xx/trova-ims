'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, ChevronLeft, Loader2, Plus, X, ScanBarcode } from 'lucide-react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { useCurrency } from '@/lib/currency-context'
import { getCurrencySymbol } from '@/lib/currency'
import { createBatchSession, type IntakeLineInput } from '@/app/actions/batches'
import { getProductByBarcode } from '@/app/actions/products'
import { ProductSlideOver } from '@/components/products/product-slide-over'
import { VendorSlideOver } from '@/components/vendors/vendor-slide-over'
import type { VendorWithStats } from '@/app/actions/vendors'
import type { ProductWithStock } from '@/app/actions/products'
import type { Category, Product, Vendor } from '@/lib/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntakeFormProps {
  products: ProductWithStock[]
  vendors: VendorWithStats[]
  categories: Category[]
  defaultProductId?: string
  /**
   * A barcode that was scanned elsewhere (POS) and didn't match any
   * product. Since that lookup already came up empty, there's no point
   * re-checking it here — open straight to the create-product panel with
   * it pre-filled instead of making the cashier scan it a second time.
   */
  defaultBarcode?: string
}

type LineErrorField =
  | 'productId'
  | 'qty'
  | 'numPacks'
  | 'unitsPerPack'
  | 'totalCost'
  | 'sellingPrice'
  | 'expiryDate'

type LineErrors = Partial<Record<LineErrorField, string>>

interface LineState {
  key: string
  productId: string
  vendorId: string
  isConsignment: boolean
  supplierLotNumber: string
  purchaseMode: 'unit' | 'pack'
  qtyUnits: string
  numPacks: string
  unitsPerPack: string
  /** Total cost and cost-per-unit stay in sync — whichever the user typed
   *  into most recently is the "source"; the other is recomputed from it.
   *  lastCostField records which one that is. */
  totalCost: string
  costPerUnit: string
  lastCostField: 'total' | 'perUnit'
  sellingPrice: string
  hasExpiry: boolean
  expiryDate: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function emptyLine(productId = ''): LineState {
  return {
    key: makeKey(),
    productId,
    vendorId: '',
    isConsignment: false,
    supplierLotNumber: '',
    purchaseMode: 'unit',
    qtyUnits: '',
    numPacks: '',
    unitsPerPack: '',
    totalCost: '',
    costPerUnit: '',
    lastCostField: 'total',
    sellingPrice: '',
    hasExpiry: false,
    expiryDate: '',
  }
}

function lineTotalUnits(line: LineState): number {
  if (line.purchaseMode === 'unit') {
    const n = parseInt(line.qtyUnits, 10)
    return isNaN(n) || n <= 0 ? 0 : n
  }
  const packs = parseInt(line.numPacks, 10)
  const perPack = parseInt(line.unitsPerPack, 10)
  if (isNaN(packs) || isNaN(perPack) || packs <= 0 || perPack <= 0) return 0
  return packs * perPack
}

function lineCostPerUnit(line: LineState): number | null {
  if (!line.costPerUnit) return null
  const cpu = parseFloat(line.costPerUnit)
  return isNaN(cpu) || cpu < 0 ? null : cpu
}

/**
 * Recomputes whichever of totalCost/costPerUnit is NOT the current source
 * of truth, given a patch about to be applied (a new cost value, or a
 * quantity/pack change that shifts the total unit count). Always returns a
 * complete patch — merge it with whatever triggered the recompute.
 */
function recomputeCostFields(line: LineState, patch: Partial<LineState>): Partial<LineState> {
  const merged: LineState = { ...line, ...patch }
  const units = lineTotalUnits(merged)
  const source = patch.lastCostField ?? merged.lastCostField

  if (units <= 0) return patch

  if (source === 'perUnit') {
    const cpu = parseFloat(merged.costPerUnit)
    if (!isNaN(cpu) && cpu >= 0) {
      return { ...patch, totalCost: (cpu * units).toFixed(2) }
    }
  } else {
    const cost = parseFloat(merged.totalCost)
    if (!isNaN(cost) && cost >= 0) {
      return { ...patch, costPerUnit: (cost / units).toFixed(2) }
    }
  }
  return patch
}

function lineEffectiveSellingPrice(line: LineState): number | null {
  if (!line.sellingPrice) return null
  const sp = parseFloat(line.sellingPrice)
  return isNaN(sp) || sp <= 0 ? null : sp
}

function lineGrossMargin(line: LineState): number | null {
  const sp = lineEffectiveSellingPrice(line)
  const cpu = lineCostPerUnit(line)
  if (sp === null || cpu === null) return null
  return ((sp - cpu) / sp) * 100
}

function marginColor(margin: number | null): string {
  if (margin === null) return 'var(--text-secondary)'
  if (margin < 0) return 'var(--danger)'
  if (margin < 15) return 'var(--warning)'
  return 'var(--positive)'
}

function validateLine(line: LineState): LineErrors {
  const errs: LineErrors = {}
  if (!line.productId) errs.productId = 'Please select a product.'
  if (line.purchaseMode === 'unit') {
    const n = parseInt(line.qtyUnits, 10)
    if (!line.qtyUnits || isNaN(n) || n <= 0) errs.qty = 'Enter a valid quantity greater than zero.'
  } else {
    const packs = parseInt(line.numPacks, 10)
    const perPack = parseInt(line.unitsPerPack, 10)
    if (!line.numPacks || isNaN(packs) || packs <= 0) errs.numPacks = 'Enter a valid number of packs.'
    if (!line.unitsPerPack || isNaN(perPack) || perPack <= 0) errs.unitsPerPack = 'Enter units per pack.'
  }
  const cost = parseFloat(line.totalCost)
  if (!line.totalCost || isNaN(cost) || cost < 0) errs.totalCost = 'Enter the cost — either total cost or cost per unit above.'
  const sp = parseFloat(line.sellingPrice)
  if (!line.sellingPrice || isNaN(sp) || sp <= 0) errs.sellingPrice = 'Enter a valid selling price.'
  if (line.hasExpiry && !line.expiryDate) errs.expiryDate = 'Please select an expiry date.'
  return errs
}

function lineToInput(line: LineState, products: ProductWithStock[]): IntakeLineInput {
  // The selling price field is always shown, pre-filled with the product's
  // current default — so most lines will match the default exactly. Only
  // send it to the backend as a per-batch override when it actually
  // differs; otherwise leave it null so this batch keeps tracking the
  // product's price automatically if that price changes later (raising a
  // product's price should apply to existing unsold stock too, not just
  // stock received after the price change).
  const product = products.find((p) => p.id === line.productId)
  const defaultPrice = product ? parseFloat(product.selling_price as string) : null
  const enteredPrice = line.sellingPrice ? parseFloat(line.sellingPrice) : null
  const isOverride =
    enteredPrice !== null && (defaultPrice === null || Math.abs(enteredPrice - defaultPrice) > 0.001)

  return {
    productId: line.productId,
    vendorId: line.vendorId || null,
    purchaseMode: line.purchaseMode,
    qtyReceived: line.purchaseMode === 'unit' ? parseInt(line.qtyUnits, 10) : parseInt(line.numPacks, 10),
    packSize: line.purchaseMode === 'pack' ? parseInt(line.unitsPerPack, 10) : 1,
    totalPurchaseCost: parseFloat(line.totalCost),
    sellingPriceOverride: isOverride ? enteredPrice : null,
    expiryDate: line.hasExpiry && line.expiryDate ? new Date(line.expiryDate) : null,
    supplierLotNumber: line.supplierLotNumber.trim() || null,
    isConsignment: line.isConsignment,
  }
}

// ─── BarcodeScanField ───────────────────────────────────────────────────────
// A scanner types the barcode into whatever's focused and sends a trailing
// Enter — this field just needs to sit there, focusable, and act on Enter
// (or on the debounce settling, for manual typing) rather than requiring the
// cashier to open the product dropdown first.

function BarcodeScanField({
  onMatch,
  onNotFound,
}: {
  onMatch: (product: ProductWithStock) => void
  onNotFound: (barcode: string) => void
}) {
  const [value, setValue] = React.useState('')
  const [checking, setChecking] = React.useState(false)

  async function lookup(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return
    setChecking(true)
    const result = await getProductByBarcode(trimmed)
    setChecking(false)
    if (result.success && result.data) {
      onMatch(result.data)
      setValue('')
    } else {
      onNotFound(trimmed)
    }
  }

  // Debounced lookup for manual typing.
  React.useEffect(() => {
    if (!value.trim()) return
    const handle = setTimeout(() => lookup(value), 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative">
      <ScanBarcode
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            lookup(value)
          }
        }}
        placeholder="Scan or type barcode…"
        autoComplete="off"
        className="w-full h-10 rounded-lg pl-9 pr-9 text-sm outline-none transition-all bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]"
      />
      {checking && (
        <Loader2
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
          style={{ color: 'var(--text-muted)' }}
        />
      )}
    </div>
  )
}

// ─── SearchableSelect ────────────────────────────────────────────────────────

interface SearchableSelectProps {
  options: { id: string; label: string; sub?: string }[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  emptyLabel?: string
  /** If provided, shows a "+ Create new…" row at the bottom of the results. */
  onCreateNew?: () => void
  createNewLabel?: string
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  onCreateNew,
  createNewLabel = 'Create new…',
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)
    )
  }, [options, search])

  const selected = options.find((o) => o.id === value)

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={[
          'flex w-full items-center justify-between h-10 rounded-lg px-3 text-sm outline-none transition-all border',
          open
            ? 'border-[var(--accent-primary)] ring-2 ring-[rgba(245,97,10,0.2)]'
            : 'border-[var(--border)]',
        ].join(' ')}
        style={{
          background: 'var(--bg-input)',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          width: 'var(--radix-popover-trigger-width, 360px)',
          minWidth: '280px',
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
            style={{ background: 'var(--bg-input)' }}
          />
          <CommandList>
            {emptyLabel && (
              <CommandGroup>
                <CommandItem value="__none__" onSelect={() => handleSelect('')} className="italic" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-4 h-4 shrink-0 inline-block" />
                  {emptyLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length === 0 && (
              <CommandEmpty style={{ color: 'var(--text-muted)' }}>No results.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem key={opt.id} value={opt.id} onSelect={() => handleSelect(opt.id)}>
                    <span
                      className="flex items-center justify-center w-4 h-4 shrink-0"
                      style={{ color: opt.id === value ? 'var(--accent-primary)' : 'transparent' }}
                    >
                      <Check size={13} />
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.sub && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {opt.sub}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {onCreateNew && (
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={() => {
                    setOpen(false)
                    setSearch('')
                    onCreateNew()
                  }}
                  style={{ color: 'var(--accent-primary)' }}
                >
                  <span className="flex items-center justify-center w-4 h-4 shrink-0">
                    <Plus size={13} />
                  </span>
                  <span className="flex-1 truncate font-medium">{createNewLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--accent-primary)' }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ number, title, children, action }: {
  number: number | string
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
            style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
          >
            {number}
          </span>
          <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 w-fit"
    >
      <span
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? 'var(--accent-primary)' : 'var(--bg-input)', border: '1px solid var(--border)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 inline-block h-4 w-4 rounded-full transition-transform duration-200"
          style={{
            background: 'var(--text-primary)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </span>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'h-10 w-full rounded-lg px-3 text-sm outline-none transition-all border',
        'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
        props.className ?? '',
      ].join(' ')}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        ...props.style,
      }}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className={[
        'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all border resize-none',
        'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
        props.className ?? '',
      ].join(' ')}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        ...props.style,
      }}
    />
  )
}

// ─── Intake Line Card ─────────────────────────────────────────────────────────
// One product + one vendor + its own quantity/pricing/expiry — the atomic
// unit a batch is built from. The intake form is one or more of these.

interface IntakeLineCardProps {
  line: LineState
  index: number
  total: number
  currency: string
  products: ProductWithStock[]
  vendors: VendorWithStats[]
  errors: LineErrors
  onUpdate: (patch: Partial<LineState>) => void
  onRemove: () => void
  onCreateProduct: (barcode?: string) => void
  onCreateVendor: () => void
}

function IntakeLineCard({
  line,
  index,
  total,
  currency,
  products,
  vendors,
  errors,
  onUpdate,
  onRemove,
  onCreateProduct,
  onCreateVendor,
}: IntakeLineCardProps) {
  const productOptions = React.useMemo(
    () => products.map((p) => ({ id: p.id, label: p.name, sub: p.barcode ? `${p.sku} · ${p.barcode}` : p.sku })),
    [products],
  )
  const vendorOptions = React.useMemo(
    () => vendors.map((v) => ({ id: v.id, label: v.name, sub: v.type === 'consignment' ? 'Consignment' : 'Direct' })),
    [vendors],
  )

  const totalUnits = lineTotalUnits(line)
  const costPerUnit = lineCostPerUnit(line)
  const grossMargin = lineGrossMargin(line)

  function handleVendorChange(vendorId: string) {
    if (!vendorId) {
      onUpdate({ vendorId, isConsignment: false })
      return
    }
    const vendor = vendors.find((v) => v.id === vendorId)
    onUpdate({ vendorId, isConsignment: vendor?.type === 'consignment' ? true : line.isConsignment })
  }

  function handleProductChange(productId: string) {
    const patch: Partial<LineState> = { productId }
    // Pre-fill selling price with this product's current default — the
    // field stays freely editable, this just saves re-typing the common
    // case where a batch sells at the usual price.
    if (!line.sellingPrice) {
      const product = products.find((p) => p.id === productId)
      if (product) patch.sellingPrice = parseFloat(product.selling_price as string).toFixed(2)
    }
    onUpdate(patch)
  }

  // Any change that affects total unit count (quantity, pack size, or
  // switching purchase mode) needs the cost fields resynced — whichever of
  // Total Cost / Cost per Unit the user typed into most recently stays the
  // source of truth, and the other one recomputes from it.
  function handleUnitsAffectingChange(patch: Partial<LineState>) {
    onUpdate(recomputeCostFields(line, patch))
  }

  function handleTotalCostChange(raw: string) {
    onUpdate(recomputeCostFields(line, { totalCost: raw, lastCostField: 'total' }))
  }

  function handleCostPerUnitChange(raw: string) {
    onUpdate(recomputeCostFields(line, { costPerUnit: raw, lastCostField: 'perUnit' }))
  }

  return (
    <Section
      number={index + 1}
      title={total > 1 ? `Item ${index + 1}` : 'What are you receiving?'}
      action={
        total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove this item"
            className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--bg-input)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <X size={15} />
          </button>
        ) : undefined
      }
    >
      {/* Barcode scan — a faster way to fill in Product below, not a
          separate field of its own. Scanning selects the matching product;
          an unrecognized code opens the create-product panel with it
          pre-filled. */}
      <Field label="Scan Barcode (optional)">
        <BarcodeScanField
          onMatch={(product) => handleProductChange(product.id)}
          onNotFound={(barcode) => onCreateProduct(barcode)}
        />
      </Field>

      {/* Product */}
      <Field label="Product" required error={errors.productId}>
        <div data-error={!!errors.productId}>
          <SearchableSelect
            options={productOptions}
            value={line.productId}
            onChange={handleProductChange}
            placeholder="Search products…"
            onCreateNew={() => onCreateProduct()}
            createNewLabel="Create new product…"
          />
        </div>
      </Field>

      {/* Vendor */}
      <Field label="Vendor">
        <SearchableSelect
          options={vendorOptions}
          value={line.vendorId}
          onChange={handleVendorChange}
          placeholder="Select a vendor…"
          emptyLabel="(No vendor / Open market)"
          onCreateNew={onCreateVendor}
          createNewLabel="Create new vendor…"
        />
      </Field>

      {/* Consignment */}
      <Toggle
        checked={line.isConsignment}
        onChange={(v) => onUpdate({ isConsignment: v })}
        label="Mark as consignment stock"
      />

      {/* Supplier lot number */}
      <Field label="Supplier Lot Number (optional)">
        <Input
          type="text"
          value={line.supplierLotNumber}
          onChange={(e) => onUpdate({ supplierLotNumber: e.target.value })}
          placeholder="Only if the delivery has one"
          maxLength={100}
        />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Your internal batch reference is generated automatically — this
          is just for the supplier&apos;s own code, if the delivery has one.
        </p>
      </Field>

      {/* Purchase mode */}
      <Field label="Purchase Mode" required>
        <div className="flex gap-3">
          {(['unit', 'pack'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleUnitsAffectingChange({ purchaseMode: mode })}
              className="flex-1 flex flex-col items-start gap-0.5 rounded-lg px-4 py-3 border text-sm font-medium transition-all"
              style={{
                background: line.purchaseMode === mode ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                border: `1px solid ${line.purchaseMode === mode ? 'var(--accent-primary)' : 'var(--border)'}`,
                color: line.purchaseMode === mode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {mode === 'unit' ? 'By Unit' : 'By Pack'}
              <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                {mode === 'unit' ? 'Each item counted individually' : 'Carton, dozen, bag, etc.'}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {/* Qty inputs */}
      {line.purchaseMode === 'unit' ? (
        <Field label="Quantity (units)" required error={errors.qty}>
          <div data-error={!!errors.qty}>
            <Input
              type="number"
              min={1}
              step={1}
              value={line.qtyUnits}
              onChange={(e) => handleUnitsAffectingChange({ qtyUnits: e.target.value })}
              placeholder="e.g. 100"
            />
          </div>
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Number of Packs" required error={errors.numPacks}>
            <div data-error={!!errors.numPacks}>
              <Input
                type="number"
                min={1}
                step={1}
                value={line.numPacks}
                onChange={(e) => handleUnitsAffectingChange({ numPacks: e.target.value })}
                placeholder="e.g. 10"
              />
            </div>
          </Field>
          <Field label="Units Per Pack" required error={errors.unitsPerPack}>
            <div data-error={!!errors.unitsPerPack}>
              <Input
                type="number"
                min={1}
                step={1}
                value={line.unitsPerPack}
                onChange={(e) => handleUnitsAffectingChange({ unitsPerPack: e.target.value })}
                placeholder="e.g. 12"
              />
            </div>
          </Field>
        </div>
      )}

      {/* Cost — either box can be typed into, the other fills in automatically */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Total Purchase Cost (${getCurrencySymbol(currency)})`} required error={errors.totalCost}>
            <div data-error={!!errors.totalCost} className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              >
                {getCurrencySymbol(currency)}
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={line.totalCost}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </Field>
          <Field label={`Cost Per Unit (${getCurrencySymbol(currency)})`}>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              >
                {getCurrencySymbol(currency)}
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={line.costPerUnit}
                onChange={(e) => handleCostPerUnitChange(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </Field>
        </div>
        <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
          {totalUnits > 0
            ? `Know either number? Type it in — the other fills in for ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} automatically.`
            : 'Know either number? Type it in — enter a quantity above and the other fills in automatically.'}
        </p>
      </div>

      {/* Selling price — always shown, pre-filled with this product's usual price */}
      <Field label={`Selling Price per Unit (${getCurrencySymbol(currency)})`} required error={errors.sellingPrice}>
        <div data-error={!!errors.sellingPrice} className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {getCurrencySymbol(currency)}
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={line.sellingPrice}
            onChange={(e) => onUpdate({ sellingPrice: e.target.value })}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Pre-filled with this product&apos;s usual price — change it if this batch sells for something different.
        </p>
      </Field>

      {/* Profit — one line, always visible once cost and selling price are both set */}
      {grossMargin !== null && costPerUnit !== null && (() => {
        const sellingPrice = lineEffectiveSellingPrice(line) ?? 0
        const profitPerUnit = sellingPrice - costPerUnit
        return (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>You make </span>
            <span className="font-semibold mono" style={{ color: marginColor(grossMargin) }}>
              {getCurrencySymbol(currency)}{fmt(Math.abs(profitPerUnit))}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}> per unit </span>
            <span className="font-semibold" style={{ color: marginColor(grossMargin) }}>
              ({grossMargin.toFixed(1)}%)
            </span>
            {profitPerUnit < 0 && (
              <span style={{ color: 'var(--danger)' }}> — you&apos;re selling below cost</span>
            )}
          </div>
        )
      })()}

      {/* Expiry */}
      <Toggle
        checked={line.hasExpiry}
        onChange={(v) => onUpdate({ hasExpiry: v })}
        label="This item has an expiry date"
      />

      {line.hasExpiry && (
        <Field label="Expiry Date" required error={errors.expiryDate}>
          <div data-error={!!errors.expiryDate}>
            <Input
              type="date"
              value={line.expiryDate}
              onChange={(e) => onUpdate({ expiryDate: e.target.value })}
              min={todayString()}
            />
          </div>
        </Field>
      )}
    </Section>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function IntakeForm({ products, vendors, categories, defaultProductId, defaultBarcode }: IntakeFormProps) {
  const router = useRouter()
  const { currency } = useCurrency()

  // Local copies of products/vendors so a newly created one can be merged in
  // and auto-selected immediately, without waiting for the page to refetch.
  const [localProducts, setLocalProducts] = React.useState<ProductWithStock[]>(products)
  const [localVendors, setLocalVendors] = React.useState<VendorWithStats[]>(vendors)
  React.useEffect(() => { setLocalProducts(products) }, [products])
  React.useEffect(() => { setLocalVendors(vendors) }, [vendors])

  // Which line triggered the "Create new product/vendor" panel — so the
  // newly created record gets applied to that specific line, not just the
  // first one.
  const [activeLineKey, setActiveLineKey] = React.useState<string | null>(null)
  const [productPanelOpen, setProductPanelOpen] = React.useState(false)
  const [vendorPanelOpen, setVendorPanelOpen] = React.useState(false)
  // Set when a scanned barcode didn't match anything, so the create-product
  // panel opens with it pre-filled instead of a blank Barcode field.
  const [pendingBarcode, setPendingBarcode] = React.useState<string | undefined>(undefined)

  // Shared across the whole intake session — one restock trip is normally
  // one date, and "notes about this delivery" apply to everything in it.
  const [dateReceived, setDateReceived] = React.useState(todayString())
  const [sessionNotes, setSessionNotes] = React.useState('')
  const [dateError, setDateError] = React.useState<string | undefined>()

  // One or more product+vendor lines. A single-line submission behaves
  // exactly as intake always has; multiple lines share one intake session.
  const [lines, setLines] = React.useState<LineState[]>(() => {
    const first = emptyLine(defaultProductId)
    if (defaultProductId) {
      const product = products.find((p) => p.id === defaultProductId)
      if (product) first.sellingPrice = parseFloat(product.selling_price as string).toFixed(2)
    }
    return [first]
  })
  const [lineErrors, setLineErrors] = React.useState<Record<string, LineErrors>>({})

  const [submitting, setSubmitting] = React.useState(false)

  // A barcode arriving via ?barcode= (redirected here from a POS scan that
  // had no match) already failed a lookup once — skip straight to create.
  React.useEffect(() => {
    if (defaultBarcode) {
      openCreateProduct(lines[0].key, defaultBarcode)
    }
    // Only on mount — this shouldn't reopen if the panel is closed later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Line management ────────────────────────────────────────────────────────

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)))
    setLineErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // ─── Inline creation handlers ──────────────────────────────────────────────

  function openCreateProduct(lineKey: string, barcode?: string) {
    setActiveLineKey(lineKey)
    setPendingBarcode(barcode)
    setProductPanelOpen(true)
  }

  function openCreateVendor(lineKey: string) {
    setActiveLineKey(lineKey)
    setVendorPanelOpen(true)
  }

  function handleProductCreated(product: Product) {
    const withDefaults: ProductWithStock = {
      ...product,
      category_name: categories.find((c) => c.id === product.category_id)?.name ?? null,
      current_stock: 0, // brand new — no batches yet
    }
    setLocalProducts((prev) => [...prev, withDefaults])
    if (activeLineKey) updateLine(activeLineKey, { productId: product.id })
  }

  function handleVendorCreated(vendor: Vendor) {
    const withDefaults: VendorWithStats = {
      ...vendor,
      batch_count: 0,
      outstanding_qty: 0,
    }
    setLocalVendors((prev) => [...prev, withDefaults])
    if (activeLineKey) {
      updateLine(activeLineKey, {
        vendorId: vendor.id,
        isConsignment: vendor.type === 'consignment',
      })
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nextDateError = !dateReceived ? 'Date received is required.' : undefined
    const nextLineErrors: Record<string, LineErrors> = {}
    let hasErrors = !!nextDateError

    for (const line of lines) {
      const errs = validateLine(line)
      if (Object.keys(errs).length > 0) {
        nextLineErrors[line.key] = errs
        hasErrors = true
      }
    }

    setDateError(nextDateError)
    setLineErrors(nextLineErrors)

    if (hasErrors) {
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    setSubmitting(true)

    try {
      const result = await createBatchSession({
        receivedAt: new Date(dateReceived),
        notes: sessionNotes.trim() || null,
        lines: lines.map((l) => lineToInput(l, localProducts)),
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      if (lines.length === 1) {
        const units = lineTotalUnits(lines[0])
        const name = localProducts.find((p) => p.id === lines[0].productId)?.name ?? 'product'
        toast.success(`Batch recorded. ${units} unit${units !== 1 ? 's' : ''} of ${name} added to stock.`)
      } else {
        const totalUnits = lines.reduce((sum, l) => sum + lineTotalUnits(l), 0)
        const vendorCount = new Set(lines.map((l) => l.vendorId).filter(Boolean)).size
        const vendorPart = vendorCount > 1 ? ` across ${vendorCount} vendors` : ''
        toast.success(
          `${lines.length} batches recorded. ${totalUnits} units${vendorPart} added to stock.`,
        )
      }

      router.push('/intake')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record stock intake.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 max-w-2xl mx-auto">

      {/* Back link */}
      <Link
        href="/intake"
        className="flex items-center gap-1.5 text-sm w-fit transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <ChevronLeft size={15} />
        Back to Intake Log
      </Link>

      {/* ── Intake details (shared across every line) ── */}
      <Section number="•" title="When did this arrive?">
        <Field label="Date Received" required error={dateError}>
          <div data-error={!!dateError}>
            <Input
              type="date"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              max={todayString()}
            />
          </div>
        </Field>
        {lines.length > 1 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Applies to every item below — for one restock trip received on the same day.
          </p>
        )}
      </Section>

      {/* ── One card per product/vendor line ── */}
      {lines.map((line, index) => (
        <IntakeLineCard
          key={line.key}
          line={line}
          index={index}
          total={lines.length}
          currency={currency}
          products={localProducts}
          vendors={localVendors}
          errors={lineErrors[line.key] ?? {}}
          onUpdate={(patch) => updateLine(line.key, patch)}
          onRemove={() => removeLine(line.key)}
          onCreateProduct={(barcode) => openCreateProduct(line.key, barcode)}
          onCreateVendor={() => openCreateVendor(line.key)}
        />
      ))}

      {/* Add another line */}
      <button
        type="button"
        onClick={addLine}
        className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed text-sm font-medium transition-colors"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)'
          e.currentTarget.style.color = 'var(--accent-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        <Plus size={15} />
        Add Another Product
      </button>

      {/* Session notes */}
      <Section number="•" title="Notes">
        <Field label={lines.length > 1 ? 'Notes about this delivery' : 'Notes'}>
          <Textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Any additional notes about this shipment…"
            maxLength={500}
          />
        </Field>
      </Section>

      {/* ── Actions ── */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pb-8">
        <Link
          href="/intake"
          className="flex items-center justify-center h-10 rounded-lg px-5 text-sm font-medium border transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-input)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg px-5 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-primary)' }}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.background = 'var(--accent-primary-hover)'
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {submitting
            ? 'Recording…'
            : lines.length > 1
              ? `Record ${lines.length} Batches`
              : 'Record Stock Intake'}
        </button>
      </div>
    </form>

    <ProductSlideOver
      open={productPanelOpen}
      onOpenChange={(next) => {
        setProductPanelOpen(next)
        if (!next) setPendingBarcode(undefined)
      }}
      categories={categories}
      defaultBarcode={pendingBarcode}
      onCreated={handleProductCreated}
    />
    <VendorSlideOver
      open={vendorPanelOpen}
      onOpenChange={setVendorPanelOpen}
      onCreated={handleVendorCreated}
    />
    </>
  )
}
