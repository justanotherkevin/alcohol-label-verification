# Queue-Based AI-Precomputed Review Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "upload image + type application data + click Verify" single-label flow with a queue of already-submitted applications that are pre-analyzed by AI ahead of time, so a Labeling Specialist opens an application, reviews the AI's per-field findings, resolves any flags (override or leave flagged), and approves or rejects.

**Architecture:** A new `lib/queue/` module owns an in-memory store of `QueueApplication` records (bundled application data + bundled label image + optional pre-computed analysis + optional resolution), a pre-analysis function that reuses the existing `getProvider()` OCR factory and `verifyLabel()` comparison engine, and a pure resolution-validation function enforcing the approve/reject gating rules. New API routes expose this store to two rewritten pages: the dashboard becomes a queue list with "Add mock application" / "Run pre-analysis now" dev tools, and a new `/queue/[id]` page is the review screen (reusing the field-row UI pattern from the page it replaces). Batch processing gets a small addition: any batch row that doesn't fully pass gets pushed into the same queue store instead of only appearing in a CSV export.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, Vitest (`lib/**/*.test.ts`), Playwright (`tests/*.spec.ts`). No new dependencies and no database — persistence is an in-memory module-level array, matching this prototype's existing scope (no auth/persistence per `docs/users-flow.md`).

## Global Constraints

- No new npm dependencies. Reuse `getProvider()` (`lib/ocr/index.ts`), `verifyLabel()` and `ApplicationData`/`VerificationResult`/`FieldResult` types (`lib/verify.ts`), and `ExtractedLabelData`/`ConfidenceMap`/`BoundingBoxMap`/`OcrResult` types (`lib/ocr/types.ts`) as-is — do not modify them.
- Use the `@/` path alias for all cross-directory imports, matching existing files.
- Next.js 16 dynamic route handlers take `{ params }: { params: Promise<{ id: string }> }` — `params` must be awaited.
- Persistence is in-memory only (a module-level array in `lib/queue/store.ts`). No database, no file-based persistence. This matches the project's existing stated scope exclusion of data retention.
- Follow existing Tailwind token usage verbatim (`bp-success`, `bp-error`, `bp-warning`, `on-surface`, `on-surface-dim`, `on-surface-muted`, `surface-card`, `surface-dim`, `outline`, `primary`) — do not invent new color tokens.
- Unit tests: Vitest, files named `*.test.ts` under `lib/`, `describe`/`it`/`expect` style matching `lib/verify.test.ts`.
- E2E tests: Playwright, files named `*.spec.ts` under `tests/`, using `page.getByRole()`/`page.getByText()` and the `addInitScript` pattern for setting `ttb-ocr-settings` to the mock provider, matching `tests/single-verify.spec.ts`.

---

### Task 1: Queue domain types

**Files:**

- Create: `lib/queue/types.ts`

**Interfaces:**

- Consumes: `ApplicationData`, `VerificationResult` from `lib/verify.ts`; `ExtractedLabelData`, `ConfidenceMap`, `BoundingBoxMap` from `lib/ocr/types.ts`
- Produces: `QueueStatus`, `FieldOverride`, `Resolution`, `QueueAnalysis`, `QueueApplication`, `QueueSummary` — used by every later task in this plan

- [ ] **Step 1: Write the types file**

```typescript
// lib/queue/types.ts
import { ApplicationData, VerificationResult } from "@/lib/verify";
import {
  ExtractedLabelData,
  ConfidenceMap,
  BoundingBoxMap,
} from "@/lib/ocr/types";

export type QueueStatus = "pending" | "analyzed" | "resolved";

export interface FieldOverride {
  field: string;
  reason: string;
}

export interface Resolution {
  decision: "approved" | "rejected";
  overrides: FieldOverride[];
  rejectedFields: string[];
  note: string;
  resolvedAt: string;
}

export interface QueueAnalysis {
  extracted: ExtractedLabelData;
  confidence: ConfidenceMap;
  boundingBoxes?: BoundingBoxMap;
  result: VerificationResult;
  analyzedAt: string;
}

export interface QueueApplication {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  applicationData: ApplicationData;
  imageBase64: string;
  imageMimeType: string;
  status: QueueStatus;
  analysis: QueueAnalysis | null;
  resolution: Resolution | null;
}

export interface QueueSummary {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  status: QueueStatus;
  flagCount: number;
  overallPass: boolean | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/queue/types.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/queue/types.ts
git commit -m "feat: add queue domain types"
```

---

### Task 2: Image loader + seed data

**Files:**

- Create: `lib/queue/load-image.ts`
- Create: `lib/queue/seed-data.ts`

**Interfaces:**

- Consumes: `QueueApplication`, `FieldOverride` (unused here) from `./types`; `ApplicationData`, `FieldResult`, `REQUIRED_GOVERNMENT_WARNING`, `RegulatoryCheck` from `@/lib/verify`; `ExtractedLabelData` from `@/lib/ocr/types`
- Produces: `loadMockImage(relPath: string): { imageBase64: string; imageMimeType: string }`, `SEED_APPLICATIONS: QueueApplication[]` (6 entries) — consumed by Task 3 (mock templates) and Task 4 (store)

- [ ] **Step 1: Write the image loader**

```typescript
// lib/queue/load-image.ts
import fs from "fs";
import path from "path";

export function loadMockImage(relPath: string): {
  imageBase64: string;
  imageMimeType: string;
} {
  const filePath = path.join(process.cwd(), "tests", "mocks", relPath);
  const buffer = fs.readFileSync(filePath);
  const imageMimeType =
    relPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return { imageBase64: buffer.toString("base64"), imageMimeType };
}
```

- [ ] **Step 2: Write the seed data**

Five applications ship pre-analyzed (covering: clean pass, Government Warning strict-fail, fuzzy-match pass, glare/low-confidence fail, override-candidate ABV mismatch). One ships `pending` with no analysis, so Task 9's "Run pre-analysis now" button has something to do.

