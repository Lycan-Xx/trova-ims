// Runs before `tauri build`/`tauri dev` (see src-tauri/tauri.conf.json's
// `beforeBuildCommand`). Next.js's `output: 'standalone'` produces a
// self-contained server in .next/standalone, but deliberately leaves out
// `public/` and `.next/static/` — those have to be copied in by hand for
// the bundle to actually serve pages. See:
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output

import { execSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const standaloneDir = path.join(root, '.next', 'standalone')

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

console.log('[tauri-prebuild] Done — .next/standalone is ready to bundle.')
