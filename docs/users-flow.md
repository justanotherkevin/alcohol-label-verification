# User Flows — TTB Label Verification App

## Personas

| Persona | Role | Primary Need |
|---|---|---|
| **Jenny Park** | Junior compliance agent (8 months) | Guided, step-by-step label check |
| **Dave Morrison** | Senior compliance agent (28 years) | Fast throughput + ability to apply judgment on edge cases |
| **Janet (Seattle)** | Compliance agent, high-volume importer handling | Batch processing of 200–300 labels at once |
| **Sarah Chen** | Deputy Director | Aggregate pass/fail visibility across submissions |
| **Marcus Williams** | IT Admin | API key config, no blocked endpoints |

> **Scope note:** User auth, role-based access, and data retention are out of scope for this prototype. Sarah and Marcus's admin journeys are deferred. Dave's override flow is included as a lightweight addition.

---

## Flow 1: Single Label Verification

**Actors:** Jenny, Dave
**Goal:** Verify one label application in ≤5 seconds

```
1. LAND
   └── Two-panel layout: image upload (left), application data form (right)
       No login. No onboarding wizard.

2. UPLOAD label image
   ├── Drag-and-drop zone or click-to-browse button
   ├── Accepts: JPG, PNG, WEBP, PDF (single page)
   └── Thumbnail preview appears immediately after selection

3. FILL application data
   ├── Fields: Brand Name, Class/Type, ABV, Net Contents,
   │          Bottler Info, Country of Origin, Govt Warning
   └── Fields are optional — blank fields are skipped in comparison

4. SUBMIT
   ├── "Verify Label" button (prominent, always visible)
   ├── Loading state shown (spinner + "Analyzing label...")
   └── Result returned in ≤5 seconds

5. VIEW results
   ├── Overall verdict banner: APPROVED / REJECTED / NEEDS REVIEW
   ├── Per-field result rows:
   │   ├── ✅ Pass — extracted value matches application data
   │   ├── ❌ Fail — mismatch shown as: extracted vs. expected
   │   └── ⚠️ Warning — low confidence, readability issue, or soft mismatch
   └── Govt Warning row shows exact character diff if failed

6. OVERRIDE (Dave's edge case flow)
   ├── Any ❌ Fail field shows an "Override" option
   ├── Agent selects Override → required free-text reason field appears
   ├── On save: field verdict changes to ⚠️ Override (Pass)
   └── Final verdict reflects override with agent note attached

7. NEXT
   └── "Clear & Start New" resets form and upload area
```

**Matching rules:**
- Government Warning → strict exact match (word-for-word, `GOVERNMENT WARNING:` must be bold + ALL CAPS)
- All other fields → fuzzy/normalized match (`STONE'S THROW` vs `Stone's Throw` passes; `45% Alc./Vol.` vs `45% ABV` passes)
- Unreadable image → returns "Unable to extract" per field, does not silently fail

---

## Flow 2: Batch Processing

**Actor:** Janet (Seattle office)
**Goal:** Process a full importer submission of 200–300 labels and export results

```
1. SWITCH to Batch mode
   └── Tab or toggle at top of page: "Single Label" | "Batch Upload"

2. UPLOAD labels
   ├── Multi-file select or ZIP file containing label images
   └── CSV upload: one row per label, filename column maps to image file
       CSV columns: filename, brand_name, class_type, abv, net_contents,
                    bottler_info, country_of_origin, govt_warning

3. VALIDATE inputs
   ├── App confirms: N images matched to N CSV rows
   ├── Flags any unmatched filenames before processing
   └── User can proceed or fix mismatches

4. PROCESS
   ├── All labels processed in parallel (not sequentially)
   ├── Progress indicator: "Processing 47 / 300..."
   └── Results populate incrementally as each label completes

5. VIEW batch results table
   ├── One row per label
   ├── Columns: Filename | Brand | ABV | Govt Warning | Net Contents | Verdict
   ├── Color-coded rows: green (pass) / red (fail) / yellow (warning/override)
   └── Sort and filter by verdict (e.g. show failures first)

6. EXPORT
   ├── Download full results as CSV
   └── Summary bar: "240 passed / 45 failed / 15 warnings out of 300"
```

---

## Edge Cases & States

| Scenario | Behavior |
|---|---|
| Image has glare / poor lighting | AI attempts extraction; low-confidence fields flagged ⚠️ |
| Image is completely unreadable | Returns "Unable to extract" per field; does not auto-reject |
| Minor brand name formatting diff | Fuzzy match — passes (e.g. `STONE'S THROW` vs `Stone's Throw`) |
| Govt warning in title case | Strict match — fails; diff shown |
| Govt warning in small/low-contrast text | Flagged ⚠️ but not auto-rejected |
| ABV format variation | Normalized match — passes (e.g. `45% Alc./Vol. (90 Proof)` vs `45% ABV`) |
| Batch: CSV row has no matching image | Flagged before processing begins |
| API timeout / error | Clear error message per label; does not silently fail |

---

## Deferred Journeys (out of scope for prototype)

**Sarah Chen — Supervisor Dashboard**
- Aggregate pass/fail rates across submissions
- Agent throughput metrics
- Requires: data persistence, auth

**Marcus Williams — IT Admin Config**
- API key management UI
- System health / uptime monitoring
- Requires: admin role, persistent config storage

**Full audit trail**
- Agent override history with timestamps and IDs
- Requires: user auth + data retention
