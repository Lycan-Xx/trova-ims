# Sales integrity repair plan

Baseline: the 2026-09-11 audit. No historical totals will be rewritten automatically.

## First patch (implemented in this working tree)

1. Replace shared manual desktop transactions with a native PGlite transaction API; migrate transactional callers and prevent unsafe manual transaction use.
2. Share quantity-aware pricing between server quotes and checkout. Validate cart quantities, normalize duplicate products, require expected-total agreement, and show committed receipt values.
3. Serialize export jobs, preserve distinct windows, read committed snapshots, and advance export state only after successful output. Suspend automatic age-based purging pending verified archive coverage.
4. Correct business-date formatting and daily SQL boundaries; test Lagos midnight with a UTC database session.
5. Convert audit reproductions to regression assertions, replay the supplied CSV, typecheck, and add a lightweight CI gate before desktop packaging.

## Follow-up patch (implemented in this working tree)

- Auditable owner-only voids with required reason and receipt confirmation. The original sale remains queryable with actor/time/reason, is excluded from operational totals/exports, and tracked stock is restored in the same transaction. Permanent deletion is disabled through the legacy action.
- Pending-checkout recovery across reloads. The client stores only a request ID/fingerprint, and can query the committed result before a cashier starts another sale.
- Immutable CSV publication with a SHA-256 manifest containing receipt coverage and totals. The two-year desktop purge is enabled only after every old active receipt is covered by a valid, hash-matching manifest; voided rows remain as audit history.
- Runtime/cloud and desktop schemas include backward-compatible void columns; the release metadata is synchronized at version 1.7.0.

## Validation and release

Use isolated PGlite and synthetic temporary exports only. Customer CSV is a read-only optional replay input and is not committed. No customer database, migration endpoint, purge endpoint, release, or GitHub workflow is executed locally. No Rust build locally; compile/package validation belongs to the existing GitHub Actions workflow. The local checks completed for this patch are TypeScript, ESLint, schema/action regression replay, archive hash/coverage checks, and build-setup metadata validation. A source patch is not a verified customer-machine release.
