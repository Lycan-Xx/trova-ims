import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { getStoreSettings } from '@/app/actions/settings'
import { StoreSettingsForm } from '@/components/settings/store-settings-form'
import { TeamManagement } from '@/components/settings/team-management'
import { RestartTutorialButton } from '@/components/settings/restart-tutorial-button'
import { PrinterSetup } from '@/components/settings/printer-setup'

export const metadata = { title: 'Settings — StockSmart' }

export default async function SettingsPage() {
  const user = await requireOwner()
  const isOwner = true

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

      {/* Section B — Printer Setup (desktop only — PrinterSetup self-guards) */}
      {isOwner && (
        <section
          className="rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            Printer Setup
          </h2>
          <PrinterSetup />
        </section>
      )}

      {/* Section C — Team Management */}
      {isOwner && (
        <section>
          <TeamManagement isOwner={isOwner} />
        </section>
      )}

      {/* Section C — Tutorial & Onboarding */}
      {isOwner && (
        <section
          className="rounded-xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Tutorial & Onboarding
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Reset the dashboard checklist to learn how to use the application.
              </p>
            </div>
            <RestartTutorialButton />
          </div>
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

      {/* Legal + version footer */}
      <div className="flex items-center justify-center gap-4 py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        <a
          href="https://lycanforge.com.ng/trova/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          Privacy Policy
        </a>
        <span>•</span>
        <span>© {new Date().getFullYear()} Trova</span>
        <span>•</span>
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.4'}</span>
      </div>
    </main>
  )
}
