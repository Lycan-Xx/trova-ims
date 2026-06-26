import { Suspense } from 'next'
import { redirect } from 'next/navigation'
import { acceptInvitation } from '@/app/actions/invitations'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>
}

async function JoinContent({ token }: { token: string }) {
  if (!token) {
    return (
      <div className="text-center">
        <p style={{ color: 'var(--text-danger)' }}>Invalid invitation link</p>
      </div>
    )
  }

  const result = await acceptInvitation(token)

  if (!result.success) {
    return (
      <div className="text-center">
        <p style={{ color: 'var(--text-danger)' }}>{result.error}</p>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
          Contact your store owner for a new invitation link.
        </p>
      </div>
    )
  }

  return (
    <div className="text-center space-y-4">
      <p style={{ color: 'var(--text-primary)' }} className="font-semibold">
        ✓ Invitation accepted!
      </p>
      <p style={{ color: 'var(--text-secondary)' }}>
        Please sign up or sign in to continue.
      </p>
      <Link href="/sign-up">
        <Button
          className="h-9 px-4 text-sm text-white"
          style={{ background: 'var(--accent-primary)' }}
        >
          Sign Up
        </Button>
      </Link>
    </div>
  )
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { token } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-main)' }}>
      <div
        className="w-full max-w-md rounded-xl p-8 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Join StockSmart
        </h1>

        <Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>Verifying invitation...</p>}>
          <JoinContent token={token || ''} />
        </Suspense>
      </div>
    </div>
  )
}
