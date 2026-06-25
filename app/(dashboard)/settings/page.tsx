import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getStoreSettings, getUsers } from '@/app/actions/settings'
import { StoreSettingsForm } from '@/components/settings/store-settings-form'
import { TeamMembersTable } from '@/components/settings/team-members-table'

export const metadata = { title: 'Settings — StockSmart' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const isOwner = user.role === 'owner'

  const [storeResult, usersResult] = await Promise.all([
    getStoreSettings(),
    isOwner ? getUsers() : Promise.resolve({ success: true as const, data: [] }),
  ])

  const store = storeResult.success ? storeResult.data : null
  const users = usersResult.success ? usersResult.data : []

  return (
    <main className="p-6 max-w-3xl mx-auto flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Manage your store configuration and team.
        </p>
      </div>

      {/* Section A — Store Settings */}
      {isOwner && store && (
        <section
          className="rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            Store Settings
          </h2>
          <StoreSettingsForm store={store} />
        </section>
      )}

      {/* Section B — Team Members */}
      {isOwner && (
        <section
          className="rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <TeamMembersTable users={users} currentUserId={user.id} />
        </section>
      )}

      {/* Non-owner: read-only note */}
      {!isOwner && (
        <div
          className="rounded-xl p-6 text-sm"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Settings are managed by the store owner. Contact your owner to make changes.
        </div>
      )}
    </main>
  )
}