```typescript
// lib/queue/seed-data.ts
import {
  ApplicationData,
  FieldResult,
  REQUIRED_GOVERNMENT_WARNING,
  RegulatoryCheck,
} from "@/lib/verify";
import { ExtractedLabelData } from "@/lib/ocr/types";
import { QueueApplication } from "./types";
import { loadMockImage } from "./load-image";

const TITLE_CASE_WARNING =
  "Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function field(
  key: string,
  label: string,
  expected: string | null,
  extracted: string | null,
  status: FieldResult["status"],
  extra: Partial<FieldResult> = {},
): FieldResult {
  return { field: key, label, expected, extracted, status, ...extra };
}

const REG_PASS_CLASS: RegulatoryCheck = {
  status: "pass",
  note: "Recognized TTB class/type designation",
};
const regPassAbv = (pct: number, type: string): RegulatoryCheck => ({
  status: "pass",
  note: `ABV ${pct}% is within allowed range for ${type}`,
});
const regPassFill = (ml: number): RegulatoryCheck => ({
  status: "pass",
  note: `${ml} mL is a valid standard fill size`,
});

function seed(
  id: string,
  brandName: string,
  applicant: string,
  submittedAt: string,
  imageFile: string,
  applicationData: ApplicationData,
  extracted: ExtractedLabelData,
  fields: FieldResult[],
  confidence: Record<string, number> = {},
): QueueApplication {
  return {
    id,
    brandName,
    applicant,
    submittedAt,
    applicationData,
    ...loadMockImage(imageFile),
    status: "analyzed",
    analysis: {
      extracted,
      confidence,
      result: { overallPass: fields.every((f) => f.status === "pass"), fields },
      analyzedAt: submittedAt,
    },
    resolution: null,
  };
}

export const SEED_APPLICATIONS: QueueApplication[] = [
  // 1. Clean AI pass
  seed(
    "TTB-2026-1001",
    "Old Tom Distillery — Bourbon Reserve",
    "Old Tom Distillery LLC",
    "2026-06-29T14:00:00.000Z",
    "label_1.jpg",
    {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% ABV",
      netContents: "750 mL",
      bottler: "Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Old Tom Distillery, Louisville, KY",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field(
        "brandName",
        "Brand Name",
        "OLD TOM DISTILLERY",
        "OLD TOM DISTILLERY",
        "pass",
      ),
      field(
        "classType",
        "Class / Type",
        "Kentucky Straight Bourbon Whiskey",
        "Kentucky Straight Bourbon Whiskey",
        "pass",
        { regulatory: REG_PASS_CLASS },
      ),
      field(
        "abv",
        "Alcohol Content (ABV)",
        "45% ABV",
        "45% Alc./Vol.",
        "pass",
        { regulatory: regPassAbv(45, "spirits") },
      ),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", {
        regulatory: regPassFill(750),
      }),
      field(
        "bottler",
        "Bottler / Producer",
        "Old Tom Distillery, Louisville, KY",
        "Old Tom Distillery, Louisville, KY",
        "pass",
      ),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field(
        "governmentWarning",
        "Government Warning",
        REQUIRED_GOVERNMENT_WARNING,
        REQUIRED_GOVERNMENT_WARNING,
        "pass",
      ),
    ],
  ),

  // 2. Government Warning strict-fail (title case)
  seed(
    "TTB-2026-1002",
    "ABC Distillery — Silver Label Vodka",
    "ABC Distillery Inc.",
    "2026-06-29T15:30:00.000Z",
    "abc-distillery.png",
    {
      brandName: "ABC Distillery",
      classType: "Vodka",
      abv: "40% ABV",
      netContents: "750 mL",
      bottler: "ABC Distillery, Austin, TX",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "ABC Distillery",
      classType: "Vodka",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottler: "ABC Distillery, Austin, TX",
      countryOfOrigin: "USA",
      governmentWarning: TITLE_CASE_WARNING,
    },
    [
      field(
        "brandName",
        "Brand Name",
        "ABC Distillery",
        "ABC Distillery",
        "pass",
      ),
      field("classType", "Class / Type", "Vodka", "Vodka", "pass", {
        regulatory: REG_PASS_CLASS,
      }),
      field(
        "abv",
        "Alcohol Content (ABV)",
        "40% ABV",
        "40% Alc./Vol.",
        "pass",
        { regulatory: regPassAbv(40, "spirits") },
      ),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", {
        regulatory: regPassFill(750),
      }),
      field(
        "bottler",
        "Bottler / Producer",
        "ABC Distillery, Austin, TX",
        "ABC Distillery, Austin, TX",
        "pass",
      ),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field(
        "governmentWarning",
        "Government Warning",
        REQUIRED_GOVERNMENT_WARNING,
        TITLE_CASE_WARNING,
        "fail",
        {
          note: 'Warning must begin with "GOVERNMENT WARNING:" in ALL CAPS (27 CFR Part 16)',
        },
      ),
    ],
  ),

  // 3. Fuzzy-match pass (case/punctuation diff on brand name — allowable revision)
  seed(
    "TTB-2026-1003",
    "Malt & Hop Brewery — Golden Ale",
    "Malt & Hop Brewing Co.",
    "2026-06-30T09:15:00.000Z",
    "malt-hop-brewery.png",
    {
      brandName: "MALT & HOP BREWERY",
      classType: "Ale",
      abv: "5.5% ABV",
      netContents: "12 FL OZ",
      bottler: "Malt & Hop Brewery, Portland, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "Malt & Hop Brewery",
      classType: "Ale",
      abv: "5.5% Alc./Vol.",
      netContents: "12 FL OZ",
      bottler: "Malt & Hop Brewery, Portland, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field(
        "brandName",
        "Brand Name",
        "MALT & HOP BREWERY",
        "Malt & Hop Brewery",
        "pass",
      ),
      field("classType", "Class / Type", "Ale", "Ale", "pass", {
        regulatory: REG_PASS_CLASS,
      }),
      field(
        "abv",
        "Alcohol Content (ABV)",
        "5.5% ABV",
        "5.5% Alc./Vol.",
        "pass",
        { regulatory: regPassAbv(5.5, "malt") },
      ),
      field("netContents", "Net Contents", "12 FL OZ", "12 FL OZ", "pass"),
      field(
        "bottler",
        "Bottler / Producer",
        "Malt & Hop Brewery, Portland, OR",
        "Malt & Hop Brewery, Portland, OR",
        "pass",
      ),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field(
        "governmentWarning",
        "Government Warning",
        REQUIRED_GOVERNMENT_WARNING,
        REQUIRED_GOVERNMENT_WARNING,
        "pass",
      ),
    ],
  ),

  // 4. Low-confidence / glare — country of origin misread
  seed(
    "TTB-2026-1004",
    "12345 Imports — Cabernet Sauvignon",
    "12345 Imports LLC",
    "2026-06-30T11:00:00.000Z",
    "12345-imports.png",
    {
      brandName: "12345 Imports",
      classType: "Cabernet Sauvignon",
      abv: "13.5% ABV",
      netContents: "750 mL",
      bottler: "12345 Imports, Miami, FL",
      countryOfOrigin: "Chile",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "12345 Imports",
      classType: "Cabernet Sauvignon",
      abv: "13.5% Alc./Vol.",
      netContents: "750 mL",
      bottler: "12345 Imports, Miami, FL",
      countryOfOrigin: "Ch1le",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field(
        "brandName",
        "Brand Name",
        "12345 Imports",
        "12345 Imports",
        "pass",
      ),
      field(
        "classType",
        "Class / Type",
        "Cabernet Sauvignon",
        "Cabernet Sauvignon",
        "pass",
        { regulatory: REG_PASS_CLASS },
      ),
      field(
        "abv",
        "Alcohol Content (ABV)",
        "13.5% ABV",
        "13.5% Alc./Vol.",
        "pass",
        { regulatory: regPassAbv(13.5, "wine") },
      ),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", {
        regulatory: regPassFill(750),
      }),
      field(
        "bottler",
        "Bottler / Producer",
        "12345 Imports, Miami, FL",
        "12345 Imports, Miami, FL",
        "pass",
      ),
      field("countryOfOrigin", "Country of Origin", "Chile", "Ch1le", "fail", {
        confidence: 0.42,
        note: "Low-confidence extraction — possible glare on label. Review the original image before rejecting.",
      }),
      field(
        "governmentWarning",
        "Government Warning",
        REQUIRED_GOVERNMENT_WARNING,
        REQUIRED_GOVERNMENT_WARNING,
        "pass",
      ),
    ],
    { countryOfOrigin: 0.42 },
  ),

  // 5. Override-candidate — ABV mismatch
  seed(
    "TTB-2026-1005",
    "Cascade Peak Gin",
    "Cascade Peak Distillers",
    "2026-06-30T13:45:00.000Z",
    "labels/label-1-front.png",
    {
      brandName: "Cascade Peak Gin",
      classType: "Gin",
      abv: "45% ABV",
      netContents: "750 mL",
      bottler: "Cascade Peak Distillers, Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    {
      brandName: "Cascade Peak Gin",
      classType: "Gin",
      abv: "40% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Cascade Peak Distillers, Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    [
      field(
        "brandName",
        "Brand Name",
        "Cascade Peak Gin",
        "Cascade Peak Gin",
        "pass",
      ),
      field("classType", "Class / Type", "Gin", "Gin", "pass", {
        regulatory: REG_PASS_CLASS,
      }),
      field(
        "abv",
        "Alcohol Content (ABV)",
        "45% ABV",
        "40% Alc./Vol.",
        "fail",
        {
          regulatory: regPassAbv(40, "spirits"),
          note: "Application claims 45% ABV; label reads 40% Alc./Vol. — confirm against the approved formula.",
        },
      ),
      field("netContents", "Net Contents", "750 mL", "750 mL", "pass", {
        regulatory: regPassFill(750),
      }),
      field(
        "bottler",
        "Bottler / Producer",
        "Cascade Peak Distillers, Bend, OR",
        "Cascade Peak Distillers, Bend, OR",
        "pass",
      ),
      field("countryOfOrigin", "Country of Origin", "USA", "USA", "pass"),
      field(
        "governmentWarning",
        "Government Warning",
        REQUIRED_GOVERNMENT_WARNING,
        REQUIRED_GOVERNMENT_WARNING,
        "pass",
      ),
    ],
  ),
];

// 6. Pending — no analysis yet, demonstrates "Run pre-analysis now"
const pendingSeed: QueueApplication = {
  id: "TTB-2026-1006",
  brandName: "Sonoma Ridge Chardonnay",
  applicant: "Sonoma Ridge Winery",
  submittedAt: "2026-06-30T16:00:00.000Z",
  applicationData: {
    brandName: "Sonoma Ridge",
    classType: "Chardonnay",
    abv: "13% ABV",
    netContents: "750 mL",
    bottler: "Sonoma Ridge Winery, Sonoma, CA",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  ...loadMockImage("labels/label-2-front.png"),
  status: "pending",
  analysis: null,
  resolution: null,
};

SEED_APPLICATIONS.push(pendingSeed);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/queue/seed-data.ts` or `lib/queue/load-image.ts`

