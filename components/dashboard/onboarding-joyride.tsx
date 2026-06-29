'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Joyride, STATUS, type Step, type EventData, type Controls } from 'react-joyride'
import { Trash2, CheckCircle2 } from 'lucide-react'
import { dismissOnboarding, type OnboardingState } from '@/lib/actions/onboarding'

interface Props {
  state: OnboardingState
}

const STORAGE_KEY = 'onboarding_step_index'

export function OnboardingJoyride({ state }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [showCompletion, setShowCompletion] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent SSR hydration mismatch — Joyride needs the DOM
  useEffect(() => {
    setMounted(true)
  }, [])

  // Steps target sidebar nav links which are ALWAYS visible in the DOM.
  // This is critical — Joyride can only highlight elements currently rendered.
  const steps: Step[] = [
    {
      target: '[data-joyride="nav-settings"]',
      title: '① Configure Store Settings',
      content:
        'Click Settings to set your official store name and trading currency. This establishes your store\'s identity.',
      placement: 'right',
      skipBeacon: true,
    },
    {
      target: '[data-joyride="nav-vendors"]',
      title: '② Add your first Vendor',
      content:
        'Navigate to Vendors and create a supplier record. Vendors are essential for tracking inventory sources.',
      placement: 'right',
      skipBeacon: true,
    },
    {
      target: '[data-joyride="nav-intake"]',
      title: '③ Log your first Stock Intake',
      content:
        'Go to Intake and record your first product batch. This establishes your inventory baseline.',
      placement: 'right',
      skipBeacon: true,
    },
    {
      target: '[data-joyride="nav-sales"]',
      title: '④ Make a Test Sale',
      content:
        'Visit Sales to process a test transaction. This helps you understand how sales are tracked in the system.',
      placement: 'right',
      skipBeacon: true,
    },
  ]

  // Determine starting step from completed tasks
  const getInitialStepIndex = useCallback((): number => {
    if (!state.hasStoreSetup) return 0
    if (!state.hasVendor) return 1
    if (!state.hasIntake) return 2
    if (!state.hasSale) return 3
    return 0 // all done — doesn't matter, we'll show completion
  }, [state.hasStoreSetup, state.hasVendor, state.hasIntake, state.hasSale])

  // On mount, decide whether to show the tour or the completion modal
  useEffect(() => {
    if (!mounted || state.isDismissed) return

    if (state.isComplete) {
      // All 4 tasks done — show the completion modal instead of the tour
      setShowCompletion(true)
      setRun(false)
    } else {
      // Figure out where the user left off based on actual progress
      const savedRaw = localStorage.getItem(STORAGE_KEY)
      const saved = savedRaw ? parseInt(savedRaw, 10) : null
      const progressIndex = getInitialStepIndex()

      // Use whichever is further along (saved vs actual progress)
      const startAt = saved !== null && saved > progressIndex ? saved : progressIndex
      setStepIndex(Math.min(startAt, steps.length - 1))
      setRun(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.isDismissed, state.isComplete, getInitialStepIndex])

  // Persist step index
  const saveStep = (index: number) => {
    localStorage.setItem(STORAGE_KEY, index.toString())
  }

  // Joyride event handler (v3 API: onEvent callback)
  const handleEvent = useCallback((data: EventData, controls: Controls) => {
    const { status, action, index, type } = data

    // When user advances to next step
    if (type === 'step:after' && action === 'next') {
      const nextIndex = index + 1
      if (nextIndex < steps.length) {
        setStepIndex(nextIndex)
        saveStep(nextIndex)
      }
    }

    // When user goes back
    if (type === 'step:after' && action === 'prev') {
      const prevIndex = index - 1
      if (prevIndex >= 0) {
        setStepIndex(prevIndex)
        saveStep(prevIndex)
      }
    }

    // Tour finished (user clicked through all steps)
    if (status === STATUS.FINISHED) {
      setRun(false)
      setShowCompletion(true)
      localStorage.removeItem(STORAGE_KEY)
    }

    // Tour skipped
    if (status === STATUS.SKIPPED) {
      setRun(false)
      handleDismiss(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  const handleDismiss = (wipeData: boolean) => {
    startTransition(async () => {
      setError(null)
      const res = await dismissOnboarding(wipeData)
      if (res.success) {
        localStorage.removeItem(STORAGE_KEY)
        setShowCompletion(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (state.isDismissed || !mounted) return null

  return (
    <>
      {/* Joyride Tour */}
      {run && (
        <Joyride
          steps={steps}
          stepIndex={stepIndex}
          run={run}
          continuous
          onEvent={handleEvent}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            skip: 'Skip tutorial',
          }}
          options={{
            skipScroll: true,
            showProgress: true,
            buttons: ['back', 'close', 'primary', 'skip'],
            primaryColor: '#f5610a',
            backgroundColor: 'var(--bg-card)',
            textColor: 'var(--text-primary)',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            spotlightRadius: 8,
            skipBeacon: true,
          }}
          styles={{
            tooltip: {
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            },
            tooltipContainer: {
              textAlign: 'left',
            },
            tooltipTitle: {
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 4,
            },
            tooltipContent: {
              fontSize: 13,
              lineHeight: 1.6,
              padding: '8px 0',
            },
            buttonPrimary: {
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
            },
            buttonBack: {
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              marginRight: 8,
            },
            buttonSkip: {
              color: 'var(--text-muted)',
              fontSize: 12,
            },
          }}
        />
      )}

      {/* Completion Modal — shown after all 4 tasks are done */}
      {showCompletion && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div
            className="rounded-2xl p-6 md:p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="py-4 flex flex-col items-center justify-center text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                Setup Complete!
              </h3>
              <p
                className="text-sm max-w-md mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                You&apos;ve successfully configured your store, added suppliers,
                logged inventory, and processed a sale. You are ready for production.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => handleDismiss(false)}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
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
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    background: '#f5610a',
                    color: '#fff',
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                  Wipe test data &amp; start fresh
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-md text-sm text-red-500 bg-red-500/10 border border-red-500/20 w-full">
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
