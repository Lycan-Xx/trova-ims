# Desktop sales integrity audit — 11 September 2026

## Conclusion

**The app cannot be cleared of fault.** Executable tests against the current desktop database adapter and sales actions reproduced defects capable of losing, adding, or misrepresenting more than NGN 10,000. However, neither these tests nor the supplied CSV prove which mechanism caused this customer's particular differences. Human error remains possible, but is not established.

The ordinary arithmetic and daily aggregation work on a reconstruction of all supplied transactions. That is a narrower finding than database integrity, completeness of exports, or agreement between the amount shown to a cashier and the amount saved.

This was a diagnostic audit: no production implementation was changed, no customer database was opened, and no Rust build or GitHub workflow was run.

## Evidence and reconciliation

Input: `C:\Users\lycan-xx12\Downloads\Localsend\sales-2026-09-07-to-2026-09-11.csv`.

SHA-256: `FA702352160BB8807B5F3ABEC297A3B6F091E97CA44A6EC56248E1733838EEB5`.

There are **440 item rows representing 380 transaction IDs**, including 53 multi-line transactions. All amounts below are NGN. Difference means **CSV minus the manually computed figure**.

| Date | Transactions | Item rows | CSV sales | Manual figure | Difference |
| --- | ---: | ---: | ---: | ---: | ---: |
| 7 Sep | 62 | 70 | 90,500 | 92,600 | -2,100 |
| 8 Sep | 78 | 89 | 123,450 | 114,900 | +8,550 |
| 9 Sep | 115 | 133 | 229,850 | 225,300 | +4,550 |
| 10 Sep | 113 | 135 | 216,300 | 224,850 | -8,550 |
| **7–10 Sep** | **368** | **427** | **660,100** | **657,650** | **+2,450** |
| 11 Sep, partial | 12 | 13 | 16,600 | Not supplied | — |

The four-day net difference is **+2,450**, not -2,450. The equal-and-opposite 8,550 differences on the 8th and 10th are suggestive of a reconciliation/date-allocation issue, but do not identify a moved transaction or prove that explanation.

| Date | Cash | Transfer | First–last exported time |
| --- | ---: | ---: | --- |
| 7 Sep | 22,800 | 67,700 | 11:38:14–22:40:16 |
| 8 Sep | 26,200 | 97,250 | 11:37:53–22:08:25 |
| 9 Sep | 27,050 | 202,800 | 12:46:49–22:34:48 |
| 10 Sep | 18,200 | 198,100 | 11:06:17–21:51:09 |
| 11 Sep | 500 | 16,100 | Through 14:14:05 |

Every line satisfies quantity × unit price = subtotal. For every transaction group, item subtotals equal its header total, and its date, time, payment method, and repeated total agree. Overall revenue is **676,700**.

**Do not sum the CSV's `Total` column across item rows.** It repeats the entire transaction total on each item line. That produces 925,550 instead of 676,700; the incorrect daily figures would be 115,500 / 159,150 / 328,150 / 302,550 / 20,200. Sum `Subtotal`, or take `Total` once per transaction. This export-format trap does not match the supplied manual differences on its own.

The first exported record is after the stated approximately 11:00 installation on 7 September. There are no pre-7th records to compare, and no pre-installation morning records in this file. These timestamps are consistent with post-upgrade activity, but cannot establish the installed binary or whether earlier sales existed elsewhere.

PS5 and PS4 appear at multiple prices (PS5: 500/1,000/2,000; PS4: 300/600/1,200). This is not proof of corruption: the CSV lacks product UUIDs, batch identifiers, inventory-tracking history, and original checkout quotes.

## Scope and method

Source baseline: HEAD `120baee`, app version 1.7.0. The earlier join-multiplication fix in `cfac202` predates 1.6.1; `2304f9e` introduced the September 7 request-ID/full-day-total/delete changes. The current revenue query sums sales headers without multiplying them by item joins.

Reproduction harness: [scripts/audit-desktop-sales.cjs](../scripts/audit-desktop-sales.cjs).

- Executes the actual TypeScript desktop `withConnection` adapter, sales actions, analytics actions, database helpers, desktop schema, and filesystem exporter against isolated in-memory PGlite databases.
- Replaces authentication with a fixed owner and replaces persistent database initialization with isolated query routing. It does not connect to the customer's database.
- Uses installed PGlite 0.5.5 and Node 22.12.0. TypeScript transpilation is for executing these modules, not a complete application typecheck.
- Replays all 380 CSV baskets. Products are reconstructed per name/price as untracked because original product and batch IDs are unavailable. Historical timestamps are assigned explicitly after checkout. This tests recorded arithmetic/reporting, not a reconstruction of the original inventory or exact user interaction.
- Tests deterministic overlap by pausing query execution; selected failure cases deliberately inject an item-write error. This proves a possible failure mechanism, not its frequency in normal use.
- Price-preview and dashboard-date tests reproduce source formulas; they are not rendered-browser tests.
- All 14 scenarios passed their assertions in the post-fix full run, including the 380-transaction replay. A `PASS` for a scenario named `BUG` in the original baseline means the defect was successfully reproduced, **not** that the implementation was safe. The post-fix scenarios use `Control` names. An initial timezone expectation was corrected after observing the actual local database timezone; the corrected test passed.
- No Rust compilation, desktop packaging, process-crash/durability test, physical terminal test, or customer-machine execution was performed. Rust build validation remains for GitHub Actions; no claim of compiler verification is made.

