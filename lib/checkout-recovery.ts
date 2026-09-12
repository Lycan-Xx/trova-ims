export type PendingCheckout = {
  requestId: string
  fingerprint: string
  createdAt: number
}

const PENDING_CHECKOUT_KEY = 'trova_pending_checkout'

export function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_CHECKOUT_KEY) ?? 'null') as Partial<PendingCheckout> | null
    if (
      !value || typeof value.requestId !== 'string' || value.requestId.length > 128 ||
      typeof value.fingerprint !== 'string' || typeof value.createdAt !== 'number'
    ) return null
    return { requestId: value.requestId, fingerprint: value.fingerprint, createdAt: value.createdAt }
  } catch {
    return null
  }
}

export function savePendingCheckout(checkout: PendingCheckout): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(checkout)) } catch {}
}

export function clearPendingCheckout(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(PENDING_CHECKOUT_KEY) } catch {}
}
