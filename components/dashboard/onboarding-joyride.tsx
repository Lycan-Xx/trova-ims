'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Joyride, type Step, type CallBackProps, STATUS } from 'react-joyride'
import { Trash2 } from 'lucide-react'
import { dismissOnboarding, type OnboardingState } from '@/lib/actions/onboarding'

interface Props {
  state: OnboardingState
}

export function OnboardingJoyride({ state }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [isShowingFinalStep, setIsShowingFinalStep] = useState(false)

  // Load saved step index from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !state.isDismissed) {
      const savedIndex = localStorage.getItem('onboarding_step_index')
      if (savedIndex) {
        setStepIndex(parseInt(savedIndex, 10))
      }
    }
  }, [state.isDismissed])

  // Save step index to localStorage
  const saveStepIndex = (index: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_step_index', index.toString())
    }
  }

  const steps: Step[] = [
    {
      target: '[data-joyride="store"]',
      title: 'Configure Store Settings',
      content: 'Set your official store name and trading currency. This helps you establish your store&apos;s identity and ensures accurate financial tracking.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-joyride="vendor"]',
      title: 'Add your first Vendor',
      content: 'Create a supplier record before logging intake. Vendors are essential for tracking inventory sources and managing stock replenishment.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-joyride="intake"]',
      title: 'Log your first Stock Intake',
      content: 'Add a product and record its initial stock. This establishes your inventory baseline and helps you track stock movements accurately.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-joyride="sale"]',
      title: 'Make a Test Sale',
      content: 'Process a dummy transaction at the POS. This helps you understand how sales are recorded and tracked in the system.',
      placement: 'bottom',
      disableBeacon: true,
    },
  ]

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index } = data

    // Save current step
    if (type === 'step:after' || type === 'step:before') {
      saveStepIndex(index)
    }

    // Handle skipping the tour
    if (status === STATUS.SKIPPED) {
      handleDismiss(false)
    }

    // Check if tour finished
    if (status === STATUS.FINISHED) {
      setIsShowingFinalStep(true)
    }
  }

  const handleDismiss = (wipeData: boolean) => {
    startTransition(async () => {
      setError(null)
      const res = await dismissOnboarding(wipeData)
      if (res.success) {
        // Clear saved step index
        if (typeof window !== 'undefined') {
          localStorage.removeItem('onboarding_step_index')
        }
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (state.isDismissed) return null

  return (
    <>
      <Joyride
        steps={steps}
        stepIndex={stepIndex}
        run={!state.isDismissed && !isShowingFinalStep}
        continuous
        showSkip
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: 'var(--accent-primary)',
            backgroundColor: 'var(--bg-card)',
            textColor: 'var(--text-primary)',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: 8,
          },
          beacon: {
            inner: 'var(--accent-primary)',
            outer: 'var(--accent-primary)',
          },
          tooltip: {
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipTitle: {
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: 600,
          },
          tooltipContent: {
            color: 'var(--text-secondary)',
            fontSize: '13px',
          },
          button: {
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            marginRight: '8px',
          },
          skip: {
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
          },
        }}
      />

      {/* Final Step Modal */}
      {isShowingFinalStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-[16px] border p-6 md:p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="py-4 flex flex-col items-center justify-center text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}
              >
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Setup Complete!
              </h3>
              <p className="text-sm max-w-md mb-6" style={{ color: 'var(--text-secondary)' }}>
                You&apos;ve successfully configured your store, added suppliers, logged inventory, and processed a sale. You are ready for production.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => handleDismiss(false)}
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  Keep test data
                </button>
                <button
                  onClick={() => handleDismiss(true)}
                  disabled={isPending}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1"
                  style={{
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                  Wipe test data & start fresh
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-md text-sm text-red-500 bg-red-500/10 border border-red-500/20">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