- [ ] **Step 4: Commit**

```bash
git add lib/queue/load-image.ts lib/queue/seed-data.ts
git commit -m "feat: add queue seed data covering pass/fail/override scenarios"
```

---

### Task 3: Mock application templates (for the "Add mock application" dev tool)

**Files:**

- Create: `lib/queue/mock-templates.ts`

**Interfaces:**

- Consumes: `loadMockImage` from `./load-image`; `REQUIRED_GOVERNMENT_WARNING` from `@/lib/verify`; `QueueApplication` from `./types`
- Produces: `MOCK_QUEUE_TEMPLATES: MockTemplate[]` — consumed by Task 4's `addMockApplication()`

- [ ] **Step 1: Write the templates file**

```typescript
// lib/queue/mock-templates.ts
import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify";
import { QueueApplication } from "./types";
import { loadMockImage } from "./load-image";

export type MockTemplate = Omit<
  QueueApplication,
  "id" | "submittedAt" | "status" | "analysis" | "resolution"
>;

export const MOCK_QUEUE_TEMPLATES: MockTemplate[] = [
  {
    brandName: "Blue Ridge Bourbon",
    applicant: "Blue Ridge Distillers LLC",
    applicationData: {
      brandName: "BLUE RIDGE BOURBON",
      classType: "Straight Bourbon Whiskey",
      abv: "50% ABV",
      netContents: "750 mL",
      bottler: "Blue Ridge Distillers, Asheville, NC",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    ...loadMockImage("labels/label-3-front.png"),
  },
  {
    brandName: "Cascade Mountain Gin",
    applicant: "Cascade Spirits Co.",
    applicationData: {
      brandName: "CASCADE MOUNTAIN GIN",
      classType: "Gin",
      abv: "47% ABV",
      netContents: "750 mL",
      bottler: "Cascade Spirits Co., Bend, OR",
      countryOfOrigin: "USA",
      governmentWarning: REQUIRED_GOVERNMENT_WARNING,
    },
    ...loadMockImage("labels/label-1-back.png"),
  },
];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/queue/mock-templates.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/queue/mock-templates.ts
git commit -m "feat: add mock application templates for dev queue seeding"
```

---

### Task 4: In-memory queue store

**Files:**

- Create: `lib/queue/store.ts`
- Test: `lib/queue/store.test.ts`

**Interfaces:**

- Consumes: `QueueApplication`, `QueueSummary`, `Resolution` from `./types`; `SEED_APPLICATIONS` from `./seed-data`; `MOCK_QUEUE_TEMPLATES` from `./mock-templates`
- Produces: `listQueue(): QueueSummary[]`, `getApplication(id: string): QueueApplication | undefined`, `addApplication(app: QueueApplication): void`, `updateApplication(id: string, patch: Partial<QueueApplication>): QueueApplication | undefined`, `unanalyzedApplications(): QueueApplication[]`, `resolveApplication(id: string, resolution: Resolution): QueueApplication | undefined`, `addMockApplication(): QueueApplication`, `__resetQueueForTests(): void` — consumed by Task 5 (analyze), Task 7 (API routes), Task 11 (batch integration)

- [ ] **Step 1: Write the failing test**

```typescript
// lib/queue/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  listQueue,
  getApplication,
  unanalyzedApplications,
  resolveApplication,
  addMockApplication,
  __resetQueueForTests,
} from "./store";

describe("queue store", () => {
  beforeEach(() => {
    __resetQueueForTests();
  });

  it("lists seeded applications excluding resolved ones", () => {
    const items = listQueue();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.status !== "resolved")).toBe(true);
  });

  it("sorts by flag count descending", () => {
    const items = listQueue();
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].flagCount).toBeGreaterThanOrEqual(items[i].flagCount);
    }
  });

  it("getApplication returns undefined for unknown id", () => {
    expect(getApplication("nope")).toBeUndefined();
  });

  it("unanalyzedApplications returns only pending applications", () => {
    const pending = unanalyzedApplications();
    expect(pending.every((a) => a.status === "pending")).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("addMockApplication adds a pending application to the queue", () => {
    const before = listQueue().length;
    const added = addMockApplication();
    expect(added.status).toBe("pending");
    expect(listQueue().length).toBe(before + 1);
  });

  it("resolveApplication marks status resolved and removes it from listQueue", () => {
    const target = listQueue().find((i) => i.status === "analyzed")!;
    resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    });
    expect(listQueue().find((i) => i.id === target.id)).toBeUndefined();
    expect(getApplication(target.id)?.status).toBe("resolved");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/queue/store.test.ts`
Expected: FAIL — `Cannot find module './store'`

- [ ] **Step 3: Write the store implementation**

```typescript
// lib/queue/store.ts
import { QueueApplication, QueueSummary, Resolution } from "./types";
import { SEED_APPLICATIONS } from "./seed-data";
import { MOCK_QUEUE_TEMPLATES } from "./mock-templates";

let applications: QueueApplication[] = SEED_APPLICATIONS.map((app) => ({
  ...app,
}));
let templateCursor = 0;
let nextIdSuffix = 2000;

export function listQueue(): QueueSummary[] {
  return applications
    .filter((app) => app.status !== "resolved")
    .map((app) => ({
      id: app.id,
      brandName: app.brandName,
      applicant: app.applicant,
      submittedAt: app.submittedAt,
      status: app.status,
      flagCount:
        app.analysis ?
          app.analysis.result.fields.filter((f) => f.status !== "pass").length
        : 0,
      overallPass: app.analysis ? app.analysis.result.overallPass : null,
    }))
    .sort((a, b) => b.flagCount - a.flagCount);
}

export function getApplication(id: string): QueueApplication | undefined {
  return applications.find((app) => app.id === id);
}

export function addApplication(app: QueueApplication): void {
  applications.push(app);
}

export function updateApplication(
  id: string,
  patch: Partial<QueueApplication>,
): QueueApplication | undefined {
  const idx = applications.findIndex((app) => app.id === id);
  if (idx === -1) return undefined;
  applications[idx] = { ...applications[idx], ...patch };
  return applications[idx];
}

export function unanalyzedApplications(): QueueApplication[] {
  return applications.filter((app) => app.status === "pending");
}

export function resolveApplication(
  id: string,
  resolution: Resolution,
): QueueApplication | undefined {
  return updateApplication(id, { status: "resolved", resolution });
}

export function addMockApplication(): QueueApplication {
  const template =
    MOCK_QUEUE_TEMPLATES[templateCursor % MOCK_QUEUE_TEMPLATES.length];
  templateCursor += 1;
  nextIdSuffix += 1;
  const app: QueueApplication = {
    ...template,
    id: `TTB-2026-${nextIdSuffix}`,
    submittedAt: new Date().toISOString(),
    status: "pending",
    analysis: null,
    resolution: null,
  };
  applications.push(app);
  return app;
}

/** Test-only: reset the store back to its seeded state between test runs. */
export function __resetQueueForTests(): void {
  applications = SEED_APPLICATIONS.map((app) => ({ ...app }));
  templateCursor = 0;
  nextIdSuffix = 2000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/queue/store.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/queue/store.ts lib/queue/store.test.ts
git commit -m "feat: add in-memory queue store"
```

