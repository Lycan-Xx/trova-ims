import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const packagePath = path.join(root, 'package.json')
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml')
const splashPath = path.join(root, 'src-tauri', 'splash', 'index.html')

const version = JSON.parse(readFileSync(packagePath, 'utf8')).version
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version}`)
}

const cargo = readFileSync(cargoPath, 'utf8')
const versionRegex = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m

if (!versionRegex.test(cargo)) {
  throw new Error('Could not find src-tauri/Cargo.toml package version')
}

const updatedCargo = cargo.replace(versionRegex, `$1${version}$2`)
writeFileSync(cargoPath, updatedCargo)
console.log(`[desktop-version] Using version ${version} for the Tauri/Cargo package`)

const splash = readFileSync(splashPath, 'utf8')
const splashVersionRegex = /(<div class="version">)[^<]*(<\/div>)/

if (!splashVersionRegex.test(splash)) {
  throw new Error('Could not find the version element in src-tauri/splash/index.html')
}

const updatedSplash = splash.replace(splashVersionRegex, `$1v${version}$2`)
writeFileSync(splashPath, updatedSplash)
console.log(`[desktop-version] Stamped v${version} onto the splash screen`)
