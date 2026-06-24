/**
 * Lightweight test harness for the StockSmart API test suite.
 * No external dependencies — runs inside Next.js API routes against the real DB.
 */

export interface TestResult {
  name: string
  group: string
  status: 'pass' | 'fail' | 'skip'
  durationMs: number
  error?: string
}

export interface TestSuiteReport {
  passed: number
  failed: number
  skipped: number
  total: number
  durationMs: number
  results: TestResult[]
}

type TestFn = () => Promise<void> | void

export class TestRunner {
  private results: TestResult[] = []
  private currentGroup = 'default'
  private startTime = 0

  group(name: string, fn: () => void) {
    const prev = this.currentGroup
    this.currentGroup = name
    fn()
    this.currentGroup = prev
  }

  test(name: string, fn: TestFn) {
    this._enqueue(name, fn)
  }

  skip(name: string, _fn: TestFn) {
    this.results.push({
      name,
      group: this.currentGroup,
      status: 'skip',
      durationMs: 0,
    })
  }

  private _enqueue(name: string, fn: TestFn) {
    // Store as-is; run() executes sequentially
    this.results.push({ name, group: this.currentGroup, status: 'pass', durationMs: 0, _fn: fn } as TestResult & { _fn: TestFn })
  }

  async run(): Promise<TestSuiteReport> {
    const executed: TestResult[] = []
    this.startTime = Date.now()

    for (const r of this.results) {
      const item = r as TestResult & { _fn?: TestFn }
      if (r.status === 'skip' || !item._fn) {
        executed.push({ name: r.name, group: r.group, status: 'skip', durationMs: 0 })
        continue
      }

      const t0 = Date.now()
      try {
        await item._fn()
        executed.push({ name: r.name, group: r.group, status: 'pass', durationMs: Date.now() - t0 })
      } catch (err) {
        executed.push({
          name: r.name,
          group: r.group,
          status: 'fail',
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const passed = executed.filter((r) => r.status === 'pass').length
    const failed = executed.filter((r) => r.status === 'fail').length
    const skipped = executed.filter((r) => r.status === 'skip').length

    return {
      passed,
      failed,
      skipped,
      total: executed.length,
      durationMs: Date.now() - this.startTime,
      results: executed,
    }
  }
}

// ── Assertion helpers ──────────────────────────────────────────────────────────

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

export function assertEqual<T>(actual: T, expected: T, label = '') {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

export function assertNotNull<T>(value: T | null | undefined, label = ''): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${label ? label + ': ' : ''}expected non-null value, got ${value}`)
  }
}

export function assertSuccess<T>(
  result: { success: true; data: T } | { success: false; error: string },
  label = '',
): result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(
      `${label ? label + ': ' : ''}action failed: ${(result as { success: false; error: string }).error}`,
    )
  }
  return true
}

export function assertMatch(value: string, pattern: RegExp, label = '') {
  if (!pattern.test(value)) {
    throw new Error(
      `${label ? label + ': ' : ''}${JSON.stringify(value)} did not match ${pattern}`,
    )
  }
}
