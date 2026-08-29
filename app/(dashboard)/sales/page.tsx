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

function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function SalesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const params = await searchParams

  const page = params.page ? parseInt(String(params.page), 10) : 1
  const hasExplicitDateFilter = !!params.dateFrom || !!params.dateTo
  const today = formatLocalDateInput(new Date())
  const dateFrom = params.dateFrom ? String(params.dateFrom) : hasExplicitDateFilter ? undefined : today
  const dateTo = params.dateTo ? String(params.dateTo) : hasExplicitDateFilter ? undefined : today
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
    : {
        sales: [],
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
        summary: {
          totalRevenue: 0,
          transactionCount: 0,
          avgTransactionValue: 0,
          totalUnitsSold: 0,
        },
      }

  const cashiers = cashiersResult.success ? cashiersResult.data : []

  const summary = user.role === 'owner' ? salesData.summary : undefined
  const summaryLabel = !hasExplicitDateFilter ? 'Today' : 'Selected Range'

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
        dateFrom={dateFrom}
        dateTo={dateTo}
        summary={summary}
        summaryLabel={summaryLabel}
      />
    </div>
  )
}
