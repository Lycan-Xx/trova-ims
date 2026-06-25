#!/usr/bin/env node
/**
 * StockSmart Test Runner
 *
 * Hits /api/test-suite on the deployed app and prints a human-readable report.
 *
 * Usage:
 *   node scripts/run-tests.mjs --url https://your-app.vercel.app --secret <TEST_SUITE_SECRET>
 *
 * Or with env vars:
 *   TEST_BASE_URL=https://your-app.vercel.app TEST_SUITE_SECRET=xxx node scripts/run-tests.mjs
 */

import { parseArgs } from 'node:util'

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    url:    { type: 'string', short: 'u' },
    secret: { type: 'string', short: 's' },
    json:   { type: 'boolean', short: 'j', default: false },
  },
  allowPositionals: false,
  strict: false,
})

const baseUrl = values.url    || process.env.TEST_BASE_URL    || 'http://localhost:3000'
const secret  = values.secret || process.env.TEST_SUITE_SECRET || ''
const jsonOut = values.json

if (!secret) {
  console.error('ERROR: TEST_SUITE_SECRET is required. Pass --secret or set the env var.')
  process.exit(1)
}

// ── Terminal colours ──────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY
const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  bold:   isTTY ? '\x1b[1m'  : '',
  dim:    isTTY ? '\x1b[2m'  : '',
  green:  isTTY ? '\x1b[32m' : '',
  red:    isTTY ? '\x1b[31m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  cyan:   isTTY ? '\x1b[36m' : '',
  white:  isTTY ? '\x1b[37m' : '',
}

function pass(msg)  { return `${c.green}✓${c.reset} ${msg}` }
function fail(msg)  { return `${c.red}✗${c.reset} ${c.bold}${msg}${c.reset}` }
function skip(msg)  { return `${c.yellow}−${c.reset} ${c.dim}${msg}${c.reset}` }

// ── Fetch the test suite ──────────────────────────────────────────────────────

const endpoint = `${baseUrl}/api/test-suite?secret=${encodeURIComponent(secret)}`

console.log(`\n${c.bold}${c.cyan}StockSmart Integration Test Suite${c.reset}`)
console.log(`${c.dim}Endpoint: ${endpoint.replace(secret, '***')}${c.reset}\n`)

let report
let httpStatus

try {
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(120_000) })
  httpStatus = res.status

  if (httpStatus === 401) {
    console.error(`${c.red}ERROR: Unauthorized — check your TEST_SUITE_SECRET.${c.reset}`)
    process.exit(1)
  }

  report = await res.json()
} catch (err) {
  console.error(`${c.red}ERROR: Could not reach ${baseUrl} — is the app running?${c.reset}`)
  console.error(err.message)
  process.exit(1)
}

// ── Output ────────────────────────────────────────────────────────────────────

if (jsonOut) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  process.exit(report.failed > 0 ? 1 : 0)
}

// Group results by their group name
const groups = {}
for (const result of report.results) {
  const g = result.group || 'default'
  if (!groups[g]) groups[g] = []
  groups[g].push(result)
}

for (const [groupName, tests] of Object.entries(groups)) {
  const groupFailed  = tests.filter(t => t.status === 'fail').length
  const groupPassed  = tests.filter(t => t.status === 'pass').length
  const groupSkipped = tests.filter(t => t.status === 'skip').length

  const statusIcon = groupFailed > 0 ? c.red + '●' + c.reset : c.green + '●' + c.reset
  console.log(`${statusIcon} ${c.bold}${groupName}${c.reset} ${c.dim}(${groupPassed} passed, ${groupFailed} failed, ${groupSkipped} skipped)${c.reset}`)

  for (const t of tests) {
    const dur = t.durationMs > 0 ? `${c.dim} ${t.durationMs}ms${c.reset}` : ''
    if (t.status === 'pass') {
      console.log(`  ${pass(t.name)}${dur}`)
    } else if (t.status === 'fail') {
      console.log(`  ${fail(t.name)}${dur}`)
      if (t.error) {
        console.log(`    ${c.red}${c.dim}${t.error}${c.reset}`)
      }
    } else {
      console.log(`  ${skip(t.name)}`)
    }
  }
  console.log()
}

// ── Summary ───────────────────────────────────────────────────────────────────

const { passed, failed, skipped, total, durationMs } = report

const bar = '─'.repeat(42)
console.log(`${c.dim}${bar}${c.reset}`)

if (failed === 0) {
  console.log(`${c.bold}${c.green}All ${passed} tests passed${c.reset} ${c.dim}(${durationMs}ms)${c.reset}`)
} else {
  console.log(
    `${c.bold}${c.red}${failed} failed${c.reset}` +
    `, ${c.green}${passed} passed${c.reset}` +
    (skipped > 0 ? `, ${c.yellow}${skipped} skipped${c.reset}` : '') +
    ` ${c.dim}of ${total} total (${durationMs}ms)${c.reset}`
  )
}

console.log()

// ── Failed test details ───────────────────────────────────────────────────────

const failures = report.results.filter(r => r.status === 'fail')
if (failures.length > 0) {
  console.log(`${c.bold}${c.red}FAILURES${c.reset}`)
  console.log(`${c.dim}${bar}${c.reset}`)
  failures.forEach((f, i) => {
    console.log(`\n${c.bold}${i + 1}) [${f.group}] ${f.name}${c.reset}`)
    console.log(`   ${c.red}${f.error || 'Unknown error'}${c.reset}`)
  })
  console.log()
}

process.exit(failed > 0 ? 1 : 0)
