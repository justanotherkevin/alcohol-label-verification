# TTB AI-Powered Alcohol Label Verification App

## Overview

Build a standalone AI-powered tool for TTB labeling specialists to verify alcohol beverage labels against COLA application data (Form 5100.31). The app uses a pluggable vision/OCR pipeline — Tesseract WASM for local extraction, or any of three LLM providers (Claude Sonnet 4.6, Gemini Flash, GPT-4o) for semantic field extraction with confidence scores — to extract and compare label fields against form-submitted application data. Every field result shows pass/fail with inline diff (extracted vs. expected).

> **Terminology:** Throughout this plan, use TTB's exact vocabulary: "Brand Name" (not "Trade Name"), "Fanciful Name" (distinct field), "Alcohol Content" / "ABV" (either acceptable), "Government Warning Statement" / "GOVERNMENT WARNING", "Name and Address" (with qualifying phrase), "Type of Product" (Wine / Distilled Spirits / Malt Beverages), "Labeling Specialist" (not "agent" or "reviewer"), "Needs Correction" / "Approved" / "Rejected" for statuses.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Claude Sonnet 4.6 / Gemini Flash / GPT-4o + Tesseract.js + PapaParse + Vitest + Playwright

> **MVP scope:** Phase 1 (single label verify) + Phase 2 (batch processing) + Phase 3 (multi-provider settings) are the complete deliverable. Phase 4 (stretch) adds depth. Build MVP first.

---

## Background & Stakeholder Context

### Sarah Chen — Deputy Director, Label Compliance

- ~150,000 COLA applications reviewed per year by 47 specialists
- Current workflow: 5–10 min per simple label; agents do visual comparison manually
- Last year's scanning vendor pilot failed — 30–40 second response times made it unusable; **agents rejected the tool and went back to reviewing by eye**
- Hard requirement: **results in ≤5 seconds** or adoption fails
- UI must be usable by a 73-year-old — **no hidden buttons, no multi-step wizards**
- Peak season: large importers submit 200–300 labels at once; no current batch path

### Dave Morrison — Senior Compliance Agent (28 years)

- Skeptical of automation projects (has seen many fail)
- Key insight: "You can't just pattern match everything" — `STONE'S THROW` vs `Stone's Throw` is obviously the same brand; strict rejection would cause agent rejection of the tool
- Values speed through his queue above all else
- Wants the ability to override AI judgment on edge cases (deferred to stretch)

### Jenny Park — Junior Compliance Agent (8 months)

- Enthusiastic; works from a printed checklist
- Warning statement check is "trickier than it sounds" — must be **exact**, `GOVERNMENT WARNING:` in ALL CAPS and bold; she caught a title-case violation last month
- Wants the tool to handle imperfect images (glare, angle, low light) rather than bouncing them

### Marcus Williams — IT Systems Administrator

- Network blocks many outbound domains — caused half the vendor pilot features to fail
- No integration with COLAs Online for prototype — standalone proof of concept only
- No PII storage; no sensitive data at rest
- Current infra: Azure (post-2019 migration); COLA system is .NET from 2003

---

## Key Decisions

**Read this list top-down — it is the build order.** Each decision is a layer the next one rests on: the first five establish the platform you stand on, the next two lay the spine every feature hangs off, then providers fill that spine, extraction runs through it, verification sits on top of extraction, batch reuses the single-label path, and the last two are quality and scope. No decision below depends on one above it being changed. If you build in this sequence, the app stands up cleanly.

---

### Foundation

#### 1. Next.js (App Router) as one deployable unit

_Builds on: nothing — this is the ground floor._

The whole app is a single Next.js project: UI pages (`app/page.tsx`, `app/batch`, `app/settings`) and server endpoints (`app/api/verify`, `app/api/batch`) ship together to one host. The server work — calling vision APIs with secret keys, streaming batch results — physically cannot run in the browser, so we need a server; Next.js gives us one _in the same unit_ as the UI.

**Why:** One deploy instead of two (no separate API server to host, CORS-configure, or keep in sync). API routes keep secret keys server-side — the browser only ever sees results. Route handlers can return a `ReadableStream` for native SSE. File-based routing means `/`, `/batch`, `/settings` are literally three files. This rules out plain React + a separate Express backend (two deploys, manual CORS) and Streamlit (explicitly forbidden by the requirements, and its rerun-on-every-interaction model fights a ≤5s perceived-latency target).

#### 2. TypeScript end-to-end

_Builds on: #1._

