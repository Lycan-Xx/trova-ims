import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sync = spawnSync(process.execPath, [path.join(root, 'scripts', 'sync-desktop-version.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
if (sync.status !== 0) process.exit(sync.status ?? 1)

const build = spawnSync('npx', ['tauri', 'build', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(build.status ?? 1)
