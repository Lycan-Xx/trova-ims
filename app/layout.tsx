import { Analytics } from '@vercel/analytics/next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Trova - Inventory Management',
  description: 'Smart inventory and stock management for modern retail stores.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/images/favicon.ico',
      },
      {
        url: '/images/favicon.png',
        type: 'image/png',
      },
    ],
    apple: '/images/favicon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#111111',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} bg-bg-base`}>
      <body className="font-sans antialiased">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster position="bottom-right" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
