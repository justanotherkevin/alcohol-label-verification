# TTB COLA Reference — What We're Replacing

This document captures the real-world process, forms, and regulatory requirements behind the system our app assists with. Sources: TTB.gov, TTB Form 5100.31 (04/2023), TTB Form 5013.2 (08/2025).

---

## TTB and the Alcohol Labeling and Formulation Division (ALFD)

The **Alcohol and Tobacco Tax and Trade Bureau (TTB)** is a bureau of the U.S. Department of the Treasury. Its mandate covers three areas: federal excise tax collection on alcohol and tobacco; permit and registration of producers, importers, and wholesalers; and label and formula approval to prevent consumer deception.

The **Alcohol Labeling and Formulation Division (ALFD)** is the TTB division that issues and reviews COLAs. ALFD employs approximately 47 labeling specialists who process roughly 150,000 COLA applications per year (~3,200 per specialist annually). Federal authority for this work derives from the **Federal Alcohol Administration Act (FAA Act)**, codified at 27 U.S.C. § 205.

---

## What Is a COLA?

A **Certificate of Label Approval (COLA)** authorizes a producer to bottle and sell an alcohol beverage product. Issued by the **Alcohol Labeling and Formulation Division (ALFD)** of the Alcohol and Tobacco Tax and Trade Bureau (TTB).

