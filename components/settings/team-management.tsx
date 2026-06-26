'use client'

import * as React from 'react'
import { getTeamMembers, getPendingInvitations, sendInvitation, cancelInvitation, updateMemberRole, removeMember } from '@/app/actions/invitations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TeamMember, PendingInvitation } from '@/app/actions/invitations'

interface TeamManagementProps {
  isOwner: boolean
}

export function TeamManagement({ isOwner }: TeamManagementProps) {
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = React.useState<PendingInvitation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState<'storekeeper' | 'cashier'>('cashier')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')

  React.useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    if (!isOwner) return
    try {
      setLoading(true)
      const [membersRes, invitesRes] = await Promise.all([
        getTeamMembers(),
        getPendingInvitations(),
      ])
      if (membersRes.success) setTeamMembers(membersRes.data)
      if (invitesRes.success) setPendingInvites(invitesRes.data)
    } catch (err) {
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const result = await sendInvitation(inviteEmail, inviteRole)
      if (result.success) {
        setSuccess(`Invitation sent to ${inviteEmail}`)
        setInviteEmail('')
        setInviteRole('cashier')
        await loadData()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      const result = await cancelInvitation(id)
      if (result.success) {
        await loadData()
        setSuccess('Invitation cancelled')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to cancel invitation')
    }
  }

  async function handleUpdateRole(memberId: string, newRole: 'storekeeper' | 'cashier') {
    try {
      const result = await updateMemberRole(memberId, newRole)
      if (result.success) {
        await loadData()
        setSuccess('Role updated')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to update role')
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this team member?')) return
    try {
      const result = await removeMember(memberId)
      if (result.success) {
        await loadData()
        setSuccess('Team member removed')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to remove member')
    }
  }

  if (!isOwner) {
    return <p style={{ color: 'var(--text-muted)' }}>Only store owners can manage team members.</p>
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading team data...</p>
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500 text-green-600">
          {success}
        </div>
      )}

      {/* Invite Form */}
      <div
        className="rounded-xl p-6 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Invite Team Member
        </h2>
        <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
              className="w-full h-9 rounded-lg px-3 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'storekeeper' | 'cashier')}
              className="w-full h-9 rounded-lg px-3 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="cashier">Cashier (can record sales)</option>
              <option value="storekeeper">Storekeeper (can manage inventory)</option>
            </select>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-9 text-sm text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            {submitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div
          className="rounded-xl overflow-hidden border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Pending Invitations
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right" />
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {invite.email}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <Badge variant="success">{invite.role}</Badge>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleCancelInvite(invite.id)}
                        className="h-7 px-2 text-xs"
                        style={{
                          background: 'var(--bg-input)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div
        className="rounded-xl overflow-hidden border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Team Members ({teamMembers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-input)' }}>
                <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Joined
                </th>
                <th className="px-6 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {member.name}
                  </td>
                  <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {member.email}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {member.role === 'owner' ? (
                      <Badge variant="accent">Owner</Badge>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value as 'storekeeper' | 'cashier')}
                        className="h-6 px-2 text-xs rounded"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value="cashier">Cashier</option>
                        <option value="storekeeper">Storekeeper</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {member.role !== 'owner' && (
                      <Button
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="h-7 px-2 text-xs"
                        style={{
                          background: 'var(--bg-input)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
