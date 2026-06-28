import Nav from '@/components/landing/nav'
import Hero from '@/components/landing/hero'
import Pain from '@/components/landing/pain'
import BuiltFor from '@/components/landing/built-for'
import Features from '@/components/landing/features'
import ProductPeek from '@/components/landing/product-peek'
import HowItWorks from '@/components/landing/how-it-works'
import Cta from '@/components/landing/cta'
import Footer from '@/components/landing/footer'

export const metadata = {
  title: 'Trova — Know your store, always.',
  description:
    'Trova tracks every item, every batch, every naira — from supplier intake to customer receipt. Inventory management built for retail stores.',
}

export default function LandingPage() {
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
