import { redirect } from 'next/navigation'
import Nav from '@/app/landing/nav'
import Hero from '@/app/landing/hero'
import Pain from '@/app/landing/pain'
import BuiltFor from '@/app/landing/built-for'
import Features from '@/app/landing/features'
import ProductPeek from '@/app/landing/product-peek'
import HowItWorks from '@/app/landing/how-it-works'
import Cta from '@/app/landing/cta'
import Footer from '@/app/landing/footer'

export const metadata = {
  title: 'Trova | Know your store, always.',
  description:
    'Trova tracks every item, every batch, every naira from supplier intake to customer receipt. Inventory management built for retail stores.',
}

export default function RootPage() {
  // In DESKTOP_MODE there is no marketing page — the app is already
  // installed. Send the user straight to the dashboard.
  if (process.env.DESKTOP_MODE === 'true') {
    redirect('/dashboard')
  }

  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Nav />
      <main>
        <Hero />
        <Pain />
        <BuiltFor />
        <Features />
        <ProductPeek />
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
