'use client'

import * as React from 'react'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteSale } from '@/app/actions/sales'
import { Button } from '@/components/ui/button'

interface DeleteSaleButtonProps {
  saleId: string
  receiptNumber: string
}

export function DeleteSaleButton({ saleId, receiptNumber }: DeleteSaleButtonProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirmation, setConfirmation] = React.useState('')
  const [deleting, setDeleting] = React.useState(false)
  const requiredText = `DELETE ${receiptNumber}`
  const canDelete = confirmation === requiredText && !deleting

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, deleting])

  function closeDialog() {
    if (deleting) return
    setOpen(false)
    setConfirmation('')
  }

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)

    try {
      const result = await deleteSale(saleId, confirmation)
      if (!result.success) {
        toast.error(result.error)
        setDeleting(false)
        return
      }

      toast.success(`Sale ${result.data.receiptNumber} deleted`)
      router.replace('/sales')
      router.refresh()
    } catch {
      toast.error('Could not delete this sale. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="h-11 px-4"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Delete Sale
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close delete sale dialog"
            onClick={closeDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sale-title"
            className="relative z-10 w-full max-w-md rounded-xl border p-5 shadow-2xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 id="delete-sale-title" className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Permanently delete this sale?
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    This removes one receipt and its line items. Tracked stock is returned to its original batches; no batch records are deleted.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md p-1"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close"
                disabled={deleting}
                onClick={closeDialog}
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block text-sm" style={{ color: 'var(--text-secondary)' }}>
              Type <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>{requiredText}</span> to confirm
              <input
                autoFocus
                type="text"
                value={confirmation}
                disabled={deleting}
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>

            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              This cannot be undone. Untracked products have no stock quantity to restore.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9 px-4" disabled={deleting} onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" className="h-9 px-4" disabled={!canDelete} onClick={handleDelete}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {deleting ? 'Deleting…' : 'Delete Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
