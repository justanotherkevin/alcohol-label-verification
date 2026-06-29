# TTB Label Verification App — Requirements Checklist

## Core Functionality

### Label Verification
- [ ] Upload a label image (single file)
- [ ] Input application data fields (brand name, class/type, ABV, net contents, bottler info, country of origin, govt warning)
- [ ] AI extracts all text fields from the label image using vision model
- [ ] Field-by-field comparison: label vs. application data
- [ ] Per-field pass/fail result display
- [ ] Overall pass/fail verdict per label

### Government Warning Statement
- [ ] Exact word-for-word match check against required text:
  > `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`
- [ ] Verify "GOVERNMENT WARNING:" is bold and ALL CAPS
- [ ] Flag title case, abbreviated, or reworded variants as non-compliant
- [ ] Detect when warning is buried in tiny/low-contrast text (flag but don't auto-reject)

### Matching Logic
- [ ] **Strict matching** for Government Warning Statement (zero tolerance)
- [ ] **Fuzzy/normalized matching** for other fields (handle case differences, punctuation, minor formatting — e.g. `STONE'S THROW` vs `Stone's Throw` should pass)
- [ ] ABV normalization (e.g. `45% Alc./Vol. (90 Proof)` vs `45% ABV`)
- [ ] Surface confidence level or explanation per field decision

---

## Performance

- [ ] Single label result returned in ≤ 5 seconds (hard requirement — prior pilot failed at 30–40s)
- [ ] Batch processing runs labels in parallel (not sequentially)
- [ ] No perceptible UI freeze during processing (show loading state)

---

## Batch Processing

- [ ] Upload multiple label images at once (ZIP or multi-file select)
- [ ] Accept CSV/spreadsheet with application data mapped to each label file
- [ ] Process all labels in parallel
- [ ] Display results in a table (one row per label, columns per field)
- [ ] Export batch results to CSV
- [ ] Show overall summary: X passed / Y failed / Z warnings out of N labels

---

## User Interface

- [ ] Clean, minimal UI — no hidden buttons, no multi-step wizards
- [ ] Large, clearly labeled upload area (drag-and-drop + button)
- [ ] Form fields clearly labeled with field names
- [ ] Results use clear visual language: green checkmark (pass), red X (fail), yellow warning
- [ ] Mismatch details shown inline (what was found vs. what was expected)
- [ ] Mobile-friendly / responsive layout (at minimum, usable on a standard desktop monitor)
- [ ] No login or account required for prototype

---

## Image Handling

- [ ] Accept common image formats: JPG, PNG, WEBP, PDF (single page)
- [ ] Handle imperfect images: glare, angle distortion, low lighting (pass to vision model rather than reject)
- [ ] Show uploaded image preview alongside results
- [ ] If image is unreadable, return a clear "unable to extract" message (not a silent fail)

---

## Technical Requirements

- [ ] AI backbone: multimodal vision model (Claude Sonnet 4.6 recommended)
- [ ] Frontend: React or Next.js (polished, not Streamlit)
- [ ] API key configurable via environment variable (`.env`)
- [ ] No PII stored — images and data processed in memory only, not persisted
- [ ] Works without VPN or special network config (no blocked external endpoints)
- [ ] Deployable to a public URL (Vercel, Railway, Fly.io, etc.)

---

## Deliverables

- [ ] GitHub repository (public)
- [ ] README with setup instructions and env var docs
- [ ] Brief write-up: approach, tools used, assumptions, trade-offs
- [ ] Deployed live URL

---

## Out of Scope (for this prototype)

- Integration with the existing COLA system
- User authentication / role-based access
- Data retention or audit logging
- TTB Alcohol Facts Statement (proposed rule, not yet mandated)
- Multi-page PDF label sets
- Non-English label verification
