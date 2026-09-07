import { getStoreSettings } from '@/app/actions/settings'
import { getCurrencySymbol } from '@/lib/currency'
import { CustomerDisplayView } from '@/components/customer-display/customer-display-view'

export default async function CustomerDisplayPage() {
  const result = await getStoreSettings()
  const store = result.success ? result.data : null
  return <CustomerDisplayView storeName={store?.name ?? 'Trova IMS'} currencySymbol={getCurrencySymbol(store?.currency ?? 'NGN')} />
}