Everything — providers, verification, API routes, UI — is typed. The load-bearing type is the `OcrProvider` contract (decision #6): because every provider and every consumer shares one compile-checked interface, swapping backends can't silently break a caller.

**Why:** The app's whole structure depends on interchangeable parts agreeing on a shape (`OcrResult`). Types are what enforce that agreement. Without them, the Adapter pattern that makes this app flexible would be held together by hope.

#### 3. React + Tailwind for a state-driven UI

_Builds on: #1, #2._

React is the rendering layer Next.js runs on; Tailwind is utility-first styling. The UI is fundamentally state-driven: upload → preview appears; submit → loading state → results render; batch SSE events arrive → result cards append one at a time.

**Why:** "UI as a function of state" is exactly React's model — declaratively mapping the `fields` array from verification to ✅/❌/⚠️ rows, or appending a card per SSE event, would be error-prone with manual DOM work. Tailwind keeps iteration fast on the "clean, obvious, no hidden buttons" UI Sarah's 73-year-old benchmark demands, with no separate CSS files to manage.

#### 4. No PII at rest — and, for the prototype, no persistence at all

_Builds on: #1._

The hard constraint from Marcus (IT) and the requirements is narrower than "no database": **store no PII** (data identifying a _person_). Almost everything this app handles is _product/business_ data — label artwork, brand names, ABV, class/type, bottler _company_ name and address, net contents, compliance verdicts — none of which identifies a private individual. Persisting those records would **not** violate the constraint. The one genuinely sensitive element is _actor identity_ (which specialist/supervisor did what); that's handled by minimizing to opaque user IDs under the agency's existing identity system, not by avoiding storage wholesale.

For the **prototype**, we satisfy the constraint the simplest possible way: persist nothing. The app is a pure function `(image, applicationData) → result`. The image lives in server-function memory only during the request and is discarded on response; the result is held in React state and gone on refresh; the provider + API key live in browser `localStorage` and are sent per-request as headers — never to a server store.

**Why simplest-thing-first:** "store nothing" is the _strongest_ guarantee (you cannot leak PII you never kept) and it makes deployment trivial — no connection strings, migrations, or provisioning. The core value (extract + compare a label) needs no memory between requests, so the prototype shouldn't pay for a database it doesn't use. (Note: `docs/system-design.md` sketches a Redis + QStash design — considered and deliberately deferred, not the prototype path.)

**Where this changes:** **override** (a specialist overriding the AI's verdict, stored with a reason for audit) and **supervisor read-only dashboards** _do_ require persistence — but of non-PII compliance records, which the constraint permits. Statelessness is a prototype scoping choice, **not** a limit imposed by "no PII." See **B5** for that production data model (PostgreSQL) and query path.

#### 5. Vercel hosting

_Builds on: #1, #4._

Deploy target is Vercel — zero-config for Next.js, free tier, standard public URL.

**Why:** "Deployable to a public URL" with minimal ops. Critically, it's a normal public endpoint unlikely to be blocked — unlike the previous vendor's custom ML endpoints that TTB's firewall killed mid-pilot (Marcus's pain point). Statelessness (#4) makes deployment trivial: no connection strings, no migrations, no provisioning.

---

### The spine

#### 6. The `OcrProvider` interface (Adapter pattern)

_Builds on: #2._

Every way of reading a label implements one interface:

```typescript
interface OcrProvider {
  name: string;
  extract: (imageBase64: string, mimeType: string) => Promise<OcrResult>;
}
```

`OcrResult` is `{ data: ExtractedLabelData, confidence: ConfidenceMap }`. One method, one return shape, regardless of how extraction actually happens underneath.

**Why:** This single decision is what makes the app flexible. The API route, verification, and UI are all written against this interface and never know which concrete provider they got. Adding a backend means writing one file; nothing downstream changes. It is the most important structural choice in the codebase.

#### 7. `getProvider(name, apiKey)` factory

_Builds on: #6._

`lib/ocr/index.ts` maps a string name to a concrete `OcrProvider`, defaulting to Tesseract for unknown names.

**Why:** Lets the running app pick an implementation _at request time_ from the `X-Ocr-Provider` header — the seam that connects the user's `/settings` choice (#10) to the actual extraction call, without any caller hardcoding a provider.

---

### Providers

#### 8. Tesseract as the default, local, no-key provider

_Builds on: #6, #7._

`lib/ocr/tesseract.ts` runs Tesseract.js (WASM) inside the server function using the bundled `eng.traineddata`. No API key, no network call, no cost — so it's the default.

**Why:** The app must work out of the box for anyone who clones it, with zero setup. Tesseract guarantees a working pipeline before any key is entered. **Tradeoff (see B1):** Tesseract only does character recognition, not semantic field-finding, so `tesseract.ts` guesses fields with regex/heuristics afterward — brittle on decorative, curved, or glary label text. That's why it returns an empty confidence map and is the fallback, not the recommendation.

#### 9. LLM vision providers (Claude / Gemini / OpenAI) sharing one prompt

_Builds on: #6, #8._

`lib/ocr/claude.ts`, `gemini.ts`, `openai.ts` each call their vision API. **The models are external, hosted APIs — not files in this repo** (Tesseract's local `eng.traineddata` is the lone exception). All three share one extraction system prompt (`lib/ocr/llm-prompt.ts`) that demands structured JSON: each field as `{ value, confidence }`.

**Why:** Unlike Tesseract, a vision-LLM _understands_ the label — it knows the big top text is the brand, finds the warning paragraph wherever it sits, reads ABV in odd fonts or at an angle. This is what handles Jenny's "imperfect images" (glare, angles, bad lighting). One shared prompt keeps the three providers behaviorally identical so they're truly interchangeable.

#### 10. Runtime provider + key selection (`/settings` → localStorage → headers)

_Builds on: #4, #7, #9._

`/settings` lets the user pick a provider and enter an API key, saved to `localStorage` as `{ provider, apiKey }`. Every request sends `X-Ocr-Provider` and `X-Api-Key`; the server reads them, calls `getProvider()`, and uses the key for that request only.

**Why:** Different users have different API access and cost tolerance. Keeping the key in the browser and passing it per-request honors the no-persistence rule (#4) — the key never touches a server store — while still letting users choose the accurate path (#9) over the free default (#8).

---

### Extraction

#### 11. Semantic vs heuristic extraction, both yielding `OcrResult`

_Builds on: #6, #8, #9._

Two fundamentally different strategies sit behind the interface: **semantic** (LLM reads and labels fields directly, with confidence) and **heuristic** (Tesseract dumps raw text, then regex/substring rules in `tesseract.ts` guess each field). Both return the identical `OcrResult` shape.

**Why:** Because the output shape is identical, everything downstream — verification, UI, batch — is written once and works for either strategy. The difference in _how_ extraction happens is completely hidden from the rest of the app. This is the payoff of decision #6.

---

### Verification

#### 12. Verification is pure deterministic TypeScript, not AI

_Builds on: #2, #11._

The AI's job ends at extraction. The pass/fail decision is plain TypeScript (`lib/verify.ts`, `lib/ttb-rules.ts`) — no model involved.

**Why:** A compliance tool's verdict must be auditable, repeatable, and explainable. Deterministic code gives the same answer every time and can cite the exact rule it applied; a model's opinion cannot. This cleanly separates "what's on the label?" (AI) from "is it correct?" (code).

#### 13. Two-layer verification

_Builds on: #12._

**Layer 1 — Application match:** does the extracted value match the Form 5100.31 submission? **Layer 2 — Regulatory validation** (`lib/ttb-rules.ts`): is the value legal under TTB CFR rules, independent of the form? (recognized class/type, ABV in legal bounds, standard fill size).

**Why:** Layer 1 catches "does the label match the form?" Layer 2 catches "is the form itself compliant?" — a label can match the form perfectly yet declare an illegal 30% ABV bourbon. Running both is the difference between matching and actual compliance review.

#### 14. Fuzzy matching for most fields

_Builds on: #13._

Brand, class/type, net contents, bottler, country: `normalize()` lowercases, trims, collapses whitespace. ABV additionally falls back to numeric comparison so `45% ABV` == `45% Alc./Vol. (90 Proof)`. `STONE'S THROW` == `Stone's Throw`.

**Why:** 27 CFR Allowable Revisions (Form 5100.31 Item 3b) explicitly permits case and abbreviation changes without resubmission. Strict matching here would cause false rejections and the exact agent frustration Dave warned about.

#### 15. Strict matching for the Government Warning

_Builds on: #13._

Exact string equality, no normalization. Must begin with `GOVERNMENT WARNING:` in ALL CAPS. Title case, abbreviation, or rewording → fail, with a note citing the reason.

**Why:** 27 CFR Part 16 mandates the exact text with zero variation. This is TTB policy, not an app choice — and the one field where Jenny's "it has to be _exact_" applies literally.

---

### Batch

#### 16. Batch via SSE streaming, processed sequentially

_Builds on: #7, #11, #12._

`/api/batch` reuses the exact same `getProvider()` → `extract()` → `verifyLabel()` path per label, looping sequentially and emitting one Server-Sent Event as each finishes. A top-right notification panel ticks `3 / 10 verified`.

**Why:** Batch is just single-label verify in a loop — no new verification logic. Sequential + streaming gives _perceived progress_ (cards animating in, a live counter) that rebuilds the trust the previous vendor destroyed with 30–40s silent waits. For prototype sizes (10–30 labels) this stays well under Vercel's function timeout; the QStash + KV fan-out upgrade path is documented for when batches grow past ~30.

#### 17. CSV parsing with papaparse, matched by filename

_Builds on: #16._

The batch CSV (one row per label, `filename` column + application fields) is parsed with papaparse; images are matched to rows by the `filename` column in the same multipart request.

**Why:** papaparse handles quoted fields and edge cases a hand-rolled `split(",")` would mangle. Filename matching is the simplest reliable way to pair N images with N rows without an upload order contract.

---

### Quality

#### 18. Vitest (unit) + Playwright (E2E with mock provider)

_Builds on: #11, #12._

Vitest covers the pure logic (`verify.ts`, `ttb-rules.ts`, the provider factory); Playwright drives the real browser through upload → verify → result and batch flows using the **mock** provider so no API key is needed in CI.

**Why:** The deterministic verification logic (#12) is exactly what unit tests pin down. The mock provider (a fifth `OcrProvider`) lets E2E exercise the full UI path deterministically and for free — another payoff of decision #6.

#### 19. Scope cuts: no PDF, no CSV export

_Builds on: everything above — these are the deliberate edges._

**No PDF:** image formats only (JPG/PNG/WEBP); PDF needs server-side rendering Tesseract.js can't do natively — deferred. **No CSV export:** batch results are viewed in-app; export is UI work outside the core verification value and was deprioritized.

**Why:** A prototype earns trust by doing the core thing excellently, not by being wide. Both are clean future adds that touch only the edges, not the spine.

## Architecture

The app is a single Next.js unit with two API routes: `POST /api/verify` (sync, single label) and `POST /api/batch` (SSE stream, N labels). Both routes go through the `getProvider()` factory → `extract()` → `verifyLabel()` pipeline.

> For the full request flow diagram, OCR provider interface types, provider registry, API contracts, and constraints see **[`docs/system-design.md`](system-design.md)**.

### LLM System Prompt

All three LLM providers share the same extraction prompt (defined in `lib/ocr/llm-prompt.ts`):

```
You are an OCR specialist for TTB (Alcohol and Tobacco Tax and Trade Bureau) label verification.
Extract the following fields from the alcohol label image. Return ONLY valid JSON with exactly this structure:
{
  "brandName": { "value": string | null, "confidence": number },
  "classType": { "value": string | null, "confidence": number },
  "abv": { "value": string | null, "confidence": number },
  "netContents": { "value": string | null, "confidence": number },
  "bottler": { "value": string | null, "confidence": number },
  "countryOfOrigin": { "value": string | null, "confidence": number },
  "governmentWarning": { "value": string | null, "confidence": number }
}
confidence is 0.0–1.0. Use null when a field is not present on the label.
For governmentWarning, extract the COMPLETE text exactly as printed, preserving capitalization.
```

---

## Pages & Routes

| Route       | Purpose                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------ |
| `/`         | Single label verification — upload image, fill application fields, see per-field pass/fail |
| `/batch`    | Batch verification — upload N images + CSV, watch results stream in via SSE                |
| `/settings` | Provider configuration — select OCR provider, enter API key, view cost estimates           |

A persistent `NavBar` links all three pages. The active provider name is shown in the nav (e.g. `Using: Tesseract`).

---

## Verification Logic

### Field Match Rules

| Field                    | Match Type | Normalization                                         |
| ------------------------ | ---------- | ----------------------------------------------------- |
| Brand Name               | Fuzzy      | Lowercase, trim, collapse whitespace                  |
| Class/Type               | Fuzzy      | Same                                                  |
| ABV                      | Fuzzy      | Strip`%`, `Alc./Vol.`, `Proof`; compare numeric       |
| Net Contents             | Fuzzy      | Normalize units (`mL` = `ml`); compare numeric + unit |
| Bottler / Name & Address | Fuzzy      | Lowercase + trim                                      |
| Country of Origin        | Fuzzy      | Lowercase + trim                                      |
| Government Warning       | **Strict** | Exact text;`GOVERNMENT WARNING:` must be ALL CAPS     |

### Field Result Statuses

- `pass` — extracted value matches application data within rules
- `fail` — mismatch
- `missing` — field not found on label (null extracted)
- `warning` — readable but suspicious (low confidence, readability concern)

**Overall verdict:** `pass` only if all required fields are `pass`. Any `fail` or `missing` = overall fail.

### Regulatory Layer (Layer 2) — `lib/ttb-rules.ts`

Independent of application data. Validates:

| Check                                      | Regulation           | Example                                      |
| ------------------------------------------ | -------------------- | -------------------------------------------- |
| Class/type is a recognized TTB designation | 27 CFR Parts 4, 5, 7 | "Straight Bourbon Whisky" valid; "Bourb" not |
| ABV within legal bounds for product type   | 27 CFR Parts 4, 5, 7 | Distilled spirits ≥ 40% ABV                  |
| Net contents matches a standard fill size  | Standards of fill    | 750 mL valid; 800 mL not                     |

Layer 2 results are shown as a separate "Regulatory" section in the UI.

### Confidence Badges

LLM providers return confidence (0–1) per field. Displayed as a `%` badge on each field result row. Tesseract returns no confidence — badge is omitted.

---

## Batch Flow

1. User drops N images into the dropzone (multi-file select)
2. Uploads CSV with `filename` column + application fields per row:
   ```
   filename,brandName,classType,abv,netContents,bottler,countryOfOrigin,governmentWarning
   old-tom-label.jpg,Old Tom Distillery,Bourbon Whiskey,45% ABV,750 mL,...
   ```
3. Hits **Verify All** → client opens SSE connection to `/api/batch`
4. Server processes each label sequentially, emitting one SSE event per label as it finishes
5. Each result animates in as a card in the results list
6. **Notification window** (top-right, `components/Notification.tsx`) — live counter `3 / 10 verified` + mini log of recent completions (`✓ old-tom-label.jpg`, `✗ hop-city.png`)
7. On completion: notification shows `Batch complete — 8 passed, 2 failed`

Images are matched to CSV rows by the `filename` column. Both are sent in the same multipart POST.

---

## Settings Page

`/settings` displays:

- Provider radio group: Tesseract (default) / Claude / Gemini / OpenAI / Mock
- API key input (visible only when an LLM provider is selected)
- Cost estimate per provider (static, shown as "~$X/label" with variance note)
- Save → writes `{ provider, apiKey }` to `localStorage`
- Active provider reflected immediately in nav badge

### Provider Cost Estimates

| Provider          | Est. cost/label | Notes                   |
| ----------------- | --------------- | ----------------------- |
| Tesseract         | Free            | Local WASM — no API key |
| Gemini Flash      | ~$0.0002        | Cheapest LLM option     |
| GPT-4o            | ~$0.008         | Mid-range               |
| Claude Sonnet 4.6 | ~$0.010         | ~$0.010                 |

Estimates based on ~2,000 input tokens + ~300 output tokens per image. Vary by image resolution.

### API Key Flow

1. User selects provider + enters API key on `/settings`
2. Saved to `localStorage` as `{ provider: string, apiKey: string }`
3. Every request sends `X-Ocr-Provider` and `X-Api-Key` headers
4. Server reads headers, calls `getProvider()`, uses key for that request only — never persisted server-side

---

## File Map (As Built)

### Source files

```
app/
  layout.tsx                    — Root layout, NavBar, global CSS
  page.tsx                      — Single label verify page (270 lines)
  batch/
    page.tsx                    — Batch upload + SSE streaming + notification (315 lines)
  settings/
    page.tsx                    — Provider selector + API key entry (128 lines)
  api/
    verify/
      route.ts                  — POST /api/verify, sync (28 lines)
    batch/
      route.ts                  — POST /api/batch, SSE stream (104 lines)

components/
  NavBar.tsx                    — Top nav with active provider badge
  Notification.tsx              — Live batch progress panel (top-right)

lib/
  verify.ts                     — verifyLabel() + field normalization (182 lines)
  ttb-rules.ts                  — Regulatory rule checks (122 lines)
  verify.test.ts                — Unit tests for matching + regulatory
  ttb-rules.test.ts             — Unit tests for regulatory rule lookups
  ocr/
    types.ts                    — OcrProvider, OcrResult, ExtractedLabelData, ConfidenceMap
    index.ts                    — getProvider() factory
    index.test.ts               — Factory + mock provider tests
    llm-prompt.ts               — Shared extraction prompt + JSON parser
    claude.ts                   — Claude Sonnet 4.6 provider
    gemini.ts                   — Gemini 2.0 Flash provider
    openai.ts                   — GPT-4o provider
    tesseract.ts                — Tesseract.js WASM provider
    mock.ts                     — Fixed mock data provider

tests/ (Playwright E2E)
  landing.spec.ts               — Smoke test
  single-verify.spec.ts         — Upload + fill + verify flow
  batch.spec.ts                 — CSV + image upload + SSE stream
  settings.spec.ts              — Provider select + localStorage + nav badge

docs/
  system-design.md              — Architecture diagram, API contracts, OCR provider interface, constraints (canonical system design reference)
  users-flow.md                 — User journeys for Jenny, Dave, Janet
  ttb-cola-reference.md         — TTB Form 5100.31, CFR regulations, domain vocab
  superpowers/
    specs/
      2026-06-29-ttb-label-verification-design.md   — Approved design spec (OCR arch, batch flow, file map)
  PLAN-multi-provider-ocr-and-batch.md   — Task execution record for feat/multi-provider-ocr-and-batch
```

### Config files

```
package.json                    — Next.js 16, Tailwind v4, Tesseract.js, PapaParse, Anthropic SDK, @google/generative-ai, openai
tailwind.config.js              — Content paths for all component dirs
postcss.config.mjs              — @tailwindcss/postcss plugin
playwright.config.ts            — E2E test config
vitest.config.ts                — Unit test config (node environment)
tsconfig.json                   — Strict TypeScript
.env.local                      — ANTHROPIC_API_KEY (optional — can use /settings instead)
```

---

## Environment Variables

| Variable            | Description                                      | Required |
| ------------------- | ------------------------------------------------ | -------- |
| `ANTHROPIC_API_KEY` | Claude provider default (if not using /settings) | No       |
| `GEMINI_API_KEY`    | Gemini provider default (if not using /settings) | No       |
| `OPENAI_API_KEY`    | OpenAI provider default (if not using /settings) | No       |

All keys can also be entered at runtime via `/settings` without touching `.env`. The runtime key (from header) takes precedence over env var.

---

## Testing Strategy

### Unit Tests (Vitest)

| File                    | What it covers                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `lib/ocr/index.test.ts` | `getProvider()` returns correct provider; mock provider returns valid `OcrResult` shape            |
| `lib/verify.test.ts`    | Fuzzy match edge cases; strict government warning match; ABV normalization; missing field handling |
| `lib/ttb-rules.test.ts` | Valid/invalid class types; ABV bounds per product type; standard fill lookups                      |

Run: `npm run test:unit` (31 tests, all pass)

### E2E Tests (Playwright)

| File                          | What it covers                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `tests/landing.spec.ts`       | Page loads, upload area visible, form fields present                            |
| `tests/single-verify.spec.ts` | Upload image + fill application data + click Verify → field result cards appear |
| `tests/batch.spec.ts`         | Upload images + CSV → SSE stream → result cards animate in                      |
| `tests/settings.spec.ts`      | Select provider + enter key → saved to localStorage → nav badge updates         |

All E2E tests use the mock OCR provider (no API key required in CI).

---

## Domain Vocabulary (Use Exactly in UI)

| Use This                      | Not This                         |
| ----------------------------- | -------------------------------- |
| Brand Name                    | Trade Name, Product Name         |
| Fanciful Name                 | Sub-brand, Secondary Name        |
| Alcohol Content (ABV)         | Just "ABV" alone                 |
| Net Contents                  | Volume, Size, Bottle Size        |
| Name and Address              | Producer Info, Company Info      |
| Type of Product               | Category, Beverage Type          |
| Government Warning Statement  | Health Warning, Warning Label    |
| Certificate of Label Approval | Label Approval, COLA Certificate |
| Labeling Specialist           | Agent, Reviewer, Inspector       |
| COLA                          | Always ALL CAPS                  |
| Needs Correction              | Rejected for Corrections         |

---

## Regulatory Reference

| Regulation     | Title                      | What It Governs                                 |
| -------------- | -------------------------- | ----------------------------------------------- |
| 27 CFR Part 4  | Wine Labeling              | Mandatory fields, ABV rules, appellation        |
| 27 CFR Part 5  | Distilled Spirits Labeling | Class/type designations, minimum 40% ABV        |
| 27 CFR Part 7  | Malt Beverage Labeling     | Mandatory fields (no federal fill standards)    |
| 27 CFR Part 13 | Labeling Proceedings       | COLA application procedures                     |
| 27 CFR Part 16 | Health Warning Statement   | Exact mandatory text, ALL CAPS, bold formatting |

**Government Warning exact required text:**

```
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink
alcoholic beverages during pregnancy because of the risk of birth defects.
(2) Consumption of alcoholic beverages impairs your ability to drive a car or
operate machinery, and may cause health problems.
```

**Allowable Revisions (no new COLA needed — relevant for fuzzy matching):**

- Item 3b: Type size, font, case (upper↔lower), abbreviations — fuzzy matching handles this correctly
- Items 10, 11, 19: Net contents, alcohol content, name/address changes within same state

---

## Stretch Goals (Phase 4 — Not Built)

### Override Flow (Dave's edge case)

When a labeling specialist disagrees with an AI `fail` result:

- Any `fail` field shows an "Override" button
- Clicking reveals a required free-text reason field
- On save: field changes to `⚠️ Override (Pass)`
- Final verdict reflects override with note attached

**Requires:** session/form state persistence; not meaningful without auth + audit trail.

### CSV Export of Batch Results

- Download full batch results as CSV from `/batch` page
- Summary row at bottom: totals for pass / fail / warning
- Deferred: not part of core value proposition; viewing in-app table is sufficient for prototype demo

### PaddleOCR Provider

Significantly better accuracy than Tesseract for real-world label images (curved text, glare, unusual fonts). Requires Python runtime (FastAPI sidecar) — cannot run on Vercel serverless functions. Would slot in as a fifth `OcrProvider` if deployment target changes to Railway or Fly.io.

### Supervisor Dashboard (`/dashboard`)

- Aggregate pass/fail rates across sessions
- Requires: data persistence, auth

### PDF Support

- Convert single-page PDF to image server-side before passing to OCR
- Requires: `pdf2pic` or Puppeteer or cloud conversion service

### Sort/Filter Batch Results

- Filter batch table by verdict (show failures first)
- Sort by filename, pass/fail, specific field

---

## Out of Scope

- Integration with COLAs Online (TTB's .NET system)
- User authentication / role-based access
- Data retention or audit logging
- TTB Alcohol Facts Statement (proposed rule, not yet mandated)
- Multi-page PDF label sets
- Non-English label verification
- ABV font size / type size regulatory check (TTB does not routinely review per Form 5100.31 Conditions)

---

## Build Steps

**Build in this order.** Steps follow the Key Decisions sequence — each layer depends on the one before it. Every step can be verified independently. Steps marked **⚠️ needs work** require code changes to the current codebase.

---

### Step 0 — Scaffold the project foundation
_Implements: Decisions #1, #2, #3, #5_

```
package.json         — Next.js 16, TypeScript, Tailwind v4, PapaParse, Tesseract.js, Anthropic/Google/OpenAI SDKs
tsconfig.json        — Strict TypeScript, path alias @/* → ./*
postcss.config.mjs   — @tailwindcss/postcss (Tailwind v4 — no separate tailwind.config.js needed)
app/layout.tsx       — Root layout; mounts NavBar above {children}
app/globals.css      — @import "tailwindcss" (v4 syntax)
```

**Verify:** `npm run dev` starts without errors; `http://localhost:3000` loads.  
**Status: ✅ done**

---

### Step 1 — Define the `OcrProvider` interface
_Implements: Decision #6_

```
lib/ocr/types.ts     — ExtractedLabelData, ConfidenceMap, OcrResult, OcrProvider
```

These four types are the shared contract every provider and every consumer must satisfy. Nothing downstream compiles without them.

**Verify:** `tsc --noEmit` passes.  
**Status: ✅ done**

---

### Step 2 — Wire `getProvider()` factory
_Implements: Decision #7_

```
lib/ocr/index.ts     — getProvider(name, apiKey): OcrProvider
```

Maps a string name to a concrete provider instance at request time. Defaults to `tesseract` for unknown names so the app always works out of the box.

**Verify:** `tsc --noEmit` passes.  
**Status: ✅ done**

---

### Step 3 — Add the Tesseract default provider
_Implements: Decision #8_

```
lib/ocr/tesseract.ts — Tesseract.js WASM via bundled eng.traineddata; heuristic field extraction; returns OcrResult with empty confidence map
```

No API key. No network call. The free-forever fallback that guarantees a working pipeline before any key is entered.

**Verify:** `npm run dev`, upload a label image without setting a provider — extraction runs and results render.  
**Status: ✅ done**

---

### Step 4 — Add the Mock provider
_Implements: Decision #18 (test infrastructure)_

```
lib/ocr/mock.ts      — Fixed deterministic OcrResult; 800ms simulated delay
```

`MOCK_EXTRACTED.governmentWarning` must be the exact canonical ALL CAPS text (`GOVERNMENT WARNING: ...`) so E2E tests with the mock provider can exercise a full pass path for that field.

**Verify:** `getProvider("mock").extract(...)` returns a valid `OcrResult` with `governmentWarning` starting with `GOVERNMENT WARNING:`.  
**Status: ✅ done** _(was G1 — fixed)_

---

### Step 5 — Add LLM vision providers
_Implements: Decision #9_

```
lib/ocr/llm-prompt.ts — EXTRACTION_SYSTEM_PROMPT + parseExtractionResponse()
lib/ocr/claude.ts     — Claude Sonnet 4.6 via @anthropic-ai/sdk
lib/ocr/gemini.ts     — Gemini 2.0 Flash via @google/generative-ai
lib/ocr/openai.ts     — GPT-4o via openai
```

All three providers share one prompt and one JSON parser. Each is wired into `getProvider()`.

**Verify:** With a valid API key in `X-Api-Key` header, `/api/verify` returns per-field confidence values.  
**Status: ✅ done**

---

### Step 6 — Write verification logic (Layers 1 & 2)
_Implements: Decisions #12, #13, #14, #15_

```
lib/verify.ts        — verifyLabel(); fuzzyMatch(), abvMatch(), strictMatch(); checkClassTypeRegulatory(), checkAbvRegulatory(), checkNetContentsRegulatory()
```

Layer 1 matches extracted fields against application data — fuzzy for most fields, strict for Government Warning.  
Layer 2 runs independent regulatory checks against TTB CFR rules regardless of what the form says.

**Verify:** `npm run test:unit -- verify` → all tests pass.  
**Status: ✅ done**

---

### Step 7 — Write TTB regulatory rules engine
_Implements: Decision #13_

```
lib/ttb-rules.ts     — isValidClassType(), detectProductType(), parseAbv(), parseNetContentsMl(), isValidFillSize(), ABV_BOUNDS
```

Pure lookup and parse functions. No I/O, no side effects. Called by `verifyLabel()` for Layer 2.

**Verify:** `npm run test:unit -- ttb-rules` → all tests pass.  
**Status: ✅ done**

---

### Step 8 — Unit test suite
_Implements: Decision #18 (unit tests)_

```
vitest.config.ts          — node environment, lib/**/*.test.ts glob
lib/ocr/index.test.ts     — getProvider() factory: default, mock, unknown fallback, OcrResult shape (4 tests)
lib/verify.test.ts        — fuzzy matching, ABV normalization, strict gov warning, Layer 2 regulatory (8 tests)
lib/ttb-rules.test.ts     — class type lookup, product detection, ABV parse, fill size validation (19 tests)
```

**Verify:** `npm run test:unit` → 31 tests, exit 0.  
**Status: ✅ done (31/31 passing)**

---

### Step 9 — Single-label verify API route
_Implements: Decision #1 (API server)_

```
app/api/verify/route.ts  — POST; reads X-Ocr-Provider + X-Api-Key headers; getProvider() → extract() → verifyLabel(); returns { extracted, confidence, result }
```

**Verify:** POST to `/api/verify` with `X-Ocr-Provider: mock` returns JSON with `result.fields` array.  
**Status: ✅ done**

---

### Step 10 — Batch SSE API route
_Implements: Decisions #16, #17_

```
app/api/batch/route.ts   — POST; parses multipart (images keyed as image:{filename} + rows JSON); loops sequentially; emits one SSE event per label
```

CSV rows are pre-parsed client-side with PapaParse and sent as JSON. Images are matched to rows by `filename`. Sequential processing + streaming gives perceived progress that rebuilds user trust.

**Verify:** POST to `/api/batch` with 2 images + 2-row JSON → 2 SSE `result` events stream back.  
**Status: ✅ done**

---

### Step 11 — NavBar + Settings page
_Implements: Decisions #3, #10_

```
components/NavBar.tsx    — Single / Batch / Settings links; "Using: {provider}" badge reads localStorage on each pathname change
app/settings/page.tsx    — Provider radio group (Tesseract / Claude / Gemini / OpenAI / Mock); API key input shown only for LLM providers; Save → localStorage
```

Mock must appear in the provider list so E2E tests can select it without an API key.

**Verify:** `/settings` shows 5 providers including Mock; selecting Mock + Save → NavBar shows "Using: Mock".  
**Status: ✅ done** _(was G2 — Mock option added)_

---

### Step 12 — Single-label verify page
_Implements: Decisions #3, #11_

```
app/page.tsx             — Image upload (drag-and-drop + click); Application Data form (7 fields); Verify Label button; FieldRow per-field results
```

`FieldRow` renders three zones:
1. Status badge (✓ / ✗ / —) + field label + confidence % badge
2. For non-pass: Expected vs. Found on label diff
3. **Regulatory subsection** (if `field.regulatory` exists and is not `"skipped"`): regulatory status icon + note

**Verify:** Upload any label with Mock provider → all 7 field rows render; classType, abv, and netContents rows each show a Regulatory subsection.  
**Status: ✅ done** _(was G3 — regulatory section added to FieldRow)_

---

### Step 13 — Batch verify page
_Implements: Decisions #3, #16_

```
app/batch/page.tsx       — Multi-image file input; CSV file input; Verify All button; result cards animate in per SSE event
components/Notification.tsx — Top-right live counter "3 / 10 verified"; mini log of recent completions; "Batch complete — X passed, Y failed" on done
```

**Verify:** Upload 2 images + valid CSV with Mock provider → 2 result cards render; Notification shows "2 / 2 verified" then completion summary.  
**Status: ✅ done**

---

### Step 14 — E2E test suite
_Implements: Decision #18 (E2E)_

All E2E tests use the **Mock provider** — no API key needed in CI. Set `localStorage` in `beforeEach` via `page.addInitScript`.

```
tests/landing.spec.ts        — Page loads; heading, upload zone, Verify Label button visible (1 test)
tests/single-verify.spec.ts  — Upload image + Verify → field result cards appear (8 tests, real Tesseract fixtures)
tests/batch.spec.ts          — Upload images + valid CSV → Verify All → result cards animate in; invalid CSV → error message (2 tests)
tests/settings.spec.ts       — Provider select + Save → nav badge updates; selection persists across reload (4 tests)
```

**Verify:** `npm run test` → all 4 spec files pass with Chromium.  
**Status: ✅ done** _(was G4 — `single-verify.spec.ts` renamed from `label-verification.spec.ts`; `batch.spec.ts` and `settings.spec.ts` created)_

# Operational Considerations & Open Questions

The Key Decisions above describe how the prototype is built. This section addresses what it takes to _trust, run, and operationalize_ it — accuracy measurement, where the approach sits against industry practice, what it costs at TTB scale, and what happens to a result after verification.

## B1. Accuracy & Evaluation Strategy

**The problem:** Right now there is no way to know how accurate any provider is, because there is no ground truth. You cannot improve — or even compare Tesseract vs. Claude vs. Gemini vs. GPT-4o — without measuring against known-correct answers. Tesseract's weakness is structural: it excels at clean, high-contrast, horizontal printed text (scanned documents) and struggles exactly where alcohol labels live — decorative fonts, curved text on bottles, foil glare, rotation, low contrast. That weakness is a hypothesis until it's measured.

**The fix: a labeled test set + a scoring harness that runs the real pipeline.** This is scaffolded (not just described) so labeled images can be dropped straight in.

### Test set layout

```
fixtures/
  labels/
    <id>.jpg | .png | .webp        — the label images
  ground-truth.csv                 — known-correct values, one row per image
```

`ground-truth.csv` schema:

```
id,brandName,classType,abv,netContents,bottler,countryOfOrigin,governmentWarning,expectedVerdict
```

- `id` matches the image filename stem (e.g. `old-tom-01` → `labels/old-tom-01.jpg`).
- `expectedVerdict` is `pass` or `fail` — the human's overall judgment, used to score end-to-end accuracy.
- **Target set:** ~20–50 diverse images spanning product types (wine / spirits / malt), font styles, and image quality (clean, glare, angled, low light). _The user is hand-labeling this set._

### Scoring script — `scripts/eval.ts`

Runs the **real pipeline**, reusing existing code (no new extraction logic):

- `getProvider(name, apiKey)` from `lib/ocr/index.ts`
- `verifyLabel(appData, extracted, confidence)` from `lib/verify.ts`
- types from `lib/ocr/types.ts`

For each provider in `tesseract | claude | gemini | openai`, it loads every fixture, runs `extract()` → `verifyLabel()`, and compares against ground truth. Added to `package.json` as `"eval": "tsx scripts/eval.ts"` (with `--provider` to scope to one).

### Metrics (per provider)

| Metric                 | What it measures                                                       |
| ---------------------- | ---------------------------------------------------------------------- |
| **Per-field accuracy** | % of fields whose extracted value matches ground truth                 |
| **Verdict accuracy**   | % of images where the app's overall pass/fail matches`expectedVerdict` |
| **False-pass rate** ⭐ | % of*should-fail* labels the app marked **pass** — the headline number |
| Per-field confusion    | Which fields fail most (e.g. warning vs. brand)                        |
| (optional) CER / WER   | Character/word error rate on the raw government-warning text           |

**Why false-pass rate is the headline:** for a compliance tool, a false pass lets a non-compliant label through — the dangerous failure. A false fail merely sends a good label to a human, which is annoying but safe. We optimize provider choice to drive false-pass toward zero, even at the cost of more false fails.

This harness is what lets us **justify the default provider with numbers** instead of a guess, and re-run the moment new labeled images arrive.

## B2. Industry OCR Standards & Region Detection

The industry standard is a **two-stage pipeline: text detection → text recognition.**

| Stage       | Job                                  | Representative approaches                 |
| ----------- | ------------------------------------ | ----------------------------------------- |
| Detection   | Find*where* text is (bounding boxes) | EAST, CRAFT, DBNet                        |
| Recognition | Read*what* it says                   | CRNN, Tesseract LSTM, TrOCR (transformer) |

**How systems narrow the search area:** (a) **zonal / template ROI** — for fixed layouts (forms, passports) you predefine regions and OCR only those crops; (b) **learned text detection** — a model proposes text regions on arbitrary images; (c) **vision-LLM** — hand the whole image to a model that attends to relevant regions internally (what this app does today).

Cloud services return text **with bounding boxes and key-value pairs**: Google Document AI, AWS Textract, Azure AI Document Intelligence. The modern high-accuracy pattern is **OCR-with-boxes → LLM classification**: the boxes give pixel-accurate, _auditable_ locations ("here's exactly where we read the ABV"), and an LLM maps each region to a TTB field.

**Why this matters here:** alcohol-label layouts are **not standardized** — every brand differs — so zonal templating can't work. That's precisely why a vision-LLM (handles arbitrary layout) or a learned detection+recognition pipeline is the right call over plain Tesseract. The current whole-image vision-LLM approach is the pragmatic choice; the documented upgrade path is adding a boxes-returning provider (e.g. Document AI) as a fifth `OcrProvider` to gain auditable region annotations.

## B3. Cost Model

TTB reviews **~150,000 applications/year**. At one label image per application:

| Provider          | Per label         | Annual @ 150k | @ 2–3 labels/application |
| ----------------- | ----------------- | ------------- | ------------------------ |
| Tesseract         | $0 (compute only) | **$0**        | $0                       |
| Gemini Flash      | ~$0.0002          | **~$30**      | ~$60–90                  |
| GPT-4o            | ~$0.008           | **~$1,200**   | ~$2,400–3,600            |
| Claude Sonnet 4.6 | ~$0.010           | **~$1,500**   | ~$3,000–4,500            |

- **The prototype itself costs ~$0** — Tesseract default + Vercel free tier.
- **Cost is a rounding error** against 47 specialists' salaries. Even the priciest option (~$1,500/yr) is a fraction of one FTE. → The real constraints are **accuracy and trust, not cost** (which loops back to B1).
- **Caveat — "free" Tesseract isn't free at scale:** it has no API cost but is **CPU-heavy** (seconds of WASM compute per image), which can cost more in serverless compute, and risks hitting function time limits, than the ~$0.0002/label Gemini API would. At volume, the cheap LLM can be the _cheaper and faster_ option.

## B4. Post-Verification Workflow — "what happens after labeling"

- **In the prototype:** the verdict (per-field pass/fail + overall) is shown in the UI and the specialist acts on it. Nothing persists (stateless by design, decision #4). The app's responsibility ends at displaying the result.
- **In the real TTB workflow** (`docs/ttb-cola-reference.md`): the specialist uses the result to mark the application **Approved / Needs Correction / Rejected** in COLAs Online. The app is **decision support** — it does not make the final call or write back to COLA (integration is out of scope).
- **The production payoff is triage:** auto-clear high-confidence clean passes, and route only failures / low-confidence / edge cases to a human. That's the real efficiency unlock — let AI absorb the "just matching" volume Sarah described, and escalate the nuanced judgment calls to specialists like Dave. This requires the persistence + auth + COLA integration deliberately excluded from the prototype (see Out of Scope).

## B5. Persistence, Override & Oversight (production design)

The prototype is stateless (decision #4), but that is a _prototype scoping choice_, not a limit imposed by "no PII." The moment a result must outlive its request — to be overridden with an auditable reason, or rolled up for a supervisor — persistence is required. And it is _permitted_: verification records are product/business data, not PII.

### Database: PostgreSQL

PostgreSQL is the pick:
- The verification / override / audit data is **relational** — Postgres models it directly with foreign keys and constraints.
- The variable parts (`extracted`, `application_data`, `results`) fit Postgres **`jsonb`** columns — flexible shape without a migration per field change.
- **Azure Database for PostgreSQL** is a managed, **FedRAMP-available** option that aligns with TTB's existing Azure infrastructure (Marcus) — no new cloud to certify.

### What this enables (from `docs/users-flow.md`)

| Capability | Who | Source |
| --- | --- | --- |
| **Override** — override an AI `fail` on your own review with a written reason | Dave / any specialist | `users-flow.md` line 50 ("OVERRIDE — Dave's edge case flow") |
| **Audit trail** — override history with timestamps + IDs | — | `users-flow.md` lines 132–134 |
| **Supervisor dashboard** — aggregate pass/fail visibility (read-only) | Sarah | `users-flow.md` lines 122–125 |

> **Override model = agent-over-AI** (per the literal requirement). A specialist overrides the **AI's** verdict on **their own** review — there is no review queue, no assignment, and no supervisor approving a subordinate's decision. Supervisors get *read-only* oversight (dashboards + audit drill-down), not an approval gate.

### Data model (non-PII; actor identity minimized to opaque IDs)

```
verification
  verification_id   uuid pk
  created_at        timestamp
  disposition       approved | needs_correction | rejected   (specialist's final call — TTB vocab)
  image_ref         blob-storage URL (label artwork — not PII)
  extracted         jsonb   (the ExtractedLabelData)
  application_data  jsonb   (the submitted fields)
  results           jsonb   (per-field AI pass/fail + overall verdict)
  reviewed_by       user_id (opaque specialist ID)

override            (0..n per verification — the audit trail)
  override_id       uuid pk
  verification_id   uuid fk
  field             string
  original_status   pass | fail | missing     (the AI's call)
  override_status   pass | fail
  reason            text     (required)
  overridden_by     user_id  (opaque — the same specialist who reviewed)
  overridden_at     timestamp
```

Nothing here identifies a private individual except the opaque actor IDs, which map to the agency's existing identity system (COLAs Online User IDs) rather than duplicating employee PII. In the agent-over-AI model `reviewed_by` and `overridden_by` are the same specialist.

### Auth & roles

Two roles, mirroring COLAs Online's Full User vs. Reviewer split: `specialist` (verify a label, override **their own** AI results, set disposition) and `supervisor`/`admin` (read-only dashboards + audit). No "approve subordinate" action exists.

### Cross-user read path — how data is queried and shown to a supervisor

This answers the earlier question. It is **read-only oversight**, not an approval step:

1. A specialist verifies a label → record saved; any field they override appends an `override` row; they set `disposition`.
2. **Aggregate dashboard (Sarah):** `SELECT disposition, COUNT(*) … FROM verification WHERE created_at BETWEEN … GROUP BY disposition` — pass/fail/correction rates across submissions.
3. **Audit drill-down:** a supervisor opens any `verification_id` → joins its `override` rows → sees the AI's original call, the specialist's override, the reason, the timestamp, and the opaque actor ID. Pure visibility; the supervisor takes no action on the record.

### Honest caveat

"Non-PII is storable" does **not** make storage consequence-free. Marcus flagged document-retention policies and FedRAMP — federal records carry handling/retention obligations regardless of PII. So this is a substantial build (Postgres + auth + roles + audit + retention policy), which is exactly why the prototype defers it. The point of B5 is to record that the door is _open_ — the "no PII" rule does not close it.
