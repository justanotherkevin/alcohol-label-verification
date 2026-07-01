---
OCR Solutions Comparison

For TTB Alcohol Label Verification

Last updated: July 2026 | Context: Next.js app, Vercel deployment, ~150 verifications/specialist/month

---

1. Quick Decision Matrix

┌───────────────────────────────────────┬────────────────────────────┬──────────────────────────────┬─────────────────────────────┬──────────────────────┬───────────────────────┐
│ Solution │ Free Tier │ Bounding Boxes │ Label Accuracy │ Auth Complexity │ Best For │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ Google Cloud Vision │ 1,000/mo forever │ Word-level, excellent │ ★★★★★ │ Medium (GCP project) │ Production primary │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ AWS Textract │ 1,000 pages / 90 days only │ Block/word/line │ ★★★★★ │ High (IAM) │ Tables & forms │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ Azure Computer Vision │ 5,000/mo forever │ Yes │ ★★★★★ (99.8% on clean text) │ Medium (Azure acct) │ Microsoft-stack shops │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ OCR.space │ 25,000 req/mo forever │ Yes (isOverlayRequired) │ ★★★ │ Low (API key only) │ Budget / prototype │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ Tesseract.js (already in app) │ Unlimited │ Yes (approximate) │ ★★ on labels │ Zero │ Offline / fallback │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ EasyOCR │ Unlimited (OSS) │ Yes │ ★★★ │ Zero (self-hosted) │ Multilingual, GPU │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ PaddleOCR │ Unlimited (OSS) │ Yes │ ★★★★ │ Zero (self-hosted) │ Dense layouts, GPU │
├───────────────────────────────────────┼────────────────────────────┼──────────────────────────────┼─────────────────────────────┼──────────────────────┼───────────────────────┤
│ Claude/Gemini/GPT-4o (already in app) │ Varies / paid │ LLM-estimated (less precise) │ ★★★★ │ API key │ Field interpretation │
└───────────────────────────────────────┴────────────────────────────┴──────────────────────────────┴─────────────────────────────┴──────────────────────┴───────────────────────┘

---

2. Provider Deep Dives

---

2.1 Google Cloud Vision API

What it is: Dedicated Google OCR service. Two relevant modes: TEXT_DETECTION (natural scene text) and DOCUMENT_TEXT_DETECTION (dense printed documents — use this for labels).

Pricing (2026)

┌─────────────────────────────┬───────────────┐
│ Tier │ Cost │
├─────────────────────────────┼───────────────┤
│ 0–1,000 units/month │ Free forever │
├─────────────────────────────┼───────────────┤
│ 1,001–5,000,000 units/month │ $1.50 / 1,000 │
├─────────────────────────────┼───────────────┤
│ 5,000,001+ units/month │ $1.00 / 1,000 │
└─────────────────────────────┴───────────────┘

Each image = 1 unit per feature applied. For TTB specialists at ~5 labels/day = ~150/month → permanently free.

Bounding Boxes

Returns FullTextAnnotation with BoundingPoly vertices at page, block, paragraph, word, and symbol level. Pixel coordinates — you divide by image dimensions to normalize. Most precise of all the options for label text.

Accuracy

- Clean printed text: ~98-99% CER
- Dense label layouts: Best in class among dedicated OCR services
- Handles curved text on bottles better than Tesseract

Pain Points

- Requires a GCP project + billing account enabled (even for free tier)
- Service account JSON or API key must be set up in Google Cloud Console (~10 min)
- @google-cloud/vision Node SDK is heavy; REST API call is simpler for your use case
- Does NOT interpret what field something is — you still need regex extraction on top of the raw text
- GCP Console UX is dense/confusing for first-timers

Common Patterns

- Used as the "OCR engine" layer; a separate NLP/LLM layer interprets fields
- Often paired with: Firestore (results storage), Cloud Functions (serverless processing), Document AI (if table/form extraction needed)
- In Next.js on Vercel: call via REST with Authorization: Bearer <api-key>, not the Node SDK (avoids cold-start weight)

Community Sentiment

Generally trusted for accuracy. Main complaints: GCP auth friction, cost unpredictability at scale, occasional degraded accuracy on stylized/decorative fonts common in premium alcohol branding.

---

2.2 AWS Textract

What it is: Amazon's document analysis service. Goes beyond OCR — extracts structured data from forms and tables.

