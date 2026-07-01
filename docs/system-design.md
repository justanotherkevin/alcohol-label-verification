# System Design: TTB Alcohol Label Verification App

## Overview

A single Next.js unit (UI + API routes) that verifies alcohol labels against TTB COLA application data using a pluggable vision/OCR pipeline. Supports single-label (sync) and batch verification (SSE streaming).

---

## Architecture

### High-Level Diagram

```
Browser (Next.js)
    │
    ├── POST /api/verify          ← single label, sync ~5s
    │       │
    │       ├── reads X-Ocr-Provider + X-Api-Key headers
    │       ├── getProvider(name, apiKey)
    │       ├── provider.extract(imageBase64, mimeType) → OcrResult
    │       ├── verifyLabel(extracted, applicationData, confidence) → VerifyResult
    │       └── returns VerifyResult JSON
    │
    └── POST /api/batch           ← N labels, SSE stream
            │
            ├── reads multipart: images[] + csvRows JSON
            ├── for each label (sequentially):
            │       ├── getProvider(name, apiKey)
            │       ├── provider.extract(...)
            │       ├── verifyLabel(...)
            │       └── SSE: emit { filename, result }
            └── SSE: emit { done: true, summary }
```

---

## Services

| Service      | Role                  | Hosting      | Free Tier   |
| ------------ | --------------------- | ------------ | ----------- |
| Next.js App  | Frontend + API routes | Vercel       | Yes (Hobby) |
| OCR Provider | Image text extraction | External API | Pay per use |

---

## API Routes

### `POST /api/verify`

Single label verification. Synchronous — waits for OCR + verification result.

**Request:**

```
Content-Type: multipart/form-data
- image: File
- brandName: string
- classType: string
- abv: string
- netContents: string
- bottler: string
- countryOfOrigin: string
- governmentWarning: string
```

**Response:**

```json
{
  "overall": "pass" | "fail",
  "fields": {
    "brandName":         { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.95, "note": "..." },
    "classType":         { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.90, "note": "..." },
    "abv":               { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.98, "note": "..." },
    "netContents":       { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.92, "note": "..." },
    "bottler":           { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.88, "note": "..." },
    "countryOfOrigin":   { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.85, "note": "..." },
    "governmentWarning": { "status": "pass" | "fail" | "missing" | "warning", "extracted": "...", "expected": "...", "confidence": 0.99, "note": "..." }
  },
  "regulatory": [ { "rule": "...", "status": "pass" | "fail", "note": "..." } ]
}
```

`confidence` is 0–1 per field; omitted when using the Tesseract provider (which returns no confidence scores).

---

### `POST /api/batch`

Batch label verification. Returns a Server-Sent Events stream — one event per label as it finishes, then a final completion event.

**Request:**

```
Content-Type: multipart/form-data
- images[]: File[]   (one image per label)
- csvRows: string    (JSON-encoded array of application data rows, each with a "filename" key)
```

**SSE Response:**

Per-label events (one as each finishes):

```json
{ "filename": "old-tom-label.jpg", "result": { "overall": "pass", "fields": { ... } } }
```

Final event:

```json
{ "done": true, "summary": { "total": 10, "passed": 8, "failed": 2 } }
```

Images are matched to CSV rows by the `filename` key. Both are sent in the same multipart POST.

---

## OCR Provider Interface

All providers implement one interface. The factory `getProvider(name, apiKey)` in `lib/ocr/index.ts` maps a provider name to the concrete implementation at request time.

```typescript
// lib/ocr/types.ts

export interface ExtractedLabelData {
  brandName: string | null;
  classType: string | null;
  abv: string | null;
  netContents: string | null;
  bottler: string | null;
  countryOfOrigin: string | null;
  governmentWarning: string | null;
}

export type ConfidenceMap = Partial<Record<keyof ExtractedLabelData, number>>;

export interface OcrResult {
  data: ExtractedLabelData;
  confidence: ConfidenceMap; // 0–1 per field; empty for Tesseract
}

export interface OcrProvider {
  name: string;
  extract: (imageBase64: string, mimeType: string) => Promise<OcrResult>;
}
```

### Two-Layer Extraction (Tesseract & Google Vision)

Text-based OCR providers (`tesseract.ts`, `google-vision.ts`) don't understand what a "brand name" or "ABV" is — they only see pixels and text. Field identification happens in a second layer, on top of the raw OCR output:

```
┌───────────────────────────────┐
│  Layer 1: OCR Engine           │
│  Tesseract.js  /  Google Vision│
└───────────────────────────────┘
                │
                ├── full text (flat string, no field semantics)
                └── word list: { text, bbox } (pixel coords, no field semantics)
                │
                ▼
┌───────────────────────────────┐
│  Layer 2: Regex Extraction     │
│  lib/ocr/tesseract.ts:         │
│  extractAbv, extractBrandName, │
│  extractBottler, extractClass- │
│  Type, extractCountryOfOrigin, │
│  extractGovernmentWarning,     │
│  extractNetContents            │
└───────────────────────────────┘
                │
                └── field value strings (e.g. abv: "43% ALC./VOL")
                │      or null if no pattern matched the text
                ▼
┌───────────────────────────────┐
│  Bbox Lookup                   │
│  computeFieldBbox(words,       │
│    fieldValue, W, H)           │
└───────────────────────────────┘
                │
                └── union of matching words' boxes, normalized 0–1
                ▼
       ExtractedLabelData + BoundingBoxMap
```

