'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, ChevronLeft, Loader2 } from 'lucide-react'
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
import { createBatch } from '@/app/actions/batches'
import type { VendorWithStats } from '@/app/actions/vendors'
import type { ProductWithStock } from '@/app/actions/products'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntakeFormProps {
  products: ProductWithStock[]
  vendors: VendorWithStats[]
  defaultProductId?: string
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

// ─── SearchableSelect ────────────────────────────────────────────────────────

interface SearchableSelectProps {
  options: { id: string; label: string; sub?: string }[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  emptyLabel?: string
}

function SearchableSelect({ options, value, onChange, placeholder, emptyLabel }: SearchableSelectProps) {
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

function Section({ number, title, children }: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
          style={{ background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)' }}
        >
          {number}
        </span>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
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

// ─── Main Form ────────────────────────────────────────────────────────────────

export function IntakeForm({ products, vendors, defaultProductId }: IntakeFormProps) {
  const router = useRouter()
  const { currency } = useCurrency()

  // Section 1
  const [productId, setProductId] = React.useState(defaultProductId ?? '')
  const [vendorId, setVendorId] = React.useState('')
  const [isConsignment, setIsConsignment] = React.useState(false)
  const [batchRef, setBatchRef] = React.useState('')
  const [dateReceived, setDateReceived] = React.useState(todayString())

  // Section 2
  const [purchaseMode, setPurchaseMode] = React.useState<'unit' | 'pack'>('unit')
  const [qtyUnits, setQtyUnits] = React.useState('')
  const [numPacks, setNumPacks] = React.useState('')
  const [unitsPerPack, setUnitsPerPack] = React.useState('')
  const [totalCost, setTotalCost] = React.useState('')
  const [overrideSelling, setOverrideSelling] = React.useState(false)
  const [sellingPrice, setSellingPrice] = React.useState('')

  // Section 3
  const [hasExpiry, setHasExpiry] = React.useState(false)
  const [expiryDate, setExpiryDate] = React.useState('')
  const [notes, setNotes] = React.useState('')

  // Submission
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // ─── Auto-set consignment when vendor changes ─────────────────────────────

  React.useEffect(() => {
    if (!vendorId) {
      setIsConsignment(false)
      return
    }
    const vendor = vendors.find((v) => v.id === vendorId)
    if (vendor?.type === 'consignment') {
      setIsConsignment(true)
    }
  }, [vendorId, vendors])

  // ─── Derived calculations ─────────────────────────────────────────────────

  const totalUnits = React.useMemo(() => {
    if (purchaseMode === 'unit') {
      const n = parseInt(qtyUnits, 10)
      return isNaN(n) || n <= 0 ? 0 : n
    }
    const packs = parseInt(numPacks, 10)
    const perPack = parseInt(unitsPerPack, 10)
    if (isNaN(packs) || isNaN(perPack) || packs <= 0 || perPack <= 0) return 0
    return packs * perPack
  }, [purchaseMode, qtyUnits, numPacks, unitsPerPack])

  const costPerUnit = React.useMemo(() => {
    const cost = parseFloat(totalCost)
    if (isNaN(cost) || cost < 0 || totalUnits === 0) return null
    return cost / totalUnits
  }, [totalCost, totalUnits])

  const grossMargin = React.useMemo(() => {
    if (!overrideSelling || !sellingPrice) return null
    const sp = parseFloat(sellingPrice)
    if (isNaN(sp) || sp <= 0 || costPerUnit === null) return null
    return ((sp - costPerUnit) / sp) * 100
  }, [overrideSelling, sellingPrice, costPerUnit])

  function marginColor(): string {
    if (grossMargin === null) return 'var(--text-secondary)'
    if (grossMargin < 0) return 'var(--danger)'
    if (grossMargin < 15) return 'var(--warning)'
    return 'var(--positive)'
  }

  // ─── Options for searchable selects ──────────────────────────────────────

  const productOptions = products.map((p) => ({
    id: p.id,
    label: p.name,
    sub: p.sku,
  }))

  const vendorOptions = vendors.map((v) => ({
    id: v.id,
    label: v.name,
    sub: v.type === 'consignment' ? 'Consignment' : 'Direct',
  }))

  // ─── Validation ───────────────────────────────────────────────────────────

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!productId) errs.productId = 'Please select a product.'
    if (!dateReceived) errs.dateReceived = 'Date received is required.'
    if (purchaseMode === 'unit') {
      const n = parseInt(qtyUnits, 10)
      if (!qtyUnits || isNaN(n) || n <= 0) errs.qty = 'Enter a valid quantity greater than zero.'
    } else {
      const packs = parseInt(numPacks, 10)
      const perPack = parseInt(unitsPerPack, 10)
      if (!numPacks || isNaN(packs) || packs <= 0) errs.numPacks = 'Enter a valid number of packs.'
      if (!unitsPerPack || isNaN(perPack) || perPack <= 0) errs.unitsPerPack = 'Enter units per pack.'
    }
    const cost = parseFloat(totalCost)
    if (!totalCost || isNaN(cost) || cost < 0) errs.totalCost = 'Enter a valid total cost (can be 0).'
    if (overrideSelling) {
      const sp = parseFloat(sellingPrice)
      if (!sellingPrice || isNaN(sp) || sp <= 0) errs.sellingPrice = 'Enter a valid selling price.'
    }
    if (hasExpiry && !expiryDate) errs.expiryDate = 'Please select an expiry date.'
    return errs
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setErrors({})
    setSubmitting(true)

    const selectedProduct = products.find((p) => p.id === productId)

    try {
      const result = await createBatch({
        productId,
        vendorId: vendorId || null,
        purchaseMode,
        qtyReceived: purchaseMode === 'unit' ? parseInt(qtyUnits, 10) : parseInt(numPacks, 10),
        packSize: purchaseMode === 'pack' ? parseInt(unitsPerPack, 10) : 1,
        totalPurchaseCost: parseFloat(totalCost),
        sellingPriceOverride: overrideSelling && sellingPrice ? parseFloat(sellingPrice) : null,
        expiryDate: hasExpiry && expiryDate ? new Date(expiryDate) : null,
        batchRef: batchRef.trim() || null,
        notes: notes.trim() || null,
        isConsignment,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      const units = totalUnits
      const name = selectedProduct?.name ?? 'product'
      toast.success(`Batch recorded. ${units} unit${units !== 1 ? 's' : ''} of ${name} added to stock.`)
      router.push('/intake')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
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

      {/* ── Section 1 ── */}
      <Section number={1} title="What are you receiving?">
        {/* Product */}
        <Field label="Product" required error={errors.productId}>
          <div data-error={!!errors.productId}>
            <SearchableSelect
              options={productOptions}
              value={productId}
              onChange={setProductId}
              placeholder="Search products…"
            />
          </div>
        </Field>

        {/* Vendor */}
        <Field label="Vendor" error={errors.vendorId}>
          <SearchableSelect
            options={vendorOptions}
            value={vendorId}
            onChange={setVendorId}
            placeholder="Select a vendor…"
            emptyLabel="(No vendor / Open market)"
          />
        </Field>

        {/* Consignment */}
        <Toggle
          checked={isConsignment}
          onChange={setIsConsignment}
          label="Mark as consignment stock"
        />

        {/* Batch ref + Date in a 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Batch / Lot Reference">
            <Input
              type="text"
              value={batchRef}
              onChange={(e) => setBatchRef(e.target.value)}
              placeholder="Supplier batch or lot number"
              maxLength={100}
            />
          </Field>
          <Field label="Date Received" required error={errors.dateReceived}>
            <div data-error={!!errors.dateReceived}>
              <Input
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                max={todayString()}
              />
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Section 2 ── */}
      <Section number={2} title="Quantity & Pricing">
        {/* Purchase mode */}
        <Field label="Purchase Mode" required>
          <div className="flex gap-3">
            {(['unit', 'pack'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPurchaseMode(mode)}
                className="flex-1 flex flex-col items-start gap-0.5 rounded-lg px-4 py-3 border text-sm font-medium transition-all"
                style={{
                  background: purchaseMode === mode ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                  border: `1px solid ${purchaseMode === mode ? 'var(--accent-primary)' : 'var(--border)'}`,
                  color: purchaseMode === mode ? 'var(--accent-primary)' : 'var(--text-secondary)',
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
        {purchaseMode === 'unit' ? (
          <Field label="Quantity (units)" required error={errors.qty}>
            <div data-error={!!errors.qty}>
              <Input
                type="number"
                min={1}
                step={1}
                value={qtyUnits}
                onChange={(e) => setQtyUnits(e.target.value)}
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
                  value={numPacks}
                  onChange={(e) => setNumPacks(e.target.value)}
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
                  value={unitsPerPack}
                  onChange={(e) => setUnitsPerPack(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
            </Field>
          </div>
        )}

        {/* Total cost */}
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
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
        </Field>

        {/* Calculated: cost per unit */}
        {costPerUnit !== null && totalUnits > 0 && (
          <div
            className="rounded-lg px-4 py-3 text-sm flex items-center justify-between"
            style={{ background: 'var(--accent-primary-muted)', border: '1px solid rgba(245,97,10,0.2)' }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Cost per unit
              {purchaseMode === 'pack' && totalUnits > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> ({totalUnits} units total)</span>
              )}
            </span>
            <span className="font-semibold mono" style={{ color: 'var(--accent-primary)' }}>
              ₦{fmt(costPerUnit)}
            </span>
          </div>
        )}

        {/* Override selling price */}
        <Toggle
          checked={overrideSelling}
          onChange={setOverrideSelling}
          label="Override selling price for this batch"
        />

        {overrideSelling && (
          <>
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
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </Field>

            {grossMargin !== null && (
              <div
                className="rounded-lg px-4 py-3 text-sm flex items-center justify-between"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Gross Margin</span>
                <span className="font-semibold" style={{ color: marginColor() }}>
                  {grossMargin.toFixed(1)}%
                  {grossMargin < 0 && ' — selling below cost'}
                  {grossMargin >= 0 && grossMargin < 15 && ' — low margin'}
                  {grossMargin >= 15 && ' — healthy'}
                </span>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Section 3 ── */}
      <Section number={3} title="Expiry & Notes">
        <Toggle
          checked={hasExpiry}
          onChange={setHasExpiry}
          label="This batch has an expiry date"
        />

        {hasExpiry && (
          <Field label="Expiry Date" required error={errors.expiryDate}>
            <div data-error={!!errors.expiryDate}>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={todayString()}
              />
            </div>
          </Field>
        )}

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          {submitting ? 'Recording…' : 'Record Stock Intake'}
        </button>
      </div>
    </form>
  )
}
