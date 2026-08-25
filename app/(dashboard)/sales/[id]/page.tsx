import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { getSaleById } from '@/app/actions/sales'
import { ReceiptDownloadButton } from '@/components/sales/receipt-download-button'
import { getStoreSettings } from '@/app/actions/settings'
import { getCurrencySymbol } from '@/lib/currency'

export default async function SaleConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [result, storeResult] = await Promise.all([getSaleById(id), getStoreSettings()])

  if (!result.success) redirect('/sales')

  const sale = result.data
  const currencySymbol = getCurrencySymbol(storeResult?.success ? storeResult.data.currency : 'NGN')

  const fmt = (v: string | number) =>
    `${currencySymbol}${parseFloat(String(v)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const subtotal = sale.items.reduce((s, i) => s + parseFloat(i.lineTotal), 0)

  const paymentLabel: Record<string, string> = {
    cash: 'Cash',
    transfer: 'Bank Transfer',
    pos: 'POS / Card',
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} />
          Back to Sales
        </Link>

        {/* Success header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'var(--positive-bg)' }}
          >
            <CheckCircle2 size={32} style={{ color: 'var(--positive)' }} />
          </div>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Sale Complete
          </h1>
          <p
            className="mono text-xl tracking-wider mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {sale.receipt_number}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {fmtDate(sale.created_at)}
            {sale.cashier_name && (
              <> &middot; {sale.cashier_name}</>
            )}
          </p>
        </div>

        {/* Receipt card */}
        <div
          className="rounded-xl overflow-hidden mb-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Items table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th
                  className="text-left px-5 py-3 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Product
                </th>
                <th
                  className="text-center px-3 py-3 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Qty
                </th>
                <th
                  className="text-right px-3 py-3 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Unit Price
                </th>
                <th
                  className="text-right px-5 py-3 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td
                    className="px-5 py-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.productName}
                  </td>
                  <td
                    className="text-center px-3 py-3"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {item.qtySold}
                  </td>
                  <td
                    className="text-right px-3 py-3 mono"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {fmt(item.unitPrice)}
                  </td>
                  <td
                    className="text-right px-5 py-3 mono"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {fmt(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals section */}
          <div
            className="px-5 py-4 space-y-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {sale.items.length > 1 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {fmt(subtotal)}
                </span>
              </div>
            )}

            <div
              className="flex justify-between pt-2"
              style={{ borderTop: sale.items.length > 1 ? '1px solid var(--border-subtle)' : undefined }}
            >
              <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                Total
              </span>
              <span
                className="mono font-bold text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                {fmt(sale.total_amount)}
              </span>
            </div>
          </div>

          {/* Payment details */}
          <div
            className="px-5 py-4 space-y-2 text-sm"
            style={{
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-input)',
            }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
              <span
                className="font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {paymentLabel[sale.payment_method] ?? sale.payment_method}
              </span>
            </div>
            {sale.amount_paid && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Amount Paid</span>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {fmt(sale.amount_paid)}
                </span>
              </div>
            )}
            {sale.change_given !== null && parseFloat(sale.change_given) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Change Given</span>
                <span
                  className="mono font-semibold"
                  style={{ color: 'var(--positive)' }}
                >
                  {fmt(sale.change_given)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <ReceiptDownloadButton
            sale={sale}
            storeName={storeResult.success ? storeResult.data.name : undefined}
            storeAddress={storeResult.success ? storeResult.data.address ?? undefined : undefined}
            storePhone={storeResult.success ? storeResult.data.phone ?? undefined : undefined}
          />

          <Link
            href="/sales/new"
            className="flex-1 flex items-center justify-center h-11 rounded-xl text-sm font-medium transition-colors"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              background: 'transparent',
            }}
          >
            New Sale
          </Link>
        </div>
      </div>
    </div>
  )
}
