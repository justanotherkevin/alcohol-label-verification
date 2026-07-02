# Codebase Context

A running glossary of key terms and phrases used in this codebase, kept up to date so future chat sessions can ramp up quickly without re-deriving vocabulary from scratch. Append new terms here as they come up — group by subsystem, cite `file:line`, and cross-link related terms.

For TTB/COLA regulatory domain background (not code terminology), see `docs/TTB-COLA-context.md`.

---

## "Layer 1" / "Layer 2" (overloaded — two different meanings)

This codebase uses "Layer 1"/"Layer 2" for **two unrelated two-stage pipelines**. Always check which pipeline is under discussion before assuming which meaning applies.

### Meaning A: OCR extraction pipeline

Applies to text-based OCR providers only (`lib/ocr/tesseract.ts`, `lib/ocr/google-vision.ts`). See `docs/system-design.md:148-188`.

- **Layer 1 = OCR Engine** — Tesseract.js or Google Vision reads raw pixels into a flat text string plus a word/bbox list. No field semantics; it doesn't know what a "brand name" or "ABV" is.
- **Layer 2 = Regex Extraction** — field-identification functions in `lib/ocr/tesseract.ts`: `extractAbv`, `extractBrandName`, `extractBottler`, `extractClassType`, `extractCountryOfOrigin`, `extractGovernmentWarning`, `extractNetContents`. Turns Layer 1's raw text into typed fields (`ExtractedLabelData`, `lib/ocr/types.ts:1-9`).

A `null` field can originate from either layer: Layer 1 failed to read the text (bad image quality, occlusion), or Layer 1 read it fine but Layer 2's regex didn't match the phrasing on this label.

**LLM providers skip this split entirely** — `lib/ocr/claude.ts`, `lib/ocr/gemini.ts`, `lib/ocr/openai.ts` return field values directly in one pass.

**Guided OCR** (added in the type-restructure PR) lets Layer 2 use the submitted application data as search targets instead of blind regex heuristics:
- `GuidedSearchHints` — `lib/ocr/types.ts:31-39`
- `findInText()` — `lib/ocr/tesseract.ts:110-115`
- `findAbvInText()` / `findNetContentsInText()` (numeric fallbacks) — `lib/ocr/tesseract.ts:119-129`, `:133-143`
- `extractWithHints()` orchestrator — `lib/ocr/tesseract.ts:146+`
- `OcrProvider.extract()` now takes an optional `hints` param — `lib/ocr/types.ts:41-44`

### Meaning B: Verification pipeline

Applies after OCR extraction is complete — deterministic TypeScript, no model involved. See `docs/system-design.md:212-251`, `lib/verify.test.ts:24,55`.

- **Layer 1 = Application Match** — `verifyLabel()` in `lib/verify.ts`. Compares extracted fields to the submitted COLA application data (fuzzy match on most fields, strict exact-match on `governmentWarning`).
- **Layer 2 = Regulatory Validation** — `validateRegulatoryRules()` in `lib/ttb-rules.ts`. Checks TTB CFR compliance (27 CFR Parts 4/5/7) independent of what the applicant submitted — e.g. is the class/type a recognized designation, is ABV within legal bounds, does net contents match a standard fill size.

Shown as separate "Verification" and "Regulatory" sections in the UI.

---

## `rawOcrText`

- Type: `LabelImage.rawOcrText?: string` — `lib/queue/types.ts:8`
- Source: `OcrResult.rawText?: string` — `lib/ocr/types.ts:28` (Layer 1 output, OCR-extraction sense)
- Populated in `lib/queue/analyze.ts:27` from `ocrResult.rawText`, only for image index 0
- Also loaded via the dev-mode vision-text loader — `lib/queue/load-image.ts:21-22`

## `QueueApplication` (types restructure)

- `lib/queue/types.ts` — `ocrData: OcrData | null` (line 62, extraction results) is separated from `reviewData: ApplicationReviewData` (line 63, specialist audit trail: `sessions[]`, `fieldNotes[]`, `resolution`).
