import { describe, it, expect } from "vitest"
import { parseBatchCsv, MAX_BATCH_ROWS } from "./csv"

const HEADER =
  "brand_name,class_type,abv,net_contents,bottler_info,country_of_origin,govt_warning,front_image_url,back_image_url"

function csvRow(overrides: Partial<Record<string, string>> = {}): string {
  const defaults = {
    brand_name: "Stone's Throw",
    class_type: "Kentucky Straight Bourbon Whiskey",
    abv: "45% ABV",
    net_contents: "750 mL",
    bottler_info: "Stone's Throw Distillery",
    country_of_origin: "United States",
    govt_warning: "GOVERNMENT WARNING: ...",
    front_image_url: "https://example.com/front.jpg",
    back_image_url: "https://example.com/back.jpg",
  }
  const merged = { ...defaults, ...overrides }
  return [
    merged.brand_name,
    merged.class_type,
    merged.abv,
    merged.net_contents,
    merged.bottler_info,
    merged.country_of_origin,
    merged.govt_warning,
    merged.front_image_url,
    merged.back_image_url,
  ].join(",")
}

describe("parseBatchCsv", () => {
  it("parses a valid row with no errors", () => {
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${csvRow()}`)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].applicationData.brandName).toBe("Stone's Throw")
    expect(rows[0].frontImageUrl).toBe("https://example.com/front.jpg")
    expect(rows[0].backImageUrl).toBe("https://example.com/back.jpg")
  })

  it("parses a govt_warning field containing commas, when properly quoted", () => {
    const warning =
      "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects."
    const row = [
      "Stone's Throw",
      "Kentucky Straight Bourbon Whiskey",
      "45% ABV",
      "750 mL",
      "Stone's Throw Distillery",
      "United States",
      `"${warning}"`,
      "https://example.com/front.jpg",
      "https://example.com/back.jpg",
    ].join(",")
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${row}`)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].applicationData.governmentWarning).toBe(warning)
    expect(rows[0].frontImageUrl).toBe("https://example.com/front.jpg")
    expect(rows[0].backImageUrl).toBe("https://example.com/back.jpg")
  })

  it("treats back_image_url as optional", () => {
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${csvRow({ back_image_url: "" })}`)
    expect(errors).toHaveLength(0)
    expect(rows[0].backImageUrl).toBeUndefined()
  })

  it("fails the whole upload when a required column is missing", () => {
    const headerMissingAbv = HEADER.replace("abv,", "")
    const { rows, errors } = parseBatchCsv(`${headerMissingAbv}\nfoo`)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("abv")
  })

  it("reports a per-row error for a missing brand_name without failing other rows", () => {
    const csv = `${HEADER}\n${csvRow({ brand_name: "" })}\n${csvRow()}`
    const { rows, errors } = parseBatchCsv(csv)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(1)
  })

  it("reports a per-row error for a malformed front_image_url", () => {
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${csvRow({ front_image_url: "not-a-url" })}`)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("front_image_url")
  })

  it("reports a per-row error for an unparseable abv", () => {
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${csvRow({ abv: "very strong" })}`)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("abv")
  })

  it("rejects an upload exceeding the row cap", () => {
    const lines = Array.from({ length: MAX_BATCH_ROWS + 1 }, () => csvRow())
    const { rows, errors } = parseBatchCsv(`${HEADER}\n${lines.join("\n")}`)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("Too many rows")
  })
})
