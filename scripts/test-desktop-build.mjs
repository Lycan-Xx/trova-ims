#!/usr/bin/env node

/**
 * Test script to verify desktop build setup before pushing to CI
 * 
 * Usage:
 *   node scripts/test-desktop-build.mjs [platform] [profile]
 * 
 * Examples:
 *   node scripts/test-desktop-build.mjs          # Current platform, release
 *   node scripts/test-desktop-build.mjs linux    # Linux bundles, release
 *   node scripts/test-desktop-build.mjs windows debug  # Windows, debug mode
 */

import { execSync } from 'node:child_process'
import { platform } from 'node:os'

const currentPlatform = platform()
const requestedPlatform = process.argv[2] || 'current'
const buildProfile = process.argv[3] || 'release'

// Map platform names
const platformMap = {
  win32: 'windows',
  darwin: 'macos',
  linux: 'linux',
  current: currentPlatform === 'win32' ? 'windows' : currentPlatform === 'darwin' ? 'macos' : 'linux',
}

const targetPlatform = platformMap[requestedPlatform] || requestedPlatform

// Bundle types per platform
const bundleMap = {
  linux: 'deb,rpm',
  macos: 'dmg',
  windows: 'msi,nsis',
}

const bundles = bundleMap[targetPlatform]

if (!bundles) {
  console.error(`❌ Unknown platform: ${targetPlatform}`)
  console.error('Valid platforms: linux, macos, windows')
  process.exit(1)
}

console.log('🚀 Trova IMS Desktop Build Test')
console.log('================================')
console.log(`Platform: ${targetPlatform}`)
console.log(`Profile: ${buildProfile}`)
console.log(`Bundles: ${bundles}`)
console.log('')

// Check if running on the right platform
if (requestedPlatform !== 'current' && targetPlatform !== platformMap.current) {
  console.warn(`⚠️  Warning: Building for ${targetPlatform} on ${platformMap.current}`)
  console.warn('   This may not work correctly. Consider using current platform.')
  console.log('')
}

// Verify dependencies
console.log('📦 Checking dependencies...')
try {
  // Check Node
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim()
  console.log(`✓ Node.js: ${nodeVersion}`)

  // Check npm
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim()
  console.log(`✓ npm: ${npmVersion}`)

  // Check Rust
  try {
    const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim()
    console.log(`✓ Rust: ${rustVersion}`)
  } catch {
    console.error('❌ Rust not found. Install from: https://rustup.rs/')
    process.exit(1)
  }

  // Check Cargo
  const cargoVersion = execSync('cargo --version', { encoding: 'utf8' }).trim()
  console.log(`✓ Cargo: ${cargoVersion}`)

  console.log('')
} catch (error) {
  console.error('❌ Dependency check failed:', error.message)
  process.exit(1)
}

// Platform-specific dependency checks
if (targetPlatform === 'linux' && platformMap.current === 'linux') {
  console.log('🐧 Checking Linux dependencies...')
  const linuxDeps = [
    'pkg-config',
    'libwebkit2gtk-4.1-0',
    'libgtk-3-0',
  ]

  for (const dep of linuxDeps) {
    try {
      execSync(`dpkg -l | grep ${dep}`, { stdio: 'ignore' })
      console.log(`✓ ${dep}`)
    } catch {
      console.warn(`⚠️  ${dep} may not be installed`)
    }
  }
  console.log('')
}

// Check environment variables
console.log('🔐 Checking environment...')
const requiredEnvVars = ['DATABASE_URL', 'BETTER_AUTH_SECRET']
let hasAllEnvVars = true

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✓ ${envVar}: set`)
  } else {
    console.warn(`⚠️  ${envVar}: not set (will use placeholder)`)
    hasAllEnvVars = false
  }
}

if (!hasAllEnvVars) {
  console.log('')
  console.log('💡 Note: Missing env vars will use placeholder values')
  console.log('   This is fine for build testing')
}

console.log('')

// Build
console.log('🔨 Starting build...')
console.log('')

const debugFlag = buildProfile === 'debug' ? '--debug' : ''
const buildCommand = `npx tauri build ${debugFlag} --bundles ${bundles}`

console.log(`Running: ${buildCommand}`)
console.log('')

try {
  execSync(buildCommand, { stdio: 'inherit' })
  console.log('')
  console.log('✅ Build completed successfully!')
  console.log('')
  console.log(`📦 Installers are in: src-tauri/target/${buildProfile}/bundle/`)
  console.log('')

  // List generated files
  try {
    const { readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')

    const bundleDir = `src-tauri/target/${buildProfile}/bundle`
    const bundleTypes = bundles.split(',')

    console.log('Generated files:')
    for (const bundleType of bundleTypes) {
      const typeDir = join(bundleDir, bundleType)
      try {
        const files = readdirSync(typeDir)
        for (const file of files) {
          const filePath = join(typeDir, file)
          const stats = statSync(filePath)
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
          console.log(`  • ${bundleType}/${file} (${sizeMB} MB)`)
        }
      } catch {
        // Directory doesn't exist or is empty
      }
    }
  } catch (err) {
    // Listing files failed, not critical
  }
} catch (error) {
  console.error('')
  console.error('❌ Build failed!')
  console.error('')
  console.error('Common issues:')
  console.error('  • Missing system dependencies (Linux: install webkit2gtk, gtk3)')
  console.error('  • Rust toolchain not installed')
  console.error('  • Node.js dependencies not installed (run: npm install)')
  console.error('  • Cargo.lock out of sync (try: cd src-tauri && cargo update)')
  console.error('')
  process.exit(1)
}
