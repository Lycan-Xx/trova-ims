// Runs before `tauri build`/`tauri dev` (see src-tauri/tauri.conf.json's
// `beforeBuildCommand`). Next.js's `output: 'standalone'` produces a
// self-contained server in .next/standalone, but deliberately leaves out
// `public/` and `.next/static/` — those have to be copied in by hand for
// the bundle to actually serve pages. See:
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const nextDir = path.join(root, '.next')
const standaloneDir = path.join(nextDir, 'standalone')

// Force a completely clean Next.js build before packaging. Without this,
// old Turbopack artifacts from `next dev` (which uses Turbopack by default
// in Next 15+) can survive into the webpack production build and make it
// into the bundled installer. The result is a mix of Turbopack-hashed
// module names (e.g. pg-587764f78a6c7a9c) and real package names in the
// same standalone directory — the server tries to load the hash name, it
// doesn't exist, and every request fails.
console.log('[tauri-prebuild] Cleaning previous .next/ build artifacts…')
rmSync(nextDir, { recursive: true, force: true })

console.log('[tauri-prebuild] Building Next.js (standalone output)…')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

if (!existsSync(standaloneDir)) {
  throw new Error(
    '[tauri-prebuild] .next/standalone was not produced — check that ' +
      "next.config.mjs has `output: 'standalone'` set.",
  )
}

console.log('[tauri-prebuild] Copying public/ into the standalone bundle…')
cpSync(path.join(root, 'public'), path.join(standaloneDir, 'public'), { recursive: true })

console.log('[tauri-prebuild] Copying .next/static/ into the standalone bundle…')
const staticDest = path.join(standaloneDir, '.next', 'static')
rmSync(staticDest, { recursive: true, force: true })
cpSync(path.join(root, '.next', 'static'), staticDest, { recursive: true })

// The desktop DB initialiser (lib/db/desktop-init.ts) reads this file at
// runtime via `join(process.cwd(), 'scripts', 'desktop-schema.sql')`.
// When the server runs inside the packaged Tauri app, process.cwd() is the
// standalone directory — so the file must live at standalone/scripts/.
// It is NOT included by Next's own standalone output, so we copy it here.
console.log('[tauri-prebuild] Copying scripts/desktop-schema.sql into the standalone bundle…')
const scriptsDest = path.join(standaloneDir, 'scripts')
mkdirSync(scriptsDest, { recursive: true })
cpSync(
  path.join(root, 'scripts', 'desktop-schema.sql'),
  path.join(scriptsDest, 'desktop-schema.sql'),
)

console.log('[tauri-prebuild] Done — .next/standalone is ready to bundle.')
