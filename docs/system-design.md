# System Design: TTB Alcohol Label Verification App

## Overview

A web application that verifies alcohol labels against TTB application data using a configurable vision/OCR processing backend. Supports single-label and batch verification with async job processing.

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          Client                             │
│                     (Next.js / React)                       │
└──────────┬───────────────────────────┬──────────────────────┘
           │                           │
    POST /api/verify            POST /api/batch
    (single label)              (multi-label)
           │                           │
           ▼                           ▼
┌──────────────────┐       ┌───────────────────────┐
│  /api/verify     │       │  /api/batch           │
│  (sync, ~5s)     │       │  creates job in Redis │
└────────┬─────────┘       │  enqueues N messages  │
         │                 └──────────┬────────────┘
         │                            │ (one msg per label)
         │                            ▼
         │                 ┌───────────────────────┐
         │                 │   Upstash QStash       │
         │                 │   (HTTP queue)         │
         │                 └──────────┬────────────┘
         │                            │ triggers
         │                            ▼
         │                 ┌───────────────────────┐
         │                 │  /api/worker          │
         │                 │  (per-label fn)       │
         │                 └──────────┬────────────┘
         │                            │
         └──────────────┬─────────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │    OCR Service      │
             │   lib/ocr.ts        │
             │  (adapter layer)    │
             └──────────┬──────────┘
                        │ dispatches to configured provider
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   ┌────────────┐ ┌──────────┐ ┌────────────────┐
   │   Claude   │ │  Google  │ │ AWS Textract   │
   │  Vision    │ │  Vision  │ │   (or other)   │
   └────────────┘ └──────────┘ └────────────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │  Comparison Logic   │
             │  lib/compare.ts     │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │   Upstash Redis     │
             │  job status, cache  │
             └─────────────────────┘
                        ▲
                        │ GET /api/jobs/:id
                        │ (client polls)
             ┌─────────────────────┐
             │       Client        │
             └─────────────────────┘
