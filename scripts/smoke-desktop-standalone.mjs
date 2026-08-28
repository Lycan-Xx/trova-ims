import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const standaloneDir = path.join(root, '.next', 'standalone')
const serverJs = path.join(standaloneDir, 'server.js')
const port = Number(process.env.TROVA_SMOKE_PORT || 47829)
const dataDir = mkdtempSync(path.join(tmpdir(), 'trova-desktop-smoke-'))
const output = []

function remember(chunk) {
  output.push(chunk.toString())
  while (output.join('').length > 12_000) output.shift()
}

function fail(message) {
  const log = output.join('').trim()
  console.error(`[desktop-smoke] ${message}`)
  if (log) {
    console.error('[desktop-smoke] server output:')
    console.error(log)
  }
  process.exitCode = 1
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth(baseUrl) {
  let lastError = 'server did not respond'
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/desktop/health`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(1_500),
      })
      const text = await response.text()
      if (response.ok) {
        const payload = JSON.parse(text)
        if (payload.ok === true) return payload
        lastError = text
      } else {
        lastError = text
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(500)
  }
  throw new Error(lastError)
}

async function assertDashboardRenders(baseUrl) {
  const response = await fetch(`${baseUrl}/dashboard`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`/dashboard returned HTTP ${response.status}: ${text.slice(0, 500)}`)
  }
}

if (!existsSync(serverJs)) {
  fail(`standalone server was not found at ${serverJs}`)
  process.exit()
}

console.log(`[desktop-smoke] Starting standalone server on 127.0.0.1:${port}`)
const child = spawn(process.execPath, [serverJs], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DESKTOP_MODE: 'true',
    TROVA_DATA_DIR: dataDir,
    TROVA_DESKTOP_VERSION: process.env.npm_package_version || packageVersion,
    BETTER_AUTH_SECRET: 'desktop-smoke-not-used',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stdout.on('data', remember)
child.stderr.on('data', remember)

try {
  const baseUrl = `http://127.0.0.1:${port}`
  const health = await waitForHealth(baseUrl)
  console.log(`[desktop-smoke] Health OK (${health.version ?? 'unknown'})`)
  await assertDashboardRenders(baseUrl)
  console.log('[desktop-smoke] Dashboard render OK')
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  child.kill()
  rmSync(dataDir, { recursive: true, force: true })
}