- ~150,000 applications reviewed per year by ~47 labeling specialists
- Filed electronically via **COLAs Online** (https://www.ttbonline.gov) or on paper
- Authority: 27 U.S.C. 205, Federal Alcohol Administration Act
- Governing regulations: 27 CFR Parts 4 (Wine), 5 (Distilled Spirits), 7 (Malt Beverages), 16 (Health Warning)

### Who Needs a COLA

| Product                                          | Requirement                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| Distilled spirits (all)                          | Required for all bottling, domestic or imported |
| Wine above 7% ABV                                | Required                                        |
| Malt beverages shipped interstate                | Required                                        |
| Wine 7% ABV or below                             | Exempt                                          |
| Products for personal/research use, not for sale | Exempt                                          |

### Application Types

| Type                                   | Description                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Certificate of Label Approval**      | Standard — authorizes bottling and interstate commerce                                                             |
| **Certificate of Exemption**           | For sale in one state only; label must say "For sale in [STATE] only"; not available for imports or malt beverages |
| **Distinctive Liquor Bottle Approval** | For non-standard bottle shapes; requires total bottle capacity before closure                                      |
| **Resubmission After Rejection**       | Requires original TTB ID from the rejected application                                                             |

Once a COLA is issued, certain minor changes are allowed without resubmission (see [Allowable Revisions](#allowable-revisions-no-new-cola-required)). Structural changes require a new application.

---

## TTB Form 5100.31 — The COLA Application

**Full title:** Application for and Certification/Exemption of Label/Bottle Approval  
**Form number:** TTB F 5100.31 (04/2023)  
**OMB:** 1513-0020  
**Burden estimate:** ~31 minutes to complete

### Part I — Application Fields

`data/ttb-cola-fields.json`: a 27-field COLA registry covering both label-facing fields (brand name, class/type, ABV, net contents, government warning, etc.) and application-only administrative fields (permit number, serial number, signature), plus product-type-specific fields not yet wired into the app (fanciful name, grape varietal, appellation, vintage, sulfites, age statement, same-field-of-vision, distinctive-bottle capacity). Each entry has TTB terminology, form item number, accepted-value rules, regulatory citations, allowable-revision exceptions, and templated failure messages for showing specialists why a field failed. No changes were made to lib/verify.ts or lib/ttb-rules.ts — wiring the registry in is left as follow-up work per your earlier decision.

| Item | Field                                               | Required      | Notes                                                                                                             |
| ---- | --------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | Rep ID No.                                          | Optional      | Third-party representative ID; enables disclosure to that rep                                                     |
| 2    | Plant Registry / Basic Permit / Brewer's Notice No. | **Required**  | BW-, TPWBH-, DSP- (wine/spirits) or BR- (beer) or importer basic permit                                           |
| 3    | Source of Product                                   | **Required**  | Domestic or Imported                                                                                              |
| 4    | Serial Number                                       | **Required**  | Format: `YY-N` (e.g., `24-1`, `24-2`); assigned by applicant sequentially                                         |
| 5    | Type of Product                                     | **Required**  | WINE / DISTILLED SPIRITS / MALT BEVERAGES                                                                         |
| 6    | Brand Name                                          | **Required**  | Name under which product is sold; if no brand name, use bottler/importer name                                     |
| 7    | Fanciful Name                                       | Optional      | Further identifies product; required for some specialty products                                                  |
| 8    | Name and Address of Applicant                       | **Required**  | Exact match to plant registry, basic permit, or brewer's notice; include approved DBA/trade name if used on label |
| 8a   | Mailing Address                                     | Optional      | Only if different from Item 8                                                                                     |
| 9    | Formula                                             | If required   | TTB Formula ID for products needing pre-approval (flavored beverages, etc.)                                       |
| 10   | Grape Varietal(s)                                   | Wine only     | List each varietal appearing on wine labels                                                                       |
| 11   | Wine Appellation                                    | If on label   | Fill only if appellation of origin stated on label                                                                |
| 12   | Phone Number                                        | Yes           | Contact for the application                                                                                       |
| 13   | Email Address                                       | Optional      | TTB sends processed paper applications here if provided                                                           |
| 14   | Type of Application                                 | **Required**  | See below                                                                                                         |
| 15   | Blown/Branded/Embossed Info                         | If applicable | Container-embossed content not on affixed labels; foreign language translations                                   |
| 16   | Date of Application                                 | Yes           |                                                                                                                   |
| 17   | Signature                                           | **Required**  | Applicant or authorized agent, in ink                                                                             |
| 18   | Print Name                                          | **Required**  |                                                                                                                   |

**Item 14 — Application Types:**

- **a. Certificate of Label Approval** — standard; authorizes bottling and removal
- **b. Certificate of Exemption** — for sale in one state only; must appear on label as "For sale in [STATE] only"; not available for imports or malt beverages
- **c. Distinctive Liquor Bottle Approval** — for non-standard bottle shapes; requires total bottle capacity before closure
- **d. Resubmission After Rejection** — requires original TTB ID of rejected application

### Part II — Applicant's Certification

Signed under penalty of perjury: all application statements are true; label representations correctly represent container contents.

### Part III — TTB Certificate

Issued by TTB with date, authorized signature, and any qualifications or expiration date.

---

## What Specialists Review (The Matching Task)

A labeling specialist's core job is verifying that **what is printed on the label matches what is stated in the COLA application**. Field-by-field comparison:

| Label Field                          | Application Field                                 | Match Type                               |
| ------------------------------------ | ------------------------------------------------- | ---------------------------------------- |
| Brand name as printed                | Item 6 Brand Name                                 | Fuzzy (case, punctuation variants OK)    |
| Fanciful name                        | Item 7 Fanciful Name                              | Fuzzy                                    |
| Class / type designation             | Item 5 Type of Product + class/type from label    | Fuzzy                                    |
| Alcohol content (ABV)                | (on label, cross-checked against regulations)     | Fuzzy + regulatory bounds                |
| Net contents                         | Item 14c (if distinctive bottle) or standard fill | Regulatory standards of fill             |
| Name and address of bottler/producer | Item 8 Name and Address                           | Fuzzy                                    |
| Country of origin                    | (for imports, from Item 3 + label)                | Fuzzy                                    |
| Government Warning Statement         | Mandatory per 27 CFR Part 16                      | **Strict** — exact text, ALL CAPS prefix |

**TTB explicitly does NOT routinely review** (from Form 5100.31 Conditions):

- Type size
- Characters per inch
- Contrasting background

However, TTB reserves the right to review these and can return noncompliant applications.

---

## Government Warning Statement (27 CFR Part 16)

**Mandatory on all alcohol beverages.** Exact required text:

```
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink
alcoholic beverages during pregnancy because of the risk of birth defects.
(2) Consumption of alcoholic beverages impairs your ability to drive a car or
operate machinery, and may cause health problems.
```

**Requirements:**

- `GOVERNMENT WARNING:` must appear in **ALL CAPS** and **bold**
- Zero tolerance for rewording, abbreviation, or paraphrasing
- Title case ("Government Warning") = **non-compliant** → reject
- Buried/tiny text = flag but typically not auto-reject (visual review required)
- Type size requirements by container size (from 27 CFR Part 16):
  - ≤ 237 mL: minimum 1 mm type size
  - 237 mL – 3 L: minimum 2 mm type size
  - > 3 L: minimum 3 mm type size

---

## Mandatory Label Information by Product Type

Requirements vary by beverage type under 27 CFR Parts 4, 5, 7:

### All Products

- Brand name
- Class/type designation
- Net contents
- Name and address of bottler/producer (with qualifying phrase: "Bottled by", "Produced by", "Distilled by", "Imported by", etc.)
- **Government Health Warning Statement** (27 CFR Part 16)

### Wine (27 CFR Part 4)

- Alcohol content (required unless labeled as "table wine" ≤14% or "dessert wine")
- Grape varietal(s) if claimed
- Appellation of origin if claimed
- Vintage date if claimed
- Sulfite declaration if SO₂ ≥ 10 ppm

### Distilled Spirits (27 CFR Part 5)

- Alcohol content (always required, minimum 40% ABV for most spirits)
- Class/type designation (e.g., "Straight Bourbon Whisky", "Vodka", "Rum")
- Age statement if required by class/type (e.g., straight whiskies aged <4 years)
- **Same field of vision rule:** brand name, alcohol content, and class/type designation must all appear on the same side of the container simultaneously (for cylindrical containers: within any 40% arc of circumference)

### Malt Beverages (27 CFR Part 7)

- Alcohol content only required if alcohol derived from added flavors/non-beverage ingredients
- No federal standards of fill (any container size permitted)

---

## Allowable Revisions (No New COLA Required)

Once approved, producers can make these changes without resubmitting. **Relevant for matching logic** — a specialist seeing one of these changes on a label should not reject:

| #   | Change                                                             | Wine | Spirits | Malt            |
| --- | ------------------------------------------------------------------ | ---- | ------- | --------------- |
| 3b  | Change type size, font, case (upper↔lower), abbreviations          | ✓    | ✓       | ✓               |
| 10  | Change net contents statement (must comply with standards of fill) | ✓    | ✓       | ✓               |
| 11  | Change mandatory alcohol content statement                         | ✓    | ✓       | (flavored only) |
| 19  | Change name/address within same state                              | ✓    | ✓       | ✓               |
| 22  | Add/delete/change bottle deposit or recycling info                 | ✓    | ✓       | ✓               |
| 23  | Add/delete/change UPC or QR codes                                  | ✓    | ✓       | ✓               |
| 27  | Add/delete/change award/medal info                                 | ✓    | ✓       | ✓               |

**Key implication for our app:** A label showing "stone's throw" vs application showing "STONE'S THROW" is an allowable revision (Item 3b — case changes). Our fuzzy matching (normalize to lowercase) correctly handles this. However, a brand name change always requires a new COLA.

---

## COLAs Online System (What Our App Assists)

**TTB Form 5013.2** governs access to COLAs Online:

- Each specialist gets individual User ID + password (no sharing — sharing results in cancellation)
- User roles: Full User (can submit), Preparer/Reviewer (limited — can draft but not submit)
- Access scoped to specific plant registry/permit numbers

**Current workflow specialists follow:**

1. Log into COLAs Online (https://www.ttbonline.gov)
2. Pull up a COLA application in their queue
3. View label artwork attached to the application
4. Check each mandatory field on the label against the application data
5. Mark as Approved / Needs Correction / Rejected
6. Average 5-10 minutes per simple application; longer for issues

### Processing Times and Fees

- **No application fee** for COLA submission
- **Processing time:** 5–20 business days for straightforward applications; more complex submissions take longer
- **TTB customer service goal:** 85% of applications completed within target timeframes
- **Expedited review:** Available by calling TTB Customer Service at 866-927-2533

### Public COLA Registry

All approved COLAs are publicly searchable at [ttb.gov/online-services/public-cola-registry](https://www.ttb.gov/online-services/public-cola-registry):

- No registration required to search
- Covers COLAs issued from 1999 to present; label images available approximately 48 hours after approval
- Searchable by brand name, permit number, product type, approval date
- Wildcard search supported (`%` replaces unknown characters)
- **Only approved COLAs appear** — rejected or returned applications are not included

**Our app's role:** Replace step 3-4 (the visual matching) with AI extraction + automated comparison, targeting ≤5 seconds per label.

---

## Key Regulations Referenced

| CFR Part        | Title                                         | Relevance                                       |
| --------------- | --------------------------------------------- | ----------------------------------------------- |
| 27 CFR Part 4   | Labeling and Advertising of Wine              | Mandatory wine label fields                     |
| 27 CFR Part 5   | Labeling and Advertising of Distilled Spirits | Mandatory spirits label fields                  |
| 27 CFR Part 7   | Labeling and Advertising of Malt Beverages    | Mandatory malt beverage label fields            |
| 27 CFR Part 13  | Labeling Proceedings                          | COLA application procedures                     |
| 27 CFR Part 16  | Alcoholic Beverage Health Warning Statement   | Mandatory warning text + formatting             |
| 27 U.S.C. § 205 | Federal Alcohol Administration Act (FAA Act)  | Statutory authority for TTB labeling regulation |

---

## Form Reference

| Form                    | Title                                                                | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TTB F 5100.31 (04/2023) | Application for and Certification/Exemption of Label/Bottle Approval | The COLA application itself; what specialists compare labels against |
| TTB F 5013.2 (08/2025)  | COLAs Online Access Request                                          | User onboarding for COLAs Online system                              |

---

## Domain Vocabulary (Use Exactly)

TTB uses precise terminology. Match it in the UI:

| Use This                      | Not This                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| Brand Name                    | Trade Name, Product Name                                    |
| Fanciful Name                 | Sub-brand, Secondary Name                                   |
| Alcohol Content               | ABV (acceptable in parentheses: "Alcohol Content (ABV)")    |
| Net Contents                  | Volume, Size, Bottle Size                                   |
| Name and Address              | Producer Info, Company Info                                 |
| Type of Product               | Category, Beverage Type                                     |
| Government Warning Statement  | Health Warning, Warning Label                               |
| Certificate of Label Approval | Label Approval, COLA Certificate                            |
| Labeling Specialist           | Agent, Reviewer, Inspector                                  |
| COLA                          | (always all-caps; stands for Certificate of Label Approval) |
| Needs Correction              | Rejected for Corrections                                    |
| Approved                      | Passed                                                      |
