# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2026-07-02] — queue-audit-pagination

### Added

- `lib/queue/audit.ts` — `listAuditEntries(page, pageSize)`: paginated `LIMIT`/`OFFSET` query for the audit log that reads only the columns the table needs (id, decision, resolved timestamp, specialist, product), replacing the previous path that reassembled every resolved application in full (including base64 label images) just to render a row
- `app/api/queue/route.ts`, `app/api/audit/route.ts` — accept `?page=&pageSize=` query params (default page size 25, capped at 100 server-side)

### Changed

- `lib/queue/store.ts` — `listQueue(page, pageSize)` now returns `{ items, total, counts }`; `pending`/`flagged`/`clean` status counts are computed server-side so the client no longer needs the full unpaginated row set to render the summary tiles
- `app/page.tsx`, `app/audit/page.tsx` — added Previous/Next pagination controls to the queue table and audit log table

---

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
