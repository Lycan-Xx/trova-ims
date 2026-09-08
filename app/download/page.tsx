import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Download,
  FileArchive,
  HardDriveDownload,
  PackageCheck,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { getLatestWindowsRelease, type WindowsInstaller } from '@/lib/releases/github'

export const metadata: Metadata = {
  title: 'Download Trova for Windows',
  description: 'Download the latest full offline Trova installer for Windows as an EXE or MSI package.',
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatPublishedDate(value: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

function InstallerCard({ installer }: { installer: WindowsInstaller }) {
  const isExe = installer.format === 'exe'
  const digest = installer.digest?.replace(/^sha256:/i, '')

  return (
    <article className={`relative flex h-full flex-col rounded-2xl border p-6 ${isExe ? 'border-accent-primary/50 bg-accent-primary-muted/40' : 'border-border bg-bg-card'}`}>
      {isExe && (
        <span className="absolute right-5 top-5 rounded-full bg-accent-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
          Recommended
        </span>
      )}
      <span className={`flex size-11 items-center justify-center rounded-xl ${isExe ? 'bg-accent-primary text-white' : 'bg-bg-input text-text-secondary'}`}>
        {isExe ? <HardDriveDownload size={21} aria-hidden="true" /> : <FileArchive size={21} aria-hidden="true" />}
      </span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">.{installer.format}</p>
      <h2 className="mt-1 text-xl font-bold text-text-primary">
        {isExe ? 'Setup wizard' : 'Windows installer'}
      </h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-text-secondary">
        {isExe
          ? 'Best for most stores. Open it and follow the guided installation steps.'
          : 'Best for managed deployment, IT tools, or a traditional MSI workflow.'}
      </p>
      <a
        href={installer.downloadUrl}
        className={`mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${isExe ? 'bg-accent-primary text-white hover:bg-accent-primary-hover' : 'border border-border bg-bg-input text-text-primary hover:border-text-muted'}`}
      >
        <Download size={16} aria-hidden="true" /> Download .{installer.format} · {formatFileSize(installer.size)}
      </a>
      <div className="mt-4 border-t border-border-subtle pt-4">
        <p className="truncate text-[11px] text-text-muted" title={installer.name}>{installer.name}</p>
        {digest && (
          <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={`SHA-256: ${digest}`}>
            SHA-256: {digest}
          </p>
        )}
      </div>
    </article>
  )
}

function DownloadStatusSkeleton() {
  return (
    <div aria-label="Loading latest release" className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="h-[335px] animate-pulse rounded-2xl border border-border bg-bg-card p-6">
          <div className="size-11 rounded-xl bg-bg-input" />
          <div className="mt-6 h-4 w-16 rounded bg-bg-input" />
          <div className="mt-3 h-7 w-44 rounded bg-bg-input" />
          <div className="mt-5 h-12 rounded bg-bg-input" />
          <div className="mt-6 h-11 rounded-lg bg-bg-input" />
        </div>
      ))}
    </div>
  )
}

async function LatestDownloads() {
  await connection()
  const release = await getLatestWindowsRelease()

  if (!release || release.installers.length === 0) {
    return (
      <div className="rounded-2xl border border-accent-yellow/30 bg-accent-yellow/5 p-6 text-center">
        <PackageCheck className="mx-auto text-accent-yellow" size={28} aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-text-primary">Downloads are temporarily unavailable</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
          We could not verify the latest full Windows installers. Refresh this page in a few minutes.
        </p>
      </div>
    )
  }

  const publishedDate = formatPublishedDate(release.publishedAt)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-teal/30 bg-accent-teal/10 px-3 py-1 font-semibold text-accent-teal">
          <BadgeCheck size={14} aria-hidden="true" /> Latest release
        </span>
        <span className="font-semibold text-text-primary">Trova {release.tagName}</span>
        {publishedDate && <span className="text-text-muted">Published {publishedDate}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {release.installers.map((installer) => <InstallerCard key={installer.id} installer={installer} />)}
      </div>
      {release.installers.length < 2 && (
        <p className="mt-4 rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 px-4 py-3 text-sm text-accent-yellow">
          One installer format is still being prepared. The available full installer is safe to use.
        </p>
      )}
    </div>
  )
}

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border-subtle bg-bg-nav/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Trova home">
            <img src="/images/favicon.png" alt="" width={28} height={28} className="rounded-[7px]" />
            <span className="text-sm font-bold">Trova</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary transition hover:text-white">
            <ArrowLeft size={14} aria-hidden="true" /> Back to website
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border-subtle px-5 py-16 md:px-8 md:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_70%_at_50%_-10%,rgba(245,97,10,0.13),transparent_70%)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-primary">Trova for Windows</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">Download once. Work offline.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-text-secondary md:text-base">
              Get the complete Windows package with everything Trova needs to run. Choose the friendly setup wizard or the MSI installer—both contain the same app.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
          <Suspense fallback={<DownloadStatusSkeleton />}>
            <LatestDownloads />
          </Suspense>

          <div className="mt-12 grid gap-8 border-t border-border-subtle pt-10 md:grid-cols-2">
            <div>
              <h2 className="text-base font-bold text-text-primary">Included in both downloads</h2>
              <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-accent-teal" size={16} aria-hidden="true" /> Trova desktop and its local application server</li>
                <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-accent-teal" size={16} aria-hidden="true" /> Bundled Node.js runtime</li>
                <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-accent-teal" size={16} aria-hidden="true" /> Offline Microsoft WebView2 installer</li>
              </ul>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Before you install</h2>
              <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                <li className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-accent-primary" size={16} aria-hidden="true" /> Windows may ask you to approve installation</li>
                <li className="flex gap-3"><WifiOff className="mt-0.5 shrink-0 text-accent-primary" size={16} aria-hidden="true" /> Your store data remains on your computer</li>
                <li className="flex gap-3"><PackageCheck className="mt-0.5 shrink-0 text-accent-primary" size={16} aria-hidden="true" /> Installing an update keeps your existing app data</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
