# User Flows — TTB Label Verification App

## Personas

| Persona             | Role                                            | Primary Need                                              |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Jenny Park**      | Junior compliance agent (8 months)              | Guided, step-by-step label check                          |
| **Dave Morrison**   | Senior compliance agent (28 years)              | Fast throughput + ability to apply judgment on edge cases |
| **Janet (Seattle)** | Compliance agent, high-volume importer handling | Batch processing of 200–300 labels at once                |
| **Sarah Chen**      | Deputy Director                                 | Aggregate pass/fail visibility across submissions         |
| **Marcus Williams** | IT Admin                                        | API key config, no blocked endpoints                      |

> **Scope note:** User auth, role-based access, and data retention are out of scope for this prototype. Sarah and Marcus's admin journeys are deferred. Dave's override flow is included as a lightweight addition.

> **Core model:** A Labeling Specialist never types or invents application data. Every application in the queue was already submitted by a producer/importer, with its label artwork attached — the specialist's job is to _review_, not to _enter data and wait for a result_. AI pre-analysis runs ahead of time (see below), so opening a queue item shows findings that are already computed.

> **Design principle — no training required:** The review team spans a wide range of tech comfort, from a 28-year veteran who still prints his email to a specialist eight months into the job who's comfortable with any modern tool. Every screen must be self-explanatory on first use — no hidden actions, no multi-step discovery, nothing that requires a walkthrough. If a screen needs an explanation, it needs a redesign, not a tooltip.

---

## Flow 1: Single Application Review

**Actors:** Jenny, Dave
**Goal:** AI analysis must already be complete before a specialist opens an application. A prior scanning-vendor pilot was abandoned because per-label processing took 30-40 seconds — agents could review five labels by eye in the time the machine took to do one. Pre-analysis exists specifically to make that a non-issue: the specialist never watches a spinner, so reviewing a single already-analyzed application takes ≤5 seconds of their own time.

```
1. LAND
   └── Queue screen: list of pending applications, no login, no onboarding wizard.
       Each row already carries AI-computed verdict + flag count (pre-analysis
       ran before the specialist ever opened the app — see "AI Pre-Analysis" below).

2. QUEUE (list of pending applications)
   ├── Columns: Applicant / Brand Name | Verdict | Flags | Submitted Date
   ├── Sortable and filterable (e.g. show flagged-first for triage)
   └── Color-coded rows: green (clean AI pass) / yellow (has flags) / red (severe fail)

3. OPEN application
   ├── Specialist clicks a queue row
   ├── Detail view loads: bundled label image + bundled application data +
   │   AI's per-field results — all already populated, no wait
   └── No "Verify Label" button — analysis already happened

4. REVIEW results
   ├── Per-field result rows:
   │   ├── ✅ Pass — extracted value matches application data
   │   ├── ❌ Fail — mismatch shown as: extracted vs. expected
   │   └── ⚠️ Warning — low confidence, readability issue, or soft mismatch
   └── Govt Warning row shows exact character diff if failed

4a. INSPECT field source (optional, any field)
   ├── Labeling Specialist clicks any field row in the results panel
   ├── A bounding rectangle highlights on the label image showing
   │   exactly where the OCR read that field's text from
   ├── Clicking a different row moves the highlight to that field
   ├── Clicking the same row again deselects (clears the highlight)
   └── If the OCR could not locate the field spatially, click does nothing silently
   Note: available on LLM providers (Claude/Gemini/GPT-4o) and Tesseract word-match.
         If bounding box data is absent, feature is simply not available for that field.

5. RESOLVE flagged fields
   ├── Any ❌ Fail or ⚠️ Warning field shows an "Override" option
   ├── Specialist selects Override → required free-text reason field appears
   ├── On save: field verdict changes to ⚠️ Override (Pass)
   └── A field left flagged (not overridden) still blocks Approve, below

6. DECIDE
   ├── Approve — enabled only once every field is ✅ Pass or ⚠️ Override (Pass)
   ├── Reject — requires citing ≥1 field still flagged (not overridden), plus a note
   │   └── Cannot reject a clean or fully-overridden application (nothing to cite)
   │   └── Cannot reject with zero cited reason
   └── Decision + any override/reject notes attached to the application record

7. NEXT
   └── Application marked resolved, removed from the pending queue.
       Specialist returns to the queue automatically.
```

**Matching rules** (applied by the AI pre-analysis engine, not configured per-review):

- Government Warning → strict exact match (word-for-word, `GOVERNMENT WARNING:` must be bold + ALL CAPS)
- All other fields → fuzzy/normalized match (`STONE'S THROW` vs `Stone's Throw` passes; `45% Alc./Vol.` vs `45% ABV` passes)
- Unreadable image → returns "Unable to extract" per field, does not silently fail

---

## AI Pre-Analysis (background job)

**Goal:** Every queued application already has AI findings by the time a specialist opens it.

