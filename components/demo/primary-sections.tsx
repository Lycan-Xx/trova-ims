'use client'

import { useState } from 'react'
import { AlertTriangle, BarChart3, Eye, Package, ReceiptText, ShoppingCart, TrendingUp, X } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { dailySales, expiringBatches, grossProfitEstimate, lowStockProducts, productPerformance, productsWithStock, salesSummary, todaySales } from '@/lib/demo/selectors'
import type { DemoData, DemoProductWithStock, DemoSale } from '@/lib/demo/types'
import { DemoActionButton, DemoBadge, DemoCard, DemoPageHeader, DemoSearch, DemoSelect, DemoStatCard } from './demo-ui'

const money = (value: number) => formatCurrency(value, 'NGN')
const when = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function DashboardPreview({ data, onAction, onNavigate }: { data: DemoData; onAction: (value: string) => void; onNavigate: (value: string) => void }) {
  const summary = salesSummary(todaySales(data))
  const low = lowStockProducts(data)
  const expiry = expiringBatches(data)
  const week = dailySales(data)
  const max = Math.max(...week.map((day) => day.revenue), 1)
  return <>
    <DemoPageHeader eyebrow="Store overview" title="Good morning, Store Owner" description={'Here is what is happening at ' + data.store.name + ' today.'} action={<DemoActionButton onClick={() => onAction('Record a new sale')} icon={ShoppingCart}>New Sale</DemoActionButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DemoStatCard label="Today's revenue" value={money(summary.revenue)} detail={summary.transactions + ' completed transactions'} icon={TrendingUp} tone="green" />
      <DemoStatCard label="Items sold" value={String(summary.itemsSold)} detail="Across all payments" icon={ShoppingCart} />
      <DemoStatCard label="Low stock" value={String(low.length)} detail="Tracked products need attention" icon={Package} tone="yellow" />
      <DemoStatCard label="Expiry alerts" value={String(expiry.length)} detail="Due within 30 days" icon={AlertTriangle} tone="teal" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <DemoCard title="Revenue — last 7 days" description="Calculated from the receipts shown in Sales."><div className="flex h-64 items-end gap-3 px-5 pb-5 pt-8">{week.map((day) => <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-2 text-center"><span className="text-[10px] text-text-muted">{day.transactionCount}</span><div title={money(day.revenue)} className="mx-auto w-full max-w-12 rounded-t bg-accent-primary" style={{ height: Math.max(8, day.revenue / max * 170) }} /><span className="text-[10px] text-text-secondary">{new Intl.DateTimeFormat('en-NG', { weekday: 'short' }).format(new Date(day.date))}</span></div>)}</div></DemoCard>
      <DemoCard title="Recent sales" action={<button onClick={() => onNavigate('sales')} className="text-xs font-semibold text-accent-primary">View all</button>}><div className="divide-y divide-border-subtle">{data.sales.slice(0, 5).map((sale) => <button key={sale.id} onClick={() => onNavigate('sales')} className="flex w-full justify-between gap-3 px-4 py-3 text-left hover:bg-bg-card-hover"><span><span className="mono block text-xs text-white">{sale.receiptNumber}</span><span className="text-[11px] text-text-muted">{sale.cashierName}</span></span><strong className="text-sm">{money(sale.totalAmount)}</strong></button>)}</div></DemoCard>
    </div>
  </>
}

export function ProductsPreview({ data, onAction }: { data: DemoData; onAction: (value: string) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState<DemoProductWithStock | null>(null)
  const products = productsWithStock(data).filter((p) => (category === 'all' || p.categoryId === category) && (p.name + p.sku).toLowerCase().includes(search.toLowerCase()))
  return <>
    <DemoPageHeader eyebrow="Inventory catalogue" title="Products" description={data.products.length + ' fictional products, including tracked goods and untracked services.'} action={<DemoActionButton onClick={() => onAction('Create products')} icon={Package}>Add Product</DemoActionButton>} />
    <DemoCard><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row"><DemoSearch value={search} onChange={setSearch} placeholder="Search products or SKU" /><DemoSelect label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-bg-nav text-[11px] uppercase text-text-muted"><tr><th className="px-4 py-3">Product</th><th>Category</th><th>Stock</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody className="divide-y divide-border-subtle">{products.map((p) => <tr key={p.id} className="hover:bg-bg-card-hover"><td className="px-4 py-3"><strong className="block text-white">{p.name}</strong><span className="mono text-[11px] text-text-muted">{p.sku}</span></td><td className="text-text-secondary">{p.categoryName}</td><td>{p.stock === null ? <DemoBadge tone="teal">Untracked</DemoBadge> : <span className={p.stock <= p.reorderLevel ? 'text-warning' : 'text-text-secondary'}>{p.stock} {p.unit}</span>}</td><td className="font-semibold">{money(p.sellingPrice)}</td><td><DemoBadge tone={p.isActive ? 'positive' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</DemoBadge></td><td><button onClick={() => setSelected(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-primary"><Eye size={14} /> View</button></td></tr>)}</tbody></table></div>
      <div className="border-t border-border-subtle px-4 py-3 text-xs text-text-muted">{products.length} matching products</div>
    </DemoCard>
    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6"><div className="flex justify-between"><DemoBadge tone={selected.trackInventory ? 'orange' : 'teal'}>{selected.trackInventory ? 'Stock tracked' : 'Untracked item'}</DemoBadge><button aria-label="Close" onClick={() => setSelected(null)}><X size={18} /></button></div><h2 className="mt-5 text-xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-text-secondary">{selected.description}</p><div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-bg-nav p-4 text-sm"><span>SKU<br/><b className="mono text-white">{selected.sku}</b></span><span>Price<br/><b>{money(selected.sellingPrice)}</b></span><span>Stock<br/><b>{selected.stock === null ? 'Not tracked' : selected.stock + ' ' + selected.unit}</b></span><span>Reorder level<br/><b>{selected.trackInventory ? selected.reorderLevel : 'N/A'}</b></span></div><div className="mt-5 flex gap-3"><DemoActionButton onClick={() => onAction('Edit products')}>Edit</DemoActionButton><DemoActionButton variant="secondary" onClick={() => onAction('Record stock intake')}>Add stock</DemoActionButton></div></div></div>}
  </>
}

export function SalesPreview({ data, onAction }: { data: DemoData; onAction: (value: string) => void }) {
  const [search, setSearch] = useState('')
  const [payment, setPayment] = useState('all')
  const [selected, setSelected] = useState<DemoSale | null>(null)
  const sales = data.sales.filter((s) => (payment === 'all' || s.paymentMethod === payment) && s.receiptNumber.toLowerCase().includes(search.toLowerCase()))
  const summary = salesSummary(sales)
  return <>
    <DemoPageHeader eyebrow="Completed transactions" title="Sales history" description="Inspect fictional receipts and verify every headline total against its transactions." action={<DemoActionButton onClick={() => onAction('Record a new sale')} icon={ShoppingCart}>New Sale</DemoActionButton>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><DemoStatCard label="Revenue shown" value={money(summary.revenue)} detail="Current filters" icon={TrendingUp} tone="green" /><DemoStatCard label="Transactions" value={String(summary.transactions)} detail="Completed receipts" icon={ReceiptText} /><DemoStatCard label="Items sold" value={String(summary.itemsSold)} detail="Total units" icon={ShoppingCart} tone="teal" /></div>
    <DemoCard><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row"><DemoSearch value={search} onChange={setSearch} placeholder="Search receipt number" /><DemoSelect label="Payment" value={payment} onChange={setPayment} options={[{value:'all',label:'All payments'},{value:'cash',label:'Cash'},{value:'pos',label:'POS'},{value:'transfer',label:'Transfer'}]} /></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-bg-nav text-[11px] uppercase text-text-muted"><tr><th className="px-4 py-3">Receipt</th><th>Date & time</th><th>Items</th><th>Total</th><th>Payment</th><th>Cashier</th><th></th></tr></thead><tbody className="divide-y divide-border-subtle">{sales.map((s) => <tr key={s.id} className="hover:bg-bg-card-hover"><td className="mono px-4 py-3 text-xs">{s.receiptNumber}</td><td className="text-text-secondary">{when(s.createdAt)}</td><td>{s.items.reduce((n,i)=>n+i.quantity,0)}</td><td className="font-semibold">{money(s.totalAmount)}</td><td><DemoBadge tone={s.paymentMethod === 'cash' ? 'positive' : 'orange'}>{s.paymentMethod.toUpperCase()}</DemoBadge></td><td className="text-text-secondary">{s.cashierName}</td><td><button onClick={() => setSelected(s)} className="text-xs font-semibold text-accent-primary">View receipt</button></td></tr>)}</tbody></table></div></DemoCard>
    {selected && <ReceiptPreview sale={selected} data={data} onClose={() => setSelected(null)} onAction={onAction} />}
  </>
}

function ReceiptPreview({ sale, data, onClose, onAction }: { sale: DemoSale; data: DemoData; onClose: () => void; onAction: (value: string) => void }) {
  const names = new Map(data.products.map((p) => [p.id, p.name]))
  return <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/75 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div role="dialog" aria-modal="true" className="my-5 w-full max-w-lg rounded-2xl border border-border bg-bg-card p-5"><div className="flex justify-between"><div><p className="text-xs uppercase text-text-muted">Sample receipt</p><h2 className="mono mt-1 text-lg font-bold">{sale.receiptNumber}</h2></div><button aria-label="Close receipt" onClick={onClose}><X size={18}/></button></div><div className="mt-5 text-center"><b>{data.store.name}</b><p className="text-xs text-text-muted">{when(sale.createdAt)}</p></div><div className="my-5 divide-y divide-dashed divide-border border-y border-dashed border-border">{sale.items.map((i)=><div key={i.id} className="flex justify-between py-3 text-sm text-text-secondary"><span>{i.quantity} × {names.get(i.productId)}</span><b className="text-white">{money(i.lineTotal)}</b></div>)}</div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(sale.totalAmount)}</span></div><div className="mt-5 flex gap-2"><DemoActionButton onClick={() => onAction('Download receipts')}>Download PDF</DemoActionButton><DemoActionButton variant="danger" onClick={() => onAction('Delete sales safely')}>Delete sale</DemoActionButton></div></div></div>
}

export function AnalyticsPreview({ data }: { data: DemoData }) {
  const [range, setRange] = useState('14')
  const cutoff = new Date(data.generatedAt).getTime() - Number(range) * 86400000
  const subset = { ...data, sales: data.sales.filter((s) => new Date(s.createdAt).getTime() >= cutoff) }
  const summary = salesSummary(subset.sales)
  const top = productPerformance(subset).slice(0, 6)
  const max = Math.max(...top.map((p) => p.revenue), 1)
  return <>
    <DemoPageHeader eyebrow="Performance insights" title="Analytics" description="Revenue, estimated margin, and product performance derived from completed sample receipts." action={<DemoSelect label="Range" value={range} onChange={setRange} options={[{value:'7',label:'Last 7 days'},{value:'14',label:'Last 14 days'},{value:'30',label:'Last 30 days'}]} />} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DemoStatCard label="Revenue" value={money(summary.revenue)} detail={'Last '+range+' days'} icon={TrendingUp} tone="green"/><DemoStatCard label="Transactions" value={String(summary.transactions)} detail="Completed sales" icon={ReceiptText}/><DemoStatCard label="Estimated gross profit" value={money(grossProfitEstimate(subset))} detail="Revenue less estimated cost" icon={BarChart3} tone="teal"/><DemoStatCard label="Average transaction value" value={money(summary.averageTransaction)} detail="Average revenue per completed transaction" icon={ShoppingCart}/></div>
    <DemoCard title="Top products by revenue" description="Performance for the selected period" className="mt-5"><div className="space-y-4 p-5">{top.map((p,i)=><div key={p.productId}><div className="mb-2 flex justify-between text-xs"><span className="text-text-secondary">{i+1}. {p.productName}</span><b>{money(p.revenue)}</b></div><div className="h-2 rounded-full bg-bg-input"><div className="h-full rounded-full bg-accent-primary" style={{width:p.revenue/max*100+'%'}}/></div></div>)}</div></DemoCard>
  </>
}
