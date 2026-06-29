'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, signUp } from '@/lib/auth-client'
import { toast } from 'sonner'

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'sign-up') {
        const res = await signUp.email({ email, password, name })
        if (res.error) { setError(res.error.message ?? 'Sign up failed'); return }
        toast.success('Account created! Welcome.')
      } else {
        const res = await signIn.email({ email, password })
        if (res.error) { setError(res.error.message ?? 'Invalid email or password'); return }
        toast.success('Signed in successfully.')
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center">
            <img src="/images/favicon.png" alt="Trova" width={36} height={36} className="rounded-lg object-contain" />
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Trova</span>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {mode === 'sign-in' ? 'Sign in to your store' : 'Set up your Trova store'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'sign-up' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Moh'd Bello"
              required
              className="h-10 w-full rounded-lg px-3 text-sm outline-none transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="h-10 w-full rounded-lg px-3 text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            className="h-10 w-full rounded-lg px-3 text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {error && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-10 w-full rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
          style={{ background: loading ? 'var(--accent-primary-hover)' : 'var(--accent-primary)' }}
        >
          {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        {mode === 'sign-in' ? (
          <>Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="font-medium" style={{ color: 'var(--accent-primary)' }}>Sign up</Link>
          </>
        ) : (
          <>Already have an account?{' '}
            <Link href="/sign-in" className="font-medium" style={{ color: 'var(--accent-primary)' }}>Sign in</Link>
          </>
        )}
      </p>
    </div>
  )
}
