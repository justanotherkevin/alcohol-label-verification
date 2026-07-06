# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2026-07-06] — OCR Found percentage now matches the bounding-box overlay

### Fixed

- `components/queue/FieldReviewCard.tsx`: the "OCR Found" percentage shown in field review preferred `field.matchScore` (text similarity between the OCR output and the application data) over `field.confidence`, which is always empty since no OCR provider (`mock.ts`, `google-vision.ts`, `tesseract.ts`) populates a per-field confidence map. This made the reviewer-facing percentage disagree with the confidence badge drawn on the label region image, which comes from the bounding-box localization score computed in `computeFieldBoxes()` — e.g. a field could show "100%" next to the extracted text while its box overlay showed "82%" for the same field.
- `components/queue/FieldReviewCard.tsx`, `components/queue/PassedFieldPanel.tsx`, `app/queue/[id]/page.tsx`: threaded the field's `BoundingBox[]` down to `FieldValueRows`, which now averages the boxes' `confidence` and uses that for the displayed percentage (falling back to `field.confidence`/`matchScore` only when no box confidence is available), so the two numbers agree.

## [2026-07-06] — unify bounding-box location with fuzzy text matching

### Fixed

- `lib/ocr/extraction.ts`: a field could pass fuzzy text matching (`findFuzzyMatch`'s substring/dice-window/scattered-word stages) while its bounding box came back `null`, because `computeFieldBbox` only ever tried a strict contiguous-word walk — visible as "No location found on label" on a field showing a 100% OCR text match. Replaced it with `computeFieldBoxes()`, which mirrors the same three-stage fallback used for text (contiguous substring → Dice-scored sliding window → scattered significant-word matching) and returns `BoundingBox[]` instead of a single box-or-null, so a garbled or scattered OCR read now surfaces disconnected boxes around whatever was actually located rather than nothing.

### Changed

- `lib/ocr/types.ts`: `BoundingBoxMap` values are now `BoundingBox[]` (empty array = not found) instead of `BoundingBox | null`, threaded through every provider (`tesseract.ts`, `google-vision.ts`, `mock.ts`, `llm-prompt.ts`), `merge.ts`, and `regenerate-extracted.ts`.
- `components/queue/LabelRegionPanel.tsx`, `components/queue/ImageExpandModal.tsx`: render every box in the array (drawing multiple disconnected rectangles when the scattered-word fallback fires) instead of a single rect; the "no location" empty state now only shows when the array is empty.
- `tests/mocks/labels/_extracted.json`: regenerated via `scripts/regenerate-extracted.ts` against the updated matcher.

## [2026-07-06] — applicant portal visual polish

### Changed

- `components/ApplicantNav.tsx`: sticky/blurred header, primary-tinted logo badge, active-nav shadow, and an avatar-initial badge next to "Signed in as". Avatar is `aria-hidden`; the accompanying name text uses `sr-only sm:not-sr-only` so it stays announced to screen readers even where it's visually hidden below the `sm` breakpoint.
- `components/ApplicantHome.tsx`: added a Total / In review / Resolved summary tile row, icons on status badges, a richer empty state, and subtle hover/shadow polish on the applications table.
- `app/apply/page.tsx`: label-picker cards get shadow + hover-lift + image zoom; the review step has a sticky image column, focus rings on inputs, and an icon-styled error banner; the submitted confirmation now uses a circular icon badge and a constrained width.
- `app/page.tsx`: moved the "Start batch review" action from the page header into the "Pending Applications" table header, next to the heading it acts on.
- `app/layout.tsx`: extended the Material Symbols `icon_names` allowlist to include the new icons used above (`add`, `arrow_back`, `check_circle`, `error`, `inventory_2`, `schedule`, `visibility`) — the font is served as a subset, so unlisted icons were rendering as literal ligature text (e.g. "ARROW_BACK") instead of glyphs.
- `components/queue/FieldStatusStrip.tsx`: enlarged dash size, gaps, text, and button sizing for readability.

## [2026-07-06] — fix net contents unit-format false mismatch

### Fixed

- `lib/verify.ts`: `netContents` was compared with an exact-string match only (unlike `abv`, which already tolerates format differences), so a genuinely matching fill size like OCR's `"750ml"` against application data `"750 mL"` was flagged as a mismatch just because of unit spacing/casing. Added `netContentsMatch()`, parsing both sides to mL via the existing `parseNetContentsMl()` (already used for the regulatory fill-size check), and used it for status determination the same way `abvMatch()` already works for ABV.
- `lib/verify.test.ts`: added coverage for dropped-space and casing variants, plus a regression guard confirming a genuinely different volume still fails.

## [2026-07-06] — fuzzy partial-match bounding boxes

### Added

- `lib/text-similarity.ts`: standalone Dice-coefficient bigram `diceSimilarity()` helper, used by the new fuzzy matching below.
- `lib/ocr/extraction.ts`: `findFuzzyMatch()` — a fallback used when a field's strict matcher (exact/format-variant) returns `null`, so OCR noise (typos, garbled small print) still resolves a value instead of leaving the field unfound. `computeFieldBbox()` now walks OCR words consecutively (ported from excisely's `findMatchingWords`, see `docs/CHANGELOG.md` history) and scores partial coverage instead of requiring every word to independently contain a token, populating `BoundingBox.confidence` (0-1) with the coverage score.
- `components/queue/LabelRegionPanel.tsx`: draws a percentage badge on the highlighted region when `bbox.confidence < 1`, so a partial match is visibly distinguishable from a perfect one.
- `lib/text-similarity.test.ts`, new cases in `lib/ocr/extraction.test.ts`: cover fuzzy-fallback resolution, no-false-positive regression, and bbox confidence scoring (perfect, partial, below acceptance floor).

### Changed

- `tests/mocks/labels/_extracted.json`: regenerated via `scripts/regenerate-extracted.ts` against the real Vision API fixtures to reflect the new matching logic — e.g. a previously-`null` `bottler` field now resolves, and bounding boxes carry real `confidence` scores (e.g. `abv: 0.636` on one seed label).
## [2026-07-06] — field match-percentage scoring

### Added

