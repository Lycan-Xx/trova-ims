import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DemoApp, DemoLoading } from '@/components/demo/demo-app'

export const metadata: Metadata = {
  title: 'Interactive Preview | Trova',
  description: 'Explore Trova inventory management with fictional sample data. No account or setup required.',
}

export default function DemoPage() {
  return <Suspense fallback={<DemoLoading />}><DemoApp /></Suspense>
}

