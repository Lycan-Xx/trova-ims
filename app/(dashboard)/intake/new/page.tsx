import { getAllActiveProducts, getCategories } from '@/app/actions/products'
import { getVendors } from '@/app/actions/vendors'
import { IntakeForm } from '@/components/intake/intake-form'

interface PageProps {
  searchParams: Promise<{ productId?: string; barcode?: string }>
}

export const metadata = {
  title: 'Record Stock Intake',
}

export default async function NewIntakePage({ searchParams }: PageProps) {
  const { productId, barcode } = await searchParams

  const [productsResult, vendorsResult, categoriesResult] = await Promise.all([
    getAllActiveProducts(),
    getVendors(),
    getCategories(),
  ])

  const products = productsResult.success ? productsResult.data : []
  const vendors = vendorsResult.success ? vendorsResult.data : []
  const categories = categoriesResult.success ? categoriesResult.data : []

  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Record Stock Intake
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Log a new batch of stock received into inventory.
        </p>
      </div>

      <IntakeForm
        products={products}
        vendors={vendors}
        categories={categories}
        defaultProductId={productId}
        defaultBarcode={barcode}
      />
    </div>
  )
}
