'use client'

import * as React from 'react'
import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { voidSale } from '@/app/actions/sales'
import { Button } from '@/components/ui/button'

export function VoidSaleButton({ saleId, receiptNumber }: { saleId: string; receiptNumber: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [voiding, setVoiding] = React.useState(false)
  const requiredText = `VOID ${receiptNumber}`
  const canVoid = confirmation === requiredText && reason.trim().length >= 3 && !voiding

  function closeDialog() {
    if (voiding) return
    setOpen(false)
    setConfirmation('')
    setReason('')
  }

  async function handleVoid() {
    if (!canVoid) return
    setVoiding(true)
    try {
      const result = await voidSale(saleId, confirmation, reason)
      if (!result.success) {
        toast.error(result.error)
        setVoiding(false)
        return
      }
      toast.success(`Sale ${result.data.receiptNumber} voided`)
      router.replace(`/sales/${saleId}`)
      router.refresh()
    } catch {
      toast.error('Could not void this sale. Please try again.')
      setVoiding(false)
    }
  }

  return (
    <>
      <Button type="button" variant="destructive" className="h-11 px-4" onClick={() => setOpen(true)}>
        <ShieldAlert />
        Void Sale
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close void sale dialog" onClick={closeDialog} />
          <div role="dialog" aria-modal="true" aria-labelledby="void-sale-title" className="relative z-10 w-full max-w-md rounded-xl border p-5 shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 id="void-sale-title" className="font-semibold" style={{ color: 'var(--text-primary)' }}>Void this sale?</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    The receipt stays in the audit trail, is excluded from sales totals, and tracked stock is returned to its original batches.
                  </p>
                </div>
              </div>
              <button type="button" className="rounded-md p-1" style={{ color: 'var(--text-muted)' }} aria-label="Close" disabled={voiding} onClick={closeDialog}>
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-sm" style={{ color: 'var(--text-secondary)' }}>
              Reason (required)
              <textarea value={reason} disabled={voiding} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} onChange={(event) => setReason(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm" style={{ color: 'var(--text-secondary)' }}>
              Type <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>{requiredText}</span> to confirm
              <input autoFocus type="text" value={confirmation} disabled={voiding} autoComplete="off" spellCheck={false} className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} onChange={(event) => setConfirmation(event.target.value)} />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9 px-4" disabled={voiding} onClick={closeDialog}>Cancel</Button>
              <Button type="button" variant="destructive" className="h-9 px-4" disabled={!canVoid} onClick={() => void handleVoid()}>
                {voiding ? <Loader2 className="animate-spin" /> : <ShieldAlert />}
                {voiding ? 'Voiding…' : 'Void Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
