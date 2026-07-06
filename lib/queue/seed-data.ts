import fs from "fs";
import path from "path";
import { ApplicationData } from "@/lib/verify";
import { BoundingBoxMap, ExtractedLabelData, OcrResult } from "@/lib/ocr/types";
import { mergeOcrResults } from "@/lib/ocr/merge";
import { verifyLabel } from "@/lib/verify";
import { QueueApplication, ApplicationReviewData } from "./types";
import { loadMockImage } from "./load-image";
import { SEED_HINTS } from "./label-catalog";

export { SEED_HINTS };

type ExtractedEntry = {
  extracted: ExtractedLabelData;
  boundingBoxes: BoundingBoxMap;
};

const EXTRACTED_PATH = path.join(
  process.cwd(),
  "tests",
  "mocks",
  "labels",
  "_extracted.json",
);

function loadExtracted(): Record<string, ExtractedEntry> {
  try {
    return JSON.parse(fs.readFileSync(EXTRACTED_PATH, "utf-8"));
  } catch {
    return {};
  }
}

const allExtracted = loadExtracted();

function extractedKey(relPath: string): string {
  // "labels/hollow-creek.jpg" → "hollow-creek"
  const base = path.basename(relPath);
  return base.replace(/\.(png|jpe?g)$/i, "");
}

const emptyReviewData: ApplicationReviewData = {
  sessions: [],
  fieldNotes: [],
  resolution: null,
};

const EMPTY_EXTRACTED: ExtractedLabelData = {
  brandName: null,
  classType: null,
  abv: null,
  netContents: null,
  bottler: null,
  countryOfOrigin: null,
  governmentWarning: null,
};

function seed(
  id: string,
  applicant: string,
  submittedAt: string,
  imageFiles: string[],
  applicationData: ApplicationData,
): QueueApplication {
  const images = imageFiles.map((f) => loadMockImage(f));

  // Every image's own ground-truth entry contributes fields — mirrors the live
  // analyzeApplication() pipeline, which OCRs each image and merges the results,
  // instead of only ever looking at the front image.
  const perImageResults: OcrResult[] = imageFiles.map((f) => {
    const entry = allExtracted[extractedKey(f)];
    return {
      data: entry?.extracted ?? EMPTY_EXTRACTED,
      confidence: {},
      boundingBoxes: entry?.boundingBoxes ?? {},
    };
  });
  const merged = mergeOcrResults(perImageResults);
  const result = verifyLabel(applicationData, merged.data, merged.confidence, merged.conflicts);
  return {
    id,
    applicant,
    submittedAt,
    applicationData,
    images,
    status: "analyzed",
    ocrData: {
      extracted: merged.data,
      confidence: merged.confidence,
      boundingBoxes: merged.boundingBoxes,
      result,
      analyzedAt: submittedAt,
    },
    reviewData: emptyReviewData,
  };
}

export const SEED_APPLICATIONS: QueueApplication[] = [
  // 1. Hollow Creek — visible fields pass, but bottler / country / gov warning not on label
  seed(
    "demo-TTB-2026-1001",
    "Hollow Creek Distillery LLC",
    "2026-06-29T14:00:00.000Z",
    ["labels/hollow-creek.jpg"],
    SEED_HINTS["hollow-creek"],
  ),

  // 2. ABC Distillery — brand name OCR misfired on first line; gov warning has trailing OCR noise
  seed(
    "demo-TTB-2026-1002",
    "ABC Distillery Inc.",
    "2026-06-29T15:30:00.000Z",
    ["labels/abc-distillery.png"],
    SEED_HINTS["abc-distillery"],
  ),

  // 3. Malt & Hop Brewery — brand OCR error ("REWED"), ABV not extracted, gov warning body in ALL CAPS
  seed(
    "demo-TTB-2026-1003",
    "Malt & Hop Brewing Co.",
    "2026-06-30T09:15:00.000Z",
    ["labels/malt-hop-brewery.png"],
    SEED_HINTS["malt-hop-brewery"],
  ),

  // 4. 12345 Imports — most complete label; gov warning passes; brand/class/bottler/country partially extracted
  seed(
    "demo-TTB-2026-1004",
    "12345 Imports LLC",
    "2026-06-30T11:00:00.000Z",
    ["labels/12345-imports.png"],
    SEED_HINTS["12345-imports"],
  ),

  // 5. Elderberry & Oak Gin — front+back pair; brand partial, gov warning garbled OCR on back
  seed(
    "demo-TTB-2026-1005",
    "Elderberry & Oak Distillers",
    "2026-06-30T13:45:00.000Z",
    ["labels/label-1-front.png", "labels/label-1-back.png"],
    SEED_HINTS["label-1-front"],
  ),

  // 7. Desert Luna & Agave (resubmission) — front+back pair; gov warning on back is missing the
  // "and may cause health" clause entirely, a genuine strict-match fail
  seed(
    "demo-TTB-2026-1007",
    "Desert Luna Spirits",
    "2026-07-01T10:00:00.000Z",
    ["labels/label-3-front.png", "labels/label-3-back.png"],
    SEED_HINTS["label-3-front"],
  ),

  // 8. Hawk's Shadow Estate Winery — front+back pair; net contents cut off ("375 AL"),
  // gov warning body OCR'd with dropped leading characters per line ("OULD", "PEDANCY")
  seed(
    "demo-TTB-2026-1008",
    "Hawk's Shadow Estate Winery",
    "2026-07-01T11:30:00.000Z",
    ["labels/label-4-front.png", "labels/label-4-back.png"],
    SEED_HINTS["label-4-front"],
  ),

  // 9. Casamigos Blanco Tequila — front+back pair; clean, complete label, should pass every field
  seed(
    "demo-TTB-2026-1009",
    "Casamigos Spirits Company",
    "2026-07-01T13:00:00.000Z",
    ["labels/label-5-front.png", "labels/label-5-back.png"],
    SEED_HINTS["label-5-front"],
  ),
];

// 6. Desert Luna & Agave — pending, front+back pair, no analysis yet
const pendingSeed: QueueApplication = {
  id: "demo-TTB-2026-1006",
  applicant: "Desert Luna Spirits",
  submittedAt: "2026-06-30T16:00:00.000Z",
  applicationData: SEED_HINTS["label-2-front"],
  images: [
    loadMockImage("labels/label-2-front.png"),
    loadMockImage("labels/label-2-back.png"),
  ],
  status: "pending",
  ocrData: null,
  reviewData: emptyReviewData,
};

SEED_APPLICATIONS.push(pendingSeed);
