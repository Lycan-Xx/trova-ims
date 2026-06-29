import Nav from './nav'
import Hero from './hero'
import Pain from './pain'
import BuiltFor from './built-for'
import Features from './features'
import ProductPeek from './product-peek'
import HowItWorks from './how-it-works'
import Cta from './cta'
import Footer from './footer'

export const metadata = {
  title: 'Trova | Know your store, always.',
  description:
    'Trova tracks every item, every batch, every unit price, from supplier intake to customer receipt. Inventory management built for retail stores.',
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
