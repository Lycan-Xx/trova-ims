'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
import { createVendor, updateVendor } from '@/app/actions/vendors'
import type { Vendor, VendorType } from '@/lib/db/schema'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VendorSlideOverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, opens in edit mode pre-populated with this vendor */
  vendor?: Vendor | null
  /**
   * Called right after a new vendor is successfully created (not on edit).
   * Lets an embedding form — e.g. Stock Intake — select the new vendor
   * immediately, without waiting for router.refresh() to re-fetch the page.
   */
  onCreated?: (vendor: Vendor) => void
}

interface FormErrors {
  name?: string
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputClass = [
  'w-full h-10 rounded-lg px-3 text-sm outline-none transition-all',
  'bg-[var(--bg-input)] border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
].join(' ')

const labelClass = 'block text-[12px] font-medium mb-1.5'
const errorClass = 'mt-1 text-[11px] text-[var(--danger)]'

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
      <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}

// ─── Vendor type options ───────────────────────────────────────────────────────

const VENDOR_TYPES: {
  value: VendorType
  label: string
  description: string
}[] = [
  {
    value: 'direct',
    label: 'Direct',
    description: 'You purchase stock outright',
  },
  {
    value: 'consignment',
    label: 'Consignment',
    description: 'Vendor supplies stock, you pay after sale',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function VendorSlideOver({ open, onOpenChange, vendor, onCreated }: VendorSlideOverProps) {
  const router = useRouter()
  const isEditing = !!vendor

  // Form state
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<VendorType>('direct')
  const [contact, setContact] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [loading, setLoading] = React.useState(false)

  // Populate on open / vendor change
  React.useEffect(() => {
    if (vendor) {
      setName(vendor.name)
      setType(vendor.type)
      setContact(vendor.contact ?? '')
      setAddress(vendor.address ?? '')
      setNotes(vendor.notes ?? '')
    } else {
      setName('')
      setType('direct')
      setContact('')
      setAddress('')
      setNotes('')
    }
    setErrors({})
  }, [vendor, open])

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: FormErrors = {}
    if (!name.trim()) next.name = 'Vendor name is required.'
    if (name.trim().length > 120) next.name = 'Max 120 characters.'
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
      type,
      contact: contact.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      if (isEditing && vendor) {
        const result = await updateVendor(vendor.id, payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Vendor updated.')
      } else {
        const result = await createVendor(payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Vendor added.')
        onCreated?.(result.data)
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
          <SheetTitle>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</SheetTitle>
          <SheetCloseButton onClick={() => onOpenChange(false)} />
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full">
          <SheetBody>
            <div className="flex flex-col gap-5">

              {/* Vendor Name */}
              <Field label="Vendor Name *" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dangote Industries Ltd"
                  maxLength={120}
                  className={inputClass}
                  style={errors.name ? { borderColor: 'var(--danger)' } : undefined}
                  autoFocus
                />
              </Field>

              {/* Vendor Type — radio group */}
              <Field label="Vendor Type">
                <div className="flex flex-col gap-2.5 mt-0.5">
                  {VENDOR_TYPES.map((opt) => {
                    const isSelected = type === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className="flex items-start gap-3 rounded-lg px-3.5 py-3 text-left transition-all w-full"
                        style={{
                          background: isSelected ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border)'}`,
                        }}
                      >
                        {/* Radio circle */}
                        <span
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                          style={{
                            borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)',
                          }}
                        >
                          {isSelected && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: 'var(--accent-primary)' }}
                            />
                          )}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span
                            className="text-sm font-medium"
                            style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            {opt.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Contact */}
              <Field label="Contact (optional)">
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Phone number or email address"
                  className={inputClass}
                />
              </Field>

              {/* Address */}
              <Field label="Address (optional)">
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, city…"
                  rows={3}
                  className={[
                    'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-none',
                    'bg-[var(--bg-input)] border border-[var(--border)]',
                    'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                    'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
                  ].join(' ')}
                />
              </Field>

              {/* Notes */}
              <Field label="Notes (optional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment terms, delivery schedule, etc."
                  rows={3}
                  className={[
                    'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-none',
                    'bg-[var(--bg-input)] border border-[var(--border)]',
                    'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                    'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
                  ].join(' ')}
                />
              </Field>

            </div>
          </SheetBody>

          <SheetFooter>
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: 'var(--accent-primary)' }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-primary-hover)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-primary)' }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Vendor'}
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
