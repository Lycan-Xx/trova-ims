'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { restartOnboarding } from '@/lib/actions/onboarding'
import { RotateCcw } from 'lucide-react'

export function RestartTutorialButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleRestart = () => {
    startTransition(async () => {
      await restartOnboarding()
      router.push('/dashboard')
    })
  }

  return (
    <button
      onClick={handleRestart}
      disabled={isPending}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <RotateCcw size={16} />
      {isPending ? 'Restarting...' : 'Restart Tutorial'}
    </button>
  )
}
