import type {
  DemoBatch,
  DemoCategory,
  DemoData,
  DemoPaymentMethod,
  DemoProduct,
  DemoSale,
  DemoVendor,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

function shiftedIso(now: Date, dayOffset: number, hour: number, minute = 0): string {
  const date = new Date(now)
  date.setHours(hour, minute, 0, 0)
  date.setTime(date.getTime() + dayOffset * DAY_MS)
  return date.toISOString()
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function receiptDate(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

const categories: DemoCategory[] = [
  { id: 'cat-beverages', name: 'Beverages' },
  { id: 'cat-groceries', name: 'Groceries' },
  { id: 'cat-household', name: 'Household' },
  { id: 'cat-personal', name: 'Personal Care' },
  { id: 'cat-snacks', name: 'Snacks' },
  { id: 'cat-services', name: 'Services' },
]

const vendors: DemoVendor[] = [
  { id: 'vendor-1', name: 'Harbour Foods Distribution', contact: 'Amaka Bello', phone: '0800 000 0101', type: 'direct', isActive: true },
  { id: 'vendor-2', name: 'Northstar Wholesale', contact: 'Daniel Okoro', phone: '0800 000 0102', type: 'direct', isActive: true },
  { id: 'vendor-3', name: 'Green Basket Supply', contact: 'Mariam Lawal', phone: '0800 000 0103', type: 'consignment', isActive: true },
  { id: 'vendor-4', name: 'Everyday Essentials', contact: 'Tomi Adeyemi', phone: '0800 000 0104', type: 'direct', isActive: true },
  { id: 'vendor-5', name: 'Bright Home Merchants', contact: 'Chika Eze', phone: '0800 000 0105', type: 'direct', isActive: true },
  { id: 'vendor-6', name: 'Coastal Drinks Depot', contact: 'Seyi James', phone: '0800 000 0106', type: 'consignment', isActive: true },
  { id: 'vendor-7', name: 'Market Lane Trading', contact: 'Fatima Musa', phone: '0800 000 0107', type: 'direct', isActive: true },
  { id: 'vendor-8', name: 'Prime Care Supplies', contact: 'Ife Nwosu', phone: '0800 000 0108', type: 'direct', isActive: false },
]

const productSeed: Array<Omit<DemoProduct, 'id' | 'sku' | 'barcode' | 'isActive'>> = [
  { name: 'Premium Table Water 75cl', description: 'Chilled-ready bottled water', categoryId: 'cat-beverages', unit: 'piece', sellingPrice: 300, reorderLevel: 18, trackInventory: true },
  { name: 'Orange Juice 1L', description: '100% fruit blend', categoryId: 'cat-beverages', unit: 'pack', sellingPrice: 1850, reorderLevel: 8, trackInventory: true },
  { name: 'Malt Drink Can', description: 'Non-alcoholic malt drink', categoryId: 'cat-beverages', unit: 'piece', sellingPrice: 650, reorderLevel: 12, trackInventory: true },
  { name: 'Long Grain Rice 5kg', description: 'Premium parboiled rice', categoryId: 'cat-groceries', unit: 'bag', sellingPrice: 12500, reorderLevel: 6, trackInventory: true },
  { name: 'Vegetable Oil 1L', description: 'Refined cooking oil', categoryId: 'cat-groceries', unit: 'bottle', sellingPrice: 3200, reorderLevel: 10, trackInventory: true },
  { name: 'Brown Beans 2kg', description: 'Clean dry beans', categoryId: 'cat-groceries', unit: 'bag', sellingPrice: 5400, reorderLevel: 7, trackInventory: true },
  { name: 'Tomato Paste 400g', description: 'Concentrated tomato paste', categoryId: 'cat-groceries', unit: 'tin', sellingPrice: 1300, reorderLevel: 14, trackInventory: true },
  { name: 'Breakfast Cereal 500g', description: 'Whole grain cereal', categoryId: 'cat-groceries', unit: 'pack', sellingPrice: 4800, reorderLevel: 8, trackInventory: true },
  { name: 'Laundry Detergent 1kg', description: 'Fresh-scent detergent powder', categoryId: 'cat-household', unit: 'pack', sellingPrice: 3900, reorderLevel: 9, trackInventory: true },
  { name: 'Dishwashing Liquid 750ml', description: 'Lemon dishwashing liquid', categoryId: 'cat-household', unit: 'bottle', sellingPrice: 2200, reorderLevel: 8, trackInventory: true },
  { name: 'Kitchen Tissue 4 Roll', description: 'Absorbent kitchen towels', categoryId: 'cat-household', unit: 'pack', sellingPrice: 2800, reorderLevel: 6, trackInventory: true },
  { name: 'LED Bulb 12W', description: 'Energy-saving white bulb', categoryId: 'cat-household', unit: 'piece', sellingPrice: 2100, reorderLevel: 5, trackInventory: true },
  { name: 'Bathing Soap 3 Pack', description: 'Moisturising bathing soap', categoryId: 'cat-personal', unit: 'pack', sellingPrice: 2400, reorderLevel: 10, trackInventory: true },
  { name: 'Body Lotion 400ml', description: 'Daily moisturising lotion', categoryId: 'cat-personal', unit: 'bottle', sellingPrice: 5200, reorderLevel: 5, trackInventory: true },
  { name: 'Toothpaste 140g', description: 'Fluoride protection toothpaste', categoryId: 'cat-personal', unit: 'piece', sellingPrice: 1900, reorderLevel: 10, trackInventory: true },
  { name: 'Plantain Chips 100g', description: 'Crunchy lightly salted chips', categoryId: 'cat-snacks', unit: 'pack', sellingPrice: 900, reorderLevel: 15, trackInventory: true },
  { name: 'Chocolate Biscuits', description: 'Chocolate cream biscuits', categoryId: 'cat-snacks', unit: 'pack', sellingPrice: 750, reorderLevel: 15, trackInventory: true },
  { name: 'Roasted Groundnuts 200g', description: 'Fresh roasted groundnuts', categoryId: 'cat-snacks', unit: 'pack', sellingPrice: 1100, reorderLevel: 10, trackInventory: true },
  { name: 'Gift Wrapping', description: 'In-store gift wrapping service', categoryId: 'cat-services', unit: 'service', sellingPrice: 1500, reorderLevel: 0, trackInventory: false },
  { name: 'Local Delivery', description: 'Same-day neighbourhood delivery', categoryId: 'cat-services', unit: 'service', sellingPrice: 2500, reorderLevel: 0, trackInventory: false },
  { name: 'Shopping Bag Large', description: 'Reusable branded shopping bag', categoryId: 'cat-services', unit: 'piece', sellingPrice: 500, reorderLevel: 0, trackInventory: false },
  { name: 'Mobile Airtime Voucher', description: 'Digital airtime service', categoryId: 'cat-services', unit: 'service', sellingPrice: 1000, reorderLevel: 0, trackInventory: false },
]

function buildProducts(): DemoProduct[] {
  return productSeed.map((product, index) => ({
    ...product,
    id: `product-${index + 1}`,
    sku: `${categories.find((category) => category.id === product.categoryId)?.name.slice(0, 3).toUpperCase() ?? 'PRD'}-${String(index + 1).padStart(4, '0')}`,
    barcode: `615100000${String(index + 1).padStart(3, '0')}`,
    isActive: index !== 13,
  }))
}

function buildBatches(now: Date, products: DemoProduct[]): DemoBatch[] {
  const batches: DemoBatch[] = []
  let batchNumber = 1

  products.filter((product) => product.trackInventory).forEach((product, index) => {
    const vendor = vendors[index % 7]
    const lowStock = index % 6 === 0
    const quantity = 24 + (index % 5) * 6
    const remaining = lowStock ? Math.max(1, product.reorderLevel - 3) : 12 + (index % 7) * 5
    const receivedAt = shiftedIso(now, -(5 + index * 2), 10, 15)
    const expiresIn = index === 6 ? -2 : index === 2 ? 5 : index % 4 === 0 ? 18 : 80 + index * 7

    batches.push({
      id: `batch-${batchNumber}`,
      reference: `IN-${receiptDate(receivedAt)}-${String(batchNumber).padStart(3, '0')}`,
      intakeSessionId: `intake-${Math.floor(index / 2) + 1}`,
      productId: product.id,
      vendorId: vendor.id,
      qtyReceived: quantity,
      qtyRemaining: remaining,
      costPerUnit: Math.round(product.sellingPrice * 0.68),
      sellingPriceOverride: index === 4 ? product.sellingPrice + 150 : null,
      expiryDate: index % 3 === 1 ? null : dateOnly(shiftedIso(now, expiresIn, 12)),
      receivedAt,
      isConsignment: vendor.type === 'consignment',
    })
    batchNumber += 1

    if (index % 5 === 1) {
      const olderReceivedAt = shiftedIso(now, -(42 + index), 9, 30)
      batches.push({
        id: `batch-${batchNumber}`,
        reference: `IN-${receiptDate(olderReceivedAt)}-${String(batchNumber).padStart(3, '0')}`,
        intakeSessionId: `intake-${Math.floor(index / 2) + 1}`,
        productId: product.id,
        vendorId: vendor.id,
        qtyReceived: 18,
        qtyRemaining: 4,
        costPerUnit: Math.round(product.sellingPrice * 0.64),
        sellingPriceOverride: null,
        expiryDate: dateOnly(shiftedIso(now, 32 + index, 12)),
        receivedAt: olderReceivedAt,
        isConsignment: vendor.type === 'consignment',
      })
      batchNumber += 1
    }
  })

  return batches
}

function buildSales(now: Date, products: DemoProduct[], batches: DemoBatch[]): DemoSale[] {
  const payments: DemoPaymentMethod[] = ['cash', 'pos', 'transfer']
  const cashiers = ['Store Owner', 'Ada — Cashier', 'Musa — Cashier']

  return Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index === 0 ? 0 : -Math.floor(index / 3)
    const createdAt = shiftedIso(now, dayOffset, 8 + ((index * 3) % 13), (index * 11) % 60)
    const itemCount = 1 + (index % 3)
    const items = Array.from({ length: itemCount }, (_, itemIndex) => {
      const product = products[(index * 3 + itemIndex * 5) % products.length]
      const quantity = 1 + ((index + itemIndex) % 3)
      const batch = batches.find((candidate) => candidate.productId === product.id)
      return {
        id: `sale-item-${index + 1}-${itemIndex + 1}`,
        productId: product.id,
        batchId: product.trackInventory ? batch?.id ?? null : null,
        quantity,
        unitPrice: product.sellingPrice,
        lineTotal: product.sellingPrice * quantity,
      }
    })
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0)
    const paymentMethod = payments[index % payments.length]

    return {
      id: `sale-${index + 1}`,
      receiptNumber: `SS-${receiptDate(createdAt)}-${String(index + 1).padStart(4, '0')}`,
      cashierName: cashiers[index % cashiers.length],
      paymentMethod,
      totalAmount,
      amountPaid: totalAmount,
      changeGiven: 0,
      createdAt,
      items,
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createDemoData(now = new Date()): DemoData {
  const products = buildProducts()
  const batches = buildBatches(now, products)

  return {
    generatedAt: now.toISOString(),
    store: {
      id: 'store-demo',
      name: 'Sunrise Neighbourhood Store',
      address: '18 Market View Road, Lagos',
      phone: '0800 000 2026',
      currency: 'NGN',
    },
    categories,
    vendors,
    products,
    batches,
    sales: buildSales(now, products, batches),
  }
}

