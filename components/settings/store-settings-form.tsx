'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { updateStoreSettings } from '@/app/actions/settings'

const inputClass = [
  'w-full h-10 rounded-lg px-3 text-sm outline-none transition-all',
  'bg-[var(--bg-input)] border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
].join(' ')

const labelClass = 'block text-[12px] font-medium mb-1.5'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

interface Props {
  store: { id: string; name: string; address: string | null; phone: string | null }
}

export function StoreSettingsForm({ store }: Props) {
  const router = useRouter()
  const [name, setName] = React.useState(store.name ?? '')
  const [address, setAddress] = React.useState(store.address ?? '')
  const [phone, setPhone] = React.useState(store.phone ?? '')
  const [loading, setLoading] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [nameError, setNameError] = React.useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameError('')

    if (!name.trim()) {
      setNameError('Store name is required.')
      return
    }

    setLoading(true)
    try {
      const result = await updateStoreSettings({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Store settings saved.')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Store Name */}
      <Field label="Store Name *">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError('') }}
          placeholder="e.g. My Store"
          maxLength={120}
          className={inputClass}
          style={nameError ? { borderColor: 'var(--danger)' } : undefined}
        />
        {nameError && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--danger)' }}>{nameError}</p>
        )}
      </Field>

      {/* Phone */}
      <Field label="Phone (optional)">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+234 801 234 5678"
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

      {/* Submit */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
          style={{ background: saved ? 'var(--positive)' : 'var(--accent-primary)' }}
          onMouseEnter={(e) => {
            if (!loading && !saved) e.currentTarget.style.background = 'var(--accent-primary-hover)'
          }}
          onMouseLeave={(e) => {
            if (!loading && !saved) e.currentTarget.style.background = 'var(--accent-primary)'
          }}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {saved && <Check size={14} />}
          {loading ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