```
1. TRIGGER
   ├── Production model: cron-style job runs on an interval, picks up any
   │   application in the queue without a completed analysis
   └── Prototype model: no real scheduler — see "Dev/Demo Tools" below for
       an on-demand trigger that simulates the job firing

2. ANALYZE (per unanalyzed application)
   ├── Runs OCR/extraction against the bundled label image
   ├── Runs field-by-field comparison against the bundled application data
   │   (same matching rules as Flow 1)
   └── Persists verdict + flag count + per-field results + bounding boxes

3. SURFACE
   └── Queue list updates to show the computed verdict/flag count for that row
```

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
   ├── All labels processed in parallel (not sequentially) — the abandoned
   │   vendor pilot processed one label at a time and left agents staring
   │   at a frozen screen; parallel processing plus incremental results is
   │   a deliberate fix for that failure, not just a nice-to-have
   ├── Progress indicator: "Processing 47 / 300..."
   └── Results populate incrementally as each label completes

5. VIEW batch results table
   ├── One row per label
   ├── Columns: Filename | Brand | ABV | Govt Warning | Net Contents | Verdict
   ├── Color-coded rows: green (clean pass) / yellow (flagged, needs review)
   └── Sort and filter by verdict (e.g. show flagged rows first)

6. ROUTE flagged rows into the queue
   ├── Any row with ≥1 flagged field is added to the same review queue used by Flow 1
   ├── Clean-pass rows (all fields ✅) skip review entirely — no queue entry needed
   └── Janet (or whoever picks up the queue) resolves flagged rows via Flow 1 steps 3–7

7. EXPORT
   ├── Download results as CSV — reflects *resolved* state only
   │   (flagged rows must be Approved/Rejected via the queue before they count
   │   as final; raw AI output alone is not exportable as a final verdict)
   └── Summary bar: "240 passed / 45 rejected / 15 pending review out of 300"
```

---

## Flow 3: Correcting a Mistaken Decision (Revert)

**Actors:** Jenny, Dave (any specialist who catches an incorrect Approve/Reject)
**Goal:** Undo a mistaken decision and send the application back for re-review

```
1. NOTICE the mistake
   ├── Via Audit Log: specialist scans Review History, spots a wrong
   │   decision (e.g. rejected for a Govt Warning fuzzy-match that
   │   should've passed)
   └── Via the application's own detail page, if reopened directly by ID

2. OPEN the resolved application (optional — Audit Log also allows reverting inline)
   └── Detail page for a resolved application shows a summary block in
       place of the Approve/Reject panel: decision, specialist, note,
       timestamp

3. REVERT to queue
   ├── Specialist clicks "Revert to Queue" — available both on the
   │   application detail page and as a row action in the Audit Log table
   ├── Confirm dialog: "This will remove the resolution and return the
   │   application to the queue for re-review. This cannot be undone."
   └── On confirm: the resolution is discarded and the application's
       status returns to "analyzed"

4. RE-ENTERS the queue
   └── Application reappears in the pending queue (Flow 1, step 2) with
       its original AI findings intact — no re-analysis needed

5. RE-REVIEW and correct
   └── Specialist works the application through Flow 1 steps 3–7 again,
       this time reaching the correct Approve/Reject decision
```

**Note:** Reverting is destructive — the discarded decision, note, and specialist attribution are not archived anywhere. There is no record that a revert happened, only whatever resolution (if any) replaces it. See "Full audit trail" under Deferred Journeys.

---

## Dev/Demo Tools (prototype only)

**Not part of any specialist persona's flow.** These exist only because the prototype has no real submission intake or scheduler:

```
├── "Add mock application to queue"
│   └── Simulates a producer/importer submission arriving — adds a new
│       unanalyzed application (bundled image + data) to the queue
└── "Run pre-analysis now"
    └── Manually triggers the AI pre-analysis job on demand, since there is
        no real cron scheduler in a prototype
```

**Seed data:** The queue should ship pre-loaded with 5–8 mock applications covering: a clean AI-pass, a Government Warning strict-fail, a fuzzy-match pass (case/punctuation variant), a low-confidence/glare warning, and an override-candidate — enough to demonstrate every verdict type and the Approve/Override/Reject interactions in Flow 1.

---

## Edge Cases & States

| Scenario                                 | Behavior                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Image has glare / poor lighting          | AI attempts extraction; low-confidence fields flagged ⚠️                                                                                       |
| Image is completely unreadable           | Returns "Unable to extract" per field; does not auto-reject                                                                                    |
| Minor brand name formatting diff         | Fuzzy match — passes (e.g. `STONE'S THROW` vs `Stone's Throw`)                                                                                 |
| Govt warning in title case               | Strict match — fails; diff shown                                                                                                               |
| Govt warning in small/low-contrast text  | Flagged ⚠️ but not auto-rejected                                                                                                               |
| ABV format variation                     | Normalized match — passes (e.g. `45% Alc./Vol. (90 Proof)` vs `45% ABV`)                                                                       |
| Batch: CSV row has no matching image     | Flagged before processing begins                                                                                                               |
| API timeout / error                      | Clear error message per label; does not silently fail                                                                                          |
| Field bounding box unavailable           | Click on field row does nothing; no error shown                                                                                                |
| Application mistakenly approved/rejected | Specialist reverts via "Revert to Queue" (detail page or Audit Log row action); application returns to the queue as re-reviewable — see Flow 3 |

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
- Reverting a decision (Flow 3) is supported, but the reversal itself isn't
  logged — the prior decision is discarded, not archived, so there's no
  history of _that_ a correction happened
- Requires: user auth + data retention
