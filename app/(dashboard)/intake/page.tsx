import { getBatches } from '@/app/actions/batches'
import { getVendors } from '@/app/actions/vendors'
import { getStoreSettings } from '@/app/actions/settings'
import { getCurrencySymbol } from '@/lib/currency'
import { IntakeList } from '@/components/intake/intake-list'
import type { GetBatchesFilters } from '@/app/actions/batches'

interface IntakePageProps {
  searchParams: Promise<{
    search?: string
    vendorId?: string
    dateFrom?: string
    dateTo?: string
    consignment?: string
    session?: string
    page?: string
  }>
}

import { requireStoreAccess } from '@/lib/auth'

export default async function IntakePage({ searchParams }: IntakePageProps) {
  await requireStoreAccess()
  const params = await searchParams

  const filters: GetBatchesFilters = {
    vendorId: params.vendorId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    consignmentOnly: params.consignment === 'true',
    sessionId: params.session,
    page: params.page ? parseInt(params.page, 10) : 1,
  }

  const [batchesResult, vendorsResult, storeResult] = await Promise.all([
    getBatches(filters),
    getVendors(),
    getStoreSettings(),
  ])

  const batches = batchesResult.success ? batchesResult.data.batches : []
  const totalPages = batchesResult.success ? batchesResult.data.totalPages : 1
  const totalCount = batchesResult.success ? batchesResult.data.totalCount : 0
  const currentPage = filters.page ?? 1
  const vendors = vendorsResult.success ? vendorsResult.data : []
  const currency = storeResult.success ? storeResult.data.currency : 'NGN'
  const currencySymbol = getCurrencySymbol(currency)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Stock Intake
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          View and manage all stock batches received
        </p>
      </div>

      <IntakeList
        batches={batches}
        vendors={vendors}
        totalPages={totalPages}
        currentPage={currentPage}
        totalCount={totalCount}
        currencySymbol={currencySymbol}
        activeSessionId={params.session}
      />
    </div>
  )
}
