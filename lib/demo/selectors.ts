import type {
  DemoBatch,
  DemoData,
  DemoDailySales,
  DemoIntakeSession,
  DemoProductPerformance,
  DemoProductWithStock,
  DemoSale,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export function startOfLocalDay(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function isToday(iso: string, now: Date): boolean {
  return startOfLocalDay(new Date(iso)).getTime() === startOfLocalDay(now).getTime()
}

export function productStock(data: DemoData, productId: string): number | null {
  const product = data.products.find((candidate) => candidate.id === productId)
  if (!product?.trackInventory) return null
  return data.batches
    .filter((batch) => batch.productId === productId)
    .reduce((sum, batch) => sum + batch.qtyRemaining, 0)
}

export function productsWithStock(data: DemoData): DemoProductWithStock[] {
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]))
  return data.products.map((product) => ({
    ...product,
    categoryName: categoryNames.get(product.categoryId) ?? 'Uncategorised',
    stock: productStock(data, product.id),
  }))
}

export function todaySales(data: DemoData): DemoSale[] {
  const now = new Date(data.generatedAt)
  return data.sales.filter((sale) => isToday(sale.createdAt, now))
}

export function salesSummary(sales: DemoSale[]) {
  const revenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const itemsSold = sales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  )
  return {
    revenue,
    transactions: sales.length,
    itemsSold,
    averageTransaction: sales.length === 0 ? 0 : revenue / sales.length,
  }
}

export function dailySales(data: DemoData, numberOfDays = 7): DemoDailySales[] {
  const end = startOfLocalDay(new Date(data.generatedAt))
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date(end.getTime() - (numberOfDays - index - 1) * DAY_MS)
    const matching = data.sales.filter(
      (sale) => startOfLocalDay(new Date(sale.createdAt)).getTime() === date.getTime(),
    )
    const summary = salesSummary(matching)
    return {
      date: date.toISOString(),
      revenue: summary.revenue,
      transactionCount: summary.transactions,
      itemsSold: summary.itemsSold,
    }
  })
}

export function productPerformance(data: DemoData): DemoProductPerformance[] {
  const totals = new Map<string, DemoProductPerformance>()
  const productNames = new Map(data.products.map((product) => [product.id, product.name]))

  data.sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = totals.get(item.productId) ?? {
        productId: item.productId,
        productName: productNames.get(item.productId) ?? 'Unknown product',
        quantity: 0,
        revenue: 0,
      }
      current.quantity += item.quantity
      current.revenue += item.lineTotal
      totals.set(item.productId, current)
    })
  })

  return Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue)
}

export function intakeSessions(data: DemoData): DemoIntakeSession[] {
  const vendorNames = new Map(data.vendors.map((vendor) => [vendor.id, vendor.name]))
  const sessions = new Map<string, DemoIntakeSession>()

  data.batches.forEach((batch) => {
    const current = sessions.get(batch.intakeSessionId) ?? {
      id: batch.intakeSessionId,
      reference: batch.reference.replace(/-\d{3}$/, ''),
      vendorName: vendorNames.get(batch.vendorId) ?? 'Unknown vendor',
      receivedAt: batch.receivedAt,
      itemCount: 0,
      totalUnits: 0,
      totalCost: 0,
      isConsignment: batch.isConsignment,
      batches: [],
    }
    current.itemCount += 1
    current.totalUnits += batch.qtyReceived
    current.totalCost += batch.qtyReceived * batch.costPerUnit
    current.batches.push(batch)
    if (batch.receivedAt > current.receivedAt) current.receivedAt = batch.receivedAt
    sessions.set(batch.intakeSessionId, current)
  })

  return Array.from(sessions.values()).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}

export function lowStockProducts(data: DemoData): DemoProductWithStock[] {
  return productsWithStock(data).filter(
    (product) => product.trackInventory && product.stock !== null && product.stock <= product.reorderLevel,
  )
}

export function expiringBatches(data: DemoData, days = 30): DemoBatch[] {
  const now = startOfLocalDay(new Date(data.generatedAt)).getTime()
  const cutoff = now + days * DAY_MS
  return data.batches
    .filter((batch) => {
      if (!batch.expiryDate || batch.qtyRemaining <= 0) return false
      const expiry = new Date(`${batch.expiryDate}T00:00:00`).getTime()
      return expiry <= cutoff
    })
    .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
}

export function grossProfitEstimate(data: DemoData): number {
  const costs = new Map<string, number>()
  data.batches.forEach((batch) => {
    if (!costs.has(batch.productId)) costs.set(batch.productId, batch.costPerUnit)
  })
  return data.sales.reduce(
    (sum, sale) => sum + sale.items.reduce(
      (itemSum, item) => itemSum + item.lineTotal - (costs.get(item.productId) ?? 0) * item.quantity,
      0,
    ),
    0,
  )
}
