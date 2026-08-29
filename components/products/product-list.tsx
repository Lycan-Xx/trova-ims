'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MoreHorizontal, Search, ChevronLeft, ChevronRight, PackageX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProductSlideOver } from '@/components/products/product-slide-over'
import { useCurrency } from '@/lib/currency-context'
import { formatCurrency } from '@/lib/currency'
import { deactivateProduct, deleteProduct } from '@/app/actions/products'
import { toast } from 'sonner'
import type { ProductWithStock } from '@/app/actions/products'
import type { Category } from '@/lib/db/schema'

interface ProductListProps {
  products: ProductWithStock[]
  categories: Category[]
  totalPages: number
  currentPage: number
  totalCount: number
}

function getStockBadge(product: ProductWithStock) {
  if (!product.track_inventory) return <Badge variant="default">Not Tracked</Badge>
  const stock = product.current_stock
  const reorderLevel = product.reorder_level
  if (stock === 0) return <Badge variant="danger">Out of Stock</Badge>
  if (stock <= reorderLevel) return <Badge variant="warning">Low Stock</Badge>
  return <Badge variant="success">In Stock</Badge>
}

export function ProductList({
  products,
  categories,
  totalPages,
  currentPage,
  totalCount,
}: ProductListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { currency } = useCurrency()

  // Slide-over state
  const [slideOverOpen, setSlideOverOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<ProductWithStock | null>(null)

  function openAdd() {
    setEditingProduct(null)
    setSlideOverOpen(true)
  }

  async function handleDelete(product: ProductWithStock) {
    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nThis is permanent. If this product has any stock intake records it cannot be deleted — deactivate it instead to hide it from the catalog.`,
    )
    if (!confirmed) return
    const result = await deleteProduct(product.id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(`${product.name} deleted.`)
    router.refresh()
  }

  function openEdit(product: ProductWithStock) {
    setEditingProduct(product)
    setSlideOverOpen(true)
  }

  // Debounce ref
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '' || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // Reset to page 1 on filter change
    if (key !== 'page') params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParam('search', e.target.value)
    }, 300)
  }

  function handlePage(next: number) {
    updateParam('page', String(next))
  }

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * 20 + 1
  const rangeEnd = Math.min(currentPage * 20, totalCount)

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name or SKU…"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={handleSearch}
            className="w-full h-9 rounded-lg pl-9 pr-3 text-sm bg-bg-input border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
          />
        </div>

        {/* Category filter */}
        <Select
          defaultValue={searchParams.get('categoryId') ?? 'all'}
          onValueChange={(val) => updateParam('categoryId', val)}
        >
          <SelectTrigger className="w-[180px] h-9 bg-bg-input border-border text-text-secondary text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-bg-card border-border">
            <SelectItem value="all" className="text-text-secondary">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id} className="text-text-primary">
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stock status filter */}
        <Select
          defaultValue={searchParams.get('stockStatus') ?? 'all'}
          onValueChange={(val) => updateParam('stockStatus', val)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-bg-input border-border text-text-secondary text-sm">
            <SelectValue placeholder="All Stock" />
          </SelectTrigger>
          <SelectContent className="bg-bg-card border-border">
            <SelectItem value="all" className="text-text-secondary">All Stock</SelectItem>
            <SelectItem value="low" className="text-warning">Low Stock</SelectItem>
            <SelectItem value="out" className="text-danger">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        {/* Add product */}
        <Button
          className="ml-auto h-9 rounded-lg px-4 text-sm font-medium text-white"
          style={{ background: 'var(--accent-primary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
          onClick={openAdd}
        >
          + Add Product
        </Button>
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 rounded-xl border border-border bg-bg-card">
          <PackageX size={40} className="text-text-muted" />
          <p className="text-text-secondary text-sm">No products yet</p>
          <Button
            className="h-9 rounded-lg px-4 text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
            onClick={openAdd}
          >
            Add your first product
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {['SKU', 'Product Name', 'Category', 'Selling Price', 'Stock', 'Status', ''].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-text-muted"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-border transition-colors"
                  style={{ background: 'var(--bg-card)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-card-hover)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-card)')
                  }
                >
                  {/* SKU */}
                  <td className="px-4 py-3">
                    <span className="mono text-[12px] text-text-muted">{product.sku}</span>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-primary font-medium">{product.name}</span>
                    {product.description && (
                      <p className="text-[11px] text-text-muted truncate max-w-[200px] mt-0.5">
                        {product.description}
                      </p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-secondary">
                      {product.category_name ?? '—'}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-text-primary font-medium">
                      {formatCurrency(product.selling_price, currency)}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    {product.track_inventory ? (
                      <>
                        <span className="text-sm text-text-primary">{product.current_stock}</span>
                        <span className="text-[11px] text-text-muted ml-1">
                          {product.unit}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-text-muted">Not tracked</span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    {getStockBadge(product)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors">
                        <MoreHorizontal size={15} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-bg-card border-border text-text-primary text-sm"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer hover:bg-bg-input focus:bg-bg-input"
                          onClick={() => openEdit(product)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer hover:bg-bg-input focus:bg-bg-input"
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-danger hover:bg-bg-input focus:bg-bg-input"
                          onClick={() => handleDelete(product)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] text-text-muted">
            Showing {rangeStart}–{rangeEnd} of {totalCount} product{totalCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePage(currentPage - 1)}
              className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary hover:bg-bg-input disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="text-[13px] text-text-secondary min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePage(currentPage + 1)}
              className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary hover:bg-bg-input disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Slide-over panel */}
      <ProductSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        categories={categories}
        product={editingProduct}
      />
    </div>
  )
}
