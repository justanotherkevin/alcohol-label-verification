# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
