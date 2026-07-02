/**
 * Regenerates tests/mocks/labels/_extracted.json from the *.vision.json fixtures.
 * Run with: npx tsx scripts/regenerate-extracted.ts
 *
 * Uses guided search (extractWithHints) with applicationData from SEED_HINTS
 * so the output matches what the live guided OCR pipeline would produce.
 */

import { regenerateExtracted } from "../lib/queue/regenerate-extracted"

regenerateExtracted()
console.log("Wrote tests/mocks/labels/_extracted.json")
