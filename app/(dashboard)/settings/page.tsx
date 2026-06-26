import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getStoreSettings } from '@/app/actions/settings'
import { StoreSettingsForm } from '@/components/settings/store-settings-form'
import { TeamManagement } from '@/components/settings/team-management'

export const metadata = { title: 'Settings — StockSmart' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const isOwner = user.role === 'owner'

  const storeResult = await getStoreSettings()
  const store = storeResult.success ? storeResult.data : null

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

      {/* Section B — Team Management */}
      {isOwner && (
        <section>
          <TeamManagement isOwner={isOwner} />
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