---

### Task 5: Pre-analysis engine

**Files:**

- Create: `lib/queue/analyze.ts`
- Test: `lib/queue/analyze.test.ts`

**Interfaces:**

- Consumes: `getProvider` from `@/lib/ocr`; `verifyLabel` from `@/lib/verify`; `QueueApplication`, `QueueAnalysis` from `./types`
- Produces: `analyzeApplication(app: QueueApplication, providerName: string, apiKey?: string): Promise<QueueAnalysis>` — consumed by Task 7's `POST /api/queue/analyze` route

- [ ] **Step 1: Write the failing test**

```typescript
// lib/queue/analyze.test.ts
import { describe, it, expect } from "vitest";
import { analyzeApplication } from "./analyze";
import { QueueApplication } from "./types";
import { REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify";

const baseApp: QueueApplication = {
  id: "TEST-1",
  brandName: "Test Brand",
  applicant: "Test Applicant",
  submittedAt: new Date().toISOString(),
  applicationData: {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    abv: "40% ABV",
    netContents: "750 mL",
    bottler: "Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  imageBase64: "",
  imageMimeType: "image/png",
  status: "pending",
  analysis: null,
  resolution: null,
};

describe("analyzeApplication", () => {
  it("produces a VerificationResult with all 7 fields via the mock provider", async () => {
    const analysis = await analyzeApplication(baseApp, "mock");
    expect(analysis.result.fields).toHaveLength(7);
    expect(analysis.analyzedAt).toBeTruthy();
  });

  it("fails government warning against the mock provider's title-case text", async () => {
    const analysis = await analyzeApplication(baseApp, "mock");
    const govField = analysis.result.fields.find(
      (f) => f.field === "governmentWarning",
    );
    expect(govField?.status).toBe("fail");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/queue/analyze.test.ts`
Expected: FAIL — `Cannot find module './analyze'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/queue/analyze.ts
import { getProvider } from "@/lib/ocr";
import { verifyLabel } from "@/lib/verify";
import { QueueApplication, QueueAnalysis } from "./types";

export async function analyzeApplication(
  app: QueueApplication,
  providerName: string,
  apiKey?: string,
): Promise<QueueAnalysis> {
  const provider = getProvider(providerName, apiKey);
  const ocrResult = await provider.extract(app.imageBase64, app.imageMimeType);
  const result = verifyLabel(
    app.applicationData,
    ocrResult.data,
    ocrResult.confidence,
  );
  return {
    extracted: ocrResult.data,
    confidence: ocrResult.confidence,
    boundingBoxes: ocrResult.boundingBoxes,
    result,
    analyzedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/queue/analyze.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/queue/analyze.ts lib/queue/analyze.test.ts
git commit -m "feat: add AI pre-analysis engine for queue applications"
```

---

### Task 6: Resolution validation (approve/reject gating rules)

**Files:**

- Create: `lib/queue/resolve.ts`
- Test: `lib/queue/resolve.test.ts`

**Interfaces:**

- Consumes: `QueueAnalysis` from `./types`
- Produces: `ResolveRequestBody` type, `ValidationOutcome` type, `validateResolution(analysis: QueueAnalysis, body: ResolveRequestBody): ValidationOutcome` — consumed by Task 7's `POST /api/queue/[id]/resolve` route and Task 10's review page

- [ ] **Step 1: Write the failing test**

```typescript
// lib/queue/resolve.test.ts
import { describe, it, expect } from "vitest";
import { validateResolution } from "./resolve";
import { QueueAnalysis } from "./types";

const analysis: QueueAnalysis = {
  extracted: {
    brandName: "X",
    classType: null,
    abv: null,
    netContents: null,
    bottler: null,
    countryOfOrigin: null,
    governmentWarning: null,
  },
  confidence: {},
  result: {
    overallPass: false,
    fields: [
      {
        field: "brandName",
        label: "Brand Name",
        expected: "X",
        extracted: "X",
        status: "pass",
      },
      {
        field: "abv",
        label: "Alcohol Content (ABV)",
        expected: "40%",
        extracted: "45%",
        status: "fail",
      },
    ],
  },
  analyzedAt: new Date().toISOString(),
};

describe("validateResolution", () => {
  it("rejects approval when a field is still flagged", () => {
    const outcome = validateResolution(analysis, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
    });
    expect(outcome.ok).toBe(false);
  });

  it("allows approval once the flagged field is overridden", () => {
    const outcome = validateResolution(analysis, {
      decision: "approved",
      overrides: [{ field: "abv", reason: "Confirmed via lab certificate" }],
      rejectedFields: [],
      note: "",
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects a reject-decision with no cited field", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: [],
      note: "bad label",
    });
    expect(outcome.ok).toBe(false);
  });

  it("rejects a reject-decision with no note", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "",
    });
    expect(outcome.ok).toBe(false);
  });

  it("allows a reject-decision citing a flagged field with a note", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [],
      rejectedFields: ["abv"],
      note: "ABV mismatch, no certificate on file",
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects citing a field that was already overridden (no longer flagged)", () => {
    const outcome = validateResolution(analysis, {
      decision: "rejected",
      overrides: [{ field: "abv", reason: "ok" }],
      rejectedFields: ["abv"],
      note: "bad",
    });
    expect(outcome.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/queue/resolve.test.ts`
Expected: FAIL — `Cannot find module './resolve'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/queue/resolve.ts
import { FieldOverride, QueueAnalysis } from "./types";

export interface ResolveRequestBody {
  decision: "approved" | "rejected";
  overrides: FieldOverride[];
  rejectedFields: string[];
  note: string;
}

export type ValidationOutcome = { ok: true } | { ok: false; error: string };

export function validateResolution(
  analysis: QueueAnalysis,
  body: ResolveRequestBody,
): ValidationOutcome {
  const overriddenFields = new Set(body.overrides.map((o) => o.field));
  const stillFlagged = analysis.result.fields
    .filter((f) => f.status !== "pass" && !overriddenFields.has(f.field))
    .map((f) => f.field);

  if (body.decision === "approved") {
    if (stillFlagged.length > 0) {
      return {
        ok: false,
        error: `Cannot approve: ${stillFlagged.length} field(s) still flagged: ${stillFlagged.join(", ")}`,
      };
    }
    return { ok: true };
  }

  if (body.rejectedFields.length === 0) {
    return {
      ok: false,
      error:
        "Rejection requires citing at least one field that is still flagged (not overridden)",
    };
  }
  const citedValid = body.rejectedFields.every((f) => stillFlagged.includes(f));
  if (!citedValid) {
    return {
      ok: false,
      error:
        "Rejection can only cite fields that are still flagged (not overridden)",
    };
  }
  if (!body.note.trim()) {
    return { ok: false, error: "Rejection requires a note" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/queue/resolve.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/queue/resolve.ts lib/queue/resolve.test.ts
git commit -m "feat: add approve/reject resolution validation"
```

