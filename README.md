# TTB Alcohol Label Verification

An AI-powered web app that verifies alcohol labels against TTB application data. Supports single-label and batch verification using a configurable vision/OCR backend.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js Client                       │
└────────────────┬─────────────────────┬───────────────────┘
                 │                     │
          POST /api/verify      POST /api/batch
          (sync, ~5s)           (returns jobId)
                 │                     │
                 ▼                     ▼
        ┌────────────────┐   ┌──────────────────────┐
        │  /api/verify   │   │  /api/batch          │
        └───────┬────────┘   │  enqueues N messages │
                │            └──────────┬───────────┘
                │                       │
                │              Upstash QStash
                │            (one message per label)
                │                       │ triggers
                │                       ▼
                │            ┌──────────────────────┐
                │            │  /api/worker         │
                │            │  (per-label fn)      │
                │            └──────────┬───────────┘
                │                       │
                └──────────┬────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   OCR Service   │  lib/ocr.ts
                  │ (adapter layer) │  configured via env var
                  └────────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
      Claude          Google            AWS
      Vision          Vision          Textract
                           │
                           ▼
                  ┌─────────────────┐
                  │ Comparison Logic │  lib/compare.ts
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Upstash Redis  │  job state + result cache
                  └─────────────────┘
                           ▲
                    GET /api/jobs/:id
                    (client polling)
```

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React, Tailwind CSS |
| API | Next.js API Routes (serverless) |
| Job Queue | Upstash QStash |
| Cache / Job State | Upstash Redis |
| OCR (default) | Anthropic Claude Vision |
| OCR (alternatives) | Google Cloud Vision, AWS Textract |
| Hosting | Vercel |
