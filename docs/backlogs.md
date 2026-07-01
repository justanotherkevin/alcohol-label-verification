# Backlog

Non-critical tasks, feature ideas, and known-but-not-urgent bugs. Not a sprint plan — just a holding pen so findings aren't lost. Pull items into active work when there's bandwidth.

Each entry: **Why** it matters, **Affected files**, and any **Findings** from the conversation/investigation that surfaced it.

---

## Layer 2: refine regex for TTB COLA field extraction

**Why:** The two-layer OCR pipeline (Layer 1: OCR engine reads pixels → Layer 2: regex guesses which text is which field — see `docs/system-design.md` "Two-Layer Extraction" diagram) is only as good as its regex patterns. Testing the new Google Vision provider against `tests/kraken-reach.png` showed the current patterns miss fields that are present in the OCR text but phrased differently than the regex expects, and can't distinguish "OCR read garbled text" from "regex pattern doesn't cover this phrasing" — both currently just surface as `null`.

**Affected files:**

- `lib/ocr/tesseract.ts` — `extractAbv`, `extractBrandName`, `extractClassType`, `extractBottler`, `extractCountryOfOrigin`, `extractGovernmentWarning`, `extractNetContents` (shared verbatim by `google-vision.ts`, so any fix here benefits both providers at once)
- `lib/ocr/google-vision.ts` — consumer of the same regex functions, no changes expected here unless Vision-specific text quirks emerge

**Findings from this chat:**

- On `tests/kraken-reach.png`, `bottler` and `countryOfOrigin` returned `null` because the label simply has no "Bottled by"/"Produced by"/"Product of"/"Made in" phrase for the regex to key off of — a genuine regex-coverage gap, not an OCR failure.
- `governmentWarning` returned `null` because Vision read the warning text as "GOHENNMENT WARNING" (OCR garbling on a low-quality/placeholder label), and `extractGovernmentWarning`'s `GOVERNMENT WARNING:` prefix match correctly rejected it — this is a stricter, higher-stakes field per `docs/ocr-comparison.md` §6.2, which recommends switching this field specifically to a Levenshtein edit-distance check against the fixed TTB warning text instead of an exact prefix match, so near-miss OCR garbling can still pass.
- `extractBrandName` is the most fragile pattern — "first non-empty line under 80 chars" is a heuristic, not a real signal, and will misfire on labels where the brand isn't the first line (e.g. a tagline or vintage year printed above it).
- No visibility today into _why_ a field is null (bad OCR vs. no regex match vs. regex too strict) — worth considering whether `OcrResult` should eventually distinguish these cases for the UI, rather than collapsing both to `null`.
