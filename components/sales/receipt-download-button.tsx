'use client'

import * as React from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { useCurrency } from '@/lib/currency-context'
import type { SaleDetail } from '@/app/actions/sales'
import type { JSXElementConstructor, ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

interface ReceiptDownloadButtonProps {
  sale: SaleDetail
  storeName?: string
  storeAddress?: string
  storePhone?: string
}

export function ReceiptDownloadButton({
  sale,
  storeName,
  storeAddress,
  storePhone,
}: ReceiptDownloadButtonProps) {
  const { currency } = useCurrency()
  const [loading, setLoading] = React.useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)

    try {
      // Dynamic import to avoid SSR — @react-pdf/renderer is client-only
      const { pdf } = await import('@react-pdf/renderer')
      const { ReceiptPDF } = await import('@/components/sales/receipt-pdf')
      const React = (await import('react')).default

      const element = React.createElement(ReceiptPDF, {
        sale,
        storeName,
        storeAddress,
        storePhone,
        currency,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(element as ReactElement<DocumentProps, JSXElementConstructor<any>>).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${sale.receipt_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[v0] PDF generation error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: loading ? 'var(--accent-primary-muted)' : 'var(--accent-primary)',
        color: '#ffffff',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.background = 'var(--accent-primary-hover)'
      }}
      onMouseLeave={(e) => {
        if (!loading) e.currentTarget.style.background = 'var(--accent-primary)'
      }}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileDown size={16} />
          Download Receipt (PDF)
        </>
      )}
    </button>
  )
}
