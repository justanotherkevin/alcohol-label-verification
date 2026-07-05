# Tesseract Tuning & Playground

How to get the most out of Tesseract on alcohol-label images, and a spec for an interactive playground to tune it.

---

## Demo

![Tesseract Playground Demo](./assets/tesseract-playground.gif)

---

## 1. Purpose & relationship to the eval harness (B1)

Tesseract is the app's **default** OCR provider (`lib/ocr/tesseract.ts`) — free, local, offline, no API key (app plan decision #8). It is also the **weakest** provider on real-world label art. This doc is about closing that gap as far as it will go.

Two complementary tools, different jobs:

| Tool                          | Job                                                                                               | When                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Playground** (this doc, §9) | Explore/tune **one image** live — try configs and preprocessing, see extracted fields immediately | While _discovering_ good settings                         |
| **Eval harness** (B1)         | Regression-**score every provider** against a labeled ground-truth set                            | After _locking in_ settings, to prove them across the set |

The workflow is: **discover** a good Tesseract config in the playground → **lock** it into `lib/ocr/tesseract.ts` → **measure** it across the whole set with B1.

> **Framing — read this first.** The goal is _"how good can the free, local option get?"_ — **not** _"beat the vision-LLM."_ Tuned Tesseract can go from unusable to genuinely useful on clean labels; it will still plateau below Claude/Gemini/GPT-4o on decorative art (see §3). Tune it to maximize the zero-cost default, and let the LLM providers carry the hard cases.

---

## 2. How Tesseract works (brief)

Tesseract is a two-stage engine: it **segments** the page into text regions, then **recognizes** characters. Modern Tesseract (v4+) recognizes with an **LSTM** neural net (OEM 1); the older pattern-based "legacy" engine (OEM 0) still exists and can be combined (OEM 2).

It was built for **scanned documents** — clean, high-contrast, horizontal, ~300 DPI printed text. Alcohol labels are nearly the opposite:

- **Decorative / serif / script fonts** the LSTM wasn't heavily trained on
- **Curved text** following a bottle or seal
- **Foil, embossing, low contrast** (gold-on-cream, white-on-clear)
- **Rotation / perspective** from photos of bottles
- **Tiny text** (the government warning is often the smallest text on the label)

Every lever below exists to push a label image _back toward_ the clean-scanned-document conditions Tesseract expects.

---

## 3. The accuracy ceiling — honest expectations

| Input                                         | Tuned Tesseract                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Flat, high-contrast printed label, good photo | **Good** — often usable field extraction                                |
| Standard label, mild glare/angle              | **Fair** — preprocessing recovers a lot                                 |
| Decorative/script brand text, curved          | **Poor** — a hard plateau; detection+recognition or a vision-LLM needed |
| Foil / embossed / very low contrast           | **Poor** — even aggressive preprocessing struggles                      |
| Tiny government-warning text                  | **Variable** — upscaling + binarization help most here                  |

Tuning moves the first three rows up a grade. It does **not** make Tesseract read stylized art like an LLM does. Spend the effort because the default should be as strong as possible — not because it will win.

---

## 4. Lever 1 — Image preprocessing (the biggest lever)

**This is where most of the gains are.** "Tesseract is inaccurate" is usually _bad input_, not bad OCR. Preprocess the image to look like a clean scan before Tesseract ever runs.

### Recommended default pipeline (order matters)

1. **Grayscale** — drop color; OCR works on luminance.
2. **Upscale to ~300 DPI equivalent** — Tesseract wants ~300 DPI; small/low-res text should be scaled up 2–4× (bicubic/Lanczos). This single step often helps tiny warning text the most.
3. **Contrast / CLAHE** — Contrast-Limited Adaptive Histogram Equalization lifts faint text (foil, low-contrast) without blowing out the rest.
4. **Denoise** — light median/Gaussian/bilateral blur to remove paper grain and JPEG artifacts that confuse the binarizer. (Keep it light — over-blurring erases thin strokes.)
5. **Binarization** — convert to black-and-white text on white. Two main options:
   - **Otsu** — global threshold; great for even lighting.
   - **Adaptive threshold** — per-region threshold; better for uneven lighting/glare/gradients (common on bottle photos).
6. **Deskew** — rotate so text is horizontal (estimate skew angle, rotate back). Tesseract tolerates a few degrees but not large rotations.
7. **Border / padding** — add a white margin; Tesseract mis-segments text touching the image edge.
8. **Invert** (conditional) — if text is light-on-dark, invert so it's dark-on-light.

> Not every image needs every step, and order interacts (e.g. denoise before binarize, deskew after binarize). This is exactly why a **playground** (§9) to toggle steps and see the effect beats guessing.

### Tools