Pricing (2026)

┌─────────────────────────────────┬────────────────────────────────┐
│ Feature │ Cost │
├─────────────────────────────────┼────────────────────────────────┤
│ DetectDocumentText (plain text) │ $1.50 / 1,000 pages │
├─────────────────────────────────┼────────────────────────────────┤
│ AnalyzeDocument (tables) │ $15.00 / 1,000 pages │
├─────────────────────────────────┼────────────────────────────────┤
│ AnalyzeDocument (forms) │ $50.00 / 1,000 pages │
├─────────────────────────────────┼────────────────────────────────┤
│ AnalyzeExpense (receipts) │ $10.00 / 1,000 pages │
├─────────────────────────────────┼────────────────────────────────┤
│ Free tier │ 1,000 pages — but only 90 days │
└─────────────────────────────────┴────────────────────────────────┘

Warning: The free tier expires. After 90 days you pay $1.50/1,000 for basic text. No ongoing free tier unlike Vision API.

Bounding Boxes

Returns Block objects at PAGE, LINE, WORD, and SELECTION_ELEMENT level. Uses normalized coordinates (0.0–1.0) natively — no division needed. Very clean API response format.

Accuracy

High accuracy, comparable to Google Vision on clean documents. Better than Google for structured forms/tables (COLA applications themselves would benefit here).

Pain Points

- No ongoing free tier — the 90-day limit is a dealbreaker for a low-volume TTB app
- IAM setup is more complex than GCP (roles, policies, regions)
- Adds AWS dependency when app is on Vercel (cross-cloud latency)
- Overkill if you just need text + bounding boxes

When to Use Instead

If you ever need to extract the COLA application form data (PDFs of structured forms) rather than label images, Textract's form extraction is the best tool for that job. Worth revisiting for that use case.

Products Often Paired With

S3 (image storage), Lambda (processing), Comprehend (entity extraction), DynamoDB (results)

---

2.3 Azure Computer Vision / Document Intelligence

What it is: Microsoft's OCR stack. Two tiers: Computer Vision Read API (general OCR) and Document Intelligence (form/table extraction, formerly Form Recognizer).

Pricing (2026)

┌────────────────────────────────┬───────────────────────────┬──────────────────────┐
│ Tier │ Free │ Paid │
├────────────────────────────────┼───────────────────────────┼──────────────────────┤
│ Computer Vision Read API │ 5,000 calls/month forever │ $1.50 / 1,000 │
├────────────────────────────────┼───────────────────────────┼──────────────────────┤
│ Document Intelligence (layout) │ 500 pages/month │ $10.00 / 1,000 pages │
└────────────────────────────────┴───────────────────────────┴──────────────────────┘

Best free tier of any cloud OCR — 5,000/month forever is very generous.

Bounding Boxes

Returns BoundingPolygon with vertex coordinates. Available at line and word level. Normalized coords in some API versions.

Accuracy

- Highest accuracy on clean printed text (99.8% in independent benchmarks)
- Good on dense document layouts
- Struggles with handwritten text and heavily stylized fonts

Pain Points

- Requires an Azure account + Cognitive Services resource
- API versions change frequently; documentation can lag
- Response schema is more complex than Google Vision
- Less community tutorials outside Microsoft ecosystem

Common Patterns

Paired with: Azure Functions, Azure Blob Storage, Power Automate. Natural fit if your org is Microsoft-stack. Less common in Next.js/Vercel projects.

When to Choose

If you want the largest free tier (5,000/month) and are comfortable with Azure auth.

---

2.4 OCR.space

What it is: Simple REST-based OCR service built on Tesseract + proprietary engine. No Google/AWS/Azure account needed — just an API key.

Pricing (2026)

┌──────┬───────────┬────────────────┬────────────┐
│ Plan │ Cost │ Requests/Month │ File Size │
├──────┼───────────┼────────────────┼────────────┤
│ Free │ $0 │ 25,000 │ 1MB/image │
├──────┼───────────┼────────────────┼────────────┤
│ Pro │ $7/month │ 500,000 │ 5MB/image │
├──────┼───────────┼────────────────┼────────────┤
│ Plus │ $20/month │ 1,500,000 │ 10MB/image │
└──────┴───────────┴────────────────┴────────────┘

Bounding Boxes

