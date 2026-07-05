# TTB Alcohol Label Verification

An AI-powered web app that verifies alcohol labels against TTB application data. Supports single-label and batch verification using a configurable vision/OCR backend.

## What This App Does

This application uses AI vision (Claude, Gemini, or GPT-4o) to:

1. **Extract** text from label images (OCR + structured field extraction)
2. **Compare** extracted fields against application data (fuzzy matching for most fields, strict matching for Government Warning Statement)
3. **Validate** against TTB regulations (ABV bounds by product type, valid class designations from 27 CFR, standard fill sizes)
4. **Report** pass/fail/missing per field with extracted vs. expected values

**What it does not do:**

- Integrate directly with COLAs Online (standalone prototype)
- Replace specialist judgment on ambiguous or complex cases
- Handle visual formatting checks (font size, contrast, layout)
- Store or retain application data (no persistence beyond the session)

**Target performance:** ≤ 5 seconds per label for single verification; batch mode processes multiple labels via streaming.

### Batch Processing Context

Large importers submit hundreds of applications at once. The batch feature allows uploading multiple label images alongside a CSV of corresponding application data, processing all labels in parallel and streaming results back as each completes — enabling bulk pre-screening before specialist review.

### The Bottleneck

With 150,000 applications per year and 47 specialists, each specialist handles roughly **3,200 applications annually**. Much of that workload is mechanically matching text on a label image against text in an application form — a task that requires attention but not expertise.

Historically, TTB had over 100 agents. Budget reductions have cut staffing in half while application volume has remained high. The backlog is a recurring operational pain point, particularly during peak import seasons when large batches (200–300 applications) arrive at once.

### The Prior Attempt

TTB piloted a scanning vendor whose system took 30–40 seconds per label. Specialists abandoned it because they could manually review 5 labels in the time the machine processed 1. **Speed is a hard requirement** — results must return in approximately 5 seconds to be useful in an active review workflow.

## Architecture

The app is a single Next.js unit. Single-label verification is synchronous (`POST /api/verify`, ~5s); batch verification streams results via Server-Sent Events (`POST /api/batch`).

See [`docs/system-design.md`](docs/system-design.md) for the full request flow, API contracts, OCR provider interface, and constraints.

The default Tesseract OCR config (no preprocessing, `PSM.SPARSE_TEXT`, `OEM.LSTM_ONLY`) was chosen by grid-searching 32 configs against a manually verified ground-truth sheet for the demo labels — see [`docs/2026-07-05-tesseract-grid-search-results.md`](docs/2026-07-05-tesseract-grid-search-results.md).

## Technology Stack

| Layer             | Technology                                      |
| ----------------- | ----------------------------------------------- |
| Frontend / API    | Next.js 16 (App Router), React, Tailwind CSS v4 |
| OCR (default)     | Tesseract.js (WASM, no API key)                 |
| OCR (LLM options) | Claude Sonnet 4.6 / Gemini 2.0 Flash / GPT-4o  |
| CSV parsing       | PapaParse                                       |
| Testing           | Vitest (unit) + Playwright (E2E)                |
| Hosting           | Vercel                                          |

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
