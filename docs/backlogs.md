# Backlog

Non-critical tasks, feature ideas, and known-but-not-urgent bugs. Not a sprint plan — just a holding pen so findings aren't lost. Pull items into active work when there's bandwidth.

Each entry: **Why** it matters, **Affected files**, and any **Findings** from the conversation/investigation that surfaced it.

---

## Replace in-memory lock store with Redis

**Why:** `lib/queue/lock.ts` uses an in-memory `Map` with manual TTL checks to prevent two specialists from reviewing the same application simultaneously. This works for a single-process dev environment but is not safe under multiple server instances or restarts — a process restart clears all locks, and two instances can grant the same lock independently.

**Affected files:**

- `lib/queue/lock.ts` — swap `Map<string, Lock>` for `ioredis` client; use native key TTL (`SET lock:application:{id} ... EX 300`) and `DEL` for supervisor break; `getLock` becomes a Redis `GET` + JSON parse

**Findings:**

- Key pattern: `lock:application:{id}`, value: `JSON.stringify({ specialistId, specialistName, acquiredAt })`, TTL: 300s
- `acquireLock` → Redis `SET ... NX EX` (atomic compare-and-set)
- `refreshLock` → `GET` to verify owner, then `EXPIRE` to reset TTL
- `releaseLock` → `GET` owner check, then `DEL` (or skip check for supervisor break)
- No Lua scripting needed for this simple case — `GET` + `DEL` sequence is safe since only the lock holder calls release

---

## Wire Audit Log to real resolved applications

**Why:** The Audit Log page (`/audit`) currently renders hardcoded static data. Resolved applications (approved or rejected) disappear from the Queue but don't surface anywhere real — they're stored in memory via `resolveApplication()` but never exposed to the UI.

**Affected files:**

- `app/audit/page.tsx` — replace static `AUDIT_ENTRIES` / `SUMMARY` / `TIMELINE` with live data from a new API endpoint
- `app/api/audit/route.ts` — new endpoint; call `listResolved()` from the store
- `lib/queue/store.ts` — add `listResolved()` that returns applications where `status === "resolved"`

---

## Multi-image support in batch upload

**Why:** Batch upload currently maps 1 CSV row → 1 image file via the `filename` column. Once `QueueApplication` stores `images[]` (multi-image), the batch route will need to collect multiple images per row and run OCR on each, merging field results by best confidence. Without this, batch-submitted applications can't carry front + back label images the way queue-submitted ones can.

**Affected files:**

- `app/batch/page.tsx` — UI unchanged (already accepts `multiple` files); no changes expected
- `app/api/batch/route.ts` — split `row.filename` on commas, collect multiple entries from `imageMap`, run OCR per image, merge `ExtractedLabelData` and `BoundingBoxMap` across images, build `images[]` on `QueueApplication`
- `lib/queue/types.ts` — `imageBase64`/`imageMimeType` → `images[]` (same breaking change as the application page work)
- `tests/mocks/labels.csv` — update `filename` column to accept comma-separated values (e.g. `"label-1-front.png,label-1-back.png"`) while keeping single-filename rows backward-compatible

**Findings:**

- Comma-separated `filename` is the least-disruptive CSV change — existing single-image rows are unaffected (splitting a single filename on comma is a no-op).
- OCR merge strategy: for each field, take the extraction from whichever image returned higher confidence; store `imageIndex` on each `BoundingBox` so the UI knows which carousel slide to jump to.
- Do this after the application-page multi-image work is done — the types need to land first.

---

## Layer 2: refine regex for TTB COLA field extraction

**Why:** The two-layer OCR pipeline (Layer 1: OCR engine reads pixels → Layer 2: regex guesses which text is which field — see `docs/system-design.md` "Two-Layer Extraction" diagram) is only as good as its regex patterns. Testing the new Google Vision provider against `tests/kraken-reach.png` showed the current patterns miss fields that are present in the OCR text but phrased differently than the regex expects, and can't distinguish "OCR read garbled text" from "regex pattern doesn't cover this phrasing" — both currently just surface as `null`.

**Affected files:**

- `lib/ocr/tesseract.ts` — `extractAbv`, `extractBrandName`, `extractClassType`, `extractBottler`, `extractCountryOfOrigin`, `extractGovernmentWarning`, `extractNetContents` (shared verbatim by `google-vision.ts`, so any fix here benefits both providers at once)
- `lib/ocr/google-vision.ts` — consumer of the same regex functions, no changes expected here unless Vision-specific text quirks emerge

**Findings from this chat:**