A `null` field can come from either layer: Layer 1 failed to read the text at all (bad image quality, occlusion), or Layer 1 read it fine but Layer 2's regex doesn't match how it's actually phrased on this label (e.g. no "Bottled by" prefix present). This is why the same regex functions are shared verbatim between `tesseract.ts` and `google-vision.ts` — swapping OCR engines doesn't change what a "field" means, only how reliably the raw text/words are captured.

LLM providers (`claude.ts`, `gemini.ts`, `openai.ts`) skip this two-layer split entirely — the model returns field values and bounding boxes directly in one pass (Pattern B in `docs/ocr-comparison.md`), trading determinism for not needing a regex layer at all.

### Provider Registry

```
lib/ocr/
  types.ts       — OcrProvider, OcrResult, ExtractedLabelData, ConfidenceMap
  index.ts       — getProvider(name, apiKey): OcrProvider factory
  llm-prompt.ts  — shared extraction prompt + JSON parser (used by all LLM providers)
  claude.ts      — Claude Sonnet 4.6
  gemini.ts      — Gemini 2.0 Flash
  openai.ts      — GPT-4o
  tesseract.ts   — Tesseract.js WASM (default, no API key required)
  mock.ts        — Fixed mock data (used by tests and CI)
```

### Provider Selection

The client sends `X-Ocr-Provider` and `X-Api-Key` headers on every request. The API route calls `getProvider(name, apiKey)` to resolve the concrete provider. The key is used for that request only and never persisted server-side.

Supported provider names: `tesseract` (default) | `claude` | `gemini` | `openai` | `mock`.

---

## Verification Layer

Verification is deterministic TypeScript — no model involved.

### `lib/verify.ts` — Application Match (Layer 1)

`verifyLabel(extracted, appData, confidence)` compares each extracted field against the COLA application data. Returns a `VerifyResult` with per-field statuses and an overall verdict.

**Field match rules:**

| Field             | Match Type | Normalization                                           |
| ----------------- | ---------- | ------------------------------------------------------- |
| brandName         | Fuzzy      | Lowercase, trim, collapse whitespace                    |
| classType         | Fuzzy      | Same                                                    |
| abv               | Fuzzy      | Strip `%`, `Alc./Vol.`, `Proof`; compare numeric        |
| netContents       | Fuzzy      | Normalize units (`mL` = `ml`); compare numeric+unit     |
| bottler           | Fuzzy      | Lowercase + trim                                        |
| countryOfOrigin   | Fuzzy      | Lowercase + trim                                        |
| governmentWarning | **Strict** | Exact string; must begin `GOVERNMENT WARNING:` ALL CAPS |

**Field result statuses:**

- `pass` — extracted value matches application data within rules
- `fail` — mismatch
- `missing` — field not found on label (null extracted)
- `warning` — readable but suspicious (low confidence)

**Overall verdict:** `pass` only if all required fields are `pass`. Any `fail` or `missing` → overall fail.

### `lib/ttb-rules.ts` — Regulatory Validation (Layer 2)

`validateRegulatoryRules(extracted)` checks TTB CFR rules independently of the application data:

| Check                                      | Regulation           |
| ------------------------------------------ | -------------------- |
| Class/type is a recognized TTB designation | 27 CFR Parts 4, 5, 7 |
| ABV within legal bounds for product type   | 27 CFR Parts 4, 5, 7 |
| Net contents matches a standard fill size  | Standards of fill    |

Layer 2 results are shown as a separate "Regulatory" section in the UI.

---

## Batch Processing Sequence

```
Client              /api/batch
  │                      │
  │── POST ──────────────▶
  │                      │  (parse multipart: images + csvRows)
  │                      │  (open SSE stream)
  │                      │
  │                      │── extract label 1 → verify → emit event
  │◀── SSE: { filename: "label-01.jpg", result: { ... } } ──────────
  │                      │
  │                      │── extract label 2 → verify → emit event
  │◀── SSE: { filename: "label-02.jpg", result: { ... } } ──────────
  │                      │
  │                      │  (... repeat for each label sequentially)
  │                      │
  │◀── SSE: { done: true, summary: { total: N, passed: X, failed: Y } }
```

---

## Environment Variables

| Variable            | Description                                      | Required |
| ------------------- | ------------------------------------------------ | -------- |
| `ANTHROPIC_API_KEY` | Claude provider default (if not using /settings) | No       |
| `GEMINI_API_KEY`    | Gemini provider default (if not using /settings) | No       |
| `OPENAI_API_KEY`    | OpenAI provider default (if not using /settings) | No       |
| `GOOGLE_VISION_API_KEY` | Google Vision provider default, **dev-only** — read from `.env.development.local`, which Next.js never loads outside `next dev`; production always requires the client-supplied key from `/settings` | No |

All keys can also be entered at runtime via `/settings` without touching `.env`. The runtime key (from the `X-Api-Key` header) takes precedence over the env var, where a fallback is implemented (currently `google-vision` only — see `lib/ocr/index.ts`'s `getProvider()`).

---

## Constraints & Tradeoffs

| Constraint                  | Decision                           | Tradeoff                                                             |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Vercel 60s function timeout | Sequential SSE (not parallel)      | Simpler; parallel fan-out deferred until batch grows past ~30 labels |
| No persistent storage       | Stateless — results in React state | Gone on refresh; acceptable for prototype                            |
| No auth                     | Open API                           | Acceptable for prototype; must add before production                 |
| Image size                  | Base64 in multipart POST           | Large images may hit Vercel body limit; compress before upload       |
