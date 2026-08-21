'use client'

import { useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import Nav from '@/app/landing/nav'
import Hero from '@/app/landing/hero'
import Pain from '@/app/landing/pain'
import BuiltFor from '@/app/landing/built-for'
import Features from '@/app/landing/features'
import ProductPeek from '@/app/landing/product-peek'
import HowItWorks from '@/app/landing/how-it-works'
import Cta from '@/app/landing/cta'
import Footer from '@/app/landing/footer'

export default function RootPage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    isTauri().then(setIsDesktop)
  }, [])

  // Still detecting — show nothing to avoid flash
  if (isDesktop === null) {
    return null
  }

  // Desktop: redirect to dashboard
  if (isDesktop) {
    window.location.href = '/dashboard'
    return null
  }

  // Web: show marketing page
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
