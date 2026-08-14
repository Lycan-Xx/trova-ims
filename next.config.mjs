/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so the Tauri desktop shell can run the app's server as a
  // self-contained local process (see src-tauri/). Standard web/Vercel
  // deploys are unaffected by this — it only changes what `next build`
  // additionally emits into .next/standalone.
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
