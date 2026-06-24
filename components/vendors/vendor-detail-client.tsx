'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deactivateVendor } from '@/app/actions/vendors'
import { VendorSlideOver } from '@/components/vendors/vendor-slide-over'
import type { Vendor } from '@/lib/db/schema'

export function VendorDetailClient({ vendor }: { vendor: Vendor }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deactivating, setDeactivating] = React.useState(false)

  async function handleDeactivate() {
    if (!confirm(`Deactivate ${vendor.name}? This cannot be undone from here.`)) return
    setDeactivating(true)
    try {
      const result = await deactivateVendor(vendor.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Vendor deactivated.')
      router.refresh()
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium border transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Edit Vendor
        </button>

        {vendor.is_active && (
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
          >
            {deactivating && <Loader2 size={13} className="animate-spin" />}
            Deactivate
          </button>
        )}
      </div>

      <VendorSlideOver
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
      />
    </>
  )
}