| Tool                       | Where                      | Use                                                                                                            |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **OpenCV** / **OpenCV.js** | Python / browser-WASM      | Threshold, CLAHE, deskew, denoise, resize — the workhorse; OpenCV.js runs client-side (used in the playground) |
| **Pillow (PIL)**           | Python                     | Simple grayscale/contrast/resize                                                                               |
| **ImageMagick**            | CLI                        | Quick batch preprocessing experiments                                                                          |
| **Leptonica**              | C (bundled with Tesseract) | Tesseract's own image lib; some preprocessing happens here already                                             |

---

## 5. Lever 2 — Tesseract configuration

Once the image is clean, configuration squeezes out more.

### Page Segmentation Mode (PSM) — `tessedit_pageseg_mode`

Tells Tesseract how to interpret layout. The wrong PSM is a common, silent accuracy killer. Most relevant modes for labels:

| PSM | Name                            | Use for labels                                                      |
| --- | ------------------------------- | ------------------------------------------------------------------- |
| 3   | Auto (default)                  | Full label with mixed text blocks                                   |
| 4   | Single column of variable sizes | Stacked label text                                                  |
| 6   | Single uniform block            | A cropped region (e.g. the warning paragraph)                       |
| 7   | Single text line                | A single cropped line (brand name)                                  |
| 8   | Single word                     | A single cropped word                                               |
| 11  | Sparse text                     | Scattered text all over the label — **often best for whole labels** |
| 12  | Sparse text + OSD               | Sparse text with orientation detection                              |

In tesseract.js: `worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })` (import `PSM` from `tesseract.js`).

### OCR Engine Mode (OEM)

| OEM | Engine                   | Notes                                        |
| --- | ------------------------ | -------------------------------------------- |
| 0   | Legacy only              | Old pattern engine; needs legacy traineddata |
| 1   | **LSTM only**            | Default, best for most modern text           |
| 2   | Legacy + LSTM            | Occasionally more robust, slower             |
| 3   | Default (currently LSTM) |                                              |

> **tesseract.js constraint:** OEM is set at init — `createWorker('eng', OEM.LSTM_ONLY)` — and **cannot** be changed via `setParameters`. Switching OEM at runtime requires `worker.reinitialize('eng', oem)`. (PSM, by contrast, can be changed anytime via `setParameters`.) The playground must account for this — see §9.

### Other high-value parameters

| Parameter                      | Effect                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `tessedit_char_whitelist`      | Restrict to expected characters. E.g. ABV-only crop → `"0123456789.%ABVALC/ "`. Sharply reduces garbage on constrained fields. |
| `tessedit_char_blacklist`      | Inverse — ban characters that misfire.                                                                                         |
| `--dpi` / `user_defined_dpi`   | Tell Tesseract the effective DPI after upscaling so its heuristics match.                                                      |
| `user-words` / `user-patterns` | Bias toward a dictionary (TTB class/type terms, "Alc./Vol.", "GOVERNMENT WARNING").                                            |
| `preserve_interword_spaces`    | Keep spacing — helps downstream regex extraction.                                                                              |
| Custom `traineddata`           | Fine-tune on label fonts. High effort; last resort.                                                                            |

---

## 6. Lever 3 — Pipelines & partnering tools

Tesseract on a whole label is the weakest configuration. Better pipelines **find the text first, then read small clean crops**.

### Detection → recognition

1. A **text-detection** model proposes bounding boxes around text regions: **EAST**, **CRAFT**, or **DBNet**.
2. Crop each region, preprocess it (§4), and run Tesseract on the crop with a tight PSM (7 = line, 8 = word).
3. Reassemble.

Smaller, cleaner, single-orientation crops are exactly what Tesseract handles best — this often beats whole-image OCR substantially.

### Post-processing the OCR text

- **Dictionary / fuzzy correction** — snap near-misses to known TTB terms (the app already fuzzy-matches downstream in `lib/verify.ts`).
- **LLM cleanup** — pass noisy OCR text to a cheap LLM to repair and structure it. A middle ground between raw Tesseract and full vision-LLM extraction.

### Hybrid: Tesseract boxes + LLM classification

