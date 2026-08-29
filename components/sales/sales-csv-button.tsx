'use client'

import * as React from 'react'
import Papa from 'papaparse'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getRetainedSalesCsvRows } from '@/app/actions/sales'

interface SalesCsvButtonProps {
  dateFrom?: string
  dateTo?: string
  cashierId?: string
  paymentMethod?: string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function safePart(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
}

export function SalesCsvButton({
  dateFrom,
  dateTo,
  cashierId,
  paymentMethod,
}: SalesCsvButtonProps) {
  const [exporting, setExporting] = React.useState(false)

  async function handleExport() {
    if (exporting) return

    const confirmed = window.confirm(
      'CSV export includes only sales still kept on this device. Older sales are automatically removed after about 30 days, so export regularly if you need long-term records.',
    )
    if (!confirmed) return

    setExporting(true)
    try {
      const result = await getRetainedSalesCsvRows({
        dateFrom,
        dateTo,
        cashierId,
        paymentMethod,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.data.length === 0) {
        toast.info('No retained sales found for this filter.')
        return
      }

      const rows = result.data.map((sale) => ({
        Date: formatDate(sale.createdAt),
        Time: formatTime(sale.createdAt),
        'Transaction ID': sale.receiptNumber,
        Product: sale.productName,
        Quantity: sale.qtySold,
        'Unit Price': sale.unitPrice,
        Subtotal: sale.lineTotal,
        Discount: '',
        'Payment Method': sale.paymentMethod,
        Total: sale.saleTotal,
        Cashier: sale.cashierName ?? '',
      }))

      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-${safePart(dateFrom, 'retained')}-to-${safePart(dateTo, 'latest')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Sales CSV exported.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-60"
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (exporting) return
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.borderColor = 'var(--accent-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      Export CSV
    </button>
  )
}