---

### Task 7: Queue API routes

**Files:**

- Create: `app/api/queue/route.ts`
- Create: `app/api/queue/analyze/route.ts`
- Create: `app/api/queue/[id]/route.ts`
- Create: `app/api/queue/[id]/resolve/route.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–6 (`listQueue`, `addMockApplication`, `unanalyzedApplications`, `updateApplication`, `getApplication`, `resolveApplication`, `analyzeApplication`, `validateResolution`, `ResolveRequestBody`, `Resolution`)
- Produces: `GET /api/queue` → `{ items: QueueSummary[] }`; `POST /api/queue` → `{ id: string }` (201); `POST /api/queue/analyze` → `{ analyzedIds: string[] }`; `GET /api/queue/[id]` → `{ application: QueueApplication }` or 404; `POST /api/queue/[id]/resolve` → `{ application: QueueApplication }` or 400/404 — consumed by Task 9 (dashboard) and Task 10 (review page)

- [ ] **Step 1: Write the list + add-mock route**

```typescript
// app/api/queue/route.ts
import { NextResponse } from "next/server";
import { listQueue, addMockApplication } from "@/lib/queue/store";

export async function GET() {
  return NextResponse.json({ items: listQueue() });
}

export async function POST() {
  const app = addMockApplication();
  return NextResponse.json({ id: app.id }, { status: 201 });
}
```

- [ ] **Step 2: Write the pre-analysis trigger route**

```typescript
// app/api/queue/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unanalyzedApplications, updateApplication } from "@/lib/queue/store";
import { analyzeApplication } from "@/lib/queue/analyze";

export async function POST(req: NextRequest) {
  const providerName = req.headers.get("X-Ocr-Provider") ?? "mock";
  const apiKey = req.headers.get("X-Api-Key") ?? undefined;

  const pending = unanalyzedApplications();
  const analyzedIds: string[] = [];

  for (const app of pending) {
    const analysis = await analyzeApplication(app, providerName, apiKey);
    updateApplication(app.id, { status: "analyzed", analysis });
    analyzedIds.push(app.id);
  }

  return NextResponse.json({ analyzedIds });
}
```

- [ ] **Step 3: Write the detail route**

```typescript
// app/api/queue/[id]/route.ts
import { NextResponse } from "next/server";
import { getApplication } from "@/lib/queue/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = getApplication(id);
  if (!app) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ application: app });
}
```

- [ ] **Step 4: Write the resolve route**

```typescript
// app/api/queue/[id]/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApplication, resolveApplication } from "@/lib/queue/store";
import { validateResolution, ResolveRequestBody } from "@/lib/queue/resolve";
import { Resolution } from "@/lib/queue/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = getApplication(id);
  if (!app || !app.analysis) {
    return NextResponse.json(
      { error: "Application not found or not yet analyzed" },
      { status: 404 },
    );
  }

  const body = (await req.json()) as ResolveRequestBody;
  const outcome = validateResolution(app.analysis, body);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  const resolution: Resolution = {
    decision: body.decision,
    overrides: body.overrides,
    rejectedFields: body.decision === "rejected" ? body.rejectedFields : [],
    note: body.note,
    resolvedAt: new Date().toISOString(),
  };

  const updated = resolveApplication(id, resolution);
  return NextResponse.json({ application: updated });
}
```

- [ ] **Step 5: Typecheck and manual smoke check**

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run dev` (in background), then in another shell:

```bash
curl -s http://localhost:3000/api/queue | head -c 300
```

Expected: JSON with an `items` array containing 6 entries (one `status: "pending"`)

- [ ] **Step 6: Commit**

```bash
git add app/api/queue
git commit -m "feat: add queue API routes (list, add-mock, analyze, detail, resolve)"
```

---

### Task 8: Remove manual verify flow, update nav

**Files:**

- Delete: `app/verify/page.tsx`
- Delete: `app/api/verify/route.ts`
- Modify: `components/Sidebar.tsx:19-25`

**Interfaces:**

- Consumes: none
- Produces: none (pure removal + nav update)

- [ ] **Step 1: Delete the manual verify page and its API route**

```bash
git rm app/verify/page.tsx app/api/verify/route.ts
```

- [ ] **Step 2: Update Sidebar nav items**

In `components/Sidebar.tsx`, replace:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/verify", icon: "fact_check", label: "Verify Label" },
  { href: "/batch", icon: "layers", label: "Batch Review" },
  { href: "/audit", icon: "history", label: "Audit Log" },
  { href: "/settings", icon: "settings", label: "Settings" },
];
```

with:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: "inbox", label: "Queue" },
  { href: "/batch", icon: "layers", label: "Batch Review" },
  { href: "/audit", icon: "history", label: "Audit Log" },
  { href: "/settings", icon: "settings", label: "Settings" },
];
```

- [ ] **Step 3: Verify no remaining references to /verify**

Run: `grep -rn "\"/verify\"" app components tests --include="*.tsx" --include="*.ts"`
Expected: no matches (Task 12 will separately handle deleting `tests/single-verify.spec.ts`)

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: remove manual verify flow, queue is now the primary nav item"
```

---

### Task 9: Dashboard rewrite as the Queue screen

**Files:**

- Modify: `app/page.tsx` (full rewrite)

**Interfaces:**

- Consumes: `GET /api/queue`, `POST /api/queue`, `POST /api/queue/analyze` (Task 7)
- Produces: renders queue list with dev tools; links to `/queue/[id]` (Task 10)

- [ ] **Step 1: Write the rewritten dashboard**

```tsx
// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QueueSummary {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  status: "pending" | "analyzed" | "resolved";
  flagCount: number;
  overallPass: boolean | null;
}

const SETTINGS_KEY = "ttb-ocr-settings";

function verdictBadge(item: QueueSummary) {
  if (item.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-dim text-on-surface-dim border border-outline">
        Awaiting analysis
      </span>
    );
  }
  if (item.flagCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-success-surface text-bp-success border border-bp-success-border">
        Clean pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bp-warning-surface text-bp-warning border border-bp-warning-border">
      {item.flagCount} flag{item.flagCount === 1 ? "" : "s"}
    </span>
  );
}

