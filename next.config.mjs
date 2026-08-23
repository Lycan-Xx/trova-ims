/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so the Tauri desktop shell can run the app's server as a
  // self-contained local process (see src-tauri/). Standard web/Vercel
  // deploys are unaffected by this — it only changes what `next build`
  // additionally emits into .next/standalone.
  output: 'standalone',

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

  // Expose DESKTOP_MODE to the browser so client components can detect
  // Tauri desktop mode at runtime. The Tauri shell sets this env var
  // when spawning the Next.js server. Without this, Next.js inlines
  // process.env.DESKTOP_MODE at build time (undefined) instead of
  // reading it at runtime.
  env: {
    DESKTOP_MODE: process.env.DESKTOP_MODE,
  },

  // Disable Vercel analytics integration which tries to process .nft.json
  // during onBuildComplete. This is known to cause issues with standalone
  // builds in Next.js 16+.
  analytics: {
    enabled: false,
  },

  // Improve Node file tracing for standalone builds
  experimental: {
    optimizePackageImports: ['@base-ui/react', 'lucide-react', 'recharts'],
  },
}

export default nextConfig
