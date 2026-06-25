// ============================================================
// TypeScript types mirroring the database schema
// ============================================================

export type UserRole = 'owner' | 'storekeeper' | 'cashier'
export type VendorType = 'direct' | 'consignment'
export type UnitType = 'piece' | 'pack' | 'kg' | 'litre' | 'carton' | 'dozen' | 'bag'

export interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
}

export interface User {
  id: string
  auth_id: string        // Better Auth user.id (replaces clerk_id)
  store_id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  store_id: string
  name: string
  created_at: string
}

export interface Vendor {
  id: string
  store_id: string
  name: string
  contact: string | null
  address: string | null
  type: VendorType
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  store_id: string
  category_id: string | null
  sku: string
  name: string
  description: string | null
  unit: UnitType
  selling_price: string   // DECIMAL comes back as string from pg
  reorder_level: number
  is_active: boolean
  created_at: string
}

export interface Batch {
  id: string
  store_id: string
  product_id: string
  vendor_id: string | null
  batch_ref: string | null
  qty_received: number
  qty_remaining: number
  pack_size: number
  total_purchase_cost: string
  cost_per_unit: string
  selling_price_override: string | null
  expiry_date: string | null
  is_consignment: boolean
  notes: string | null
  received_at: string
  received_by_id: string | null
}

export interface Sale {
  id: string
  store_id: string
  receipt_number: string
  cashier_id: string | null
  total_amount: string
  amount_paid: string | null
  change_given: string | null
  payment_method: string
  notes: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  batch_id: string
  qty_sold: number
  unit_price: string
  line_total: string
}
