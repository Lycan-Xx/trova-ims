import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { getStoreSettings } from '@/app/actions/settings'
import { StoreSettingsForm } from '@/components/settings/store-settings-form'
import { TeamManagement } from '@/components/settings/team-management'
import { RestartTutorialButton } from '@/components/settings/restart-tutorial-button'
import { PrinterSetup } from '@/components/settings/printer-setup'
import { CustomerDisplaySetup } from '@/components/customer-display/customer-display-setup'
import { ExternalLink } from '@/components/ui/external-link'
import packageJson from '@/package.json'

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

      {isOwner && <CustomerDisplaySetup />}

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

      <section
        className="rounded-xl p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
          About & Support
        </h2>
        <div className="grid gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Trova IMS</p>
            <p>Version {process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version}</p>
          </div>
          <p>
            Built by{' '}
            <ExternalLink
              href="https://lycanforge.com.ng"
              className="font-bold hover:underline"
              style={{ color: '#f59e0b' }}
            >
              LycanForge
            </ExternalLink>
          </p>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Support</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <ExternalLink href="mailto:client@lycanforge.com.ng" className="hover:text-white transition-colors">
                client@lycanforge.com.ng
              </ExternalLink>
              <ExternalLink
                href="https://wa.me/2347058392920"
                className="hover:text-white transition-colors"
              >
                +234 705 839 2920 on WhatsApp
              </ExternalLink>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Legal</p>
            <p className="leading-relaxed">
              Copyright LycanForge. All rights reserved. This software is provided for use by the
              authorized recipient pending the formal Trova IMS End User License Agreement (EULA).
              Unauthorized redistribution, resale, copying, or distribution without written
              permission from LycanForge is prohibited.
            </p>
          </div>
          <ExternalLink
            href="https://trova.lycanforge.com.ng/privacy"
            className="w-fit hover:text-white transition-colors"
          >
            Privacy Policy
          </ExternalLink>
        </div>
      </section>

      {/* Legal + version footer */}
      <div className="flex items-center justify-center gap-4 py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        <ExternalLink
          href="https://trova.lycanforge.com.ng/privacy"
          className="hover:text-white transition-colors"
        >
          Privacy Policy
        </ExternalLink>
        <span>•</span>
        <span>© {new Date().getFullYear()} Trova</span>
        <span>•</span>
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version}</span>
      </div>
    </main>
  )
}
