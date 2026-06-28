import Link from 'next/link'

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 h-14 border-b border-[var(--border-subtle)] bg-[rgba(13,13,13,0.88)] backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span
          className="w-7 h-7 rounded-[7px] bg-[var(--accent-primary)] flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
            <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
          </svg>
        </span>
        <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
          Trova
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/sign-in"
          className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="text-[13px] font-semibold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-4 py-[7px] rounded-lg transition-colors duration-150 whitespace-nowrap"
        >
          Get started
        </Link>
      </div>
    </header>
  )
}