Available with isOverlayRequired=true. Returns word-level bounding boxes. Caveat: using Engine 3 (neural net) slows requests 2–3x when overlay is enabled. Engine 1/2 (Tesseract-based) has minimal overhead for overlays.

Accuracy

- Engine 1/2: Tesseract-equivalent (~★★★)
- Engine 3: Better on difficult images but slower
- Not reliable for stylized label fonts or curved text

Pain Points

- 1MB file size limit on free tier is tight for high-res label photos
- Accuracy ceiling is Tesseract-level — not production-grade for compliance use
- Engine 3 bounding boxes less precise than Engine 1/2
- Rate limited to 500 requests/day on free tier

When to Use

Quick prototype validation, internal tools where accuracy requirements are low, or when you need zero cloud account setup. Not recommended as primary OCR for a compliance tool.

---

2.5 Tesseract.js (already integrated)

What it is: Open-source OCR engine compiled to WebAssembly. Runs entirely client-side or in Node.js with no external API calls.

Cost: Free forever (WASM, self-hosted)

Bounding Boxes

Returns word-level bounding boxes as pixel coordinates. Your app already normalizes these and renders them on the canvas overlay.

Accuracy on Alcohol Labels

The recent academic study on food packaging labels (231 products, 1,628 images) found Tesseract achieved the lowest CER (0.912) and highest BLEU (0.245) of the four open-source systems tested. However, these metrics are on clean images. Real-world alcohol label pain points:

- Metallic/foil label materials cause glare
- Decorative/script fonts for brand names
- Text printed on curved bottles
- Small ABV text (often 6–8pt)
- Text embedded in design elements

Pain Points

- No confidence scores per field (your app returns empty confidence map for Tesseract)
- Approximated bounding boxes — not word-level precision
- Must pre-process images (grayscale, deskew, threshold) for best results
- WASM bundle is ~20MB (cold start latency on Vercel serverless)

Enhancement Pattern

Tesseract + image preprocessing (sharp.js for grayscale/contrast) can significantly improve accuracy on label images. Worth adding as a pre-processing step before OCR regardless of which engine is used.

---

2.6 EasyOCR (Open Source)

What it is: PyTorch-based OCR with 80+ language support. Returns bounding boxes, text, and confidence per region.

Cost: Free (self-hosted, requires Python + PyTorch)

Key Strengths

- Excellent multilingual support (relevant for imported wines/spirits with foreign-language labels)
- Returns (bbox, text, confidence) tuples natively
- GPU-accelerated on supported hardware

Pain Points

- Python-only — adding to a Next.js/Node.js app requires a Python microservice sidecar
- Heavy dependency (PyTorch ~800MB)
- GPU needed for production speed; CPU mode is slow (4–10s per image)
- Not designed for Vercel deployment

Pattern for Next.js Integration

Run as a separate Python FastAPI microservice, call via internal HTTP. Over-engineered for this use case unless you need multilingual support.

---

2.7 PaddleOCR (Open Source)

What it is: Baidu's production-grade OCR library. PP-OCRv4 (latest stable) and PP-OCRv5 show strong accuracy on dense, multi-font documents.

Cost: Free (self-hosted)

Key Strengths

- Best open-source accuracy on dense layouts
- Word-level bounding boxes
- PP-Structure module for layout analysis (can identify label regions)
- PaddleOCR-VL 1.5 (early 2026) adds VLM capabilities

Pain Points

- Same as EasyOCR: Python + PaddlePaddle framework, GPU preferred
- Larger model weights (~1.5GB with detection + recognition + layout)
- PaddlePaddle dependency (less mainstream than PyTorch)
- Overkill for a Vercel-hosted Node.js app

When to Choose

If you ever migrate to a Python backend or need on-premise processing (data sovereignty concerns around sending label images to Google/AWS).

---

3. Bounding Box Deep Dive

This is critical for your canvas overlay feature. Here's what each provider actually returns and what you need to do to use it:

┌───────────────┬───────────────────────────────────────────────┬──────────────┬───────────────────────────┐
│ Provider │ Coordinate System │ Granularity │ Normalization Needed │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ Google Vision │ Pixel vertices {x, y}[] │ Word level │ Yes: divide by image W/H │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ AWS Textract │ Normalized {Left, Top, Width, Height} │ Word level │ No — already 0.0–1.0 │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ Azure Vision │ Pixel polygon [x,y,x,y,...] │ Word level │ Yes: divide by image W/H │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ OCR.space │ Pixel {Left, Top, Height, Width} │ Word level │ Yes │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ Tesseract.js │ Pixel {x0, y0, x1, y1} │ Word level │ Yes (already done in app) │
├───────────────┼───────────────────────────────────────────────┼──────────────┼───────────────────────────┤
│ EasyOCR │ Pixel corner points [[x,y],[x,y],[x,y],[x,y]] │ Region level │ Yes │
└───────────────┴───────────────────────────────────────────────┴──────────────┴───────────────────────────┘

Your app's existing contract (BoundingBoxMap): normalized 0.0–1.0 coords. AWS Textract's format fits directly. Google Vision, Azure, OCR.space all need a divide-by-dimensions step.

Key challenge — field-to-bbox mapping: All dedicated OCR services (non-LLM) return raw text + bounding boxes for every word. They don't know which words are the "brand name" or "ABV." You need to:

1. Run regex extraction to find the field value in the full text
2. Find matching words in the OCR response
3. Aggregate their bounding boxes (union of word boxes)
4. Normalize

Your Tesseract provider already does steps 1 and 4. Google Vision integration needs to add steps 2 and 3.

---

4. Patterns Common in Production Label Verification Systems

Pattern A: Two-Layer Architecture (Recommended for This App)

Image → OCR Engine (text + word bboxes) → Regex/NLP extraction → Field map + bboxes

- OCR handles "what text is where"
- Regex/rules handle "which text is which field"
- Works with: Google Vision, Textract, Azure, OCR.space, Tesseract
- Your app already implements this pattern — see the "Two-Layer Extraction" diagram in `docs/system-design.md` for the concrete implementation (`lib/ocr/tesseract.ts` regex functions shared by both the Tesseract and Google Vision providers)

Pattern B: LLM Vision (End-to-End)

Image → Vision LLM → Structured JSON (field + value + confidence + bbox)

- Single call; model interprets layout semantically
- Better on ambiguous/creative label layouts
- Bounding boxes are approximated (model estimates, not pixel-measured)
- Works with: Claude, Gemini, GPT-4o (already in your app)
- Less deterministic — can hallucinate field assignments

Pattern C: Hybrid (Best Accuracy)

Image → OCR Engine (accurate text + precise bboxes)
↓
Full text → LLM (field extraction with context)
↓
LLM field values → map back to OCR bboxes (by string match)

- Most accurate: OCR precision + LLM intelligence
- Used in production document AI systems (Reducto, LlamaParse, etc.)
- Your app could implement this: Google Vision for text/bboxes, Gemini for field extraction, then map Gemini's values back to Vision's word bboxes

Pattern D: Preprocessing Pipeline

Image → Sharp.js preprocessing (grayscale, contrast, deskew) → OCR → extraction

- Biggest bang-for-buck improvement for Tesseract and open-source OCR
- Especially important for: foil labels, low-contrast text, curved bottles
- sharp is already a common Next.js dependency

---

5. Products Commonly Paired in Label/Compliance Verification

┌────────────────────┬─────────────────────────────────────┬──────────────────────────────────────┐
│ Component │ Common Tool Choices │ Notes │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Image storage │ Vercel Blob, S3, Cloudflare R2 │ R2 is cheapest at scale │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Preprocessing │ sharp.js, jimp │ sharp is fastest in Node.js │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ OCR │ Google Vision, Tesseract.js │ As discussed above │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Field extraction │ Regex, Zod schema validation │ Already in your app │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ LLM interpretation │ Claude 3.7, Gemini 2.5 Flash │ Already in your app │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Fuzzy matching │ fuse.js, fastest-levenshtein │ For brand name / class type matching │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ PDF handling │ pdf.js, pdf-parse │ For reading COLA application PDFs │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Queue/batch │ SSE (already done), BullMQ, Inngest │ For reliable batch processing │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Confidence UI │ Canvas 2D API │ Already in your app │
├────────────────────┼─────────────────────────────────────┼──────────────────────────────────────┤
│ Audit logging │ Postgres (Neon), Supabase │ Currently a stub in your app │
└────────────────────┴─────────────────────────────────────┴──────────────────────────────────────┘

---

6. App-Specific Notes & Recommendations

6.1 The Critical Gap: Image Quality

The #1 accuracy problem for alcohol label OCR is not the OCR engine — it's the image. Labels are photographed with:

