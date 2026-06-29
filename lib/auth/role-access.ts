import type { UserRole } from '@/lib/db/schema'

export type PageFeature = 
  | '/dashboard'
  | '/products'
  | '/vendors'
  | '/intake'
  | '/sales'
  | '/alerts'
  | '/analytics'
  | '/settings'

export const ROLE_ACCESS: Record<UserRole, PageFeature[]> = {
  owner: ['/dashboard', '/products', '/vendors', '/intake', '/sales', '/alerts', '/analytics', '/settings'],
  storekeeper: ['/dashboard', '/products', '/vendors', '/intake', '/sales', '/alerts'],
  cashier: ['/dashboard', '/products', '/sales', '/alerts'], // Dashboard has alerts only for cashier based on plan (but it is still accessible).
}

export function getAccessiblePages(role: UserRole | undefined | null): PageFeature[] {
  if (!role) return []
  return ROLE_ACCESS[role] || []
}

export function checkPageAccess(role: UserRole | undefined | null, page: PageFeature): boolean {
  if (!role) return false
  return getAccessiblePages(role).includes(page)
}
