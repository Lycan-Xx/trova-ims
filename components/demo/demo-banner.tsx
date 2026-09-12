import { Eye, RotateCcw } from 'lucide-react'

export function DemoBanner({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[rgba(245,97,10,0.25)] bg-accent-primary-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div className="flex items-start gap-3">
        <Eye className="mt-0.5 shrink-0 text-accent-primary" size={17} aria-hidden="true" />
        <p className="text-xs leading-5 text-text-secondary">
          <strong className="text-text-primary">Interactive Preview</strong> — fictional sample data only. This preview is read-only and never connects to a database.
        </p>
      </div>
      <button type="button" onClick={onReset} className="inline-flex shrink-0 items-center gap-2 self-start text-xs font-semibold text-accent-primary hover:text-white sm:self-auto">
        <RotateCcw size={13} aria-hidden="true" /> Reset view
      </button>
    </div>
  )
}

