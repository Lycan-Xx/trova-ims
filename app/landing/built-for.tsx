const STORE_TYPES = [
  'Supermarkets',
  'Pharmacies',
  'FMCG Distributors',
  'Provisions Stores',
  'Mini Marts',
  'Grocery Shops',
]

export default function BuiltFor() {
  return (
    <section
      className="py-5 px-6 md:px-10 border-b"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-nav)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.12em] mr-2 whitespace-nowrap"
          style={{ color: 'var(--text-muted)' }}
        >
          Built for
        </span>

        <div
          className="h-3.5 w-px mx-1 flex-shrink-0"
          style={{ backgroundColor: 'var(--border)' }}
          aria-hidden="true"
        />

        {STORE_TYPES.map((type, i) => (
          <span
            key={type}
            className="flex items-center gap-3 text-[13px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {type}
            {i < STORE_TYPES.length - 1 && (
              <span
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'var(--border)' }}
                aria-hidden="true"
              />
            )}
          </span>
        ))}
      </div>
    </section>
  )
}