- `lib/verify.ts`: added a Dice-coefficient bigram `similarity()` function and `matchScore` on every `FieldResult`, giving reviewers a real expected-vs-extracted text-match percentage regardless of OCR provider (previously the displayed "confidence" was the OCR provider's self-reported score, which Tesseract and Google Vision never populate). `numericAwareSimilarity()` scores ABV/net-contents fields on their parsed numeric value so unit-format differences ("45% ABV" vs "45% Alc./Vol.") still read as a near-100% match.
- `lib/verify.test.ts`: added coverage for identical strings, minor OCR noise, mismatches, unit-format variants, and missing values.

### Changed

- `components/queue/FieldReviewCard.tsx`: the percentage shown next to "OCR Found" now prefers `field.matchScore`, falling back to OCR confidence only if absent.
- `README.md`: documented app architecture (flow diagram) and added a `docs/` folder index.

## [2026-07-06] — fix production 500 on queue load, document dev tools and schema-drift backlog

### Fixed

- Production Supabase database (`supabase-ttb-labeling`) was missing the `batch_runs` table — it was added to `scripts/init-db.sql` for the batch-review cron feature but never applied to production, causing `GET /api/queue` to throw `relation "batch_runs" does not exist` and 500, which left the dashboard stuck on "Loading queue…" indefinitely (no error handling in `loadQueue()` to surface the failure). Created the table directly against the production database via the Supabase MCP; verified `/api/queue` returns 200.

### Changed

- `README.md`: documented the Settings page "Development tools" (reset seed data, add mock application, run pre-analysis) as safe to use in production since they only touch demo-prefixed applications.
- `docs/backlogs.md`: added a backlog entry proposing incremental, CI-tracked database migrations to prevent schema drift between local and production recurring (this is the second time it's caused a prod 500), plus a note that `loadQueue()` still lacks error handling for a failed `/api/queue` request.

## [2026-07-06] — queue verification page UI improvements

### Changed

- `app/queue/[id]/page.tsx`: Removed centering (`mx-auto`) from main container, increased max-width from 5xl to 7xl for consistency with other pages, changed image container background from dark (#141414) to light semantic color (bg-surface-card).
- `components/queue/LabelRegionPanel.tsx`: Converted single image thumbnail to scrollable gallery showing all label images, updated all dark colors to light theme (bg-[#1c1c1c] → bg-surface-card, text-white/50 → text-on-surface-muted), improved accessibility with descriptive aria-labels for each image.
- `components/queue/ReviewSummaryBar.tsx`: Changed background from dark (#1c1c1c) to light (bg-surface-card), updated text color for readability (text-white/50 → text-on-surface-muted), added border-t border-outline for visual separation.

## [2026-07-06] — automated batch review cron + specialist toast

### Added

- `vercel.json`: Vercel Cron schedule hitting `/api/cron/analyze-queue` at `0 5 * * *` and `0 17 * * *` (12am/12pm US Eastern, EST-aligned — Vercel Cron is UTC-only and not DST-aware, so this drifts an hour during EDT).
- `app/api/cron/analyze-queue/route.ts`: analyzes all `pending` applications, gated by a `CRON_SECRET` bearer token (must be set as a Vercel project env var for the schedule to authenticate once deployed).
- `batch_runs` table (`scripts/init-db.sql`) and `recordBatchRun`/`getLastBatchRun` (`lib/queue/store.ts`) to track when a batch (cron or manual) last completed and how many applications it analyzed.
- `components/Toast.tsx`: minimal dismissible toast. `GET /api/queue` now returns `lastBatchRun`; the dashboard (`app/page.tsx`) shows a toast once per new run, tracked via a `ttb-last-seen-batch-run` localStorage marker so it doesn't repeat on refresh.
- `lib/queue/analyze.ts`: extracted the pending-applications analyze loop into `runAnalysis`, shared by the manual (`/api/queue/analyze`) and cron routes so both record their run and stay in sync.

## [2026-07-06] — senior-friendly accessibility overhaul

### Changed

- `app/globals.css`: darkened primary color from #4c6080 to #334455 and improved all text colors for WCAG AAA contrast compliance (7:1 ratio).
- `app/page.tsx`: increased typography (h1 text-2xl→text-3xl, body text-sm→text-base), improved button sizing (px-3 py-2→px-4-5 py-3), enhanced spacing (gap-4→gap-6), added cursor-pointer to all interactive elements, wrapped table in overflow-x-auto for mobile responsiveness.
- `app/apply/page.tsx`: larger form labels (text-xs→text-base), explicit form field heights (h-12), increased button padding and font weights, improved spacing between form sections, added horizontal scrolling for tables on mobile.
- `app/settings/page.tsx`: updated all typography and button styling for senior accessibility, improved form field sizes, enhanced spacing throughout dev tools section.
- `app/audit/page.tsx`: larger headers (text-2xl→text-3xl), improved summary cards typography and spacing, wrapped audit table in overflow-x-auto for mobile scrolling, enhanced pagination buttons with better sizing and cursors.
- `components/ApplicantHome.tsx`: larger typography throughout, improved button styling with cursor-pointer, added table horizontal scrolling on mobile.
- `components/LoginModal.tsx`: larger form inputs and buttons (h-12, py-3), improved typography for better readability, added cursor-pointer to all interactive elements.
- `components/Sidebar.tsx`: increased navigation text size (text-sm→text-base), larger icons and spacing, added cursor-pointer to footer action buttons.
- `components/ApplicantNav.tsx`: improved header typography and button sizing, enhanced spacing, added cursor-pointer to all interactive elements.

### Accessibility Improvements

- Typography: 28% larger body text, better for presbyopia and low vision
- Interactive Elements: All CTAs standardized as buttons with 48x48px minimum touch targets
- Color Contrast: Updated color system for better readability across all text
- Visual Hierarchy: Improved spacing and padding for easier scanning
- Responsive Tables: Horizontal scrolling on mobile instead of cut-off content
- Cursor Feedback: Added cursor-pointer hover state to all clickable elements
- Focus States: Added keyboard focus rings to all interactive elements
- Button Styling: Clear affordance with increased padding and font weight

### Benefits for Older Users

- ✓ Easier to read for people with presbyopia
- ✓ Larger touch targets reduce accidental clicks
- ✓ Clear button styling reduces cognitive load
- ✓ Better contrast improves usability for colorblind users
- ✓ Consistent spacing reduces visual fatigue

---

## [2026-07-06] — restrict OCR provider selection to tested providers

### Changed

- `app/settings/page.tsx`: only Tesseract and Google Vision (the two OCR providers validated end-to-end) are selectable in Settings. Claude, Gemini, GPT-4o, and Mock are shown but disabled, with a "Future feature" tooltip on hover.

## [2026-07-06] — add applicant portal for COLA application submission

### Added

- `app/apply/page.tsx`: applicant-facing submission flow — pick a demo label image, review its auto-filled COLA data (editable, to allow demoing a mismatch), and submit. Lands in the queue as `status: "pending"` with a "waiting for reviewer" confirmation.
- `app/api/applications/route.ts`: `POST /api/applications` — builds a new `QueueApplication` from a selected label-catalog entry (merging any applicant edits over the catalog's ground truth) and inserts it via the existing `addApplication()`.
- `components/LoginModal.tsx`: replaces the single-column specialist login with a two-column chooser — sign in as a specialist (existing 5 demo accounts) or as an applicant (5 new prebuilt demo accounts, via `lib/queue/applicant.ts`).
- `components/AppShell.tsx`: owns identity gating/sign-in-modal display and hides the specialist sidebar entirely for applicant identities, replacing logic previously embedded in `components/Sidebar.tsx`. Also adds a "Log out" action alongside the existing "Switch user".
- `components/ApplicantNav.tsx`: lightweight top nav shown on all applicant-facing pages (My Applications / Submit New / signed-in-as / switch user / log out) — applicants otherwise had no navigation chrome at all.
- `components/ApplicantHome.tsx`: role-aware home screen shown at `/` for applicant identities — lists only that applicant's own submissions (via a new optional `applicant` filter on `listQueue()` / `GET /api/queue?applicant=`), instead of the full specialist queue.
- `lib/queue/label-catalog.ts`: extracts the per-image `SEED_HINTS` ground-truth map out of the server-only `lib/queue/seed-data.ts` into a client-safe module, and adds a grouped `LABEL_CATALOG` (front+back pairs collapsed into one selectable entry) for the applicant portal's image picker. Also adds a ground-truth entry for `label-2`, previously unused outside the hardcoded pending seed row.

### Changed

- `lib/queue/seed-data.ts`: re-exports `SEED_HINTS` from `label-catalog.ts` instead of defining it inline; no behavioral change to seeded demo data.
- `lib/queue/store.ts`: `listQueue()` takes an optional `applicant` parameter to scope results to one applicant's full history (including resolved applications), for the new applicant home screen.

---

## [2026-07-06] — add requirements-traceability test suite, align user-flow doc with source requirements

### Added

- `lib/baseRequirementsTest.test.ts`: a Vitest suite where each test ties directly to a stakeholder example or rule from the take-home requirements doc (Dave's fuzzy brand-name match, Sarah's ABV normalization, Jenny's strict govt-warning match, unreadable-field handling, and the override/approve/reject gating) rather than to implementation details — doubling as a runnable demo that core stated requirements are met.

### Changed

- `docs/users-flow.md`: made three things explicit that were previously implied — why pre-analysis exists (a prior scanning-vendor pilot's 30-40s per-label processing killed adoption), a "no training required" design principle (reviewers span a wide range of tech comfort), and why batch processing is parallelized (same failed-pilot lesson).

---

## [2026-07-05] — replace review table with a one-field-at-a-time stepper

### Changed

- Rebuilt the `/queue/[id]` review page: replaced the all-fields comparison table and "every bounding box drawn at once" image view with a stepper that walks through flagged fields one at a time. Each step pairs a dark label-region panel (cropped/zoomed bbox preview, full-label thumbnail, expandable lightbox) with a review card showing Application/OCR Found/Regulation values and single-click Accept/Reject/Skip actions.
- Added a clickable status-pill strip so a reviewer can jump straight to any field, including a field that already passed — passed fields now have a "Flag as issue" affordance to manually override a pass, with the same override mechanism the app already used for auto-detected flags.
- Replaced the checkbox-based reject flow with a bottom summary bar (live pass/warn/fail counts) and a single Deny action that submits whatever fields were marked "Reject" during the step-through, gated on a required note.
- New components: `FieldStatusStrip`, `LabelRegionPanel`, `ImageExpandModal`, `FieldReviewCard`, `PassedFieldPanel`, `ReviewSummaryPanel`, `ReviewSummaryBar`, `DenyNoteModal`. Removed `FieldTable`, `ImageCarousel`, `OverrideModal`, `ResolutionPanel`.
- Updated `tests/queue.spec.ts` and `tests/batch-review.spec.ts` for the new Accept/Reject/Skip + Approve Application/Deny flow.

---

## [2026-07-05] — fix missing Tesseract bounding boxes, grid-search the OCR config

### Fixed

- `worker.recognize(buffer)` in `lib/ocr/tesseract.ts` omitted the output-format argument, so tesseract.js's default `blocks: false` meant `data.blocks` was always `undefined` and every field's bounding box came back `null`. Now calls `recognize(buffer, {}, { blocks: true })`.
- `computeFieldBbox`'s image-dimension inputs (`W`/`H`) were approximated from the max OCR word bounding box instead of the real image size, making normalized box coordinates slightly off.

### Changed

- Replaced the (initially assumed) grayscale + denoise + invert preprocessing pipeline in `lib/ocr/tesseract.ts` with the empirically best config: **no preprocessing, `PSM.SPARSE_TEXT`, `OEM.LSTM_ONLY`**, found via a 32-config × 14-image grid search scored against a manually verified ground-truth sheet. `invert` in particular was actively harmful on this label set (3–5% token-match vs. 90% for the winning config) — see `docs/2026-07-05-tesseract-grid-search-results.md`.
- Added `tests/mocks/labels/_ground_truth.json` — manually verified true field values per demo label image, used as the scoring reference (deliberately independent of the existing `SEED_HINTS`/`_extracted.json`, which were circularly derived from each other).
- Added `scripts/tesseract-grid-search.ts` — sweeps preprocessing/PSM combinations and scores each with partial credit (fraction of matched tokens per field), so a config that reads part of a string gets a proportional score and a bounding box around just the matched part, instead of an all-or-nothing null.
- `lib/ocr/tesseract.ts` no longer preprocesses images with `sharp` (the winning config is preprocessing-free); `sharp` remains a dependency, now only used by `scripts/tesseract-grid-search.ts` to sweep preprocessing variants.

### Fixed (multi-image applications)

- `analyzeApplication()` in `lib/queue/analyze.ts` OCR'd only `app.images[0]` (the front label) — fields only present on the back image (e.g. bottler, country of origin, government warning) were silently dropped, and conflicting values between front/back were never detected. It now OCRs every image in parallel and merges the results.
- Added `lib/ocr/merge.ts` — `mergeOcrResults()` resolves each field independently: uses the only value present when just one image has it, agrees silently when images match, and prefers the higher-confidence value (falling back to the front image when no provider reports confidence) when they disagree — recording the disagreement rather than guessing silently.
- `lib/verify.ts`'s `verifyLabel()` now accepts the conflict map and appends a note (e.g. `"Images disagree on this field: image 0='43% ABV', image 1='45% ABV' — verify manually."`) to the affected `FieldResult`, reusing the existing reviewer-facing `note` field instead of adding new UI.
- Bounding boxes are now stamped with the actual source image's index instead of always defaulting to `0`.

## [2026-07-04] — enable "Reset seed data" / "Add mock application" in production, scoped to demo- rows

### Changed

- `addMockApplication()` now generates ids as `demo-TTB-2026-{timestamp}` instead of `TTB-2026-{timestamp}`, and `resetQueue()` now deletes only `id LIKE 'demo-%'` instead of the whole `applications` table. With both operations scoped to demo data, the hard `VERCEL_ENV === "production"` 403 block on `POST /api/queue` and `DELETE /api/queue/reset` was removed — these dev-tools buttons on the Settings page now actually work when clicked on the production deployment, instead of silently failing.
- `DELETE /api/queue/reset` still skips `regenerateExtracted()` in production specifically, since that function writes `tests/mocks/labels/_extracted.json` to disk and Vercel's production filesystem is read-only outside `/tmp` — the demo-scoped queue reset itself now runs in every environment, just without that dev-only side effect.
- Settings page copy and error messages updated to no longer claim these actions are "disabled in production."

### Security note

- Neither `POST /api/queue` nor `DELETE /api/queue/reset` has authentication or rate limiting, and both are now reachable in production. An anonymous visitor could spam mock-application inserts between resets, or reset the demo queue while someone else is actively using it. Accepted as a reasonable tradeoff for a demo app with no real intake pipeline — revisit if this app ever needs to coexist with real data.

---

## [2026-07-04] — store demo label images as static files, seed production demo data

### Changed

- Moved the 14 demo label images from `tests/mocks/labels/` to `public/demo-labels/` and stopped storing image bytes in Postgres. `LabelImage.base64` → `LabelImage.path` (a public URL path); `application_images.base64` column renamed to `image_path`. `lib/queue/analyze.ts` now reads image bytes from `public/` only at OCR-call time (with a path-traversal guard, since `image_path` comes from the DB). This shrank the seed payload from ~20MB of base64 to a few KB of paths, which is what made seeding production directly via the Supabase MCP practical (previously blocked — see Fixed below).
- Seed application ids now prefixed with `demo-` (e.g. `demo-TTB-2026-1001`), and `scripts/seed-db.ts` / `scripts/seed-resolutions.ts` scope their `DELETE`/`UPDATE` statements to `id LIKE 'demo-%'` instead of wiping the whole `applications` table.
- Added `scripts/seed-guard.ts`: seed scripts now refuse to run against a non-local `DATABASE_URL`/`POSTGRES_URL` unless `SEED_ALLOW_REMOTE=true` is explicitly set. Added `db:seed:remote` / `db:seed:resolutions:remote` npm scripts for intentional remote runs.
- Seeded the 9 demo applications (7 analyzed/pending + 2 resolved) directly into the production Supabase project via `execute_sql`.

### Fixed

- Production `/api/queue` and `/api/audit` were 500ing with `password authentication failed for user "postgres"` after the Supabase database password was reset while retrieving a connection string for local seeding. Vercel's `POSTGRES_URL` (managed by the Supabase integration) had already auto-synced the new password, but the running serverless instances had a `pg.Pool` created at cold start with the old password baked in. Fixed by redeploying the existing production commit (no code change) to force fresh instances to pick up the current env var.

### Security note

- `lib/queue/analyze.ts`'s image reader now validates the resolved path stays inside `public/` before calling `fs.readFileSync`, since the path comes from a DB column rather than a hardcoded value.

---

## [2026-07-04] — initialize production Supabase schema

### Fixed

- Production Supabase Postgres database (`supabase-ttb-labeling`, project `tjyfcwzfgkivknlzfjlz`) had an empty `public` schema — `scripts/init-db.sql` had never been run against it, only against local Docker Postgres. `/api/queue` and `/api/audit` were 500ing in production with `error: relation "applications" does not exist` (surfaced as browser console errors), separate from the SSL connection issue fixed below. Applied `scripts/init-db.sql` directly to the production database via the Supabase MCP (`apply_migration`), creating `applications`, `application_data`, `application_images`, `ocr_data`, `review_sessions`, `field_notes`, and `resolutions`. Verified fixed: Vercel runtime errors for `/api/queue` stopped, and browser console errors are gone.

### Docs

- `docs/backlogs.md` — closed out the "Preview deployment env vars" entry; the real gap was production itself missing schema, not just a Preview-vs-Production env var mismatch.

### Security note (not yet addressed)

- All 7 new tables have Row Level Security disabled (Supabase advisor flags this as `ERROR` severity, since Supabase exposes every `public` table via PostgREST to the anon role by default). The app currently connects via `pg.Pool` directly against `DATABASE_URL` (not the Supabase client/anon key), so this isn't an active exploit path today, but it becomes one the moment any Supabase client-side/anon-key usage is introduced. Tracked as a backlog item.

---

## [2026-07-04] — fix production SSL connection actually rejecting self-signed certs

### Fixed

- `lib/db.ts` — the previous fix (below) passed `ssl: { rejectUnauthorized: false }` alongside `connectionString`, but `pg` re-derives `ssl` from the connection string's `sslmode` param and silently overrides any explicit `ssl` option, so that setting was never applied. Now forces `sslmode=no-verify` directly in the connection string for non-localhost connections, since that's the only mode current `pg-connection-string` still treats as "accept self-signed." Verified against a Vercel preview deployment: `SELF_SIGNED_CERT_IN_CHAIN` and the associated `pg` SSL-mode deprecation warning no longer occur.

### Docs

- `docs/backlogs.md` — added entry for a separate, pre-existing issue found during verification: preview deployments hit a database with no `applications` table, since no migration tooling exists in this repo.

---

## [2026-07-04] — production database connection

### Changed

- `lib/db.ts` — enables TLS for non-localhost connections and falls back to `POSTGRES_URL` when `DATABASE_URL` is unset, so the app can connect to the pooled Supabase Postgres instance injected by Vercel's integration in production while local Docker Postgres (via `DATABASE_URL`) is unaffected
## [2026-07-04] — development tools settings panel

### Added

- `app/settings/page.tsx` — "Development tools" section: moves "Reset seed data", "+ Add mock application", and "Run pre-analysis now" off the dashboard, with a subtext explaining why the tools exist and a per-button description of what it does and when to use it
- `lib/env.ts` — `isProductionEnvironment()`, checks `VERCEL_ENV === "production"`
- `app/api/queue/reset/route.test.ts`, `app/api/queue/route.test.ts`, `app/api/queue/analyze/route.test.ts` — integration tests against real Postgres for all three queue dev-tool routes, including the new production guard behavior

### Changed

- `app/api/queue/reset/route.ts` (`DELETE`), `app/api/queue/route.ts` (`POST`) — return 403 and no-op when `VERCEL_ENV=production`, since these were previously unauthenticated and destructive/data-polluting against whatever database is live, including the production deployment
- `app/api/queue/analyze/route.ts` — left unguarded intentionally; it's the only mechanism that ever moves an application from "pending" to "analyzed" (no cron/automatic trigger exists), so it's core functionality rather than a dev-only convenience
- `app/page.tsx` — dashboard header now only shows the batch-review button; the three dev-tool buttons live on the Settings page instead

---

## [2026-07-03] — batch review selection

### Added

- `app/page.tsx` — checkbox column and "select all on page" control on the queue table, plus a "Start batch review (N)" button that appears once at least one application is selected
- `app/api/queue/analyze/route.ts` — accepts an optional `{ ids: string[] }` request body to analyze only a specific subset of pending applications, instead of always analyzing every pending application
- `app/queue/[id]/page.tsx` — reads a `batch` query param (an ordered list of application IDs), shows a "Batch review — application X of N" progress indicator, and auto-advances to the next application in the batch after a resolution instead of returning to the dashboard
- `tests/batch-review.spec.ts` — end-to-end test covering select → batch review → reject each in sequence with auto-advance → return to dashboard → applications leave the queue → applications appear in the audit log

### Changed

- `components/queue/ResolutionPanel` usage in `app/queue/[id]/page.tsx` — now keyed by `app.id` so its internal reject-mode state resets between applications instead of leaking from one batch application into the next

### Removed

- `/batch` — the CSV + image bulk-upload page (`app/batch/page.tsx`, `app/api/batch/route.ts`) and its nav entry in `components/Sidebar.tsx`. It created new applications rather than helping review existing queued ones, which is a different feature from batch review; batch review is now selection-based on the queue dashboard
- `papaparse` / `@types/papaparse` dependencies, no longer used after removing the CSV upload flow
- `tests/batch.spec.ts`, `tests/mocks/labels.csv` — fixtures/tests for the removed upload flow

---

## [2026-07-02] — queue-audit-pagination

### Added

- `lib/queue/audit.ts` — `listAuditEntries(page, pageSize)`: paginated `LIMIT`/`OFFSET` query for the audit log that reads only the columns the table needs (id, decision, resolved timestamp, specialist, product), replacing the previous path that reassembled every resolved application in full (including base64 label images) just to render a row
- `app/api/queue/route.ts`, `app/api/audit/route.ts` — accept `?page=&pageSize=` query params (default page size 25, capped at 100 server-side)

### Changed

- `lib/queue/store.ts` — `listQueue(page, pageSize)` now returns `{ items, total, counts }`; `pending`/`flagged`/`clean` status counts are computed server-side so the client no longer needs the full unpaginated row set to render the summary tiles
- `app/page.tsx`, `app/audit/page.tsx` — added Previous/Next pagination controls to the queue table and audit log table

---
## [2026-07-02] — randomize mock application seed

### Changed

- `lib/queue/store.ts` — `addMockApplication` now picks a random entry from `SEED_APPLICATIONS` (`lib/queue/seed-data.ts`) instead of round-robining through a separate 2-item template list, so clicking "+ Add mock application" repeatedly yields varied applications instead of always the same one

### Removed

- `lib/queue/mock-templates.ts` — no longer referenced now that `addMockApplication` draws from `SEED_APPLICATIONS`

## [2026-07-02] — house-keeping

### Added

- `docs/users-flow.md` — new "Flow 3: Correcting a Mistaken Decision (Revert)", documenting the case where an application is mistakenly approved/rejected and needs to be reverted and re-reviewed; matching row added to the Edge Cases table, and a note under the deferred "Full audit trail" item clarifying that reverts themselves aren't logged
- `app/api/queue/[id]/revert/route.test.ts` — integration tests against real Postgres: 404 (unknown id), 409 (not resolved), and the full resolve → revert round-trip
- `app/api/audit/route.test.ts` — integration tests for `GET /api/audit`: empty/zeroed state, and resolved applications correctly reflected in `entries`/`summary`/`activity`

### Fixed

- `vitest.config.ts` — widened `include` to pick up `app/**/*.test.ts` (route-level tests weren't being run at all), and set `fileParallelism: false` since multiple test files calling `__resetQueueForTests()` against the same shared Postgres instance were racing each other's `DELETE`/`INSERT` and hitting duplicate-key errors

### Changed

- `app/api/audit/route.ts`, `app/api/queue/[id]/resolve/route.ts`, `components/queue/ResolutionPanel.tsx`, `lib/queue/store.ts` — formatter-only changes (semicolons, line wrapping); no logic changes

---

## [2026-07-02] — feat/revert-resolution-and-audit-data

### Added

- `lib/queue/store.ts` — `revertResolution(id)`: deletes the application's `resolutions` row and sets its status back to `"analyzed"` (transactional; destructive by design, no history preserved)
- `app/api/queue/[id]/revert/route.ts` — new `POST` endpoint; 404 if the application doesn't exist, 409 if it isn't currently `"resolved"`
- `components/queue/RevertConfirmModal.tsx` — confirm-before-revert overlay, following `OverrideModal`'s existing modal pattern
- `lib/queue/audit.ts` / `lib/queue/audit-types.ts` — `getAuditSummary()` (total reviews, compliance rate, rejected count, avg response time) and `getRecentActivity()` (merged submission + resolution feed) computed from the `applications`/`resolutions` tables; types and the pure `formatTimeAgo()` helper split into `audit-types.ts` so the client-side Audit page doesn't transitively pull in the `pg`-backed store module
- `lib/queue/seed-resolutions.ts` / `scripts/seed-resolutions.ts` (`npm run db:seed:resolutions`) — editable seed list of resolved applications; each run fully replaces the previously-seeded resolved set (reverts anything currently resolved, clears `resolutions`, re-applies the current list) so the revert flow has stable test data

### Changed

- `app/queue/[id]/page.tsx` — once an application is `"resolved"`, `ResolutionPanel` is replaced with a resolution summary (decision, specialist, note, timestamp) and a "Revert to Queue" button
- `app/audit/page.tsx` — removed the hardcoded `SUMMARY`/`TIMELINE` fixtures in favor of real data from `/api/audit`; added an "Actions" column to the Review History table with a per-row "Revert" button (relabels "Revocations" → "Rejections", since the schema has no revocation concept)
- `app/api/audit/route.ts` — now returns `summary` and `activity` alongside `entries`
- `package.json` — `db:seed`/`db:seed:resolutions` now pass `--env-file=.env.development.local` to `tsx` (the existing `db:seed` script was silently broken the same way `vitest` was — neither picked up `DATABASE_URL`); added `tsx` as a proper devDependency (previously undeclared, only worked by luck via an `npx` cache)

---

## [2026-07-02] — feat/postgres-queue-store

### Added

- `lib/db.ts` — shared `pg` `Pool` (using `DATABASE_URL`); configures a `TIMESTAMPTZ` type parser so timestamps come back as ISO strings matching the app's existing string date types
- `scripts/init-db.sql` — schema for `applications`, `application_data`, `application_images`, `ocr_data`, `review_sessions`, `field_notes`, and `resolutions` tables (drop-and-recreate)
- `scripts/seed-db.ts` — CLI script (`npm run db:seed`) that clears and re-inserts `SEED_APPLICATIONS` into Postgres

### Changed

- `lib/queue/store.ts` — rewritten from an in-memory array-backed store to a Postgres-backed one; every exported function (`listQueue`, `getApplication`, `addApplication`, `updateApplication`, `unanalyzedApplications`, `resolveApplication`, `addMockApplication`, `listResolvedApplications`, `resetQueue`) is now `async` and reads/writes via parameterized queries, with multi-statement writes wrapped in `BEGIN`/`COMMIT`/`ROLLBACK` transactions
- `app/api/audit/route.ts`, `app/api/batch/route.ts`, `app/api/queue/route.ts`, `app/api/queue/[id]/route.ts`, `app/api/queue/[id]/resolve/route.ts`, `app/api/queue/analyze/route.ts`, `app/api/queue/reset/route.ts` — added `await` for the now-async queue store calls
- `lib/queue/store.test.ts` — updated to `await __resetQueueForTests()` and the store's async API
- `package.json` — added `pg` / `@types/pg` dependencies and a `db:seed` script

---

## [2026-07-02] — feat/specialist-login-audit-log

### Added

- `components/SpecialistLoginModal.tsx` — demo login modal shown on first load; presents 5 selectable specialist personas (Jenny Park, Dave Morrison, Janet, Sarah Chen, Marcus Williams) as user cards with colored avatars; stores selection to `localStorage["ttb-specialist"]`; dismissible via Escape or ✕ when switching users
- `lib/queue/specialist.ts` — shared specialist constants (`DEMO_SPECIALISTS`), `getCurrentSpecialist()` / `setCurrentSpecialist()` localStorage helpers, `specialistNameById()` lookup, and `AuditEntry` type
- `app/api/audit/route.ts` — new `GET /api/audit` endpoint returning resolved applications as audit entries (`id`, `timestamp`, `product`, `specialist`, `status`)
- `lib/queue/store.ts` — `listResolvedApplications()` returning applications with a non-null resolution, sorted newest-first

### Changed

- `components/Sidebar.tsx` — footer now shows active specialist's colored avatar + name; "Switch User" (⇄) button re-opens the login modal; modal auto-appears on first load when no specialist is in localStorage
- `app/audit/page.tsx` — converted to client component; replaces hardcoded `AUDIT_ENTRIES` with live `fetch('/api/audit')`; shows loading state and graceful empty state ("No completed reviews yet")
- `app/queue/[id]/page.tsx` — `submitResolution()` reads `getCurrentSpecialist()` and includes `specialistId` in the POST body
- `app/api/queue/[id]/resolve/route.ts` — passes `body.specialistId` through to the stored `Resolution`
- `lib/queue/types.ts` — added `specialistId?: string` to `Resolution` interface
- `lib/queue/resolve.ts` — added `specialistId?: string` to `ResolveRequestBody`

---

## [2026-07-02] — fix/abv-binding-rect

### Fixed

- `lib/ocr/extraction.ts` — `computeFieldBbox()` used one-directional substring matching (`word.includes(token)`), which failed when OCR segmented compound tokens like `"Alc./Vol."` into separate words `"Alc."` and `"Vol."` — neither short word contained the full token, so the bbox was silently null even though extraction succeeded. Fixed with bidirectional matching (`token.includes(word)`) plus a `length > 1` guard against single-character OCR noise.

### Added

- `lib/ocr/extraction.test.ts` — 15 new tests for `computeFieldBbox`: null cases (null value, empty list, no match, single-char noise guard), basic normalized coordinate output, bidirectional ABV split-word case, and invariant tests asserting that any non-null extracted value yields a non-null bbox with realistic OCR word lists.
- `lib/queue/regenerate-extracted.ts` — shared module extracted from `scripts/regenerate-extracted.ts` so the regeneration logic can be called from the API route as well as the CLI script.

### Changed

- `app/api/queue/reset/route.ts` — "Reset seed data" button now calls `regenerateExtracted()` before reloading the queue, so bboxes in `_extracted.json` are always rebuilt with the current extraction logic on reset.
- `scripts/regenerate-extracted.ts` — simplified to delegate to `lib/queue/regenerate-extracted.ts` (DRY).
- `tests/mocks/labels/_extracted.json` — regenerated; ABV bboxes now non-null for `hollow-creek`, `abc-distillery`, and `12345-imports`.

---

## [2026-07-02] — feat/layer2-shared-extraction (PR #16)

### Added

- `lib/ocr/extraction.ts` — shared Layer 2 module imported by all text-based OCR providers; exports `extractFields()` (hint-required field matching) and `computeFieldBbox()` (bounding box union); single source of truth replaces duplicated logic in `tesseract.ts` and `google-vision.ts`
- `lib/ocr/extraction.test.ts` — 89 unit tests covering: no-hint → null, brand name regression (ABC Distillery first-line bug), ABV format variants (ABV↔ALC/VOL↔Alc./Vol.), net contents unit variants (mL↔ml↔ML), government warning whitespace normalization across OCR line breaks

### Changed

- `lib/ocr/tesseract.ts` — all blind extractors (`extractBrandName`, `extractAbv`, `extractWithHints`, etc.) removed; now imports `extractFields`/`computeFieldBbox` from `extraction.ts`; provider signature and logic unchanged
- `lib/ocr/google-vision.ts` — was calling blind extractors directly and ignoring the `hints` parameter entirely; now imports from `extraction.ts` and passes hints correctly; `logRawOcrText` restored for dev consistency with Tesseract provider
- `lib/ocr/tesseract.test.ts` — import of `computeFieldBbox` updated from `./tesseract` → `./extraction`
- `lib/queue/seed-data.ts` — `SEED_HINTS["abc-distillery"]` corrected: `brandName` `"ABC"` → `"ABC DISTILLERY"`, `classType` `"Whisky"` → `"Single Barrel Straight Rye Whisky"`, `netContents` `"750 ml"` → `"750 ML"`, `governmentWarning` partial string → `REQUIRED_GOVERNMENT_WARNING`
- `scripts/regenerate-extracted.ts` — updated to import `extractFields` from `extraction.ts` (replaces `extractWithHints` from `tesseract.ts`); `lines` variable removed as `extractFields` doesn't need it
- `tests/mocks/labels/_extracted.json` — regenerated with corrected hint-based output; `abc-distillery.brandName` now `"ABC DISTILLERY"` (was `"DISTILLED AND BOTTLED BY:"`)

### Fixed

- `google-vision.ts` was silently ignoring application hints and running blind extraction — root cause of `abc-distillery` brand name being extracted as the first OCR line (`"DISTILLED AND BOTTLED BY:"`) instead of `"ABC DISTILLERY"`

---

## [2026-07-02] — feat/type-restructure-guided-ocr (PR #15)

### Added

- `GuidedSearchHints` interface (`lib/ocr/types.ts`) — optional per-field hints (`brandName`, `classType`, `abv`, etc.) passed into `OcrProvider.extract()` so providers can narrow their text search; enables guided extraction without changing callers that don't supply hints
- `OcrData` type (`lib/queue/types.ts`) — replaces the old `QueueAnalysis` shape with the same `extracted`/`confidence`/`boundingBoxes`/`verification` fields; name better reflects what the data represents (raw OCR output, not a human decision)
- `FieldReviewNote`, `ReviewSession`, `ApplicationReviewData` types (`lib/queue/types.ts`) — structured containers for specialist review sessions, per-field notes with flagged/decision/savedAt metadata, and the rolled-up resolution; decouples review state from OCR state
- `scripts/regenerate-extracted.ts` — developer script (`npx tsx scripts/regenerate-extracted.ts`) that rebuilds `tests/mocks/labels/_extracted.json` from `.vision.json` fixtures using guided extraction with `SEED_HINTS`, so fixture data stays consistent with the live guided-OCR pipeline

### Changed

- `QueueApplication` (`lib/queue/types.ts`) — `analysis: QueueAnalysis | null` replaced by `ocrData: OcrData | null` and `reviewData: ApplicationReviewData`; `resolution` moved inside `reviewData`; `brandName` top-level field removed (already in `applicationData`)
- `analyzeApplication` (`lib/queue/analyze.ts`) — now passes `app.applicationData` as hints to `provider.extract()`, enabling guided OCR on analysis; return type updated from `{ analysis, images }` to `{ ocrData, images }` to match renamed type
- `lib/queue/store.ts`, `app/api/queue/*/route.ts`, `lib/queue/seed-data.ts`, `lib/queue/mock-templates.ts`, `app/queue/[id]/page.tsx` — cascading updates to field references (`analysis` → `ocrData`, `resolution` → `reviewData.resolution`) following the type rename
- `docs/backlogs.md` — new backlog items added reflecting guided-OCR and review-session improvements identified during this refactor

## [2026-07-02] — docs/codebase-glossary

### Added

- `CONTEXT.md` (repo root) — running glossary of codebase terminology for fast context-loading in future sessions; first entry documents the overloaded "Layer 1"/"Layer 2" terms, which mean different things in the OCR extraction pipeline (`lib/ocr/tesseract.ts`) versus the verification pipeline (`lib/verify.ts`, `lib/ttb-rules.ts`)

### Changed

- `docs/context.md` renamed to `docs/TTB-COLA-context.md` — disambiguates it from the new root `CONTEXT.md`; this file covers TTB/COLA regulatory domain knowledge, not code terminology. No other files referenced the old path.

---

## [2026-07-02] — feat/rawocr-label-reorganization (PR #14)

### Added

- `rawOcrText` field on `LabelImage` (`lib/queue/types.ts`) — stores the full OCR text string alongside the base64 image; populated from `.vision.json` fixtures via `loadMockImage` and from live OCR via `analyzeApplication` (primary image only)
- Per-image Google Vision fixtures (`tests/mocks/labels/*.vision.json`) — one fixture per label image; `loadMockImage` reads the `fullTextAnnotation.text` field to pre-populate `rawOcrText` so seed applications carry realistic OCR text without live API calls
- `tests/mocks/labels/_extracted.json` — pre-computed `ExtractedLabelData` and `BoundingBoxMap` per image key, loaded at server startup by `seed-data.ts` to seed analyzed applications with deterministic field extraction results
- Reset queue API route (`app/api/queue/reset/route.ts`, `DELETE /api/queue/reset`) — restores in-memory queue to seed state; paired with a "Reset seed data" button on the dashboard
- `components/queue/` directory with four extracted sub-components: `ImageCarousel.tsx`, `FieldCard.tsx`, `OverrideModal.tsx`, `ResolutionPanel.tsx`

### Changed

- Mock label images reorganized from `tests/mocks/*.png/jpg` to `tests/mocks/labels/` — flat root is now clean; seed data and mock templates updated to use `labels/` paths
- `lib/queue/seed-data.ts` — `loadExtracted()` now reads from `_extracted.json` instead of computing OCR inline; wrapped in try/catch so a missing fixture file doesn't crash server boot (returns `{}` fallback)
- `app/api/batch/route.ts` — `JSON.parse(rowsRaw)` wrapped in try/catch; malformed JSON now returns 400 instead of an unhandled 500
- `app/queue/[id]/page.tsx` — refactored from 546 lines to ~200 lines by extracting the four sub-components above; triple-nested ternary bg-color logic replaced with named `fieldBgColor` helper in `FieldCard`
- `OcrResult` (`lib/ocr/types.ts`) — added optional `rawText?: string` field; both `tesseractOcrProvider` and `googleVisionOcrProvider` now return it

---

## [2026-07-01] — feat/queue-based-review-flow (PR #13)

### Added

- Implementation plan for the queue-based review redesign (`docs/superpowers/plans/2026-07-01-queue-based-review-flow.md`) — captures the shift from manual data entry to AI-precomputed, specialist-reviewed applications, written before any code changed
- Queue domain module (`lib/queue/`): `types.ts` (shared `QueueApplication`/`QueueAnalysis`/`Resolution` contracts consumed by every other file below), `seed-data.ts` (5 pre-analyzed + 1 pending demo applications covering every verdict type — clean pass, government-warning strict-fail, fuzzy-match pass, low-confidence/glare fail, ABV-mismatch override-candidate), `mock-templates.ts` (templates cycled by the dev-only "add mock application" tool), `store.ts` (in-memory CRUD — list/get/add/update/resolve; deliberately no database, matching this prototype's stated scope), `analyze.ts` (wraps the existing `getProvider()` OCR factory and `verifyLabel()` into a pre-analysis step that runs ahead of a specialist opening an application), `resolve.ts` (pure, unit-tested approve/reject gating — approval requires every flagged field to be overridden, rejection requires citing a still-flagged field plus a note), `field-status.ts` (`isFieldFlagged()` — the single shared definition of "needs review", now used everywhere flagging is computed)
- Mock label fixture images (`tests/mocks/labels/*.png`) committed to git — the plan's seed data depended on images that turned out to exist only in one local checkout, untracked
- Queue API routes (`app/api/queue/`): `GET/POST /api/queue` (list, add-mock), `POST /api/queue/analyze` (run pre-analysis), `GET /api/queue/[id]` (detail), `POST /api/queue/[id]/resolve` (approve/reject) — thin wrappers that delegate all logic to `lib/queue/`
- Queue application review page (`app/queue/[id]/page.tsx`) — the specialist-facing screen: bundled label image with per-field AI results, click-to-highlight bounding boxes, per-field Override (reason required), Approve/Reject gated by `validateResolution`
- E2E coverage for the queue flow (`tests/queue.spec.ts`) — queue load, add-mock, run-pre-analysis, override/approve gating, reject requiring citation + note, and the full approve/reject submit round-trip through `POST /api/queue/[id]/resolve`

### Changed

- Dashboard (`app/page.tsx`) rewritten from a static hardcoded table into a live queue fed by `GET /api/queue`, with dev-only "+ Add mock application" and "Run pre-analysis now" buttons
- Sidebar nav (`components/Sidebar.tsx`) — "Verify Label" entry removed, "Dashboard" relabeled "Queue"
- Batch processing (`app/api/batch/route.ts`, `app/batch/page.tsx`) — any batch row that doesn't fully pass now gets pushed into the same review queue (via `addApplication`) instead of only appearing in the CSV export, so batch- and single-sourced flagged applications go through one consistent review workflow
- `app/queue/[id]/page.tsx` — fixed a state-sync bug where overriding a field already checked for rejection left a stale citation the server would refuse; `saveOverride` now prunes `rejectedFields`, and the Confirm-Reject gate re-derives the valid citation count
- Field-flagging logic (`lib/queue/store.ts`, `lib/queue/resolve.ts`, `app/api/batch/route.ts`, `app/queue/[id]/page.tsx`) — a field that passes its text match but fails a regulatory bounds check (ABV range, fill size, class/type) now counts as flagged everywhere (flag counts, approve/reject gating, batch routing), and the review page's "Regulatory" sub-section — present on the old `/verify` page, silently dropped when the review page was first built — is restored; closes a compliance-visibility gap where a regulatory violation could be approved as a "clean pass"
- `tests/landing.spec.ts`, `tests/batch.spec.ts` updated for the new queue-based dashboard and the "Review in queue →" link on flagged batch rows

### Removed

- Manual single-label verify page and its API route (`app/verify/page.tsx`, `app/api/verify/route.ts`) — specialists no longer type application data by hand, they only review pre-submitted applications
- `tests/single-verify.spec.ts` — tested the now-deleted manual entry page

---

## [2026-07-01] — feat/google-vision-ocr-provider

### Added

- Google Cloud Vision OCR provider (`lib/ocr/google-vision.ts`) — calls the Vision REST API in `DOCUMENT_TEXT_DETECTION` mode, reuses `tesseract.ts`'s regex field extractors on the returned full text, and maps matched field values back to Vision's word-level bounding boxes via the existing `computeFieldBbox()` union logic; normalizes coordinates using Vision's own `pages[0].width`/`.height` rather than approximating
- Registered in the provider factory (`lib/ocr/index.ts`, `case "google-vision"`)
- "Two-Layer Extraction" architecture diagram in `docs/system-design.md`, cross-referenced from `docs/ocr-comparison.md`
- `docs/backlogs.md` — new file to track non-critical follow-up work; first entry covers refining the Layer 2 regex extractors based on gaps found while testing this provider
- OCR provider research doc (`docs/ocr-comparison.md`)

- `logRawOcrText()` (`lib/ocr/tesseract.ts`) — `NODE_ENV`-gated console log of raw OCR text, called from both `tesseractOcrProvider` and `googleVisionOcrProvider` before Layer 2 regex runs, so a `null` field can be diagnosed as an OCR miss vs. a regex-coverage gap
- Google Cloud Vision card in the `/settings` provider list (`app/settings/page.tsx`) and sidebar label (`components/Sidebar.tsx`)

### Changed

- Exported the previously-private regex extractor functions in `lib/ocr/tesseract.ts` (`extractAbv`, `extractNetContents`, `extractGovernmentWarning`, `extractBrandName`, `extractClassType`, `extractBottler`, `extractCountryOfOrigin`) so `google-vision.ts` can reuse them — no logic changes
- `getProvider()` (`lib/ocr/index.ts`) falls back to `process.env.GOOGLE_VISION_API_KEY` for the `google-vision` case when no client key is supplied — sourced from a new dev-only `.env.development.local` (replacing the prior generic `.env`), which Next.js never loads outside `next dev`, so production always requires the user's own key from `/settings`
- Corrected the Google Vision `/settings` cost badge from the inaccurate "Free (TTB volume)" to the real per-request price past the free tier (`~$0.0015 / label`), with a note that usage against the 1,000/month free quota isn't tracked

---

## [2026-07-01] — feat/app-settings-and-config-updates (PR #9)

### Added

- Regulatory subsection in `FieldRow` (`app/page.tsx`): Layer 2 regulatory result now renders inline below each field row when present — color-coded pass/fail/warning with status icon and note
- Mock provider added to `/settings` provider selector (`app/settings/page.tsx`) so the app is usable without an API key

### Changed

- `next.config.ts`: added `serverExternalPackages: ['tesseract.js']` for WASM server-side compatibility

### Removed

- `REQUIREMENTS.md`: deleted — fully superseded by `docs/20260630-ai-label-verification-app.md`

---

## [2026-07-01] — feat/bounding-box-field-source (PR #8)

### Added

- `BoundingBox` interface and `BoundingBoxMap` type in `lib/ocr/types.ts`; `OcrResult` now carries an optional `boundingBoxes` field
- LLM extraction prompt updated to request normalized (0–1) bounding box coordinates per field; `parseExtractionResponse()` extracts them — all three LLM providers (Claude, Gemini, GPT-4o) inherit this automatically
- `computeFieldBbox()` in `lib/ocr/tesseract.ts`: flattens block→paragraph→line→word tree, word-matches against extracted field text, returns union bbox normalized by max word coordinate
- Hardcoded `MOCK_BOUNDING_BOXES` in `lib/ocr/mock.ts` covering all 7 fields for E2E testing
- Unit tests for LLM parser bbox extraction (`lib/ocr/llm-prompt.test.ts`) and Tesseract word-match bbox logic (`lib/ocr/tesseract.test.ts`)
- User flow step 5a (bounding box field-source inspection) added to `docs/users-flow.md`
- Build Step 15 (bounding box field-source inspection) added to `docs/20260630-ai-label-verification-app.md`

---

## [2026-06-30]

### Added

- Tesseract OCR tuning playground (`tools/tesseract-playground.html`) — interactive HTML tool for adjusting Tesseract parameters and previewing extraction results
- Tesseract playground documentation and demo GIF (`docs/tesseract-tuning-and-playground.md`)
- Batch verification page with SSE streaming and real-time notification panel (`app/batch/page.tsx`, `components/Notification.tsx`)
- Batch SSE streaming API route (`app/api/batch/route.ts`)
- Settings page with provider selector and API key entry fields (`app/settings/page.tsx`)
- Nav bar, per-provider result headers, and confidence badges on single-label verify page (`components/NavBar.tsx`, `app/page.tsx`)
- Claude, Gemini, and OpenAI OCR providers sharing a single structured extraction prompt (`lib/ocr/claude.ts`, `lib/ocr/gemini.ts`, `lib/ocr/openai.ts`, `lib/ocr/llm-prompt.ts`)
- TTB regulatory rules engine (`lib/ttb-rules.ts`) with unit tests (`lib/ttb-rules.test.ts`)
- Layer 2 confidence-threaded verification logic (`lib/verify.ts`) with unit tests (`lib/verify.test.ts`)
- `OcrResult` type and `getProvider()` factory with Tesseract adapter (`lib/ocr/tesseract.ts`, `lib/ocr/types.ts`)
- Vitest unit test configuration (`vitest.config.ts`)
- OCR provider index unit tests (`lib/ocr/index.test.ts`)

### Fixed

- `require()` type casts and `MOCK_EXTRACTED` annotation in OCR mock and provider index (`lib/ocr/index.ts`, `lib/ocr/mock.ts`)
- Tesseract playground bounding box overlay never rendering — `worker.recognize()` wasn't requesting block output and `extractBoundingBoxes()` read from a nonexistent field, plus `drawBoundingBoxes()` double-applied scale/offset to coordinates already in final pixel space (`tools/tesseract-playground.html`)

---

## [2026-06-29]

### Added

- Initial Next.js app: alcohol label compliance verification with OCR and rule-based checking
- Mock OCR provider and initial verify logic scaffolding (`lib/ocr/mock.ts`, `lib/verify.ts`)
- Single-label verify API route (`app/api/verify/route.ts`)
- Landing page with image upload zone and compliance result form (`app/page.tsx`)
- Playwright end-to-end testing setup with landing page smoke test (`playwright.config.ts`, `tests/landing.spec.ts`)
- System design document covering architecture, API contracts, OCR adapter interface, Redis data model, and deployment constraints (`docs/system-design.md`)
- User flow documentation (`docs/users-flow.md`)

### Changed

- Trimmed README to architecture diagram and tech stack only
