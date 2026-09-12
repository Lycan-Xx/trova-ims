export type DemoView =
  | 'dashboard'
  | 'products'
  | 'vendors'
  | 'intake'
  | 'sales'
  | 'alerts'
  | 'analytics'
  | 'settings'

export type DemoPaymentMethod = 'cash' | 'pos' | 'transfer'

export interface DemoStore {
  id: string
  name: string
  address: string
  phone: string
  currency: string
}

export interface DemoCategory {
  id: string
  name: string
}

export interface DemoVendor {
  id: string
  name: string
  contact: string
  phone: string
  type: 'direct' | 'consignment'
  isActive: boolean
}

export interface DemoProduct {
  id: string
  categoryId: string
  sku: string
  name: string
  description: string
  barcode: string
  unit: string
  sellingPrice: number
  reorderLevel: number
  trackInventory: boolean
  isActive: boolean
}

export interface DemoBatch {
  id: string
  reference: string
  intakeSessionId: string
  productId: string
  vendorId: string
  qtyReceived: number
  qtyRemaining: number
  costPerUnit: number
  sellingPriceOverride: number | null
  expiryDate: string | null
  receivedAt: string
  isConsignment: boolean
}

export interface DemoSaleItem {
  id: string
  productId: string
  batchId: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface DemoSale {
  id: string
  receiptNumber: string
  cashierName: string
  paymentMethod: DemoPaymentMethod
  totalAmount: number
  amountPaid: number
  changeGiven: number
  createdAt: string
  items: DemoSaleItem[]
}

export interface DemoData {
  generatedAt: string
  store: DemoStore
  categories: DemoCategory[]
  vendors: DemoVendor[]
  products: DemoProduct[]
  batches: DemoBatch[]
  sales: DemoSale[]
}

export interface DemoProductWithStock extends DemoProduct {
  categoryName: string
  stock: number | null
}

export interface DemoIntakeSession {
  id: string
  reference: string
  vendorName: string
  receivedAt: string
  itemCount: number
  totalUnits: number
  totalCost: number
  isConsignment: boolean
  batches: DemoBatch[]
}

export interface DemoDailySales {
  date: string
  revenue: number
  transactionCount: number
  itemsSold: number
}

export interface DemoProductPerformance {
  productId: string
  productName: string
  quantity: number
  revenue: number
}