- On `tests/kraken-reach.png`, `bottler` and `countryOfOrigin` returned `null` because the label simply has no "Bottled by"/"Produced by"/"Product of"/"Made in" phrase for the regex to key off of — a genuine regex-coverage gap, not an OCR failure.
- `governmentWarning` returned `null` because Vision read the warning text as "GOHENNMENT WARNING" (OCR garbling on a low-quality/placeholder label), and `extractGovernmentWarning`'s `GOVERNMENT WARNING:` prefix match correctly rejected it — this is a stricter, higher-stakes field per `docs/ocr-comparison.md` §6.2, which recommends switching this field specifically to a Levenshtein edit-distance check against the fixed TTB warning text instead of an exact prefix match, so near-miss OCR garbling can still pass.
- `extractBrandName` is the most fragile pattern — "first non-empty line under 80 chars" is a heuristic, not a real signal, and will misfire on labels where the brand isn't the first line (e.g. a tagline or vintage year printed above it).
- No visibility today into _why_ a field is null (bad OCR vs. no regex match vs. regex too strict) — worth considering whether `OcrResult` should eventually distinguish these cases for the UI, rather than collapsing both to `null`.

---

## ~~Preview deployment env vars need to point at the Supabase (production) database~~ — RESOLVED 2026-07-04

**Resolution:** The actual root cause was broader than first thought — production itself had an empty `public` schema (`scripts/init-db.sql` had only ever been run against local Docker Postgres), which is why `/api/queue`/`/api/audit` were 500ing in production (visible as browser console errors) as well as on preview. Fixed by applying `scripts/init-db.sql` directly to the production Supabase project (`tjyfcwzfgkivknlzfjlz`) via the Supabase MCP. See `docs/CHANGELOG.md` [2026-07-04] "initialize production Supabase schema" for details. Confirmed fixed in the browser.

Still worth checking separately if preview deployments recur: whether Vercel's Preview environment scope has `DATABASE_URL`/`POSTGRES_URL` set identically to Production (Project → Settings → Environment Variables) — that was the original theory and may still cause preview-specific connection issues (e.g. `ECONNREFUSED 127.0.0.1:5432` seen on `dpl_46TU9xha5J54dxsuG1J5JrNobwSt`) independent of the schema gap.

---

## RLS disabled on all production Supabase tables

**Why:** Supabase's schema-init migration (`scripts/init-db.sql`, applied 2026-07-04) created all 7 tables with Row Level Security disabled. Supabase's advisor flags this as `ERROR` severity — every `public` schema table is exposed via PostgREST to the `anon` role by default, meaning anyone with the project's anon/publishable key could read/write every row directly, bypassing the app's API routes entirely. Not an active exploit today since `lib/db.ts` connects via `pg.Pool` + `DATABASE_URL` rather than the Supabase JS client, but it's a live risk the moment any client-side Supabase usage (anon key) is introduced, and it's flagged by Supabase's own security linter regardless.

**Affected files:**

- Supabase project `tjyfcwzfgkivknlzfjlz`, tables: `applications`, `application_data`, `application_images`, `ocr_data`, `review_sessions`, `field_notes`, `resolutions`

**Findings:**

- Remediation SQL is just `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` per table, but enabling RLS with zero policies blocks all access outright — needs policies defined first (or continue restricting all access to the service-role/direct-`pg` connection and explicitly accept the current model, documented rather than silently open).

---

## Regulations reference page (`/regulations`)

**Why:** Neither applicants nor specialists currently have an in-app way to look up *why* a field matters or what the underlying TTB rule is — reviewers rely on domain knowledge and applicants get no context on rejections beyond the flagged field name. A reference project in this space (Excisely, see its changelog) ships this as a curated, plain-English CFR reference (~30 sections across 27 CFR Parts 4-7 and 16), searchable/filterable by beverage type, with deep links to eCFR, plus contextual CFR citation badges on flagged fields in the review UI. Confirmed out of scope for the current requirements — this is forward-looking, not a gap against anything we've committed to build.

**Scope (for later):**

- New `/regulations` route, accessible to both applicant and specialist roles (not gated behind either `AppShell`/`ApplicantNav`-only nav — needs to show in both navs)
- Curated regulatory content data file (e.g. `lib/regulations/data.ts` or `src/config/regulations.ts`) — not a live eCFR fetch, a maintained local summary per section (mirrors how `lib/ttb-rules.ts` already encodes TTB business rules locally rather than calling an external service)
- Lookup utility (e.g. `lib/regulations/lookup.ts`) to search/filter by field name, beverage type, or free text
- Searchable/filterable UI on the `/regulations` page itself (by beverage type at minimum)
- Deep links out to the actual eCFR section for full legal text
- Contextual integration: CFR citation badges in field tooltips + a "See regulation" link on flagged fields during specialist review (`components/queue/*`), so a discrepancy connects directly to the rule it violates

**Findings:**

- `lib/ttb-rules.ts` is the closest existing analog — it already encodes some TTB rule logic, so the curated regulations content and the verification rule logic should probably stay separate concerns (one is human-readable reference copy, the other is executable matching logic) even if they cite the same CFR sections
- Needs both-roles nav placement decided up front, since `ApplicantNav.tsx` and the specialist `Sidebar.tsx`/`AppShell.tsx` are currently separate nav components with no shared route list

