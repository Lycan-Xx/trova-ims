import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      <AuthForm mode="sign-up" />
    </main>
  )
}
