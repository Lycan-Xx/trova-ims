'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { updateUserRole, deactivateUser, inviteUser } from '@/app/actions/settings'
import type { User, UserRole } from '@/lib/db/schema'

// ─── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<UserRole, 'accent' | 'warning' | 'default'> = {
  owner: 'accent',
  storekeeper: 'warning',
  cashier: 'default',
}

const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Owner',
  storekeeper: 'Storekeeper',
  cashier: 'Cashier',
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const inputClass = [
  'w-full h-10 rounded-lg px-3 text-sm outline-none transition-all',
  'bg-[var(--bg-input)] border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(245,97,10,0.2)]',
].join(' ')

const labelClass = 'block text-[12px] font-medium mb-1.5'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

// ─── InviteSlideOver ───────────────────────────────────────────────────────────

function InviteSlideOver({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<'storekeeper' | 'cashier'>('cashier')
  const [emailError, setEmailError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setEmail('')
      setRole('cashier')
      setEmailError('')
      setLoading(false)
      setSentTo(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')

    if (!email.trim()) {
      setEmailError('Email is required.')
      return
    }

    setLoading(true)
    try {
      const result = await inviteUser(email.trim().toLowerCase(), role)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSentTo(email.trim().toLowerCase())
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const ROLE_OPTIONS: { value: 'storekeeper' | 'cashier'; label: string; description: string }[] = [
    { value: 'storekeeper', label: 'Storekeeper', description: 'Can manage products, batches, and vendors' },
    { value: 'cashier', label: 'Cashier', description: 'Can process sales only' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Invite Team Member</SheetTitle>
          <SheetCloseButton onClick={() => onOpenChange(false)} />
        </SheetHeader>

        {sentTo ? (
          // ── Success state ──────────────────────────────────────────────────
          <SheetBody>
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full"
                style={{ background: 'var(--positive-bg)' }}
              >
                <UserPlus size={26} style={{ color: 'var(--positive)' }} />
              </div>
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Invite sent
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  An invitation was sent to
                </p>
                <p
                  className="text-sm font-medium mt-0.5 mono"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  {sentTo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-4 h-9 px-6 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent-primary)' }}
              >
                Done
              </button>
            </div>
          </SheetBody>
        ) : (
          // ── Invite form ────────────────────────────────────────────────────
          <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full">
            <SheetBody>
              <div className="flex flex-col gap-5">
                <Field label="Email Address *" error={emailError}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                    placeholder="colleague@example.com"
                    className={inputClass}
                    style={emailError ? { borderColor: 'var(--danger)' } : undefined}
                    autoFocus
                  />
                </Field>

                <Field label="Role">
                  <div className="flex flex-col gap-2.5 mt-0.5">
                    {ROLE_OPTIONS.map((opt) => {
                      const isSelected = role === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRole(opt.value)}
                          className="flex items-start gap-3 rounded-lg px-3.5 py-3 text-left transition-all w-full"
                          style={{
                            background: isSelected ? 'var(--accent-primary-muted)' : 'var(--bg-input)',
                            border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border)'}`,
                          }}
                        >
                          <span
                            className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border)' }}
                          >
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                            )}
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium" style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
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
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Sending…' : 'Send Invite'}
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
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── UserRow ───────────────────────────────────────────────────────────────────

function UserRow({
  user,
  isSelf,
  onRoleChange,
  onDeactivate,
}: {
  user: User
  isSelf: boolean
  onRoleChange: (userId: string, role: 'storekeeper' | 'cashier') => Promise<void>
  onDeactivate: (userId: string) => Promise<void>
}) {
  const [roleLoading, setRoleLoading] = React.useState(false)
  const [deactivateLoading, setDeactivateLoading] = React.useState(false)

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as 'storekeeper' | 'cashier'
    setRoleLoading(true)
    try {
      await onRoleChange(user.id, newRole)
    } finally {
      setRoleLoading(false)
    }
  }

  async function handleDeactivate() {
    if (!confirm(`Deactivate ${user.name}? They will lose access immediately.`)) return
    setDeactivateLoading(true)
    try {
      await onDeactivate(user.id)
    } finally {
      setDeactivateLoading(false)
    }
  }

  const canAct = !isSelf && user.role !== 'owner'

  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Name + email */}
      <td className="py-3 pr-4">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
      </td>

      {/* Role badge */}
      <td className="py-3 pr-4">
        <Badge variant={ROLE_BADGE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
      </td>

      {/* Status */}
      <td className="py-3 pr-4">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={
            user.is_active
              ? { background: 'var(--positive-bg)', color: 'var(--positive)' }
              : { background: 'var(--bg-input)', color: 'var(--text-muted)' }
          }
        >
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* Actions */}
      <td className="py-3 text-right">
        {isSelf ? (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>You</span>
        ) : user.role === 'owner' ? (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}> </span>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {/* Change role */}
            <div className="relative flex items-center">
              {roleLoading && (
                <Loader2 size={12} className="animate-spin absolute left-2" style={{ color: 'var(--text-muted)' }} />
              )}
              <select
                value={user.role}
                onChange={handleRoleChange}
                disabled={!canAct || roleLoading}
                className="h-7 text-[11px] rounded-md pl-2 pr-6 outline-none transition-colors disabled:opacity-50 cursor-pointer appearance-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option value="storekeeper">Storekeeper</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>

            {/* Deactivate */}
            {user.is_active && (
              <button
                onClick={handleDeactivate}
                disabled={deactivateLoading}
                className="h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid var(--danger)' }}
                onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid transparent' }}
              >
                {deactivateLoading ? <Loader2 size={11} className="animate-spin" /> : 'Deactivate'}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── TeamMembersTable ──────────────────────────────────────────────────────────

export function TeamMembersTable({
  users,
  currentUserId,
}: {
  users: User[]
  currentUserId: string
}) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = React.useState(false)

  async function handleRoleChange(userId: string, role: 'storekeeper' | 'cashier') {
    const result = await updateUserRole(userId, role)
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Role updated.')
      router.refresh()
    }
  }

  async function handleDeactivate(userId: string) {
    const result = await deactivateUser(userId)
    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('User deactivated.')
      router.refresh()
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Team Members
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
            ({users.length})
          </span>
        </h2>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium text-white transition-colors"
          style={{ background: 'var(--accent-primary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-primary)' }}
        >
          <UserPlus size={13} />
          Invite Member
        </button>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="flex items-center gap-2 py-6" style={{ color: 'var(--text-muted)' }}>
          <AlertCircle size={16} />
          <span className="text-sm">No team members found.</span>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member', 'Role', 'Status', 'Actions'].map((col) => (
                  <th
                    key={col}
                    className={`pb-2.5 text-[11px] font-medium uppercase tracking-wide text-left ${col === 'Actions' ? 'text-right' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUserId}
                  onRoleChange={handleRoleChange}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteSlideOver open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  )
}
