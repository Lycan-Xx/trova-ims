'use client'

import * as React from 'react'
import { FlaskConical, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getTestModeStatus, setTestMode, clearTestData } from '@/app/actions/settings'

export function TestModeToggle() {
  const [enabled, setEnabled] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [confirmingClear, setConfirmingClear] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)

  React.useEffect(() => {
    let active = true
    getTestModeStatus().then((status) => {
      if (!active) return
      setEnabled(status.enabled)
      setLoaded(true)
    })
    return () => { active = false }
  }, [])

  async function handleToggle() {
    const next = !enabled
    setPending(true)
    const result = await setTestMode(next)
    setPending(false)
    if (result.success) {
      setEnabled(next)
      setConfirmingClear(false)
      toast.success(
        next
          ? 'Test Mode is on. New sales and products go to an isolated test database.'
          : 'Test Mode is off. You are back on your real store data.',
      )
    } else {
      toast.error(result.error)
    }
  }

  async function handleClear() {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    setClearing(true)
    const result = await clearTestData()
    setClearing(false)
    setConfirmingClear(false)
    if (result.success) {
      toast.success('Test data cleared. The test database is empty again.')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <FlaskConical size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Test Mode
            </p>
            <p className="text-sm mt-0.5 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              When on, sales and products you create go to a separate, empty test database instead
              of your real store records. Turn it off to go back to your real data — nothing about
              your real records changes either way.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle Test Mode"
          disabled={pending || !loaded}
          onClick={handleToggle}
          className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
          style={{
            background: enabled ? 'var(--accent-yellow)' : 'var(--border)',
          }}
        >
          {pending ? (
            <Loader2
              size={12}
              className="absolute animate-spin"
              style={{ left: enabled ? 22 : 6, color: enabled ? '#1a1400' : 'var(--text-secondary)' }}
            />
          ) : (
            <span
              className="inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform"
              style={{ transform: enabled ? 'translateX(22px)' : 'translateX(4px)' }}
            />
          )}
        </button>
      </div>

      {enabled && (
        <div
          className="flex items-center justify-between gap-4 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Clear test data
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Wipes everything in the test database (sales, products, vendors, categories) back to
              empty. Does not touch your real data.
            </p>
          </div>
          <button
            type="button"
            disabled={clearing}
            onClick={handleClear}
            onBlur={() => setConfirmingClear(false)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium flex-shrink-0 disabled:opacity-60"
            style={{
              background: confirmingClear ? 'var(--danger)' : 'transparent',
              color: confirmingClear ? '#1a0000' : 'var(--danger)',
              border: '1px solid var(--danger)',
            }}
          >
            {clearing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {confirmingClear ? 'Click again to confirm' : 'Clear test data'}
          </button>
        </div>
      )}
    </div>
  )
}
