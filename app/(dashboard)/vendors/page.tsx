import { getVendors } from '@/app/actions/vendors'
import { VendorList } from '@/components/vendors/vendor-list'
import type { GetVendorsFilters } from '@/app/actions/vendors'

// Ensure the page is never statically cached — router.refresh() in the
// slide-over panel re-fetches from the server to pick up newly created
// or updated vendors. Without this directive Next.js may serve a cached
// render and the new vendor appears to be missing after "created" toast.
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ type?: string; search?: string }>
}

export const metadata = {
  title: 'Vendors | Stock Remake',
}

import { requireStoreAccess } from '@/lib/auth'

export default async function VendorsPage({ searchParams }: PageProps) {
  await requireStoreAccess()
  const { type, search } = await searchParams

  const filters: GetVendorsFilters = {
    type: (type as GetVendorsFilters['type']) ?? 'all',
    search: search ?? '',
  }

  const result = await getVendors(filters)
  const vendors = result.success ? result.data : []

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Vendors
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage your suppliers and track consignment stock.
        </p>
      </div>

      <VendorList
        vendors={vendors}
        activeType={type ?? 'all'}
        activeSearch={search ?? ''}
      />
    </div>
  )
}
