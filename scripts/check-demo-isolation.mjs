import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const demoRoots = ['app/demo', 'components/demo', 'lib/demo']
const forbiddenImports = [
  '@/app/actions',
  '@/lib/actions',
  '@/lib/auth',
  '@/lib/db',
  '@tauri-apps/',
  'better-auth',
]

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const violations = []

for (const demoRoot of demoRoots) {
  const absoluteRoot = join(root, demoRoot)
  if (!statSync(absoluteRoot, { throwIfNoEntry: false })?.isDirectory()) continue

  for (const file of walk(absoluteRoot).filter((path) => /\.(ts|tsx)$/.test(path))) {
    const source = readFileSync(file, 'utf8')
    for (const forbidden of forbiddenImports) {
      if (source.includes(forbidden)) {
        violations.push(`${relative(root, file)} imports forbidden runtime module "${forbidden}"`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('[demo-isolation] Public preview isolation failed:')
  violations.forEach((violation) => console.error(`  - ${violation}`))
  process.exit(1)
}

console.log('[demo-isolation] Public preview is isolated from actions, auth, databases, and Tauri.')
