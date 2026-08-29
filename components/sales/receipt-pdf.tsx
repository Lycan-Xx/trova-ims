'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import { getCurrencySymbol } from '@/lib/currency'
import type { SaleDetail } from '@/app/actions/sales'

const RECEIPT_FONT = 'TrovaReceiptInter'

Font.register({
  family: RECEIPT_FONT,
  fonts: [
    { src: '/fonts/inter-400.woff2', fontWeight: 400 },
    { src: '/fonts/inter-600.woff2', fontWeight: 600 },
    { src: '/fonts/inter-700.woff2', fontWeight: 700 },
  ],
})
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: RECEIPT_FONT,
    fontSize: 7.5,
    color: '#111111',
    paddingTop: 12,
    paddingRight: 11,
    paddingBottom: 14,
    paddingLeft: 11,
    backgroundColor: '#ffffff',
  },
  // Header
  storeName: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 700,
    fontSize: 10.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  storeInfo: {
    fontSize: 6.8,
    textAlign: 'center',
    color: '#555555',
    marginBottom: 2,
  },
  // Divider
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    marginVertical: 8,
  },
  hrThick: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#111111',
    marginVertical: 8,
  },
  // Receipt meta
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  metaLabel: {
    color: '#555555',
  },
  metaValue: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 600,
  },
  receiptLabel: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 700,
    fontSize: 8.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  receiptNumber: {
    fontFamily: RECEIPT_FONT,
    fontSize: 7.5,
    textAlign: 'center',
    color: '#333333',
    marginBottom: 4,
  },
  // Items table
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 700,
    fontSize: 7,
    color: '#333333',
  },
  itemBlock: {
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  itemName: {
    fontSize: 7.4,
    marginBottom: 2,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemQtyPrice: {
    fontSize: 7,
    color: '#555555',
  },
  itemAmount: {
    fontSize: 7.2,
    fontWeight: 600,
    textAlign: 'right',
    minWidth: 58,
  },
  // Totals
  totalSection: {
    marginTop: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    color: '#555555',
  },
  totalValue: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 600,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#111111',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 700,
    fontSize: 9.5,
  },
  grandTotalValue: {
    fontFamily: RECEIPT_FONT,
    fontWeight: 700,
    fontSize: 9.5,
  },
  // Footer
  footer: {
    marginTop: 16,
    textAlign: 'center',
    color: '#777777',
    fontSize: 6.8,
  },
  paymentBadge: {
    marginTop: 8,
    padding: '4 8',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    alignSelf: 'flex-start',
    fontSize: 7,
    color: '#444444',
  },
})

// Create dynamic fmt function that uses currency symbol
function createFmtFunction(currencyCode: string) {
  const symbol = getCurrencySymbol(currencyCode)
  return (v: string | number) =>
    `${symbol}${parseFloat(String(v)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function estimateReceiptHeight(sale: SaleDetail, storeAddress: string, storePhone: string): number {
  const base = 166
  const storeLines = (storeAddress ? 8 : 0) + (storePhone ? 8 : 0)
  const itemLines = sale.items.reduce((sum, item) => {
    const nameLines = Math.max(1, Math.ceil(item.productName.length / 24))
    return sum + 15 + nameLines * 8
  }, 0)
  const paymentLines = sale.payment_method === 'cash' ? 28 : 14
  return Math.max(220, base + storeLines + itemLines + paymentLines)
}

interface ReceiptPDFProps {
  sale: SaleDetail
  storeName?: string
  storeAddress?: string
  storePhone?: string
  currency?: string
}

export function ReceiptPDF({
  sale,
  storeName = 'My Store',
  storeAddress = '',
  storePhone = '',
  currency = 'NGN',
}: ReceiptPDFProps) {
  const fmt = createFmtFunction(currency)
  const subtotal = sale.items.reduce((s, i) => s + parseFloat(i.lineTotal), 0)
  const pageHeight = estimateReceiptHeight(sale, storeAddress, storePhone)

  return (
    <Document>
      <Page size={[164.4, pageHeight]} style={styles.page}>
        {/* Store header */}
        <Text style={styles.storeName}>{storeName}</Text>
        {storeAddress ? <Text style={styles.storeInfo}>{storeAddress}</Text> : null}
        {storePhone ? <Text style={styles.storeInfo}>Tel: {storePhone}</Text> : null}

        <View style={styles.hr} />

        {/* Receipt meta */}
        <Text style={styles.receiptLabel}>RECEIPT</Text>
        <Text style={styles.receiptNumber}>{sale.receipt_number}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text>{fmtDate(sale.created_at)}</Text>
        </View>
        {sale.cashier_name ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Served by</Text>
            <Text>{sale.cashier_name}</Text>
          </View>
        ) : null}

        <View style={styles.hrThick} />

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>ITEMS</Text>
        </View>

        {sale.items.map((item, i) => (
          <View key={i} style={styles.itemBlock}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <View style={styles.itemDetailRow}>
              <Text style={styles.itemQtyPrice} wrap={false}>
                {item.qtySold} x {fmt(item.unitPrice)}
              </Text>
              <Text style={styles.itemAmount} wrap={false}>
                {fmt(item.lineTotal)}
              </Text>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalSection}>
          {sale.items.length > 1 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text wrap={false}>{fmt(subtotal)}</Text>
            </View>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue} wrap={false}>{fmt(sale.total_amount)}</Text>
          </View>

          {sale.payment_method === 'cash' && sale.amount_paid ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Cash Received</Text>
                <Text wrap={false}>{fmt(sale.amount_paid)}</Text>
              </View>
              {sale.change_given !== null && parseFloat(sale.change_given) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Change</Text>
                  <Text style={styles.totalValue} wrap={false}>{fmt(sale.change_given)}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Payment method */}
        <Text style={styles.paymentBadge}>
          Payment: {sale.payment_method.toUpperCase()}
        </Text>

        <View style={styles.hr} />

        <Text style={styles.footer}>Thank you for shopping with us!</Text>
      </Page>
    </Document>
  )
}
