// Post-build script to create missing .nft.json file for Vercel compatibility
// This is a workaround for Next.js 16+ standalone output with Turbopack
import { writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const nftPath = path.join(root, '.next', 'next-server.js.nft.json')

// Only create if it doesn't exist (Vercel's onBuildComplete expects this)
if (!existsSync(nftPath)) {
  const nftData = {
    version: 1,
    files: ['.next/server', '.next/static', 'public', 'node_modules'],
    directories: [],
  }
  writeFileSync(nftPath, JSON.stringify(nftData, null, 2))
  console.log('[vercel-postbuild] Created .next/next-server.js.nft.json')
}
