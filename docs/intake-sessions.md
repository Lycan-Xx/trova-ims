# Intake Sessions — draft/resume: what it is, and when it earns its place

This document exists because we deliberately chose **not** to build draft/resume
right now, and future-us (or whoever picks this up) needs to know why, and
exactly what would change that decision. Written to be read again in three
months without needing this conversation's context.

## What we built instead (this PR)

A **session** is nothing more than a shared `intake_session_id` (nullable
`UUID`) stamped onto every `batches` row created in one form submission. There
is no `intake_sessions` table. A session only exists retroactively, as the
group of batches that share that ID — it isn't a thing you can create, save,
or come back to before at least one batch has actually been written to the
database.

Concretely: the Stock Intake form now supports multiple line items (product +
vendor + qty + cost + expiry, one line per item). Fill in as many lines as
you want, hit submit once, and every line commits in a single transaction —
one shared session ID, or nothing at all if any line fails validation. See
`app/actions/batches.ts` (`createBatchSession`) and
`components/intake/intake-form.tsx`.

## What this does NOT support

If you start filling in a 14-line intake and close the tab, or your phone
dies, or you get pulled away — **everything you typed is gone.** There is no
"continue where I left off." You start the form over from an empty line.

This is the one real gap against the full scenario set we scoped (see
`docs/intake-session-scenarios.md` if kept, or the earlier conversation —
Scenario 6: partial-entry interruption).

## Why we're not building draft/resume now — the Agile argument

Building resumable drafts means: a real `intake_sessions` table with a
`status` column (`draft` / `committed`), an autosave or explicit "save draft"
action, a "your unfinished intakes" list somewhere in the UI, and rules for
what happens to a draft that references a product later deactivated, or sits
untouched for a month. That's a second feature, not a checkbox — it has its
own edge cases, its own UI surface, and its own testing burden.

Building it speculatively — before anyone has actually hit the wall — is the
thing an agile/lean approach explicitly avoids: it's unvalidated scope
sitting on the shelf, a maintenance cost paid before there's evidence it's
needed. The lightweight version (this PR) ships the workflow improvement
that was actually asked for — multi-vendor, multi-product entry in one
sitting — at a fraction of the cost, and it does not foreclose adding
drafts later. Nothing about `intake_session_id` needs to change if we add a
table on top of it later; existing session IDs would simply get backfilled
into new `intake_sessions` rows.

**The rule: don't build resume until real usage tells you to.**

## The trigger — what specifically justifies building it

Not a gut feeling, not "it'd be nice." One or more of these, observed in
actual usage:

1. **A support/feedback signal.** A store owner explicitly reports losing a
   half-finished intake — a call dropped, the browser closed, whatever — and
   asks "why do I have to start over?" One report is a data point; two or
   three independent reports is a pattern worth acting on.

2. **A measurable session size that makes restart genuinely painful.**
   If session line-counts in production cluster around 3–5 lines, restarting
   is mildly annoying but not costly — nobody's going to ask for drafts over
   that. If they cluster around 15–20+ lines (a store doing a serious
   monthly stock-up across many vendors), the cost of losing that entry goes
   up a lot, and resume starts paying for itself. This is answerable
   directly from data once sessions exist: `SELECT intake_session_id,
   COUNT(*) FROM batches WHERE intake_session_id IS NOT NULL GROUP BY
   intake_session_id` gives you the real distribution, no guessing.

3. **A specific interruption pattern shows up in how the product is
   actually used** — e.g. store staff routinely do intake on a shared phone
   that gets used for other things mid-task, or intake happens over a spotty
   connection where the page reloads unexpectedly. Environmental signals
   like this are worth watching for even before #1 or #2 show up as
   complaints.

If none of these show up after a few months of real usage, that's not a
failure to prioritize — it's confirmation the lightweight version was the
right call.

## How to build it, when the trigger fires

Scoped so whoever picks this up later doesn't have to re-derive the design:

1. **New table:**
   ```sql
   CREATE TABLE intake_sessions (
     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
     status      TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'committed'
     notes       TEXT,
     created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
   `batches.intake_session_id` becomes a proper FK to this table instead of a
   bare UUID — a backward-compatible change, existing values slot right in.

2. **A `intake_session_lines` staging table** (or a JSONB column on
   `intake_sessions` if the line shape stays simple) to hold in-progress,
   not-yet-committed line data — since a draft line doesn't correspond to a
   `batches` row yet (no stock should be recorded as received until the user
   actually confirms). This is the part that doesn't exist at all today and
   needs real design work when the time comes — don't reuse `batches` for
   draft storage, since `qty_remaining`/FEFO logic assumes every batch row
   is real, received stock.

3. **Autosave** on the client — debounced writes of the in-progress line
   list to the draft session as the user fills the form in, not just on
   explicit "Save Draft" (people forget to click save).

4. **A "Continue unfinished intake" entry point** — likely on the Intake
   list page, or a banner on `/intake/new` if a draft already exists for
   this user/store.

5. **A staleness policy** — decide what happens to a draft nobody's touched
   in, say, 30 days (auto-discard? flag it? just leave it — low cost either
   way, but pick one on purpose rather than by accident).

None of this needs to be designed further right now. It's here so the next
pass starts from a plan instead of a blank page.
