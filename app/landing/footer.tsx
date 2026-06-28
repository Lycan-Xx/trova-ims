export default function Footer() {
  return (
    <footer
      className="border-t px-6 md:px-10 py-6 flex items-center justify-between flex-wrap gap-4"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="5" width="5" height="8" rx="1" fill="white" />
            <rect x="8" y="1" width="5" height="12" rx="1" fill="white" />
          </svg>
        </span>
        <span
          className="text-[13px] font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          Trova
        </span>
      </div>

      {/* Tagline */}
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Know your store, always.
      </p>

      {/* Copyright */}
      <p className="text-[12px]" style={{ color: 'var(--border)' }}>
        © {new Date().getFullYear()} Trova. All rights reserved.
      </p>
    </footer>
  )
}
