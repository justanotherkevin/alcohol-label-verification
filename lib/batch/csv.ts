import Papa from "papaparse"
import { parseAbv } from "@/lib/ttb-rules"
import { ApplicationData } from "@/lib/verify"

export const MAX_BATCH_ROWS = 300
export const MAX_CSV_BYTES = 2 * 1024 * 1024

const REQUIRED_COLUMNS = [
  "brand_name",
  "class_type",
  "abv",
  "net_contents",
  "bottler_info",
  "country_of_origin",
  "govt_warning",
  "front_image_url",
] as const

export interface BatchCsvRow {
  applicationData: ApplicationData
  frontImageUrl: string
  backImageUrl?: string
}

export interface CsvRowError {
  row: number
  message: string
}

export interface ParsedCsv {
  rows: BatchCsvRow[]
  errors: CsvRowError[]
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/** Parses and validates a batch-upload CSV. Rows with errors are excluded from
 * `rows` and reported in `errors` (1-indexed, header counts as row 0) rather
 * than failing the whole upload — a missing/malformed required column across
 * the whole file, by contrast, is a top-level error with an empty `rows`. */
export function parseBatchCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const fields = parsed.meta.fields ?? []
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !fields.includes(col))
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Missing required column(s): ${missingColumns.join(", ")}`,
        },
      ],
    }
  }

  if (parsed.data.length > MAX_BATCH_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Too many rows: ${parsed.data.length} exceeds the ${MAX_BATCH_ROWS}-row limit per batch`,
        },
      ],
    }
  }

  const rows: BatchCsvRow[] = []
  const errors: CsvRowError[] = []

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 1
    const brandName = raw.brand_name?.trim() ?? ""
    const classType = raw.class_type?.trim() ?? ""
    const abv = raw.abv?.trim() ?? ""
    const netContents = raw.net_contents?.trim() ?? ""
    const bottler = raw.bottler_info?.trim() ?? ""
    const countryOfOrigin = raw.country_of_origin?.trim() ?? ""
    const governmentWarning = raw.govt_warning?.trim() ?? ""
    const frontImageUrl = raw.front_image_url?.trim() ?? ""
    const backImageUrl = raw.back_image_url?.trim() ?? ""

    if (!brandName) {
      errors.push({ row: rowNumber, message: "brand_name is required" })
      return
    }
    if (!frontImageUrl) {
      errors.push({ row: rowNumber, message: "front_image_url is required" })
      return
    }
    if (!isValidUrl(frontImageUrl)) {
      errors.push({ row: rowNumber, message: "front_image_url is not a valid URL" })
      return
    }
    if (backImageUrl && !isValidUrl(backImageUrl)) {
      errors.push({ row: rowNumber, message: "back_image_url is not a valid URL" })
      return
    }
    if (abv && parseAbv(abv) === null) {
      errors.push({ row: rowNumber, message: `abv "${abv}" could not be parsed as a percentage` })
      return
    }

    rows.push({
      applicationData: {
        brandName,
        classType,
        abv,
        netContents,
        bottler,
        countryOfOrigin,
        governmentWarning,
      },
      frontImageUrl,
      backImageUrl: backImageUrl || undefined,
    })
  })

  return { rows, errors }
}
