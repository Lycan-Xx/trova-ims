'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { SaleDetail } from '@/app/actions/sales'

// Register Helvetica as the base font (built into PDF spec, no download needed)
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111111',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  // Header
  storeName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  storeInfo: {
    fontSize: 8,
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
    fontFamily: 'Helvetica-Bold',
  },
  receiptLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 2,
  },
  receiptNumber: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    textAlign: 'right',
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
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#333333',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  colName: {
    flex: 3,
  },
  colQty: {
    flex: 1,
    textAlign: 'center',
  },
  colAmount: {
    flex: 1.5,
    textAlign: 'right',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  // Footer
  footer: {
    marginTop: 16,
    textAlign: 'center',
    color: '#777777',
    fontSize: 8,
    fontStyle: 'italic',
  },
  paymentBadge: {
    marginTop: 8,
    padding: '4 8',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    alignSelf: 'flex-start',
    fontSize: 8,
    color: '#444444',
  },
})

const fmt = (v: string | number) =>
  `₦${parseFloat(String(v)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`

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

interface ReceiptPDFProps {
  sale: SaleDetail
  storeName?: string
  storeAddress?: string
  storePhone?: string
}

export function ReceiptPDF({
  sale,
  storeName = 'My Store',
  storeAddress = '',
  storePhone = '',
}: ReceiptPDFProps) {
  const subtotal = sale.items.reduce((s, i) => s + parseFloat(i.lineTotal), 0)

  return (
    <Document>
      <Page size="A5" style={styles.page}>
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
          <Text style={[styles.tableHeaderText, styles.colName]}>ITEM</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>QTY</Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>AMOUNT</Text>
        </View>

        {sale.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colName}>{item.productName}</Text>
            <Text style={styles.colQty}>{item.qtySold}</Text>
            <Text style={styles.colAmount}>{fmt(item.lineTotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalSection}>
          {sale.items.length > 1 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text>{fmt(subtotal)}</Text>
            </View>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{fmt(sale.total_amount)}</Text>
          </View>

          {sale.payment_method === 'cash' && sale.amount_paid ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Cash Received</Text>
                <Text>{fmt(sale.amount_paid)}</Text>
              </View>
              {sale.change_given !== null && parseFloat(sale.change_given) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Change</Text>
                  <Text style={styles.totalValue}>{fmt(sale.change_given)}</Text>
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
