import { ApplicationData, REQUIRED_GOVERNMENT_WARNING } from "@/lib/verify"

// imageKey → applicationData — imported by seed-data.ts and regenerate-extracted.ts
// to guide Layer 2 extraction, and by the applicant portal to auto-fill submissions.
export const SEED_HINTS: Record<string, ApplicationData> = {}

const HOLLOW_CREEK_DATA: ApplicationData = {
  brandName: "HOLLOW CREEK",
  classType: "Moonshine",
  abv: "35% ABV",
  netContents: "750 mL",
  bottler: "Hollow Creek Distillery, Bowdon, GA",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["hollow-creek"] = HOLLOW_CREEK_DATA

const ABC_DISTILLERY_DATA: ApplicationData = {
  brandName: "ABC DISTILLERY",
  classType: "Single Barrel Straight Rye Whisky",
  abv: "45% ABV",
  netContents: "750 ML",
  bottler: "Distilled and Bottled by: ABC Distillery",
  countryOfOrigin: "",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["abc-distillery"] = ABC_DISTILLERY_DATA

const MALT_HOP_BREWERY_DATA: ApplicationData = {
  brandName: "MALT & HOP BREWERY",
  classType: "Pale Ale",
  abv: "5% ABV",
  netContents: "1 pint",
  bottler: "Brewed and Bottled by Malt & Hop Brewery, Hyattsville, MD",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["malt-hop-brewery"] = MALT_HOP_BREWERY_DATA

const IMPORTS_12345_DATA: ApplicationData = {
  brandName: "12345 IMPORTS",
  classType: "Rum with Coconut Liqueur",
  abv: "18% ABV",
  netContents: "200 mL",
  bottler: "Imported by 12345 Imports, Miami, FL",
  countryOfOrigin: "Canada",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["12345-imports"] = IMPORTS_12345_DATA

const ELDERBERRY_OAK_DATA: ApplicationData = {
  brandName: "ELDERBERRY & OAK",
  classType: "Small Batch Gin",
  abv: "43% ABV",
  netContents: "750 mL",
  bottler: "Elderberry & Oak Distillers, Portland, OR",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["label-1-front"] = ELDERBERRY_OAK_DATA
SEED_HINTS["label-1-back"] = ELDERBERRY_OAK_DATA

const DESERT_LUNA_RESUBMIT_DATA: ApplicationData = {
  brandName: "DESERT LUNA & AGAVE",
  classType: "Premium Botanical Spirit",
  abv: "40% ABV",
  netContents: "750 mL",
  bottler: "Desert Luna Spirits, Oaxaca, MX",
  countryOfOrigin: "Mexico",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["label-2-front"] = DESERT_LUNA_RESUBMIT_DATA
SEED_HINTS["label-2-back"] = DESERT_LUNA_RESUBMIT_DATA
SEED_HINTS["label-3-front"] = DESERT_LUNA_RESUBMIT_DATA
SEED_HINTS["label-3-back"] = DESERT_LUNA_RESUBMIT_DATA

const HAWKS_SHADOW_DATA: ApplicationData = {
  brandName: "HAWK'S SHADOW ESTATE WINERY",
  classType: "Orange Muscat",
  abv: "13.68 % ABV",
  netContents: "375 mL",
  bottler: "Hawk's Shadow Estate, Dripping Springs, TX",
  countryOfOrigin: "USA",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["label-4-front"] = HAWKS_SHADOW_DATA
SEED_HINTS["label-4-back"] = HAWKS_SHADOW_DATA

const CASAMIGOS_DATA: ApplicationData = {
  brandName: "CASAMIGOS",
  classType: "Blanco Tequila",
  abv: "40% ABV",
  netContents: "750 mL",
  bottler: "Imported by Casamigos Spirits Company, Manhasset, NY",
  countryOfOrigin: "Mexico",
  governmentWarning: REQUIRED_GOVERNMENT_WARNING,
}
SEED_HINTS["label-5-front"] = CASAMIGOS_DATA
SEED_HINTS["label-5-back"] = CASAMIGOS_DATA

// ── Applicant portal picker catalog ─────────────────────────────────────────
// Groups the per-image SEED_HINTS entries above into one selectable tile per
// application (front+back pairs collapse into a single entry).

export interface LabelCatalogEntry {
  key: string
  displayName: string
  imageKeys: string[]
  applicationData: ApplicationData
}

export const LABEL_CATALOG: LabelCatalogEntry[] = [
  {
    key: "hollow-creek",
    displayName: "Hollow Creek Moonshine",
    imageKeys: ["labels/hollow-creek.jpg"],
    applicationData: HOLLOW_CREEK_DATA,
  },
  {
    key: "abc-distillery",
    displayName: "ABC Distillery Rye Whisky",
    imageKeys: ["labels/abc-distillery.png"],
    applicationData: ABC_DISTILLERY_DATA,
  },
  {
    key: "malt-hop-brewery",
    displayName: "Malt & Hop Brewery Pale Ale",
    imageKeys: ["labels/malt-hop-brewery.png"],
    applicationData: MALT_HOP_BREWERY_DATA,
  },
  {
    key: "12345-imports",
    displayName: "12345 Imports Rum",
    imageKeys: ["labels/12345-imports.png"],
    applicationData: IMPORTS_12345_DATA,
  },
  {
    key: "label-1",
    displayName: "Elderberry & Oak Gin",
    imageKeys: ["labels/label-1-front.png", "labels/label-1-back.png"],
    applicationData: ELDERBERRY_OAK_DATA,
  },
  {
    key: "label-2",
    displayName: "Desert Luna & Agave (Botanical Spirit)",
    imageKeys: ["labels/label-2-front.png", "labels/label-2-back.png"],
    applicationData: DESERT_LUNA_RESUBMIT_DATA,
  },
  {
    key: "label-3",
    displayName: "Desert Luna & Agave (Resubmission)",
    imageKeys: ["labels/label-3-front.png", "labels/label-3-back.png"],
    applicationData: DESERT_LUNA_RESUBMIT_DATA,
  },
  {
    key: "label-4",
    displayName: "Hawk's Shadow Estate Winery",
    imageKeys: ["labels/label-4-front.png", "labels/label-4-back.png"],
    applicationData: HAWKS_SHADOW_DATA,
  },
  {
    key: "label-5",
    displayName: "Casamigos Blanco Tequila",
    imageKeys: ["labels/label-5-front.png", "labels/label-5-back.png"],
    applicationData: CASAMIGOS_DATA,
  },
]