Use Tesseract (or a cloud OCR) for **pixel-accurate text + bounding boxes**, then an LLM to **classify** each region into a TTB field. This is the industry "OCR-with-boxes → LLM" pattern (see `docs/system-design.md` and the app plan's B2) and gives _auditable_ field locations.

---

## 7. Lever 4 — Alternative engines (the next rung)

When Tesseract plateaus, these read hard text better — at the cost of a Python runtime (which is why they aren't in the prototype; see the PaddleOCR note in `docs/specs/2026-06-29-ttb-label-verification-design.md`).

| Engine                | Strength                                                                     | Cost / runtime                               |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| **PaddleOCR**         | Excellent on varied/curved/multilingual text; built-in detection+recognition | Python; heavier deploy (FastAPI sidecar)     |
| **EasyOCR**           | Easy, good on natural-scene text, 80+ languages                              | Python + PyTorch; GPU helps                  |
| **docTR**             | Strong document/structured OCR, modern models                                | Python (TF/PyTorch)                          |
| **TrOCR** (Microsoft) | Transformer OCR, very strong on lines/handwriting                            | Python + transformers; slowest, GPU-friendly |

Each would slot in as a new `OcrProvider` (app plan decision #6) behind the same `extract()` interface — no downstream change. The barrier is deployment (Python can't run in a Vercel serverless function), not the code.

---

## 8. Testing correctness on a given image

Raw OCR text "looking better" is not the goal — **better field extraction** is. Measure the structured output, not the blob.

### Method

1. **Know the truth** for the test image — the correct values for each field (`brandName`, `classType`, `abv`, `netContents`, `bottler`, `countryOfOrigin`, `governmentWarning`).
2. Run Tesseract → feed raw text through the existing extractors in **`lib/ocr/tesseract.ts`**: `extractBrandName`, `extractClassType`, `extractAbv`, `extractNetContents`, `extractBottler`, `extractCountryOfOrigin`, `extractGovernmentWarning` — producing the `ExtractedLabelData` shape from **`lib/ocr/types.ts`**.
3. Compare extracted vs. truth **per field** (the same normalization the app uses in `lib/verify.ts` is a reasonable bar).
4. Record a **config-comparison table** — one row per config tried, columns = the 7 fields + raw-text quality + time:

   | Config                            | brand | class | abv | net | bottler | country | warning | time |
   | --------------------------------- | :---: | :---: | :-: | :-: | :-----: | :-----: | :-----: | :--: |
   | baseline (no preproc, PSM 3)      |   ✗   |   ✗   |  ✓  |  ✓  |    ✗    |    ✗    |    ✗    | 1.8s |
   | +grayscale +Otsu +upscale, PSM 11 |   ✓   |   ✓   |  ✓  |  ✓  |    ✗    |    ✓    |    ✓    | 2.4s |

5. Keep the config that maximizes correct fields (weighting the **government warning** and **ABV** highest — the compliance-critical ones).

This is the single-image, interactive analogue of B1's batch scoring. The playground (§9) automates exactly this loop.

---

## 9. Playground spec — standalone single-file HTML

> **Status: specified, not built.** This section is the build target.

### Goal & form factor

A single self-contained `.html` file a developer opens in a browser to drop in a label image, toggle preprocessing + Tesseract config, and **see the extracted fields update live**. Fully client-side, zero install, easy to share.

**Dependencies (CDN, no build step):**

- `tesseract.js` (v5+/v7) — runs Tesseract via WASM in-browser, exposes `PSM` / `OEM` enums.
- `opencv.js` — preprocessing (grayscale, threshold, CLAHE, deskew, denoise, resize) on a `<canvas>`.

### Layout (wireframe)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tesseract Playground            [ Drop image / Browse ]   [ Run ▶ ]   │
├───────────────┬───────────────────────────┬──────────────────────────┤
│  CONTROLS     │   IMAGE PREVIEW           │   OUTPUT                  │
│               │                           │                          │
│  Preprocess   │   ┌─────────┐ ┌────────┐  │   Extracted fields:      │
│  ☐ grayscale  │   │ original│ │ preproc│  │   brandName:    …  [✓/✗] │
│  ☐ binarize   │   │         │ │ (B&W)  │  │   classType:    …  [✓/✗] │
│     ▸ Otsu    │   └─────────┘ └────────┘  │   abv:          …  [✓/✗] │
│     ▸ adaptive│                           │   netContents:  …  [✓/✗] │
│     threshold ▮│  (toggles update the     │   bottler:      …  [✓/✗] │
│  ☐ deskew     │   preproc canvas live)    │   countryOfOrigin: … [✓/✗]│
│  ☐ CLAHE      │                           │   governmentWarning: …[✓/✗]│
│  ☐ denoise    │                           │                          │
│  ☐ invert     │                           │   Mean confidence: 71%   │
│  scale [2x ▾] │                           │   Time: 2.4s             │
│               │                           │                          │
│  Tesseract    │                           │   ── Raw OCR text ──     │
│  PSM  [11 ▾]  │                           │   OLD TOM DISTILLERY     │
│  OEM  [1  ▾]  │                           │   Kentucky Straight …    │
│  whitelist [ ]│                           │   45% Alc./Vol. …        │
│  lang [eng ▾] │                           │                          │
│               │                           │   [ Copy config JSON ]   │
│  [ Save as A ]│                           │   [ Compare A | B ]      │
└───────────────┴───────────────────────────┴──────────────────────────┘
```

### Controls

**Preprocessing (OpenCV.js on a canvas):**

- `grayscale` (toggle)
- `binarize` (toggle) → method: **Otsu** | **adaptive**; threshold slider when manual
- `deskew` (toggle)
- `CLAHE` / contrast (toggle, optional clip-limit slider)
- `denoise` (toggle, light)
- `invert` (toggle)
- `scale` (1× / 2× / 3× / 4×)

**Tesseract config:**

- `PSM` dropdown (0–13; default 11 Sparse) → `setParameters({ tessedit_pageseg_mode })`
- `OEM` dropdown (0–3; default 1) → **set at `createWorker('eng', oem)`; changing it triggers `worker.reinitialize`** (see §5 constraint)
- `char whitelist` text input → `tessedit_char_whitelist`
- `language` dropdown (default `eng`)

### Behavior

- **Run** (or auto-run on change) → preprocess canvas → Tesseract → extractors → render.
- Show **original vs. preprocessed** side by side so the dev sees what Tesseract actually receives.
- **Extracted fields panel** is the headline output (not raw text) — render the `ExtractedLabelData` object.
- **Optional ground-truth:** a paste box for the image's correct field values → show per-field ✓/✗ badges (single-image mirror of B1's metric).
- **A/B compare:** save config A, change to B, view both columns to compare directly.
- **Copy config as JSON** so a winning config can be transferred into `lib/ocr/tesseract.ts`.

### Field extraction — reuse, don't reinvent

Port the regex extractors from **`lib/ocr/tesseract.ts`** (`extractAbv`, `extractNetContents`, `extractGovernmentWarning`, `extractClassType`, `extractBrandName`, `extractBottler`, `extractCountryOfOrigin`) inline into the HTML, and produce the same **`ExtractedLabelData`** shape. The playground must show _what the app would extract_, so improvements transfer 1:1. If an extractor is the bottleneck (not the OCR), the playground will reveal that too.

### Implementation notes (for when it's built)

- tesseract.js: `import { createWorker, PSM, OEM } from 'tesseract.js'` (or the UMD global from CDN). PSM via `setParameters`; OEM via `createWorker(lang, oem)` + `reinitialize`.
- Pass the **preprocessed canvas** (not the original file) to `worker.recognize(canvas)`.
- Read confidence from the `recognize` result (`data.confidence` / per-word `data.words[].confidence`) for the mean-confidence readout.
- opencv.js loads async — gate the UI on its `onRuntimeInitialized`.
- Keep everything in one file; inline the extractor functions and styles so the doc/tool is trivially shareable.

---

## 10. Recommended starting presets

Try these first, then refine in the playground:

| Preset                  | Preprocessing                               | Tesseract                                 | Good for                             |
| ----------------------- | ------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| **Clean printed label** | grayscale + Otsu + 2×                       | PSM 11, OEM 1                             | Flat, high-contrast, well-lit labels |
| **Low-contrast / foil** | grayscale + CLAHE + adaptive threshold + 2× | PSM 11, OEM 1                             | Gold-on-cream, faint, embossed       |
| **Small warning text**  | grayscale + 3–4× upscale + Otsu + denoise   | PSM 6 on a crop, OEM 1, whitelist off     | Reading the tiny government warning  |
| **Single field crop**   | grayscale + Otsu + 3×                       | PSM 7 (line) or 8 (word), tight whitelist | Re-reading one field (e.g. ABV)      |

---

> **Measured, not just recommended:** a real grid search against this app's 14 demo labels (32 configs × 14 images, partial-credit token-match scoring against a manually verified ground-truth sheet) confirmed PSM matters far more than preprocessing for this label set, and that `invert` is actively harmful on ordinary dark-text-on-light labels. The winning config — **no preprocessing, `PSM.SPARSE_TEXT`, `OEM.LSTM_ONLY`** — is what `lib/ocr/tesseract.ts` runs today. Full methodology and results: [`2026-07-05-tesseract-grid-search-results.md`](./2026-07-05-tesseract-grid-search-results.md). Re-run it (`npx tsx scripts/tesseract-grid-search.ts`) whenever the demo label set changes or a new preprocessing idea needs checking — don't just trust a config because it worked in the playground on one image.

---

## 11. References

- Tesseract docs — Improving Quality: https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
- Tesseract PSM/OEM & config variables: https://tesseract-ocr.github.io/tessdoc/
- tesseract.js API (worker, `setParameters`, `PSM`/`OEM`): https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- OpenCV image-processing (threshold, CLAHE, morphology): https://docs.opencv.org/
- OpenCV.js tutorials: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR · EasyOCR: https://github.com/JaidedAI/EasyOCR · docTR: https://github.com/mindee/doctr · TrOCR: https://huggingface.co/docs/transformers/model_doc/trocr
