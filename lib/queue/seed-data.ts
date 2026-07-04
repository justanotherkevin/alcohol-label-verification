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
export const SEED_HINTS: Record<string, ApplicationData> = {};

const HOLLOW_CREEK_DATA: ApplicationData = {
  brandName: "HOLLOW CREEK",
  classType: "Moonshine",
  abv: "35% ABV",
  netContents: "750 mL",
  bottler: "Hollow Creek Distillery, Bowdon, GA",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["hollow-creek"] = HOLLOW_CREEK_DATA;

const ABC_DISTILLERY_DATA: ApplicationData = {
  brandName: "ABC DISTILLERY",
  classType: "Single Barrel Straight Rye Whisky",
  abv: "45% ABV",
  netContents: "750 ML",
  bottler: "Distilled and Bottled by: ABC Distillery",
  countryOfOrigin: "",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["abc-distillery"] = ABC_DISTILLERY_DATA;

const MALT_HOP_BREWERY_DATA: ApplicationData = {
  brandName: "MALT & HOP BREWERY",
  classType: "Pale Ale",
  abv: "5% ABV",
  netContents: "1 pint",
  bottler: "Brewed and Bottled by Malt & Hop Brewery, Hyattsville, MD",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["malt-hop-brewery"] = MALT_HOP_BREWERY_DATA;

const IMPORTS_12345_DATA: ApplicationData = {
  brandName: "12345 IMPORTS",
  classType: "Rum with Coconut Liqueur",
  abv: "18% ABV",
  netContents: "200 mL",
  bottler: "Imported by 12345 Imports, Miami, FL",
  countryOfOrigin: "Canada",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["12345-imports"] = IMPORTS_12345_DATA;

const ELDERBERRY_OAK_DATA: ApplicationData = {
  brandName: "ELDERBERRY & OAK",
  classType: "Small Batch Gin",
  abv: "43% ABV",
  netContents: "750 mL",
  bottler: "Elderberry & Oak Distillers, Portland, OR",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["label-1-front"] = ELDERBERRY_OAK_DATA;
SEED_HINTS["label-1-back"] = ELDERBERRY_OAK_DATA;

const DESERT_LUNA_RESUBMIT_DATA: ApplicationData = {
  brandName: "DESERT LUNA & AGAVE",
  classType: "Premium Botanical Spirit",
  abv: "40% ABV",
  netContents: "750 mL",
  bottler: "Desert Luna Spirits, Oaxaca, MX",
  countryOfOrigin: "Mexico",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["label-3-front"] = DESERT_LUNA_RESUBMIT_DATA;
SEED_HINTS["label-3-back"] = DESERT_LUNA_RESUBMIT_DATA;

const HAWKS_SHADOW_DATA: ApplicationData = {
  brandName: "HAWK'S SHADOW ESTATE WINERY",
  classType: "Orange Muscat",
  abv: "13.68 % ABV",
  netContents: "375 mL",
  bottler: "Hawk's Shadow Estate, Dripping Springs, TX",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["label-4-front"] = HAWKS_SHADOW_DATA;
SEED_HINTS["label-4-back"] = HAWKS_SHADOW_DATA;

const CASAMIGOS_DATA: ApplicationData = {
  brandName: "CASAMIGOS",
  classType: "Blanco Tequila",
  abv: "40% ABV",
  netContents: "750 mL",
  bottler: "Imported by Casamigos Spirits Company, Manhasset, NY",
  countryOfOrigin: "Mexico",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
};
SEED_HINTS["label-5-front"] = CASAMIGOS_DATA;
SEED_HINTS["label-5-back"] = CASAMIGOS_DATA;

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
