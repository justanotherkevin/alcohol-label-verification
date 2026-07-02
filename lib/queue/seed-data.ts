import fs from "fs";
import path from "path";
import { ApplicationData, REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify";
import { BoundingBoxMap, ExtractedLabelData } from "@/lib/ocr/types";
import { verifyLabel } from "@/lib/verify";
import { QueueApplication, ApplicationReviewData } from "./types";
import { loadMockImage } from "./load-image";

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

function seed(
  id: string,
  applicant: string,
  submittedAt: string,
  imageFiles: string[],
  applicationData: ApplicationData,
): QueueApplication {
  const images = imageFiles.map((f) => loadMockImage(f));
  const key = extractedKey(imageFiles[0]);
  const entry = allExtracted[key];
  const extracted = entry?.extracted ?? {
    brandName: null,
    classType: null,
    abv: null,
    netContents: null,
    bottler: null,
    countryOfOrigin: null,
    governmentWarning: null,
  };
  const boundingBoxes: BoundingBoxMap = entry?.boundingBoxes ?? {};
  const result = verifyLabel(applicationData, extracted, {});
  return {
    id,
    applicant,
    submittedAt,
    applicationData,
    images,
    status: "analyzed",
    ocrData: {
      extracted,
      confidence: {},
      boundingBoxes,
      result,
      analyzedAt: submittedAt,
    },
    reviewData: emptyReviewData,
  };
}

// imageKey → applicationData — imported by regenerate-extracted.ts to guide Layer 2 extraction
export const SEED_HINTS: Record<string, ApplicationData> = {
  "hollow-creek": {
    brandName: "HOLLOW CREEK",
    classType: "Moonshine",
    abv: "35% ABV",
    netContents: "750 mL",
    bottler: "Hollow Creek Distillery, Bowdon, GA",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  "abc-distillery": {
    brandName: "ABC",
    classType: "Whisky",
    abv: "45% ABV",
    netContents: "750 ml",
    bottler: "ABC Distillery, Frederick, MD",
    countryOfOrigin: "",
    governmentWarning: "GOVERNMENT WARNING",
  },
  "malt-hop-brewery": {
    brandName: "MALT & HOP BREWERY",
    classType: "Pale Ale",
    abv: "5% ABV",
    netContents: "1 pint",
    bottler: "Brewed and Bottled by Malt & Hop Brewery, Hyattsville, MD",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  "12345-imports": {
    brandName: "12345 IMPORTS",
    classType: "Rum with Coconut Liqueur",
    abv: "18% ABV",
    netContents: "200 mL",
    bottler: "Imported by 12345 Imports, Miami, FL",
    countryOfOrigin: "Canada",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  "label-1-front": {
    brandName: "ELDERBERRY & OAK",
    classType: "Small Batch Gin",
    abv: "43% ABV",
    netContents: "750 mL",
    bottler: "Elderberry & Oak Distillers, Portland, OR",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  "label-1-back": {
    brandName: "ELDERBERRY & OAK",
    classType: "Small Batch Gin",
    abv: "43% ABV",
    netContents: "750 mL",
    bottler: "Elderberry & Oak Distillers, Portland, OR",
    countryOfOrigin: "USA",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
}

export const SEED_APPLICATIONS: QueueApplication[] = [
  // 1. Hollow Creek — visible fields pass, but bottler / country / gov warning not on label
  seed(
    "TTB-2026-1001",
    "Hollow Creek Distillery LLC",
    "2026-06-29T14:00:00.000Z",
    ["labels/hollow-creek.jpg"],
    SEED_HINTS["hollow-creek"],
  ),

  // 2. ABC Distillery — brand name OCR misfired on first line; gov warning has trailing OCR noise
  seed(
    "TTB-2026-1002",
    "ABC Distillery Inc.",
    "2026-06-29T15:30:00.000Z",
    ["labels/abc-distillery.png"],
    SEED_HINTS["abc-distillery"],
  ),

  // 3. Malt & Hop Brewery — brand OCR error ("REWED"), ABV not extracted, gov warning body in ALL CAPS
  seed(
    "TTB-2026-1003",
    "Malt & Hop Brewing Co.",
    "2026-06-30T09:15:00.000Z",
    ["labels/malt-hop-brewery.png"],
    SEED_HINTS["malt-hop-brewery"],
  ),

  // 4. 12345 Imports — most complete label; gov warning passes; brand/class/bottler/country partially extracted
  seed(
    "TTB-2026-1004",
    "12345 Imports LLC",
    "2026-06-30T11:00:00.000Z",
    ["labels/12345-imports.png"],
    SEED_HINTS["12345-imports"],
  ),

  // 5. Elderberry & Oak Gin — front+back pair; brand partial, gov warning garbled OCR on back
  seed(
    "TTB-2026-1005",
    "Elderberry & Oak Distillers",
    "2026-06-30T13:45:00.000Z",
    ["labels/label-1-front.png", "labels/label-1-back.png"],
    SEED_HINTS["label-1-front"],
  ),
];

// 6. Desert Luna & Agave — pending, front+back pair, no analysis yet
const pendingSeed: QueueApplication = {
  id: "TTB-2026-1006",
  applicant: "Desert Luna Spirits",
  submittedAt: "2026-06-30T16:00:00.000Z",
  applicationData: {
    brandName: "DESERT LUNA & AGAVE",
    classType: "Premium Botanical Spirit",
    abv: "40% ABV",
    netContents: "750 mL",
    bottler: "Desert Luna Spirits, Oaxaca, MX",
    countryOfOrigin: "Mexico",
    governmentWarning: REQUIRED_GOVERNMENT_WARNING,
  },
  images: [
    loadMockImage("labels/label-2-front.png"),
    loadMockImage("labels/label-2-back.png"),
  ],
  status: "pending",
  ocrData: null,
  reviewData: emptyReviewData,
};

SEED_APPLICATIONS.push(pendingSeed);
