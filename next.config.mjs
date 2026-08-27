import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pkg = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so the Tauri desktop shell can run the app's server as a
  // self-contained local process (see src-tauri/). Standard web/Vercel
  // deploys are unaffected by this — it only changes what `next build`
  // additionally emits into .next/standalone.
  output: 'standalone',

  // Expose the version from package.json as a client-side env var so
  // the sidebar and settings page can show it without a server round-trip.
  // release-please bumps package.json on every release, so this stays
  // in sync automatically.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },

  // Keep these packages as external require() calls rather than bundling
  // them into the SSR chunks. This is critical for two reasons:
  //
  // 1. Turbopack (default bundler in Next 15+) mangles external module
  //    names with a content hash (e.g. "pg-587764f78a6c7a9c") when it
  //    bundles them. The standalone server then tries to require that
  //    hashed name, which doesn't exist in node_modules, causing a
  //    module-not-found crash on every request.
  //
  // 2. pg and @electric-sql/pglite have native/WASM components that
  //    don't survive bundling correctly regardless of the bundler.
  //
  // With serverExternalPackages set, Next traces the actual package name
  // and copies the real directory into .next/standalone/node_modules/,
  // where Node can find it by its real name at runtime.
  serverExternalPackages: [
    'pg',
    'pg-native',
    '@electric-sql/pglite',
    '@aws-sdk/rds-signer',
    '@vercel/functions',
  ],

  typescript: {
    ignoreBuildErrors: true,
  },
  
  images: {
    unoptimized: true,
  },

  // Keep PGlite's WASM/runtime assets in the standalone server output.
  outputFileTracingIncludes: {
    '/*': [
      'node_modules/@electric-sql/pglite/package.json',
      'node_modules/@electric-sql/pglite/dist/**/*',
    ],
  },

  // Improve Node file tracing for standalone builds
  experimental: {
    optimizePackageImports: ['@base-ui/react', 'lucide-react', 'recharts'],
  },
}

export default nextConfig
