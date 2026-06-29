'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight, X, Trash2, KeepSquare, Store, Users, PackagePlus, ShoppingCart } from 'lucide-react'
import { dismissOnboarding, type OnboardingState } from '@/lib/actions/onboarding'

interface Props {
  state: OnboardingState
}

export function OnboardingChecklist({ state }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const steps = [
    {
      id: 'store',
      title: 'Configure Store Settings',
      description: 'Set your official store name and trading currency.',
      isDone: state.hasStoreSetup,
      href: '/settings',
      icon: Store,
    },
    {
      id: 'vendor',
      title: 'Add your first Vendor',
      description: 'Create a supplier record before logging intake.',
      isDone: state.hasVendor,
      href: '/vendors',
      icon: Users,
    },
    {
      id: 'intake',
      title: 'Log your first Stock Intake',
      description: 'Add a product and record its initial stock.',
      isDone: state.hasIntake,
      href: '/intake',
      icon: PackagePlus,
    },
    {
      id: 'sale',
      title: 'Make a Test Sale',
      description: 'Process a dummy transaction at the POS.',
      isDone: state.hasSale,
      href: '/sales/new',
      icon: ShoppingCart,
    },
  ]

  const completedCount = steps.filter((s) => s.isDone).length
  const totalCount = steps.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)

  const handleDismiss = (wipeData: boolean) => {
    startTransition(async () => {
      setError(null)
      const res = await dismissOnboarding(wipeData)
      if (!res.success) {
        setError(res.error)
      }
    })
  }

  if (state.isDismissed) return null

  return (
    <div
      className="mb-6 rounded-[16px] border shadow-sm overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Welcome to Trova! Let&apos;s get you set up.
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Complete these essential tasks to build your store&apos;s foundation.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-48">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
          
          {!state.isComplete && (
            <button
              onClick={() => handleDismiss(false)}
              disabled={isPending}
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
              title="Skip Tutorial"
            >
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-5">
        {error && (
          <div className="mb-4 p-3 rounded-md text-sm text-red-500 bg-red-500/10 border border-red-500/20">
            {error}
          </div>
        )}

        {state.isComplete ? (
          <div className="py-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Setup Complete!
            </h3>
            <p className="text-sm max-w-md mb-6" style={{ color: 'var(--text-secondary)' }}>
              You&apos;ve successfully configured your store, added suppliers, logged inventory, and processed a sale. You are ready for production.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={() => handleDismiss(false)}
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                Keep test data
              </button>
              <button
                onClick={() => handleDismiss(true)}
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{ background: 'var(--accent-primary)', color: '#fff' }}
              >
                <Trash2 size={16} />
                Wipe test data & start fresh
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className="relative group p-4 rounded-xl border transition-all duration-200 flex items-start gap-3"
                  style={{
                    background: step.isDone ? 'var(--bg-base)' : 'var(--bg-card)',
                    borderColor: step.isDone ? 'var(--border-subtle)' : 'var(--border)',
                    opacity: step.isDone ? 0.7 : 1,
                  }}
                >
                  <div className="mt-0.5 shrink-0 transition-colors duration-300">
                    {step.isDone ? (
                      <CheckCircle2 size={20} style={{ color: 'var(--positive)' }} />
                    ) : (
                      <Circle size={20} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4
                        className="text-sm font-medium"
                        style={{
                          color: step.isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: step.isDone ? 'line-through' : 'none',
                        }}
                      >
                        {step.title}
                      </h4>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {step.description}
                    </p>
                  </div>
                  
                  {!step.isDone && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                      <ArrowRight size={18} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