```

---

## Services

| Service        | Role                    | Hosting      | Free Tier   |
| -------------- | ----------------------- | ------------ | ----------- |
| Next.js App    | Frontend + API routes   | Vercel       | Yes (Hobby) |
| Upstash Redis  | Job state, result cache | Upstash      | 10k req/day |
| Upstash QStash | HTTP job queue, fan-out | Upstash      | 500 msg/day |
| OCR Provider   | Image text extraction   | External API | Pay per use |

---

## API Routes

### `POST /api/verify`

Single label verification. Synchronous — waits for OCR + comparison result.

**Request:**

```
Content-Type: multipart/form-data
- image: File
- brandName: string
- classType: string
- abv: string
- netContents: string
- bottlerInfo: string
- countryOfOrigin: string
- govtWarning: string
```

**Response:**

```json
{
  "overall": "pass" | "fail",
  "fields": {
    "brandName":        { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "classType":        { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "abv":              { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "netContents":      { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "bottlerInfo":      { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "countryOfOrigin":  { "status": "pass" | "fail", "extracted": "...", "expected": "...", "note": "..." },
    "govtWarning":      { "status": "pass" | "fail" | "warning", "extracted": "...", "expected": "...", "note": "..." }
  }
}
```

---

### `POST /api/batch`

Initiates async batch job. Returns a jobId immediately.

**Request:**

```
Content-Type: multipart/form-data
- labels: File[]   (images or ZIP)
- csv: File        (application data mapped to filenames)
```

**Response:**

```json
{ "jobId": "job_abc123" }
```

---

### `GET /api/jobs/:id`

Client polls this for batch job progress and results.

**Response:**

```json
{
  "jobId": "job_abc123",
  "status": "pending" | "processing" | "complete",
  "total": 50,
  "completed": 32,
  "failed": 2,
  "results": [
    {
      "filename": "label_001.jpg",
      "overall": "pass",
      "fields": { ... }
    }
  ]
}
```

---

### `POST /api/worker`

Internal route. Called by QStash for each label in a batch. Not called directly by the client.

**Request (from QStash):**

```json
{
  "jobId": "job_abc123",
  "filename": "label_001.jpg",
  "imageUrl": "...",
  "applicationData": { ... }
}
```

---

## OCR Service Adapter (`lib/ocr.ts`)

Reads `PROCESSING_SERVICE` env var and dispatches to the correct provider. All providers implement the same interface.

```typescript
interface OcrResult {
  brandName: string;
  classType: string;
  abv: string;
  netContents: string;
  bottlerInfo: string;
  countryOfOrigin: string;
  govtWarning: string;
  govtWarningBold: boolean;
  govtWarningAllCaps: boolean;
  govtWarningFontSize: "normal" | "small" | "tiny";
}

interface OcrProvider {
  extract(image: Buffer, mimeType: string): Promise<OcrResult>;
}
```

**Supported providers (via `PROCESSING_SERVICE`):**

| Value      | Provider                          |
| ---------- | --------------------------------- |
| `claude`   | Anthropic Claude Vision (default) |
| `google`   | Google Cloud Vision API           |
| `textract` | AWS Textract                      |

---

## Comparison Logic (`lib/compare.ts`)

### Fuzzy Match (all fields except govt warning)

- Normalize both strings: lowercase, strip punctuation, collapse whitespace
- Use Levenshtein distance or token overlap
- Pass if similarity ≥ threshold (configurable, default 0.85)
- ABV normalization: extract numeric value, convert proof if needed (`90 Proof` → `45%`)

### Strict Match (govt warning only)

- Exact string comparison after collapsing whitespace
- Separate checks for bold formatting and ALL CAPS on "GOVERNMENT WARNING:"
- Font size flagged as `warning` state (not auto-fail)

### Result States

- `pass` — match within tolerance
- `fail` — mismatch beyond tolerance
- `warning` — readable but suspicious (tiny text, low contrast govt warning)

---

## Redis Data Model

### Job record

```
Key:   job:{jobId}
Type:  Hash
TTL:   6 hours

Fields:
  status      "pending" | "processing" | "complete"
  total       "50"
  completed   "32"
  failed      "2"
  createdAt   "2026-06-29T12:00:00Z"
```

### Per-label result

```
Key:   job:{jobId}:label:{filename}
Type:  String (JSON)
TTL:   6 hours

Value: { overall, fields }
```

### OCR result cache

```
Key:   ocr:cache:{sha256(imageBytes)}
Type:  String (JSON)
TTL:   1 hour

Value: OcrResult
```

Avoids re-calling the OCR provider if the same image is submitted twice within the TTL window.

---

## Batch Processing Sequence

```
Client          API /batch      QStash          /api/worker     Redis
  │                │               │                 │             │
  │── POST ────────▶               │                 │             │
  │                │── create job ────────────────────────────────▶│
  │                │── enqueue N msgs ──▶             │             │
  │◀── jobId ──────│               │                 │             │
  │                │               │                 │             │
  │── poll ────────────────────────────────────────────────────────▶│
  │◀── { status: "processing", completed: 0 } ──────────────────────│
  │                │               │                 │             │
  │                │               │── trigger ──────▶             │
  │                │               │── trigger ──────▶             │
  │                │               │── trigger ──────▶  (parallel) │
  │                │               │                 │             │
  │                │               │                 │── write ───▶│
  │                │               │                 │── write ───▶│
  │                │               │                 │── write ───▶│
  │                │               │                 │             │
  │── poll ────────────────────────────────────────────────────────▶│
  │◀── { status: "complete", results: [...] } ──────────────────────│
```

---

## Environment Variables

| Variable                     | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `ANTHROPIC_API_KEY`          | Required if `PROCESSING_SERVICE=claude`            |
| `GOOGLE_VISION_API_KEY`      | Required if `PROCESSING_SERVICE=google`            |
| `AWS_ACCESS_KEY_ID`          | Required if `PROCESSING_SERVICE=textract`          |
| `AWS_SECRET_ACCESS_KEY`      | Required if `PROCESSING_SERVICE=textract`          |
| `PROCESSING_SERVICE`         | `claude` (default) \| `google` \| `textract`       |
| `UPSTASH_REDIS_REST_URL`     | Upstash Redis endpoint                             |
| `UPSTASH_REDIS_REST_TOKEN`   | Upstash Redis auth token                           |
| `QSTASH_URL`                 | Upstash QStash endpoint                            |
| `QSTASH_TOKEN`               | Upstash QStash auth token                          |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash webhook verification                        |
| `QSTASH_NEXT_SIGNING_KEY`    | QStash webhook verification (rotation)             |
| `NEXT_PUBLIC_APP_URL`        | Public URL (used to construct worker callback URL) |

---

## Constraints & Tradeoffs

| Constraint                        | Decision                           | Tradeoff                                                      |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Vercel Hobby 10s timeout          | Each worker handles one label only | More QStash messages, but each stays under timeout            |
| No persistent storage             | Redis with TTL                     | Results expire after 6h; acceptable for prototype             |
| Upstash QStash 500 msg/day (free) | Sufficient for demo/prototype      | Hard cap; upgrade needed for production                       |
| No auth                           | Open API                           | Acceptable for prototype; must add before production          |
| Image size                        | Passed as base64 in QStash message | QStash has 1MB body limit; large images need pre-upload to S3 |
