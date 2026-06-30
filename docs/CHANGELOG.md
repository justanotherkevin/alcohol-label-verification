# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
