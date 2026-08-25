import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const packagePath = path.join(root, 'package.json')
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml')

const version = JSON.parse(readFileSync(packagePath, 'utf8')).version
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version}`)
}

const cargo = readFileSync(cargoPath, 'utf8')
const updatedCargo = cargo.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
  `$1${version}$2`,
)

if (updatedCargo === cargo) {
  throw new Error('Could not find src-tauri/Cargo.toml package version')
}

writeFileSync(cargoPath, updatedCargo)
console.log(`[desktop-version] Using version ${version} for the Tauri/Cargo package`)
