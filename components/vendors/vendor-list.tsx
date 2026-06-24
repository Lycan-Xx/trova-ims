'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, Building2, Edit2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VendorSlideOver } from '@/components/vendors/vendor-slide-over'
import type { VendorWithStats } from '@/app/actions/vendors'
import type { Vendor } from '@/lib/db/schema'

interface VendorListProps {
  vendors: VendorWithStats[]
  activeType: string
  activeSearch: string
}

export function VendorList({ vendors, activeType, activeSearch }: VendorListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide-over state
  const [slideOverOpen, setSlideOverOpen] = React.useState(false)
  const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null)

  function openAdd() {
    setEditingVendor(null)
    setSlideOverOpen(true)
  }

  function openEdit(vendor: Vendor) {
    setEditingVendor(vendor)
    setSlideOverOpen(true)
  }

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParam('search', e.target.value)
    }, 300)
  }

  const typeOptions: { label: string; value: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Direct', value: 'direct' },
    { label: 'Consignment', value: 'consignment' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name or contact…"
            defaultValue={activeSearch}
            onChange={handleSearch}
            className="w-full h-9 rounded-lg pl-9 pr-3 text-sm bg-bg-input border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40 transition-colors"
          />
        </div>

        {/* Type tabs */}
        <div
          className="flex items-center rounded-lg p-1 gap-1"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
        >
          {typeOptions.map((opt) => {
            const isActive = activeType === opt.value || (!activeType && opt.value === 'all')
            return (
              <button
                key={opt.value}
                onClick={() => updateParam('type', opt.value)}
                className="px-3 h-7 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Add vendor */}
        <Button
          className="ml-auto h-9 rounded-lg px-4 text-sm font-medium text-white"
          style={{ background: 'var(--accent-primary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
          onClick={openAdd}
        >
          + Add Vendor
        </Button>
      </div>

      {/* Cards */}
      {vendors.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-24 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <Building2 size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No vendors yet. Add your first vendor to track suppliers.
          </p>
          <Button
            className="h-9 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--accent-primary-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'var(--accent-primary)')
            }
            onClick={openAdd}
          >
            + Add Vendor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} onEdit={openEdit} />
          ))}
        </div>
      )}

      <VendorSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        vendor={editingVendor}
      />
    </div>
  )
}

function VendorCard({ vendor, onEdit }: { vendor: VendorWithStats; onEdit: (v: Vendor) => void }) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      className="flex flex-col gap-4 rounded-xl p-4 transition-all duration-150"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border)'}`,
        borderRadius: '12px',
        boxShadow: hovered ? '0 4px 16px rgba(245,97,10,0.10)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-sm font-semibold truncate leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {vendor.name}
          </span>
          {vendor.contact && (
            <span
              className="text-[13px] truncate"
              style={{ color: 'var(--text-secondary)', fontSize: '13px' }}
            >
              {vendor.contact}
            </span>
          )}
        </div>
        <Badge variant={vendor.type === 'consignment' ? 'accent' : 'default'}>
          {vendor.type === 'consignment' ? 'Consignment' : 'Direct'}
        </Badge>
      </div>

      {/* Address */}
      {vendor.address && (
        <p
          className="text-[12px] leading-relaxed line-clamp-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {vendor.address}
        </p>
      )}

      {/* Stats */}
      <div
        className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5"
        style={{ background: 'var(--bg-input)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Batches supplied
          </span>
          <span
            className="text-[13px] font-medium tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {vendor.batch_count}
          </span>
        </div>
        {vendor.type === 'consignment' && (
          <div className="flex items-center justify-between">
            <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Units outstanding
            </span>
            <span
              className="text-[13px] font-medium tabular-nums"
              style={{ color: vendor.outstanding_qty > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}
            >
              {vendor.outstanding_qty}
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="flex items-center justify-between pt-1 mt-auto"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <Link
          href={`/vendors/${vendor.id}`}
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: 'var(--accent-primary)' }}
        >
          <ExternalLink size={13} />
          View Details
        </Link>
        <button
          onClick={() => onEdit(vendor)}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'var(--bg-input)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
          aria-label={`Edit ${vendor.name}`}
        >
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  )
}
