'use client'

import * as React from 'react'
import Papa from 'papaparse'
import { Download } from 'lucide-react'
import type { VendorBatchRow } from '@/app/actions/vendors'

interface VendorCsvButtonProps {
  vendorName: string
  batches: VendorBatchRow[]
}

export function VendorCsvButton({ vendorName, batches }: VendorCsvButtonProps) {
  function handleExport() {
    const rows = batches.map((b) => ({
      Date: new Date(b.received_at).toLocaleDateString('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      'Product Name': b.product_name,
      'Batch Ref': b.batch_ref ?? '',
      'Qty Received': b.qty_received,
      'Qty Remaining': b.qty_remaining,
      'Total Cost (NGN)': parseFloat(b.total_purchase_cost).toFixed(2),
    }))

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = vendorName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    link.href = url
    link.download = `vendor-report-${safeName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (batches.length === 0) return null

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.borderColor = 'var(--accent-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <Download size={13} />
      Export CSV
    </button>
  )
}
