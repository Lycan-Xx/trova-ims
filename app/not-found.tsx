import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Full-screen Background with darker overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/auth-page.png"
          alt="404 Background"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/85" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-8 max-w-2xl">
        <h1 className="text-9xl font-bold text-white tracking-tighter mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-white mb-6">Page Not Found</h2>
        <p className="text-lg text-white/70 mb-10 max-w-md">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        
        <Link 
          href="/"
          className="px-8 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-md transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </main>
  )
}