---

## Consider migrating `lib/db.ts` from `pg.Pool` to `@supabase/supabase-js`

**Why:** Currently deferred — the direct `pg.Pool` connection works fine against production Supabase Postgres (confirmed 2026-07-04 after the schema-init fix above), so there's no functional problem to solve today. This is a discretionary architecture change, not a bug fix.

**Affected files (if pursued):**

- `lib/db.ts` — replace `pg.Pool` with a `supabase-js` client (`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`)
- `lib/queue/store.ts`, `lib/queue/audit.ts` (572 lines combined) — every function rewritten to call `supabase.rpc(...)` instead of `pool.query`/transactional `client.query`
- New Postgres functions (`assemble_application`, `insert_application`, `update_application`, `resolve_application`, `revert_resolution`, `list_queue_rows`, `list_audit_entries`, `get_audit_summary`, `get_recent_activity`) added to `scripts/init-db.sql`, since `supabase-js`/PostgREST can't express the existing multi-table `BEGIN`/`COMMIT` transactions or raw joins/`FILTER`/`AVG(EXTRACT(...))` aggregates directly — these have to move into `RETURNS jsonb` SQL functions and get called via RPC
- `scripts/seed-db.ts`, `scripts/seed-resolutions.ts` — client swap
- `package.json` — drop `pg`/`@types/pg`, add `@supabase/supabase-js`
- Local dev tooling — the ad hoc Postgres Docker container would need to become the Supabase CLI's local stack (`supabase start`, itself Docker-based) since `supabase-js` talks to PostgREST, which a bare Postgres container doesn't run

**Pros:**

- Lets RLS be turned on with a deny-all policy while only the backend's service-role key (which bypasses RLS) can read/write — closes the "RLS disabled" advisory finding above cleanly, rather than leaving direct raw-SQL access as the sole safeguard
- Opens the door to Supabase-native features if ever needed later (Storage for label images instead of base64-in-column, Realtime subscriptions, client-side Auth) without a second client library
- One connection-management layer (`supabase-js`) instead of hand-rolling `sslmode=no-verify` string surgery in `lib/db.ts` to work around `pg`'s SSL-mode quirks (see [2026-07-04] CHANGELOG fixes)

**Cons:**

- Real rewrite, not a swap: ~9 new Postgres RPC functions need to reproduce existing transactional/join logic exactly, with matching behavior under test
- Local dev setup changes from a plain Postgres container to the Supabase CLI stack — a bigger onboarding/tooling change than it sounds, and diverges further from "just Docker Postgres" if that simplicity was intentional
- No functional bug is being fixed — purely a bet on future Supabase-feature needs or RLS posture, both of which can also be addressed narrowly (e.g. RLS can be enabled today with a service-role-only policy without touching the `pg` client at all)
- Existing integration tests (`app/api/queue/*.test.ts`, `lib/queue/store.test.ts`) run directly against Postgres today; they'd need the local Supabase stack running to pass post-migration

---

## Guardrail against schema drift between local and production DB

**Why:** This has now caused production 500s twice — once when `scripts/init-db.sql` had never been run against production at all (2026-07-04, see CHANGELOG), and again on 2026-07-06 when the `batch_runs` table (added for the batch-review cron feature) was created locally but never applied to the production Supabase database, causing `GET /api/queue` to throw `relation "batch_runs" does not exist` and 500. Both times the bug shipped silently because nothing checks that the schema a deploy's code expects actually exists in the target database.

**Affected files:**

- `scripts/init-db.sql` — currently a single hand-run, drop-and-recreate script with no tracking of what's been applied where; would need to become incremental numbered migrations (e.g. `scripts/migrations/0001_init.sql`, `0002_add_batch_runs.sql`) run through a tool that tracks applied versions (Supabase CLI `supabase db push`, or `node-pg-migrate`)
- CI/deploy pipeline (currently no migration step) — would need a required step that runs migrations against `DATABASE_URL` before/as part of deploy, so a deploy can't ship code expecting a table that was never created
- Optionally, a `/api/health` route that touches every table the app depends on, hit automatically against preview deployments to fail the build before it reaches production

**Findings:**

- Minimum viable version without adopting a full migration framework: keep incremental SQL files in `scripts/migrations/`, and add a one-line CI check (e.g. `psql $DATABASE_URL -c "\dt"` diffed against the expected table list) that fails the deploy if any expected table is missing
- Separately (not a guardrail, still open): `app/page.tsx`'s `loadQueue()` has no error handling around the fetch/`res.json()` call, so a 500 from `/api/queue` leaves the UI stuck on "Loading queue…" forever with no visible error — masking the underlying DB issue from the user entirely instead of surfacing a retry/error state
