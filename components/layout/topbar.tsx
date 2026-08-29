'use client'

import { Bell, LogOut, Printer, ScanBarcode } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { usePrinterStatus } from '@/lib/hooks/use-printer-status'

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const ALERT_COUNT = 0

const PRINTER_STATE_LABEL: Record<ReturnType<typeof usePrinterStatus>['state'], string> = {
  not_configured: 'No printer configured',
  checking: 'Checking printer status',
  available: 'Printer connected',
  unavailable: 'Printer unavailable',
  printing: 'Printing receipt',
  error: 'Printer error',
}

const PRINTER_STATE_TITLE: Record<ReturnType<typeof usePrinterStatus>['state'], string> = {
  not_configured: 'No thermal printer configured — go to Settings → Printer Setup',
  checking: 'Checking the configured thermal printer',
  available: 'Thermal printer connected and ready',
  unavailable: 'Configured printer not found — check connection',
  printing: 'Receipt is being sent to the printer',
  error: 'The last print attempt failed',
}

const PRINTER_STATE_COLOR: Record<ReturnType<typeof usePrinterStatus>['state'], string> = {
  not_configured: 'var(--text-muted)',
  checking: 'var(--text-muted)',
  available: '#22c55e',
  unavailable: 'var(--text-muted)',
  printing: '#f59e0b',
  error: 'var(--danger)',
}

// A hardware scanner "types" into whatever's focused, character by
// character, only a few milliseconds apart — far faster than any human
// keystroke cadence — then sends a trailing Enter. There's no browser API
// that can detect a keyboard-wedge scanner being plugged in (WebHID
// deliberately excludes anything that registers as a keyboard, for
// security reasons), so this reads the timing between keystrokes instead
// and treats a tight burst as "a scan just happened," the same heuristic
// web POS systems commonly use. It reports recent scan-like activity, not
// device presence.
function useScannerActivity() {
  const [active, setActive] = React.useState(false)
  const lastTimeRef = React.useRef(0)
  const burstRef = React.useRef(0)
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      // Only plain character keys and the trailing Enter are part of a
      // scan payload — modifier combos and navigation keys are noise here.
      if (e.key.length !== 1 && e.key !== 'Enter') return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const now = performance.now()
      const gap = now - lastTimeRef.current
      lastTimeRef.current = now

      burstRef.current = gap < 40 ? burstRef.current + 1 : 1

      if (burstRef.current >= 5) {
        setActive(true)
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        resetTimerRef.current = setTimeout(() => {
          setActive(false)
          burstRef.current = 0
        }, 3000)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  return active
}

export function Topbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const initials = getInitials(session?.user?.name)
  const scannerActive = useScannerActivity()

  // Tauri-only: printer status indicator
  const [isTauri, setIsTauri] = React.useState(false)
  React.useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)
  }, [])
  const printerStatus = usePrinterStatus()

  async function handleSignOut() {
    await signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-5"
      style={{
        height: 48,
        backgroundColor: 'var(--bg-nav)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Orange square icon */}
        <div
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img src="/images/favicon.png" alt="Trova" width={24} height={24} style={{ borderRadius: 5 }} />
        </div>
        <span
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '-0.01em',
          }}
        >
          Trova
        </span>
      </div>

      {/* Right: bell + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Printer status indicator — desktop only */}
        {isTauri && (
          <div
            role="status"
            aria-label={PRINTER_STATE_LABEL[printerStatus.state]}
            title={printerStatus.error ?? PRINTER_STATE_TITLE[printerStatus.state]}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              color: PRINTER_STATE_COLOR[printerStatus.state],
              transition: 'color 200ms ease',
            }}
          >
            <Printer size={17} strokeWidth={1.75} />
            {printerStatus.state === 'available' || printerStatus.state === 'printing' || printerStatus.state === 'error' ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: PRINTER_STATE_COLOR[printerStatus.state],
                  border: '1.5px solid var(--bg-nav)',
                }}
              />
            ) : null}
          </div>
        )}

        {/* Scanner activity indicator */}
        <div
          role="status"
          aria-label={scannerActive ? 'Barcode scan detected' : 'No recent barcode scan'}
          title={
            scannerActive
              ? 'Barcode scan detected'
              : 'No scan detected yet — lights up green briefly after a scan-like burst of keystrokes'
          }
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            color: scannerActive ? '#22c55e' : 'var(--text-muted)',
            transition: 'color 200ms ease',
          }}
        >
          <ScanBarcode size={17} strokeWidth={1.75} />
          {scannerActive && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                border: '1.5px solid var(--bg-nav)',
              }}
            />
          )}
        </div>

        {/* Alert bell */}
        <button
          type="button"
          aria-label={`Alerts${ALERT_COUNT > 0 ? `, ${ALERT_COUNT} unread` : ''}`}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Bell size={18} strokeWidth={1.75} />
          {ALERT_COUNT > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--danger)',
                border: '1.5px solid var(--bg-nav)',
              }}
            />
          )}
        </button>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>

        {/* User avatar */}
        <div
          aria-label={session?.user?.name ?? 'User'}
          role="img"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary-muted)',
            border: '1.5px solid var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