export default function DashboardPage() {
  const [items, setItems] = useState<QueueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);

  async function loadQueue() {
    setLoading(true);
    const res = await fetch("/api/queue");
    const data = (await res.json()) as { items: QueueSummary[] };
    setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleAddMock() {
    setAdding(true);
    await fetch("/api/queue", { method: "POST" });
    await loadQueue();
    setAdding(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    let settings: { provider?: string; apiKey?: string } = {};
    try {
      settings = JSON.parse(
        localStorage.getItem(SETTINGS_KEY) ?? "{}",
      ) as typeof settings;
    } catch {
      /* ignore malformed localStorage */
    }
    await fetch("/api/queue/analyze", {
      method: "POST",
      headers: {
        "X-Ocr-Provider": settings.provider ?? "mock",
        ...(settings.apiKey ? { "X-Api-Key": settings.apiKey } : {}),
      },
    });
    await loadQueue();
    setAnalyzing(false);
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const flaggedCount = items.filter(
    (i) => i.status === "analyzed" && i.flagCount > 0,
  ).length;
  const cleanCount = items.filter(
    (i) => i.status === "analyzed" && i.flagCount === 0,
  ).length;

  return (
    <div className="px-8 py-8 max-w-10xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Verification Queue
          </h1>
          <p className="text-sm text-on-surface-muted mt-1">
            TTB COLA applications awaiting specialist review — AI pre-analysis
            runs ahead of you.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddMock}
            disabled={adding}
            className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim hover:bg-surface-dim transition-colors disabled:opacity-50">
            {adding ? "Adding…" : "+ Add mock application"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || pendingCount === 0}
            className="text-xs px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50">
            {analyzing ?
              "Analyzing…"
            : `Run pre-analysis now (${pendingCount} pending)`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">
            Awaiting analysis
          </p>
          <p
            className="text-3xl font-bold text-on-surface mt-1"
            style={{ fontFamily: "var(--font-inter)" }}>
            {pendingCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">
            Flagged, needs review
          </p>
          <p
            className="text-3xl font-bold text-on-surface mt-1"
            style={{ fontFamily: "var(--font-inter)" }}>
            {flaggedCount}
          </p>
        </div>
        <div className="bg-surface-card border border-outline rounded-2xl p-5">
          <p className="text-xs text-on-surface-muted font-medium uppercase tracking-wide">
            Clean AI pass
          </p>
          <p
            className="text-3xl font-bold text-on-surface mt-1"
            style={{ fontFamily: "var(--font-inter)" }}>
            {cleanCount}
          </p>
        </div>
      </div>

      <div className="bg-surface-card border border-outline rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline">
          <h2
            className="text-sm font-semibold text-on-surface"
            style={{ fontFamily: "var(--font-inter)" }}>
            Pending Applications
          </h2>
        </div>
        {loading ?
          <p className="px-6 py-8 text-sm text-on-surface-muted">
            Loading queue…
          </p>
        : items.length === 0 ?
          <p className="px-6 py-8 text-sm text-on-surface-muted">
            Queue is empty.
          </p>
        : <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline bg-surface-dim">
                {[
                  "App ID",
                  "Brand Name",
                  "Applicant",
                  "Submitted",
                  "Verdict",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-surface-dim transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-on-surface-dim">
                    {item.id}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-on-surface">
                    {item.brandName}
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-dim">
                    {item.applicant}
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-muted">
                    {new Date(item.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{verdictBadge(item)}</td>
                  <td className="px-6 py-4">
                    {item.status === "pending" ?
                      <span className="text-xs text-on-surface-muted">
                        Not yet analyzed
                      </span>
                    : <Link
                        href={`/queue/${item.id}`}
                        className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                        Review →
                      </Link>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke check**

Run: `npm run dev`, visit `http://localhost:3000/`
Expected: page shows "Verification Queue" heading, 6 rows (5 with verdict badges, 1 "Awaiting analysis"), and both dev-tool buttons

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rewrite dashboard as AI-precomputed review queue"
```

---

### Task 10: Review detail page

**Files:**

- Create: `app/queue/[id]/page.tsx`

**Interfaces:**

- Consumes: `GET /api/queue/[id]`, `POST /api/queue/[id]/resolve` (Task 7); `FieldResult` from `@/lib/verify`; `BoundingBoxMap`, `ConfidenceMap` from `@/lib/ocr/types`
- Produces: the specialist review screen — image + per-field results + bounding-box inspector (reused from the deleted `/verify` page's pattern) + per-field Override + Approve/Reject actions

- [ ] **Step 1: Write the review page**

```tsx
// app/queue/[id]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FieldResult, VerificationResult } from "@/lib/verify";
import { BoundingBoxMap, ConfidenceMap } from "@/lib/ocr/types";

interface QueueApplicationDetail {
  id: string;
  brandName: string;
  applicant: string;
  submittedAt: string;
  imageBase64: string;
  imageMimeType: string;
  status: "pending" | "analyzed" | "resolved";
  analysis: {
    confidence: ConfidenceMap;
    boundingBoxes?: BoundingBoxMap;
    result: VerificationResult;
  } | null;
}

function StatusBadge({ status }: { status: FieldResult["status"] }) {
  if (status === "pass")
    return <span className="text-bp-success font-bold text-lg">✓</span>;
  if (status === "fail")
    return <span className="text-bp-error font-bold text-lg">✗</span>;
  return <span className="text-bp-warning font-bold text-lg">—</span>;
}

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<QueueApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overrideDraftField, setOverrideDraftField] = useState<string | null>(
    null,
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectedFields, setRejectedFields] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/queue/${params.id}`)
      .then((res) => res.json())
      .then((data: { application: QueueApplicationDetail }) => {
        setApp(data.application);
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!selectedField || !app?.analysis?.boundingBoxes) return;
    const bbox =
      app.analysis.boundingBoxes[selectedField as keyof BoundingBoxMap];
    if (!bbox) return;
    ctx.strokeStyle = "#4c6080";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(76, 96, 128, 0.12)";
    ctx.beginPath();
    ctx.rect(bbox.x * w, bbox.y * h, bbox.width * w, bbox.height * h);
    ctx.fill();
    ctx.stroke();
  }, [selectedField, app]);

  function handleFieldClick(fieldKey: string) {
    setSelectedField((prev) => (prev === fieldKey ? null : fieldKey));
  }

  function openOverride(fieldKey: string) {
    setOverrideDraftField(fieldKey);
    setOverrideReason(overrides[fieldKey] ?? "");
  }

  function saveOverride() {
    if (!overrideDraftField || !overrideReason.trim()) return;
    setOverrides((prev) => ({
      ...prev,
      [overrideDraftField]: overrideReason.trim(),
    }));
    setOverrideDraftField(null);
    setOverrideReason("");
  }

  function clearOverride(fieldKey: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function toggleRejectedField(fieldKey: string) {
    setRejectedFields((prev) =>
      prev.includes(fieldKey) ?
        prev.filter((f) => f !== fieldKey)
      : [...prev, fieldKey],
    );
  }

  const flaggedFields =
    app?.analysis?.result.fields.filter((f) => f.status !== "pass") ?? [];
  const stillFlagged = flaggedFields.filter((f) => !overrides[f.field]);
  const canApprove = app?.analysis !== null && stillFlagged.length === 0;

  async function submitResolution(decision: "approved" | "rejected") {
    if (!app) return;
    setSubmitError(null);
    setSubmitting(true);
    const body = {
      decision,
      overrides: Object.entries(overrides).map(([field, reason]) => ({
        field,
        reason,
      })),
      rejectedFields: decision === "rejected" ? rejectedFields : [],
      note: decision === "rejected" ? rejectNote : "",
    };
    const res = await fetch(`/api/queue/${app.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setSubmitError(data.error);
      setSubmitting(false);
      return;
    }
    router.push("/");
  }

  if (loading)
    return (
      <div className="px-8 py-8 text-sm text-on-surface-muted">
        Loading application…
      </div>
    );
  if (!app)
    return (
      <div className="px-8 py-8 text-sm text-bp-error">
        Application not found.
      </div>
    );

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-on-surface"
          style={{ fontFamily: "var(--font-inter)" }}>
          {app.brandName}
        </h1>
        <p className="text-sm text-on-surface-muted mt-1">
          {app.id} · {app.applicant} · submitted{" "}
          {new Date(app.submittedAt).toLocaleString()}
        </p>
      </div>

      {!app.analysis ?
        <p className="text-sm text-on-surface-muted">
          This application has not been analyzed yet. Run pre-analysis from the
          queue screen first.
        </p>
      : <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="relative inline-block">
              <img
                ref={imgRef}
                src={`data:${app.imageMimeType};base64,${app.imageBase64}`}
                alt="Label"
                className="max-h-96 rounded-lg object-contain block border border-outline"
              />
              <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="absolute top-0 left-0 rounded-lg pointer-events-none"
              />
            </div>
            {app.analysis.boundingBoxes && (
              <p className="text-xs text-on-surface-muted mt-2">
                Click a field to highlight its location on the label.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {app.analysis.result.fields.map((f) => {
              const isOverridden = Boolean(overrides[f.field]);
              const bgColor =
                f.status === "pass" || isOverridden ?
                  "bg-bp-success-surface border-bp-success-border"
                : f.status === "fail" ?
                  "bg-bp-error-surface border-bp-error-border"
                : "bg-bp-warning-surface border-bp-warning-border";
              return (
                <div
                  key={f.field}
                  data-testid={`field-row-${f.field}`}
                  className={`border rounded-lg p-4 ${bgColor} cursor-pointer ${selectedField === f.field ? "ring-2 ring-primary" : ""}`}
                  onClick={() => handleFieldClick(f.field)}>
                  <div className="flex items-start gap-3">
                    <StatusBadge status={isOverridden ? "pass" : f.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface">
                        {f.label}{" "}
                        {isOverridden && (
                          <span className="text-xs font-normal text-bp-success">
                            (Overridden)
                          </span>
                        )}
                      </p>
                      {f.status !== "pass" && !isOverridden && (
                        <div className="mt-1 text-sm space-y-1">
                          <p className="text-on-surface-dim">
                            <span className="font-medium">Expected:</span>{" "}
                            <span className="font-mono">
                              {f.expected ?? "—"}
                            </span>
                          </p>
                          <p className="text-bp-error">
                            <span className="font-medium">Found on label:</span>{" "}
                            <span className="font-mono">
                              {f.extracted ?? "not found"}
                            </span>
                          </p>
                          {f.note && (
                            <p className="text-on-surface-muted italic text-xs mt-1">
                              {f.note}
                            </p>
                          )}
                        </div>
                      )}
                      {isOverridden && (
                        <p className="text-xs text-on-surface-muted mt-1 italic">
                          Reason: {overrides[f.field]}
                        </p>
                      )}
                      {f.status === "pass" && !isOverridden && (
                        <p className="text-sm text-on-surface-dim mt-1 font-mono">
                          {f.extracted}
                        </p>
                      )}
                      {f.status !== "pass" && (
                        <div
                          className="mt-2 flex gap-2"
                          onClick={(e) => e.stopPropagation()}>
                          {isOverridden ?
                            <button
                              onClick={() => clearOverride(f.field)}
                              className="text-xs font-medium text-on-surface-dim hover:text-on-surface underline">
                              Remove override
                            </button>
                          : <button
                              onClick={() => openOverride(f.field)}
                              className="text-xs font-medium text-primary hover:text-primary-hover underline">
                              Override
                            </button>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }

      {overrideDraftField && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setOverrideDraftField(null)}>
          <div
            className="bg-surface-card rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-on-surface mb-3">
              Override field
            </h3>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Reason for overriding this mismatch…"
              className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOverrideDraftField(null)}
                className="text-xs px-3 py-2 border border-outline rounded-lg text-on-surface-dim">
                Cancel
              </button>
              <button
                onClick={saveOverride}
                disabled={!overrideReason.trim()}
                className="text-xs px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50">
                Save override
              </button>
            </div>
          </div>
        </div>
      )}

      {app.analysis && app.status !== "resolved" && (
        <div className="mt-8 border-t border-outline pt-6">
          {submitError && (
            <div className="mb-4 bg-bp-error-surface border border-bp-error-border text-bp-error rounded-lg px-4 py-3 text-sm">
              {submitError}
            </div>
          )}

          {!rejectMode ?
            <div className="flex gap-3">
              <button
                onClick={() => submitResolution("approved")}
                disabled={!canApprove || submitting}
                className="px-5 py-2.5 bg-bp-success text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                Approve
              </button>
              <button
                onClick={() => setRejectMode(true)}
                disabled={stillFlagged.length === 0 || submitting}
                className="px-5 py-2.5 border border-bp-error text-bp-error text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                Reject
              </button>
              {!canApprove && (
                <p className="text-xs text-on-surface-muted self-center">
                  {stillFlagged.length} field(s) still flagged — override or
                  reject them first.
                </p>
              )}
            </div>
          : <div className="space-y-3">
              <p className="text-sm font-medium text-on-surface">
                Select the field(s) that justify rejection:
              </p>
              <div className="space-y-1">
                {stillFlagged.map((f) => (
                  <label
                    key={f.field}
                    className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rejectedFields.includes(f.field)}
                      onChange={() => toggleRejectedField(f.field)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Rejection note (required)…"
                className="w-full border border-outline rounded-lg px-3 py-2 text-sm bg-surface-card text-on-surface"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submitResolution("rejected")}
                  disabled={
                    rejectedFields.length === 0 ||
                    !rejectNote.trim() ||
                    submitting
                  }
                  className="px-5 py-2.5 bg-bp-error text-white text-sm font-semibold rounded-lg disabled:opacity-40">
                  Confirm Reject
                </button>
                <button
                  onClick={() => setRejectMode(false)}
                  className="px-5 py-2.5 border border-outline text-on-surface-dim text-sm font-semibold rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          }
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke check**

Run: `npm run dev`, visit `http://localhost:3000/`, click "Review →" on the flagged ABC Distillery row
Expected: label image renders, 7 field rows render, the Government Warning row shows "Override" button, Approve is disabled, Reject is enabled

- [ ] **Step 3: Commit**

```bash
git add app/queue
git commit -m "feat: add queue application review page with override/approve/reject"
```

---

### Task 11: Route flagged batch rows into the queue

**Files:**

- Modify: `app/api/batch/route.ts`
- Modify: `app/batch/page.tsx`

**Interfaces:**

- Consumes: `addApplication` from `@/lib/queue/store`; `QueueApplication` from `@/lib/queue/types`
- Produces: batch SSE `result` events gain an optional `queueId` field when a row is flagged; results table renders a "Review in queue →" link for those rows

- [ ] **Step 1: Modify the batch API route to push flagged rows into the queue**

In `app/api/batch/route.ts`, add the import at the top:

```typescript
import { addApplication } from "@/lib/queue/store";
import { QueueApplication } from "@/lib/queue/types";
```

Replace the per-row success branch (inside the `try` block, after `const result = verifyLabel(appData, ocrResult.data, ocrResult.confidence)`):

```typescript
const { filename, ...appData } = row;
const ocrResult = await provider.extract(imageData.base64, imageData.mimeType);
const result = verifyLabel(appData, ocrResult.data, ocrResult.confidence);

let queueId: string | undefined;
if (!result.overallPass) {
  queueId = `TTB-BATCH-${Date.now()}-${i}`;
  const queueApp: QueueApplication = {
    id: queueId,
    brandName: appData.brandName || filename,
    applicant: appData.bottler || "Batch import",
    submittedAt: new Date().toISOString(),
    applicationData: appData,
    imageBase64: imageData.base64,
    imageMimeType: imageData.mimeType,
    status: "analyzed",
    analysis: {
      extracted: ocrResult.data,
      confidence: ocrResult.confidence,
      boundingBoxes: ocrResult.boundingBoxes,
      result,
      analyzedAt: new Date().toISOString(),
    },
    resolution: null,
  };
  addApplication(queueApp);
}

controller.enqueue(
  encoder.encode(
    sseEvent({
      type: "result",
      index: i,
      filename,
      extracted: ocrResult.data,
      confidence: ocrResult.confidence,
      result,
      queueId,
    }),
  ),
);
```

- [ ] **Step 2: Update the batch page to render the queue link and revised summary**

In `app/batch/page.tsx`, add `queueId?: string` to the `BatchResult` interface:

```typescript
interface BatchResult {
  index: number;
  filename: string;
  extracted?: ExtractedLabelData;
  confidence?: ConfidenceMap;
  result?: VerificationResult;
  error?: string;
  queueId?: string;
}
```

In the SSE payload type inside `handleSubmit`, add `queueId?: string` alongside the other fields, and pass it through when building `batchResult`:

```typescript
        const payload = JSON.parse(part.slice("data: ".length)) as {
          type: string
          total?: number
          index?: number
          filename?: string
          extracted?: ExtractedLabelData
          confidence?: ConfidenceMap
          result?: VerificationResult
          error?: string
          queueId?: string
        }
        if (payload.type === "start" && payload.total !== undefined) {
          setNotifTotal(payload.total)
        } else if (payload.type === "result" && payload.index !== undefined && payload.filename) {
          const batchResult: BatchResult = {
            index: payload.index,
            filename: payload.filename,
            extracted: payload.extracted,
            confidence: payload.confidence,
            result: payload.result,
            error: payload.error,
            queueId: payload.queueId,
          }
```

Add the `Link` import at the top of the file:

```typescript
import Link from "next/link";
```

In the results table, inside the result-card header (where the PASS/FAIL badge is rendered), add a link when `queueId` is present:

```tsx
<div
  className={`flex items-center justify-between px-4 py-3 ${
    r.error ? "bg-surface-dim"
    : r.result?.overallPass ? "bg-bp-success-surface"
    : "bg-bp-error-surface"
  }`}>
  <span className="text-sm font-medium text-on-surface">{r.filename}</span>
  <div className="flex items-center gap-3">
    {r.queueId && (
      <Link
        href={`/queue/${r.queueId}`}
        className="text-xs font-medium text-primary hover:text-primary-hover">
        Review in queue →
      </Link>
    )}
    {r.error ?
      <span className="text-xs text-on-surface-muted">Error</span>
    : <span
        className={`text-xs font-semibold px-2 py-0.5 rounded ${
          r.result?.overallPass ?
            "bg-bp-success-surface text-bp-success border border-bp-success-border"
          : "bg-bp-error-surface text-bp-error border border-bp-error-border"
        }`}>
        {r.result?.overallPass ? "PASS" : "FAIL"}
      </span>
    }
  </div>
</div>
```

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, visit `http://localhost:3000/batch`, set mock provider via Settings, upload `tests/mocks/labels.csv` + its images, click "Verify All"
Expected: both result cards show "Review in queue →" (mock provider always fails Government Warning), and clicking it opens the corresponding `/queue/[id]` review page

- [ ] **Step 4: Commit**

```bash
git add app/api/batch/route.ts app/batch/page.tsx
git commit -m "feat: route flagged batch rows into the review queue"
```

---

### Task 12: Update and add E2E tests

**Files:**

- Delete: `tests/single-verify.spec.ts`
- Modify: `tests/landing.spec.ts`
- Modify: `tests/batch.spec.ts`
- Create: `tests/queue.spec.ts`

**Interfaces:**

- Consumes: the running app from Tasks 8–11

- [ ] **Step 1: Delete the obsolete manual-verify spec**

```bash
git rm tests/single-verify.spec.ts
```

- [ ] **Step 2: Rewrite the landing smoke test**

Replace the full contents of `tests/landing.spec.ts` with:

```typescript
import { test, expect } from "@playwright/test";

test("dashboard loads as the verification queue", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/TTB/i);
  await expect(
    page.getByRole("heading", { name: "Verification Queue" }),
  ).toBeVisible();
  await expect(page.getByText("Pending Applications")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Add mock application" }),
  ).toBeVisible();
});
```

- [ ] **Step 3: Add the queue link assertion to batch.spec.ts**

In `tests/batch.spec.ts`, in the `'valid CSV + images enables Verify All and streams results'` test, add after the existing result-card assertions:

```typescript
await expect(page.getByTestId("result-card-0")).toBeVisible({ timeout: 15000 });
await expect(page.getByTestId("result-card-1")).toBeVisible({ timeout: 15000 });
await expect(
  page.getByRole("link", { name: /Review in queue/i }).first(),
).toBeVisible({ timeout: 15000 });
```

- [ ] **Step 4: Write the new queue flow spec**

```typescript
// tests/queue.spec.ts
import { test, expect } from "@playwright/test";

const MOCK_SETTINGS = JSON.stringify({ provider: "mock", apiKey: "" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    localStorage.setItem("ttb-ocr-settings", settings);
  }, MOCK_SETTINGS);
});

test("queue screen loads with seeded applications", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Verification Queue" }),
  ).toBeVisible();
  await expect(page.getByText("Old Tom Distillery")).toBeVisible();
});

test("add mock application increases the pending count", async ({ page }) => {
  await page.goto("/");
  const pendingBtn = page.getByRole("button", { name: /Run pre-analysis now/ });
  const before = await pendingBtn.textContent();
  await page.getByRole("button", { name: "+ Add mock application" }).click();
  await expect(pendingBtn).not.toHaveText(before ?? "");
});

test("run pre-analysis clears the pending count", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run pre-analysis now/ }).click();
  await expect(
    page.getByText(/Run pre-analysis now \(0 pending\)/),
  ).toBeVisible({ timeout: 15000 });
});

test("opening a flagged application shows field rows with an Override option", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Review →" }).first().click();
  await expect(
    page.getByRole("button", { name: "Override" }).first(),
  ).toBeVisible();
});

test("approve is disabled until all flagged fields are overridden", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Review →" }).first().click();
  await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
});

test("overriding all flagged fields enables Approve", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Review →" }).first().click();
  const overrideButtons = page.getByRole("button", { name: "Override" });
  const count = await overrideButtons.count();
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "Override" }).first().click();
    await page
      .getByPlaceholder("Reason for overriding this mismatch…")
      .fill("Confirmed acceptable on manual review");
    await page.getByRole("button", { name: "Save override" }).click();
  }
  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
});

test("reject requires citing a field and a note", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Review →" }).first().click();
  await page.getByRole("button", { name: "Reject" }).click();
  const confirmBtn = page.getByRole("button", { name: "Confirm Reject" });
  await expect(confirmBtn).toBeDisabled();
  await page.getByRole("checkbox").first().check();
  await expect(confirmBtn).toBeDisabled();
  await page
    .getByPlaceholder("Rejection note (required)…")
    .fill("Government warning is not compliant");
  await expect(confirmBtn).toBeEnabled();
});
```

- [ ] **Step 5: Run the full Playwright suite**

Run: `npm run test`
Expected: all specs pass, including `tests/queue.spec.ts` (7 tests), updated `tests/landing.spec.ts` (1 test), updated `tests/batch.spec.ts` (3 tests)

- [ ] **Step 6: Run the full Vitest suite**

Run: `npm run test:unit`
Expected: all existing `lib/**/*.test.ts` pass plus the new `lib/queue/*.test.ts` (14 new tests across store/analyze/resolve)

- [ ] **Step 7: Commit**

```bash
git add tests
git commit -m "test: cover queue review flow, update landing and batch specs"
```

---

## Verification

1. `npx tsc --noEmit` — no type errors across the whole project.
2. `npm run test:unit` — all Vitest suites pass, including the three new `lib/queue/*.test.ts` files.
3. `npm run test` — all Playwright suites pass, including the new `tests/queue.spec.ts` and updated `tests/landing.spec.ts` / `tests/batch.spec.ts`.
4. Manual walkthrough with `npm run dev`:
   - `/` shows the queue with 6 seeded applications (5 analyzed with verdict badges, 1 "Awaiting analysis").
   - "Run pre-analysis now" analyzes the pending one and its verdict badge appears.
   - "+ Add mock application" adds a new pending row.
   - Clicking "Review →" on a flagged application opens `/queue/[id]`, shows the bundled image, 7 field rows, and lets you click a field to highlight its bounding box.
   - Overriding every flagged field enables Approve; approving returns to `/` and the application disappears from the queue.
   - Opening another flagged application, clicking Reject without citing a field or note keeps "Confirm Reject" disabled; citing a field and adding a note enables it.
   - `/batch` with the mock provider produces "Review in queue →" links on flagged rows that open the same `/queue/[id]` screen.
   - Sidebar no longer shows "Verify Label"; `/verify` returns a 404.
