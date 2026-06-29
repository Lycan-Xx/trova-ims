'use server'

import { query } from '@/lib/db'
import { requireStoreAccess } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface OnboardingState {
  hasStoreSetup: boolean
  hasVendor: boolean
  hasIntake: boolean
  hasSale: boolean
  isDismissed: boolean
  isComplete: boolean
}

export async function getOnboardingState(): Promise<{ success: true; data: OnboardingState } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    
    const storeRes = await query(`SELECT name, currency, onboarding_dismissed FROM stores WHERE id = $1`, [user.store_id])
    if (storeRes.rows.length === 0) throw new Error('Store not found')
    const store = storeRes.rows[0]

    const vendorsRes = await query(`SELECT COUNT(*)::int as count FROM vendors WHERE store_id = $1`, [user.store_id])
    const batchesRes = await query(`SELECT COUNT(*)::int as count FROM batches WHERE store_id = $1`, [user.store_id])
    const salesRes = await query(`SELECT COUNT(*)::int as count FROM sales WHERE store_id = $1`, [user.store_id])

    // If they changed the default name from "My Store" or if they have vendors/products, we consider store setup done
    const hasStoreSetup = store.name !== 'My Store' || vendorsRes.rows[0].count > 0 || store.currency !== 'NGN'
    const hasVendor = vendorsRes.rows[0].count > 0
    const hasIntake = batchesRes.rows[0].count > 0
    const hasSale = salesRes.rows[0].count > 0
    const isDismissed = store.onboarding_dismissed

    const isComplete = hasStoreSetup && hasVendor && hasIntake && hasSale

    return {
      success: true,
      data: {
        hasStoreSetup,
        hasVendor,
        hasIntake,
        hasSale,
        isDismissed,
        isComplete
      }
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function dismissOnboarding(wipeData: boolean): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    if (user.role !== 'owner') throw new Error('Only owners can dismiss onboarding')

    if (wipeData) {
      // Delete test data, order matters due to foreign keys
      await query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = $1)`, [user.store_id])
      await query(`DELETE FROM sales WHERE store_id = $1`, [user.store_id])
      await query(`DELETE FROM batches WHERE store_id = $1`, [user.store_id])
      await query(`DELETE FROM products WHERE store_id = $1`, [user.store_id])
      await query(`DELETE FROM categories WHERE store_id = $1`, [user.store_id])
      await query(`DELETE FROM vendors WHERE store_id = $1`, [user.store_id])
    }

    await query(`UPDATE stores SET onboarding_dismissed = true WHERE id = $1`, [user.store_id])

    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function restartOnboarding(): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireStoreAccess()
    if (user.role !== 'owner') throw new Error('Only owners can restart onboarding')

    await query(`UPDATE stores SET onboarding_dismissed = false WHERE id = $1`, [user.store_id])

    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
