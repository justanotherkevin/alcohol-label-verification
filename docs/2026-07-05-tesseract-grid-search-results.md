# Tesseract Config Grid Search — Results (2026-07-05)

Empirical follow-up to [`tesseract-tuning-and-playground.md`](./tesseract-tuning-and-playground.md) §8. That doc specifies *how* to measure Tesseract config quality against ground truth; this doc is the first real run of that method against the app's 14 demo label images, and the config it landed on.

## Why

The default Tesseract provider (`lib/ocr/tesseract.ts`) was returning **no bounding rectangles at all** for any field. Investigation found two independent bugs:

1. `worker.recognize(buffer)` was called without an output-format argument. tesseract.js defaults `blocks: false`, so `data.blocks` was always `undefined` — the code silently fell back to an empty word list, so image width/height and every field's bounding box came back `null`.
2. Once bounding boxes were restored, match quality was still poor. A preprocessing pipeline (grayscale + median denoise + invert) was applied based on a config that had tested well in the standalone Tesseract playground on a *different* image — but applying it here made results **worse**, not better.

That second point is the reason this doc exists: "worked in the playground on one image" is not evidence a config generalizes. It needed to be checked against the app's actual label set, with real ground truth, not vibes.

## What

Two artifacts were built:

1. **`tests/mocks/labels/_ground_truth.json`** — a manually verified sheet of the true field values (`brandName`, `classType`, `abv`, `netContents`, `bottler`, `countryOfOrigin`, `governmentWarning`) for each of the 14 demo label images, checked by eye against `public/demo-labels/*`. This deliberately does **not** reuse `SEED_HINTS`/`_extracted.json` — those were derived from each other in a circular way (fabricated demo `ApplicationData` → `extractFields()` → `_extracted.json`), so scoring against them would have measured "agrees with made-up data," not "reads the label correctly."
2. **`scripts/tesseract-grid-search.ts`** — sweeps preprocessing × PSM combinations, OCRs every verified image with each combination, and scores partial credit per field.

## How

- **Scoring is partial-credit, not binary.** Each ground-truth field value is split into tokens; the score is the fraction of tokens found among the OCR'd words for that image/config. A config that reads half a brand name still gets a proportional score, not a zero.
- **The same matched-token set drives the bounding box** (via the existing `computeFieldBbox` in `lib/ocr/extraction.ts`), so a partial text match now produces a box around just the part that was actually found, instead of an all-or-nothing null.
- **Grid:** 8 preprocessing variants (`none`, `grayscale`, `+denoise`, `+invert`, `+denoise+invert`, `+binarize`, `+scale2`, `+scale2+denoise+invert`) × 4 PSM modes (`AUTO`, `SINGLE_COLUMN`, `SINGLE_BLOCK`, `SPARSE_TEXT`) = 32 configs, run against all 14 verified images = 448 OCR passes. `OEM.LSTM_ONLY` was held fixed (the only engine mode bundled with the default `eng` traineddata).
- Run with `npx tsx scripts/tesseract-grid-search.ts`.

## Results

Top 3 by overall token-match rate:

| Rank | Preprocessing | PSM | Score |
| --- | --- | --- | --- |
| 1 | none | SPARSE_TEXT (11) | **90.1%** |
| 2 | grayscale + scale 2× | SPARSE_TEXT (11) | 89.2% |
| 3 | grayscale + scale 2× | SINGLE_BLOCK (6) | 86.5% |

Full sweep (all 32 configs) is in the script's stdout; two findings stood out:

- **`invert: true` was catastrophic everywhere it appeared** — every inverted config scored 3–5%, regardless of any other setting. These demo labels are ordinary dark-text-on-light-background; negating them turns readable text into noise. The playground config that motivated trying `invert` was presumably tuned on a light-text-on-dark-background image — it does not generalize to this label set.
- **`PSM.SPARSE_TEXT (11)` beat `SINGLE_BLOCK (6)` under every preprocessing variant.** Label text is scattered across disconnected regions (brand name, ABV, warning block, etc.), not one contiguous paragraph — sparse-text mode matches that layout much better than assuming a single block.
- Grayscale, denoise, binarize, and scale individually moved the score only a few points in either direction — the single biggest lever by far was PSM, not preprocessing.

## Applied

`lib/ocr/tesseract.ts` now uses the winning config: **no preprocessing, `OEM.LSTM_ONLY`, `PSM.SPARSE_TEXT`** (`sharp` preprocessing and the invert step from the prior change were removed).

## Re-running / extending

- `npx tsx scripts/tesseract-grid-search.ts --images=N` limits to the first N verified images (faster iteration).
- `npx tsx scripts/tesseract-grid-search.ts --top=N` changes how many top configs are printed in detail.
- To test a new preprocessing idea, add a `PreprocessConfig` entry to `PREPROCESS_VARIANTS` in the script.
- To extend ground truth to new label images, add an entry to `_ground_truth.json` with `verified: false`, fill in the real values by inspecting the image, then flip `verified: true` — unverified entries are skipped by the grid search.
