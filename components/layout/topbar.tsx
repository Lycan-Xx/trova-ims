'use client'

import { Bell } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

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

export function Topbar() {
  const { user } = useUser()
  const initials = getInitials(user?.fullName)

  return (
    <header
      style={{
        height: 48,
        backgroundColor: 'var(--bg-nav)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 20,
        position: 'sticky',
        top: 0,
        zIndex: 30,
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
            borderRadius: 5,
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
            <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
          </svg>
        </div>
        <span
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '-0.01em',
          }}
        >
          StockSmart
        </span>
      </div>

      {/* Right: bell + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

        {/* User avatar */}
        <div
          aria-label={user?.fullName ?? 'User'}
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
