import {
  ShoppingBag,
  Pill,
  Truck,
  Package,
  ShoppingCart,
  Leaf,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StoreType {
  name: string
  desc: string
  Icon: LucideIcon
}

const STORE_TYPES: StoreType[] = [
  {
    name: 'Supermarkets',
    desc: 'Multi-aisle, high SKU count, multiple cashiers',
    Icon: ShoppingBag,
  },
  {
    name: 'Pharmacies',
    desc: 'Expiry-critical stock, regulated inventory',
    Icon: Pill,
  },
  {
    name: 'FMCG Distributors',
    desc: 'High-volume batch intake, vendor consignments',
    Icon: Truck,
  },
  {
    name: 'Provisions Stores',
    desc: 'Mixed categories, direct and market purchases',
    Icon: Package,
  },
  {
    name: 'Mini Marts',
    desc: 'Fast-moving consumer goods, daily restocking',
    Icon: ShoppingCart,
  },
  {
    name: 'Grocery Shops',
    desc: 'Fresh and packaged goods with short shelf life',
    Icon: Leaf,
  },
]

function StoreCard({ name, desc, Icon }: StoreType) {
  return (
    <div
      className="group flex flex-col gap-4 p-6 md:p-7 transition-colors duration-200 cursor-default"
      style={{ backgroundColor: 'var(--bg-base)' }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = 'var(--bg-card)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = 'var(--bg-base)')
      }
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200"
        style={{
          backgroundColor: 'var(--accent-primary-muted)',
          border: '1px solid rgba(245,97,10,0.2)',
        }}
        aria-hidden="true"
      >
        <Icon
          size={17}
          strokeWidth={1.75}
          style={{ color: 'var(--accent-primary)' }}
        />
      </div>

      {/* Text */}
      <div>
        <p
          className="text-[14px] font-semibold mb-1.5 transition-colors duration-200"
          style={{ color: 'var(--text-primary)' }}
        >
          {name}
        </p>
        <p
          className="text-[12px] leading-snug"
          style={{ color: 'var(--text-muted)' }}
        >
          {desc}
        </p>
      </div>
    </div>
  )
}

export default function BuiltFor() {
  return (
    <section
      className="py-20 px-6 md:px-10 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <div className="mb-12">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Built for
          </p>
          <h2
            className="font-bold tracking-tight leading-[1.08]"
            style={{
              fontSize: 'clamp(26px, 3.5vw, 42px)',
              color: 'var(--text-primary)',
            }}
          >
            Any store.{' '}
            <span style={{ color: 'var(--text-secondary)' }}>Every shelf.</span>
          </h2>
        </div>

        {/*
          Grid border trick: set the grid gap to 1px and give the
          container a border-color background — the gap itself becomes
          the visible border line between cells.
        */}
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-px overflow-hidden rounded-xl border"
          style={{
            backgroundColor: 'var(--border)',
            borderColor: 'var(--border)',
          }}
        >
          {STORE_TYPES.map((store) => (
            <StoreCard key={store.name} {...store} />
          ))}
        </div>

        {/* Footer note */}
        <p
          className="mt-6 text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          If your business has a shelf and a supplier, Trova works for you.
        </p>
      </div>
    </section>
  )
}