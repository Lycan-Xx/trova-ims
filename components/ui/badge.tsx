import * as React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'default' | 'accent'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-positive-bg text-positive',
  warning: 'bg-warning-bg text-warning',
  danger:  'bg-danger-bg text-danger',
  default: 'bg-bg-input text-text-secondary',
  accent:  'bg-accent-primary-muted text-accent-primary',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium leading-none',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
