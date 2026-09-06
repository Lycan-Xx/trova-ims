import { execFileSync } from 'node:child_process'
import { createWriteStream, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { finished } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Keep the runtime pinned so every release is reproducible. Kysely 0.29
// requires Node 22 or newer in the bundled Next.js 16 server.
const NODE_VERSION = '22.12.0'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const runtimeRoot = path.join(root, '.trova-runtime', 'node')

if (process.platform !== 'win32') {
  // The current launcher only needs a bundled runtime for Windows. Keep the
  // placeholder resource directory present so cross-platform Tauri builds
  // still have a valid resource mapping.
  mkdirSync(runtimeRoot, { recursive: true })
  process.exit(0)
}

const nodeExe = path.join(runtimeRoot, 'node.exe')
if (existsSync(nodeExe)) {
  console.log(`[node-runtime] Using existing Node.js ${NODE_VERSION} runtime.`)
  process.exit(0)
}

const archive = path.join(root, '.trova-runtime', `node-v${NODE_VERSION}-win-x64.zip`)
const downloadUrl = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`
mkdirSync(path.dirname(archive), { recursive: true })

console.log(`[node-runtime] Downloading ${downloadUrl}`)
const response = await fetch(downloadUrl, {
  signal: AbortSignal.timeout(30_000),
})
if (!response.ok || !response.body) {
  throw new Error(`[node-runtime] Download failed: HTTP ${response.status}`)
}
await finished(Readable.fromWeb(response.body).pipe(createWriteStream(archive)))

const extractRoot = path.join(root, '.trova-runtime', 'extract')
rmSync(extractRoot, { recursive: true, force: true })
mkdirSync(extractRoot, { recursive: true })
execFileSync('powershell.exe', [
  '-NoProfile', '-NonInteractive', '-Command',
  `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${extractRoot.replaceAll("'", "''")}' -Force`,
], { stdio: 'inherit' })

const extractedDir = path.join(extractRoot, `node-v${NODE_VERSION}-win-x64`)
rmSync(runtimeRoot, { recursive: true, force: true })
mkdirSync(runtimeRoot, { recursive: true })
for (const entry of readdirSync(extractedDir)) {
  const source = path.join(extractedDir, entry)
  const destination = path.join(runtimeRoot, entry)
  cpSync(source, destination, { recursive: true })
}
rmSync(extractRoot, { recursive: true, force: true })
rmSync(archive, { force: true })

if (!existsSync(nodeExe)) {
  throw new Error('[node-runtime] Extraction completed but node.exe is missing.')
}
console.log(`[node-runtime] Prepared Node.js ${NODE_VERSION} at ${runtimeRoot}`)
