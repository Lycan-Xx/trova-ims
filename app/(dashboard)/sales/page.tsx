import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getSales, getCashiers } from '@/app/actions/sales'
import { SalesList } from '@/components/sales/sales-list'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const metadata = {
  title: 'Sales History | StockSmart',
}

export default async function SalesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const params = await searchParams

  const page = params.page ? parseInt(String(params.page), 10) : 1
  const dateFrom = params.dateFrom ? String(params.dateFrom) : undefined
  const dateTo = params.dateTo ? String(params.dateTo) : undefined
  const paymentMethod = params.paymentMethod ? String(params.paymentMethod) : undefined
  let cashierId = params.cashierId ? String(params.cashierId) : undefined
  
  if (user.role === 'cashier') {
    cashierId = user.id
  }

  const [salesResult, cashiersResult] = await Promise.all([
    getSales({ page, dateFrom, dateTo, paymentMethod, cashierId }),
    getCashiers(),
  ])

  const salesData = salesResult.success
    ? salesResult.data
    : { sales: [], totalCount: 0, totalPages: 1, currentPage: 1 }

  const cashiers = cashiersResult.success ? cashiersResult.data : []

  // Compute summary totals for owners from this page's data
  // (in a real app this would be a separate aggregation query scoped to filters)
  let summary: { totalRevenue: number; transactionCount: number; avgTransactionValue: number } | undefined

  if (user.role === 'owner' && salesData.totalCount > 0) {
    const totalRevenue = salesData.sales.reduce(
      (sum, s) => sum + parseFloat(s.total_amount),
      0,
    )
    const transactionCount = salesData.totalCount
    const avgTransactionValue =
      salesData.sales.length > 0 ? totalRevenue / salesData.sales.length : 0

    summary = { totalRevenue, transactionCount, avgTransactionValue }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Sales History
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {user.role === 'cashier'
              ? 'Your completed transactions'
              : 'All transactions across your store'}
          </p>
        </div>
      </div>

      <SalesList
        sales={salesData.sales}
        totalCount={salesData.totalCount}
        totalPages={salesData.totalPages}
        currentPage={salesData.currentPage}
        isOwner={user.role === 'owner'}
        cashiers={cashiers}
        summary={summary}
      />
    </div>
  )
}
