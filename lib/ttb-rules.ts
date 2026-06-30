// Static regulatory data sourced from 27 CFR Parts 4, 5, 7

export type ProductType = "spirits" | "wine" | "malt"

// 27 CFR Part 5 — Distilled Spirits class/type designations (lowercase for matching)
const SPIRITS_CLASS_TYPES = new Set([
  "bourbon whisky", "bourbon whiskey",
  "straight bourbon whisky", "straight bourbon whiskey",
  "kentucky straight bourbon whisky", "kentucky straight bourbon whiskey",
  "tennessee whisky", "tennessee whiskey",
  "straight tennessee whisky", "straight tennessee whiskey",
  "rye whisky", "rye whiskey",
  "straight rye whisky", "straight rye whiskey",
  "wheat whisky", "wheat whiskey",
  "straight wheat whisky", "straight wheat whiskey",
  "malt whisky", "malt whiskey",
  "straight malt whisky", "straight malt whiskey",
  "corn whisky", "corn whiskey",
  "straight corn whisky", "straight corn whiskey",
  "blended whisky", "blended whiskey",
  "scotch whisky", "scotch whiskey", "scotch",
  "irish whisky", "irish whiskey",
  "canadian whisky", "canadian whiskey",
  "rum", "light rum", "dark rum", "spiced rum", "flavored rum",
  "gin", "distilled gin", "london dry gin", "geneva",
  "vodka", "flavored vodka",
  "tequila", "blanco tequila", "reposado tequila", "añejo tequila", "extra añejo tequila",
  "mezcal",
  "brandy", "fruit brandy", "apple brandy", "grape brandy",
  "cognac", "armagnac", "calvados", "pisco",
  "neutral spirits", "grain spirits",
  "cordial", "cordials", "liqueur", "liqueurs",
  "schnapps",
  "distilled spirits specialty",
])

// 27 CFR Part 4 — Wine class/type designations (lowercase)
const WINE_CLASS_TYPES = new Set([
  "wine", "table wine", "light wine",
  "dessert wine", "aperitif wine",
  "sparkling wine", "natural sparkling wine", "artificially carbonated wine",
  "champagne", "american champagne",
  "prosecco", "cava", "crémant",
  "fruit wine", "berry wine", "citrus wine", "apple wine",
  "honey wine", "mead",
  "port", "port wine", "ruby port", "tawny port", "vintage port",
  "sherry", "cream sherry", "dry sherry",
  "madeira", "marsala", "vermouth",
  "rosé wine", "rose wine", "rosé",
])

// 27 CFR Part 7 — Malt Beverage class/type designations (lowercase)
const MALT_CLASS_TYPES = new Set([
  "beer", "ale", "porter", "stout", "lager", "pilsner", "pilsener",
  "wheat beer", "weizen", "hefeweizen",
  "malt liquor", "malt beverage", "flavored malt beverage",
  "hard seltzer", "hard cider",
  "india pale ale", "ipa", "double ipa", "session ipa",
  "sour ale", "sour beer",
  "bock", "doppelbock",
  "saison", "farmhouse ale",
])

// ABV bounds by product type (27 CFR Parts 4, 5, 7)
export const ABV_BOUNDS: Record<ProductType, { min: number; max: number }> = {
  spirits: { min: 20, max: 95 },
  wine: { min: 7, max: 24 },
  malt: { min: 0.5, max: 20 },
}

// Standard fill sizes in mL (27 CFR 5.47a for spirits, 4.72 for wine)
// Malt beverages have no federal standards of fill (27 CFR Part 7)
export const SPIRITS_FILL_SIZES_ML = new Set([50, 100, 200, 375, 750, 1000, 1750])
export const WINE_FILL_SIZES_ML = new Set([100, 187, 375, 500, 750, 1000, 1500, 3000, 4500])

function matchesAny(lower: string, set: Set<string>): boolean {
  for (const ct of set) {
    if (lower === ct || lower.includes(ct) || ct.includes(lower)) return true
  }
  return false
}

export function detectProductType(classType: string): ProductType | null {
  const lower = classType.toLowerCase().trim()
  if (matchesAny(lower, SPIRITS_CLASS_TYPES)) return "spirits"
  if (matchesAny(lower, WINE_CLASS_TYPES)) return "wine"
  if (matchesAny(lower, MALT_CLASS_TYPES)) return "malt"
  return null
}

export function isValidClassType(classType: string): boolean {
  const lower = classType.toLowerCase().trim()
  return (
    matchesAny(lower, SPIRITS_CLASS_TYPES) ||
    matchesAny(lower, WINE_CLASS_TYPES) ||
    matchesAny(lower, MALT_CLASS_TYPES)
  )
}

export function parseAbv(abvStr: string): number | null {
  const match = abvStr.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

export function parseNetContentsMl(netStr: string): number | null {
  const mlMatch = netStr.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML)/)
  if (mlMatch) return parseFloat(mlMatch[1])
  const lMatch = netStr.match(/(\d+(?:\.\d+)?)\s*(?:l|L)\b/)
  if (lMatch) return parseFloat(lMatch[1]) * 1000
  const ozMatch = netStr.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|FL\.?\s*OZ)/i)
  if (ozMatch) return Math.round(parseFloat(ozMatch[1]) * 29.5735)
  return null
}

export function isValidFillSize(ml: number, productType: ProductType): boolean {
  if (productType === "malt") return true
  const sizes = productType === "spirits" ? SPIRITS_FILL_SIZES_ML : WINE_FILL_SIZES_ML
  for (const size of sizes) {
    if (Math.abs(ml - size) <= 5) return true
  }
  return false
}
