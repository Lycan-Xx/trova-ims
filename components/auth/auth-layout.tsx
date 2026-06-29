import Image from 'next/image'
import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title?: string
  description?: string
}

export function AuthLayout({
  children,
  title,
  description,
}: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen w-full flex overflow-hidden">
      {/* Full-screen Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/store.png"
          alt="Inventory management"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/45 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left Side (Text) */}
        <div className="hidden lg:flex flex-1 flex-col justify-end p-20">
          <div className="max-w-xl">

            {title && (
              <h1
                className="mt-4 text-5xl font-semibold leading-tight text-white"
              >
                {title}
              </h1>
            )}
            {description && (
              <p
                className="mt-6 text-lg leading-8 text-white/80"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right Side (Auth Card) */}
        <section
          className="flex w-full lg:w-[400px] xl:w-[480px] items-center justify-center border-l px-8 py-12 lg:px-12 xl:px-16 shrink-0 h-full min-h-screen"
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
              {title && (
                <h1
                  className="mt-3 text-3xl font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </h1>
              )}
              {description && (
                <p
                  className="mt-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {description}
                </p>
              )}
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
