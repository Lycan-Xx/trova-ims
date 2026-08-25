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
const versionPattern = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m
const versionMatch = cargo.match(versionPattern)
if (!versionMatch) {
  throw new Error('Could not find src-tauri/Cargo.toml package version')
}

const currentCargoVersion = versionMatch[0].match(/version\s*=\s*"([^"]+)"/)?.[1]
if (currentCargoVersion !== version) {
  const updatedCargo = cargo.replace(versionPattern, `$1${version}$2`)
  writeFileSync(cargoPath, updatedCargo)
  console.log(`[desktop-version] Updated Cargo.toml from ${currentCargoVersion} to ${version}`)
}

console.log(`[desktop-version] Using version ${version} for the Tauri/Cargo package`)