- Glare off foil/metallic surfaces
- Curved bottles distorting text
- Shadows from ambient light
- Camera shake on mobile uploads
- Low resolution from phone cameras

Recommendation: Add sharp-based preprocessing as a shared step before any OCR provider runs:
// Normalize: grayscale → contrast boost → sharpen → flatten to white bg
const preprocessed = await sharp(inputBuffer)
.grayscale()
.normalise()
.sharpen({ sigma: 1.5 })
.flatten({ background: '#ffffff' })
.toBuffer()
This alone can raise Tesseract accuracy by 15–30% on difficult label images.

6.2 Government Warning Text — High Stakes, Different Strategy

Your app's verification logic marks government warning as strict match (must be verbatim). This is the highest-stakes field AND the most likely to have OCR errors (it's long, small font, often in a box with special formatting).

Recommendation for this field specifically: Run OCR, then use edit distance (Levenshtein) to check proximity to the required warning text rather than pure regex. If edit distance < 5% of total characters, report as pass with a note. The warning text is fixed — you can hardcode the target and score against it.

6.3 The Tesseract Confidence Problem

Currently your Tesseract provider returns an empty confidence map. Tesseract actually provides word-level confidence scores (0–100). These should be surfaced — a confidence of 40 on the ABV extraction should visually flag as uncertain.

6.4 Free Tier Math for TTB Use Case

TTB specialists: ~47
Labels/specialist/day: ~10-15 (conservative, mechanical pre-screening)
Monthly volume: 47 × 12 × 21 workdays ≈ ~11,800 verifications/month

- Google Vision free: 1,000/month → covers ~1 specialist; others pay $1.50/1k (~$16/month total)
- Azure free: 5,000/month → covers ~4 specialists; rest at $1.50/1k (~$10/month total)
- OCR.space free: 25,000/month → covers entire team at current volume (but accuracy trade-off)

At full 47-specialist load, Azure's free tier is the best value if you're cost-sensitive. Google Vision is better accuracy for a minimal cost difference.

6.5 Recommended Architecture for V2

User uploads label image
↓
sharp.js preprocessing (always — all providers benefit)
↓
Provider selection (user choice in settings):
├── "google-vision" → Vision API text+bboxes → regex extraction → field map
├── "tesseract" → existing Tesseract.js flow (with preprocessing added)
├── "claude/gemini/openai" → existing LLM flow
└── "hybrid" → Google Vision text → Claude/Gemini field extraction → Vision bboxes
↓
verifyLabel() + ttb-rules.ts (unchanged)
↓
Canvas overlay with precise word-level bounding boxes

---

7. Open Source Repositories Worth Examining

┌────────────────┬───────┬──────────────────────────────────────────────────────────────────┐
│ Repo │ Stars │ What's Relevant │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ tesseract.js │ ~34k │ Already used; check v7 WASM config docs │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ paddleocr │ ~44k │ PP-Structure for label region detection │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ easyocr │ ~22k │ Simple API pattern; shows how to return (bbox, text, confidence) │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ label-studio │ ~17k │ Not OCR itself, but pattern for annotation UI with bboxes │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ surya │ ~11k │ Modern open-source OCR; strong on mixed-script documents │
├────────────────┼───────┼──────────────────────────────────────────────────────────────────┤
│ doctr (mindee) │ ~4k │ PyTorch OCR with word-level bboxes; good architecture reference │
└────────────────┴───────┴──────────────────────────────────────────────────────────────────┘

Surya is worth a look — it's a newer open-source OCR that outperforms Tesseract on many benchmarks, runs in Python, and has word-level bounding box output. Same integration friction as EasyOCR/PaddleOCR (Python sidecar), but accuracy is meaningfully better.

---

Sources:

- Google Cloud Vision Pricing
- Google Cloud Vision OCR Pricing 2026
- AWS Textract Pricing
- AWS Textract Pricing 2026
- OCR Benchmark: Text Extraction Accuracy
- Comparing Top 6 OCR Models 2025
- Comparing OCR APIs: ABBYY, Tesseract, Google, Azure
- Best OCR API 2026
- OCR.space Free OCR API
- PaddleOCR vs Tesseract vs EasyOCR
- Evaluating OCR on Food Packaging Labels
- Best Open-Source OCR Models 2025
- OCR APIs Pricing: Free vs Paid

---
