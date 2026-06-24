'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'right' | 'left'
  children: React.ReactNode
}

const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm', className)}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'right', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'fixed z-50 top-0 bottom-0 flex flex-col',
        'w-full sm:w-[480px]',
        side === 'right' ? 'right-0' : 'left-0',
        className,
      )}
      style={{
        background: 'var(--bg-card)',
        borderLeft: side === 'right' ? '1px solid var(--border)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--border)' : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  ),
)
SheetContent.displayName = 'SheetContent'

function Sheet({ open, onOpenChange, children }: SheetProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // Prevent body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <SheetOverlay onClick={() => onOpenChange(false)} />
      {children}
    </div>
  )
}

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center justify-between px-6 py-4 shrink-0', className)}
    style={{ borderBottom: '1px solid var(--border)' }}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

const SheetTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn('text-base font-semibold text-text-primary', className)}
    {...props}
  />
)
SheetTitle.displayName = 'SheetTitle'

const SheetCloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors"
    aria-label="Close panel"
  >
    <X size={16} />
  </button>
)

const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
)
SheetBody.displayName = 'SheetBody'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('shrink-0 px-6 py-4', className)}
    style={{ borderTop: '1px solid var(--border)' }}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetCloseButton,
  SheetBody,
  SheetFooter,
}
