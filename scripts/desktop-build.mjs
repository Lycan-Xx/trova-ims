import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const supportedVariants = new Set(['slim', 'bundled', 'all'])

function parseVariant(argv) {
  const forwarded = []
  let variant = process.env.TROVA_DESKTOP_VARIANT || 'slim'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--variant') {
      variant = argv[i + 1]
      i += 1
    } else if (arg.startsWith('--variant=')) {
      variant = arg.slice('--variant='.length)
    } else {
      forwarded.push(arg)
    }
  }

  variant = String(variant).toLowerCase()
  if (!supportedVariants.has(variant)) {
    throw new Error(`[desktop-build] Unsupported variant "${variant}". Use slim, bundled, or all.`)
  }

  return { variant, forwarded }
}

function buildProfile(args) {
  return args.includes('--debug') || args.includes('-d') ? 'debug' : 'release'
}

function buildTarget(args) {
  const targetIndex = args.indexOf('--target')
  if (targetIndex !== -1 && args[targetIndex + 1]) return args[targetIndex + 1]

  const targetArgument = args.find((arg) => arg.startsWith('--target='))
  return targetArgument ? targetArgument.slice('--target='.length) : null
}

function renameWindowsArtifacts(variant, args) {
  const profile = buildProfile(args)
  const target = buildTarget(args)
  const targetRoot = target ? path.join('target', target) : 'target'
  const bundleRoot = path.join(root, 'src-tauri', targetRoot, profile, 'bundle')
  for (const folder of ['msi', 'nsis']) {
    const dir = path.join(bundleRoot, folder)
    if (!existsSync(dir)) continue

    for (const entry of readdirSync(dir)) {
      const ext = path.extname(entry)
      if (!['.exe', '.msi'].includes(ext.toLowerCase())) continue
      if (entry.includes(`windows-${variant}`)) continue

      const source = path.join(dir, entry)
      const destination = path.join(dir, `${path.basename(entry, ext)}-windows-${variant}${ext}`)
      rmSync(destination, { force: true })
      renameSync(source, destination)
      console.log(`[desktop-build] Wrote ${path.relative(root, destination)}`)
    }
  }
}

function runNodeScript(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runTauriBuild(variant, forwarded) {
  console.log(`[desktop-build] Building ${variant} desktop package.`)

  if (variant === 'bundled') {
    runNodeScript('ensure-node-runtime.mjs')
  }

  const configArgs = variant === 'bundled'
    ? ['--config', path.join(root, 'src-tauri', 'tauri.windows-bundled.conf.json')]
    : []

  const build = spawnSync('npx', ['tauri', 'build', ...configArgs, ...forwarded], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      TROVA_DESKTOP_VARIANT: variant,
    },
  })
  if (build.status !== 0) process.exit(build.status ?? 1)

  renameWindowsArtifacts(variant, forwarded)
}

const { variant, forwarded } = parseVariant(process.argv.slice(2))
const sync = spawnSync(process.execPath, [path.join(root, 'scripts', 'sync-desktop-version.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
if (sync.status !== 0) process.exit(sync.status ?? 1)

const variants = variant === 'all' ? ['slim', 'bundled'] : [variant]
for (const selectedVariant of variants) {
  runTauriBuild(selectedVariant, forwarded)
}
