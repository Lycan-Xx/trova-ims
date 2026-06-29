import { getProducts, getCategories } from '@/app/actions/products'
import { ProductList } from '@/components/products/product-list'
import type { GetProductsFilters } from '@/app/actions/products'

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string
    categoryId?: string
    stockStatus?: string
    page?: string
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams

  const filters: GetProductsFilters = {
    search: params.search,
    categoryId: params.categoryId,
    stockStatus: (params.stockStatus as GetProductsFilters['stockStatus']) ?? 'all',
    page: params.page ? parseInt(params.page, 10) : 1,
  }

  const [productsResult, categoriesResult] = await Promise.all([
    getProducts(filters),
    getCategories(),
  ])

  const products = productsResult.success ? productsResult.data.products : []
  const totalPages = productsResult.success ? productsResult.data.totalPages : 1
  const currentPage = productsResult.success ? productsResult.data.currentPage : 1
  const totalCount = productsResult.success ? productsResult.data.totalCount : 0
  const categories = categoriesResult.success ? categoriesResult.data : []

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Products</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage your product catalog and inventory
          </p>
        </div>
      </div>

      <ProductList
        products={products}
        categories={categories}
        totalPages={totalPages}
        currentPage={currentPage}
        totalCount={totalCount}
      />
    </div>
  )
}