## Reproduced findings

### 1. Critical: desktop transactions do not exclusively own the database connection

Locations: `lib/db/index.ts:134`, `app/actions/sales.ts:150`, `app/actions/sales.ts:376`, `app/actions/sales.ts:387`.

The desktop adapter supplies a shim whose individual queries go to one shared PGlite instance. Callers send SQL `BEGIN`/`COMMIT`/`ROLLBACK`, but the adapter does not reserve the instance for the entire callback. Serializing individual queries is not equivalent to serializing complete transactions.

Reproductions using actual sales actions:

1. Checkout A writes a 12,000 sale and pauses. Checkout B fails ordinary cash validation and rolls back. A resumes and reports success, but **zero sales remain**: its 12,000 was rolled back by B.
2. A pauses after inserting its 12,000 header, before inserting items. B successfully records 3,000 and commits. A resumes and suffers an injected item-write error. A reports failure, yet the database contains **15,000 of headers and only 3,000 of sale items**. The actual retained-sales CSV export includes only 3,000 because it inner-joins items. Thus a CSV can be internally consistent while omitting a corrupt header that inflates the dashboard by 12,000.
3. A report reads a pending 12,000 header; the checkout then rolls back, leaving zero. A displayed report can therefore contain uncommitted revenue.
4. The background exporter writes a 12,000 sale that subsequently rolls back after an injected failure. The saved CSV retains 12,000 while database revenue is zero, and the export cursor has advanced.

