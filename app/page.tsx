'use client'

import { useEffect, useState } from 'react'
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
  // Landing page for web browsers. Server-side routing now owns the
  // desktop redirect when DESKTOP_MODE=true, so the client no longer
  // attempts to detect Tauri and perform a client-side redirect.

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
