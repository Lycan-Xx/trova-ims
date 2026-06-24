import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <SignUp forceRedirectUrl="/dashboard" />
    </main>
  )
}