A native PGlite transaction callback control correctly preserved the successful 12,000 transaction against a queued failing transaction. The [PGlite transaction API](https://pglite.dev/docs/api#transaction) provides a transaction-scoped callback with commit/rollback behavior; using it requires carefully routing all callback queries through its transaction handle.

**Reachability qualification:** Next's installed Server Actions guide says client dispatch is serialized per client. These two-checkout schedules must not be described as proof that an ordinary double-click in one client causes overlap. Multiple clients/independent requests require investigation on the customer's setup. Background exports and report queries are separate paths and can overlap a checkout even without two cashiers. No evidence supplied establishes that one of these schedules occurred there.

### 2. High: displayed basket prices can differ from saved prices

Locations: `app/actions/sales.ts:558`, `app/actions/sales.ts:575`, `app/(dashboard)/sales/new/page.tsx:88`, `app/(dashboard)/sales/new/page.tsx:230`.

The preview obtains a single effective price and multiplies it by quantity. Checkout allocates stock across batches and computes the actual total from those allocations.

- Tracked PS5: one unit at 1,000, later units at 2,000; quantity 12. Preview calculation **12,000**; saved sale **23,000**; discrepancy **+11,000**.
- Untracked PS4: catalog price 600, leftover batch price 1,200; quantity 20. Preview calculation **24,000**; saved sale **12,000**; discrepancy **-12,000**. The preview query considers the batch while checkout uses the untracked product price. Product updates allow tracking to be switched off without removing old batches.

Transfer checkout has no expected-total agreement check to reject this discrepancy. Cash validation may reject an insufficient payment instead. These tests use synthetic inventory conditions with product names/prices from the sample; the CSV does not establish that the customer's batch conditions matched them. Nevertheless, this is a demonstrated way for an honestly collected/displayed amount and recorded revenue to disagree without a simple arithmetic bug.

### 3. High: incremental exports can overwrite an earlier same-day file

Locations: `lib/desktop-sales-export.ts:134`, `lib/desktop-sales-export.ts:145`, `lib/desktop-sales-export.ts:176`.

The exporter advances its time-window cursor, but filenames contain dates rather than the precise window boundaries. Two different incremental windows with the same start/end dates use the same destination filename.

The real filesystem-export test wrote a first window containing 12,000, then a second containing 3,000. There was only one remaining CSV containing **3,000**, while database revenue remained **15,000**. The first 12,000 disappeared from that file.

This affects archive completeness, not the live database sum directly. It requires colliding date ranges: not every pair of closes necessarily collides. The supplied multi-day filename alone does not demonstrate a collision or establish which export path generated it.

### 4. Medium: date selection can use the wrong business day

Location: `app/(dashboard)/dashboard/page.tsx:24` and analogous date helpers.

At 00:30 Lagos on September 8, `toISOString().slice(0, 10)` selects September 7. This can show yesterday as today's dashboard before 01:00. The date-helper reproduction is separate from database timezone behavior.

In this environment PGlite actually initialized to local UTC+1 (`Etc/GMT-1`) and correctly classified a synthetic 00:30 Lagos transaction. Explicitly changing its timezone to UTC moved that 12,000 transaction to the previous reporting day. Therefore, a database timezone mismatch is **conditional**, not an established default defect on the customer's computer.

The supplied records are in daytime/evening hours, not near midnight. A one-hour boundary discrepancy does not explain these particular rows being assigned to a different day, and cannot explain an 8th-to-10th movement.

### 5. Additional integrity and audit limitations

- **Duplicate product entries:** a direct checkout payload containing two eight-unit entries for a product with only eight units succeeds and produces stock of -8. The normal cart merges product entries; this is an action-validation weakness, not evidence of ordinary UI usage producing duplicates.
- **Physical deletion:** the actual delete action removes a historical 12,000 sale and restores its tracked stock correctly, but leaves no sale-level void trail in these tables. An authorized deletion changes historical totals and cannot be explained retrospectively from the final CSV alone. Source: `app/actions/sales.ts:703`.
- **Retry scope:** repeating the same request ID returns the existing sale correctly. A new request ID permits the same basket again, as it must for legitimate separate purchases. A retry after state loss/reload is not covered by the same-ID guarantee. No such duplicate is proven here.
- **Evidence retention:** startup initialization contains approximately 30-day sales purging after successful export. An export marked successful is not proof against the archive defects above. Preserve customer data promptly, and inspect a clone before allowing initialization to export/purge it. Source: `lib/db/desktop-init.ts:180`.

## Controls that behaved correctly

1. All 380 reconstructed CSV transactions saved with the expected totals; all 440 row calculations were consistent.
2. `getSales` summaries and daily totals matched the CSV on pages 1, 2, and 6; `getSalesAnalytics` matched each day. There was no current page-only total or item-join multiplication in those tested paths.
3. Same-ID sequential retries did not duplicate a sale.
4. A standalone insufficient-cash checkout rolled back fully.
5. Changing a product's current catalog price did not rewrite a previously stored sale amount.
6. Native PGlite transaction callbacks passed the isolation control.
7. Deletion restored the exact tracked stock, although destroying the historical sales record limits auditability.

## What is needed to attribute this customer's differences

Before blaming an operator or selecting one bug as the cause, obtain:

- A preserved copy of the customer's desktop data directory/database, all automatic exports and export-state metadata, exact installed binary/version, application logs, and OS timezone. Do not modify the live database during diagnosis.
- The original manual ledger, receipts, cash counts, transfer confirmations, refunds/voids, and the definition of each day's cutoff. The provided daily numbers alone cannot distinguish revenue, cash received, and reconciled bank deposits.
- Product IDs, batch prices/quantities, and tracking settings/history, especially for PS4/PS5; number of open windows/clients; close/reopen times; observed checkout errors; and any sale deletions.

On a database clone, compare each header's `total_amount` with the sum of its items using a **LEFT JOIN** so headers with no items remain visible. Check missing items, line multiplication, negative batch quantities, duplicate receipt numbers, daily totals in the business timezone, and agreement with archived windows. A clean inner-joined export cannot substitute for these checks.

The supplied evidence is sufficient to reject “the app is definitely not at fault.” It is insufficient to claim “this particular bug caused the customer's 8,550 difference,” or to conclude human error.

## Recommended remediation order — not implemented in this audit

1. Give complete desktop transactions exclusive ownership using the supported PGlite transaction mechanism; coordinate reporting and exports so they read committed, consistent data. Review every shared adapter caller, not only checkout. Turn these defect reproductions into safety/regression assertions after fixing.
2. Produce a quantity-aware server quote honoring tracking mode and batch allocation; require confirmation when checkout total differs from the displayed/accepted quote. Show the committed result's amount after checkout.
3. Use unique precise export-window names, preserve previous exports, and tie the cursor to a safely committed export snapshot. Review retention before relying on these files as the sole archive.
4. Use explicit business-timezone date handling consistently across dashboards, filters, SQL, and exports.
5. Add auditable voids, duplicate-product payload validation, and appropriate database constraints; review request-ID recovery across lost responses/reloads.

## Reproduction command

Run from the repository with dependencies installed:

```powershell
node scripts/audit-desktop-sales.cjs 'C:\Users\lycan-xx12\Downloads\Localsend\sales-2026-09-07-to-2026-09-11.csv'
```

Optional `AUDIT_FILTER` selects scenario names by regular expression. The harness writes only synthetic exports to uniquely named OS temporary directories; it does not write the input CSV or open persistent customer databases. Failed assertions yield exit code 1. Dependencies are required, but no Rust build is involved.
