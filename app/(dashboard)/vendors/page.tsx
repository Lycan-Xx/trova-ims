import { getVendors } from '@/app/actions/vendors'
import { VendorList } from '@/components/vendors/vendor-list'
import type { GetVendorsFilters } from '@/app/actions/vendors'

interface PageProps {
  searchParams: Promise<{ type?: string; search?: string }>
}

export const metadata = {
  title: 'Vendors | Stock Remake',
}

export default async function VendorsPage({ searchParams }: PageProps) {
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
