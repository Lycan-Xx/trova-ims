'use client'

import Link from 'next/link'
import { Download, LockKeyhole, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function DemoReadOnlyDialog({
  action,
  onClose,
}: {
  action: string | null
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!action) return
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [action, onClose])

  if (!action) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-primary-muted text-accent-primary">
            <LockKeyhole size={19} aria-hidden="true" />
          </span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 text-text-muted hover:bg-bg-input hover:text-white">
            <X size={18} />
          </button>
        </div>
        <h2 id="demo-dialog-title" className="mt-5 text-xl font-bold text-text-primary">{action} in Trova Desktop</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          The public preview is intentionally read-only. Install Trova to record sales, manage stock, create receipts, and keep your store data securely on your own computer.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/download" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent-primary px-4 text-sm font-semibold text-white hover:opacity-90">
            <Download size={15} aria-hidden="true" /> View downloads
          </Link>
          <button type="button" onClick={onClose} className="h-10 flex-1 rounded-lg border border-border bg-bg-input px-4 text-sm font-semibold text-text-secondary hover:text-white">
            Continue exploring
          </button>
        </div>
      </div>
    </div>
  )
}
