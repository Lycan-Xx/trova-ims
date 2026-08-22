// scripts/dev-desktop.js
// Cross-platform dev launcher that sets DESKTOP_MODE and starts Next dev.

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

process.env.DESKTOP_MODE = 'true'

const nextBin = require.resolve('next/dist/bin/next')
// Ensure .next/standalone exists so Tauri's resource check doesn't fail during dev
try {
  const repoRoot = path.resolve(__dirname, '..')
  const standaloneDir = path.join(repoRoot, '.next', 'standalone')
  fs.mkdirSync(standaloneDir, { recursive: true })
  const gitkeep = path.join(standaloneDir, '.gitkeep')
  if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, '')
} catch (e) {
  // Non-fatal for dev; continue to start Next dev even if directory creation fails
}
// Build spawn env and ensure Node has enough memory for Next/Turbopack
const spawnEnv = {
  ...process.env,
  DESKTOP_MODE: 'true',
}
// Respect existing NODE_OPTIONS, but add a reasonable max-old-space-size if missing
try {
  const existing = process.env.NODE_OPTIONS || ''
  const memFlag = '--max-old-space-size='
  const hasMemFlag = existing.includes(memFlag)
  if (!hasMemFlag) {
    const added = `${existing} --max-old-space-size=8192`.trim()
    spawnEnv.NODE_OPTIONS = added
  } else {
    spawnEnv.NODE_OPTIONS = existing
  }
} catch (e) {
  // ignore and continue with defaults
}

const child = spawn(process.execPath, [nextBin, 'dev', '--port', '3000'], {
  stdio: 'inherit',
  env: spawnEnv,
})

child.on('close', (code) => {
  process.exit(code)
})
