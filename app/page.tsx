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
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    // Method 1: Check for Tauri global object
    const isTauriAvailable = typeof window !== 'undefined' && 
      (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || 
       typeof (window as any).__TAURI__ !== 'undefined')
    
    if (isTauriAvailable) {
      // Tauri is available, redirect to dashboard
      setIsDesktop(true)
    } else {
      // Tauri is not available (web browser)
      setIsDesktop(false)
    }
  }, [])

  // Handle the redirect when we confirm it's desktop
  useEffect(() => {
    if (isDesktop === true) {
      window.location.href = '/dashboard'
    }
  }, [isDesktop])

  // Still detecting — show nothing to avoid flash
  if (isDesktop === null) {
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
