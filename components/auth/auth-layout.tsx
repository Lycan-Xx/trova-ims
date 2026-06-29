import Image from 'next/image'
import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  description: string
}

export function AuthLayout({
  children,
  title,
  description,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="grid min-h-screen lg:grid-cols-12">
        {/* Hero */}
        <section className="relative hidden lg:block lg:col-span-8 overflow-hidden">
          <Image
            src="/images/auth-page.png"
            alt="Inventory management"
            fill
            priority
            className="object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/45 to-black/70" />

          {/* Text */}
          <div className="absolute bottom-20 left-20 max-w-xl">
            <p 
              className="text-sm font-medium uppercase tracking-wider" 
              style={{ color: 'var(--accent-primary)' }}
            >
              Enterprise Inventory Platform
            </p>
            <h1 
              className="mt-4 text-5xl font-semibold leading-tight" 
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h1>
            <p 
              className="mt-6 text-lg leading-8" 
              style={{ color: 'var(--text-secondary)' }}
            >
              {description}
            </p>
          </div>
        </section>

        {/* Right Panel */}
        <section
          className="flex items-center justify-center border-l px-8 py-12 lg:col-span-4 lg:px-12 xl:px-16"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="w-full max-w-md">
            {/* Mobile Hero */}
            <div className="mb-10 lg:hidden">
              <p 
                className="text-sm font-medium uppercase tracking-wider" 
                style={{ color: 'var(--accent-primary)' }}
              >
                Enterprise Inventory Platform
              </p>
              <h1 
                className="mt-3 text-3xl font-semibold" 
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h1>
              <p 
                className="mt-3" 
                style={{ color: 'var(--text-secondary)' }}
              >
                {description}
              </p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
