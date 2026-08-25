#!/usr/bin/env node

/**
 * Pre-deployment validation script
 * Checks fonts, Vercel config, and CircleCI config
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
let errors = 0
let warnings = 0

console.log('🔍 Build Setup Validation')
console.log('=========================\n')

// 1. Check Fonts
console.log('📝 Checking Fonts...')
const fontsDir = join(root, 'public', 'fonts')
const requiredFonts = [
  'inter-400.woff2',
  'inter-500.woff2',
  'inter-600.woff2',
  'inter-700.woff2',
  'jetbrains-mono-400.woff2',
  'jetbrains-mono-500.woff2',
  'jetbrains-mono-600.woff2',
  'jetbrains-mono-700.woff2',
]

if (!existsSync(fontsDir)) {
  console.error('❌ public/fonts/ directory not found')
  errors++
} else {
  const files = readdirSync(fontsDir)
  requiredFonts.forEach((font) => {
    if (files.includes(font)) {
      console.log(`  ✓ ${font}`)
    } else {
      console.error(`  ❌ Missing: ${font}`)
      errors++
    }
  })
}

// Check globals.css references
const globalsCss = join(root, 'app', 'globals.css')
if (existsSync(globalsCss)) {
  const content = readFileSync(globalsCss, 'utf-8')
  requiredFonts.forEach((font) => {
    if (content.includes(`/fonts/${font}`)) {
      console.log(`  ✓ Referenced in globals.css: ${font}`)
    } else {
      console.error(`  ❌ Not referenced in globals.css: ${font}`)
      errors++
    }
  })
} else {
  console.error('❌ app/globals.css not found')
  errors++
}

console.log('')

// 2. Check Vercel Config
console.log('📝 Checking Vercel Configuration...')

// Check vercel.json
const vercelJson = join(root, 'vercel.json')
if (existsSync(vercelJson)) {
  console.log('  ✓ vercel.json exists')
  try {
    const config = JSON.parse(readFileSync(vercelJson, 'utf-8'))
    if (config.regions) {
      console.log(`  ✓ Region configured: ${config.regions.join(', ')}`)
    }
  } catch (err) {
    console.error('  ❌ vercel.json is invalid JSON')
    errors++
  }
} else {
  console.warn('  ⚠️  vercel.json not found (optional)')
  warnings++
}

// Check package.json build script
const packageJson = join(root, 'package.json')
if (existsSync(packageJson)) {
  const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'))
  if (pkg.scripts?.build) {
    if (pkg.scripts.build.includes('--webpack')) {
      console.log('  ✓ Build script uses --webpack flag')
    } else {
      console.warn('  ⚠️  Build script missing --webpack flag (may fail on Vercel)')
      warnings++
    }
    if (pkg.scripts.build.includes('vercel-postbuild')) {
      console.log('  ✓ Postbuild script configured')
    } else {
      console.warn('  ⚠️  Postbuild script not configured')
      warnings++
    }
  }
}

// Check next.config.mjs
const nextConfig = join(root, 'next.config.mjs')
if (existsSync(nextConfig)) {
  const content = readFileSync(nextConfig, 'utf-8')
  if (content.includes("output: 'standalone'")) {
    console.log("  ✓ next.config.mjs has output: 'standalone'")
  } else {
    console.error("  ❌ next.config.mjs missing output: 'standalone'")
    errors++
  }
  
  if (content.includes('serverExternalPackages')) {
    console.log('  ✓ serverExternalPackages configured')
  } else {
    console.warn('  ⚠️  serverExternalPackages not configured')
    warnings++
  }
}

// Check vercel postbuild script
const postbuildScript = join(root, 'scripts', 'vercel-postbuild.mjs')
if (existsSync(postbuildScript)) {
  console.log('  ✓ vercel-postbuild.mjs exists')
} else {
  console.error('  ❌ scripts/vercel-postbuild.mjs not found')
  errors++
}

console.log('')

// 3. Check CircleCI Config
console.log('📝 Checking CircleCI Configuration...')

const circleConfig = join(root, '.circleci', 'config.yml')
if (existsSync(circleConfig)) {
  console.log('  ✓ .circleci/config.yml exists')
  const content = readFileSync(circleConfig, 'utf-8')
  
  // Check executors
  if (content.includes('linux-builder') && content.includes('windows-builder')) {
    console.log('  ✓ Active platform executors configured (Linux, Windows)')
  } else {
    console.error('  ❌ Missing platform executors')
    errors++
  }
  
  // Check jobs
  if (content.includes('build-linux') && content.includes('build-windows')) {
    console.log('  ✓ Active platform build jobs configured (Linux, Windows)')
  } else {
    console.error('  ❌ Missing platform build jobs')
    errors++
  }
  
  // Check caching
  if (content.includes('restore_cache') && content.includes('save_cache')) {
    console.log('  ✓ Caching configured')
  } else {
    console.warn('  ⚠️  Caching not configured (slow builds)')
    warnings++
  }
  
  // Check artifact storage
  if (content.includes('store_artifacts')) {
    console.log('  ✓ Artifact storage configured')
  } else {
    console.error('  ❌ Artifact storage not configured')
    errors++
  }
} else {
  console.error('  ❌ .circleci/config.yml not found')
  errors++
}

console.log('')

// 4. Check Tauri Config
console.log('📝 Checking Tauri Configuration...')

const tauriConfig = join(root, 'src-tauri', 'tauri.conf.json')
if (existsSync(tauriConfig)) {
  console.log('  ✓ src-tauri/tauri.conf.json exists')
  try {
    const config = JSON.parse(readFileSync(tauriConfig, 'utf-8'))
    if (config.build?.beforeBuildCommand) {
      console.log('  ✓ beforeBuildCommand configured')
    }
    if (config.bundle?.resources) {
      console.log('  ✓ Bundle resources configured')
    }

    const packageVersion = JSON.parse(readFileSync(packageJson, 'utf-8')).version
    const cargo = readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf-8')
    const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
    if (cargoVersion === packageVersion) {
      console.log(`  ✓ Desktop version synchronized: ${packageVersion}`)
    } else {
      console.error(`  ✗ Desktop version mismatch: package.json=${packageVersion}, Cargo.toml=${cargoVersion}`)
      errors++
    }

    const nsis = config.bundle?.windows?.nsis
    if (nsis?.installMode === 'currentUser' && !('upgradeCode' in nsis)) {
      console.log('  ✓ NSIS options match the installed Tauri schema')
    } else {
      console.error('  ✗ NSIS options do not match the installed Tauri schema')
      errors++
    }
  } catch (err) {
    console.error('  ❌ tauri.conf.json is invalid JSON')
    errors++
  }
} else {
  console.error('  ❌ src-tauri/tauri.conf.json not found')
  errors++
}

// Check tauri prebuild script
const tauriPrebuild = join(root, 'scripts', 'tauri-prebuild.mjs')
if (existsSync(tauriPrebuild)) {
  console.log('  ✓ scripts/tauri-prebuild.mjs exists')
} else {
  console.error('  ❌ scripts/tauri-prebuild.mjs not found')
  errors++
}

// Check Cargo.lock
const cargoLock = join(root, 'src-tauri', 'Cargo.lock')
if (existsSync(cargoLock)) {
  console.log('  ✓ src-tauri/Cargo.lock exists')
} else {
  console.error('  ❌ src-tauri/Cargo.lock not found (run: cd src-tauri && cargo build)')
  errors++
}

console.log('')

// 5. Check Dependencies
console.log('📝 Checking Dependencies...')

if (existsSync(packageJson)) {
  const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'))
  
  const requiredDeps = [
    'next',
    '@tauri-apps/api',
    'better-auth',
    'pg',
    '@electric-sql/pglite',
  ]
  
  requiredDeps.forEach((dep) => {
    if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
      console.log(`  ✓ ${dep}`)
    } else {
      console.error(`  ❌ Missing dependency: ${dep}`)
      errors++
    }
  })
}

console.log('')

// Summary
console.log('=========================')
console.log('Summary:')
console.log(`  Errors: ${errors}`)
console.log(`  Warnings: ${warnings}`)
console.log('')

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Ready for deployment.')
  process.exit(0)
} else if (errors === 0) {
  console.log('⚠️  All checks passed with warnings. Review warnings before deployment.')
  process.exit(0)
} else {
  console.log('❌ Validation failed! Fix errors before deployment.')
  process.exit(1)
}
