# Alcohol Label Verification System

This application helps government specialists review alcohol beverage labels for compliance with TTB (Alcohol and Tobacco Tax and Trade Bureau) regulations. It uses artificial intelligence to automatically read label information and compare it against submitted application data, reducing review time while maintaining accuracy and human oversight.

![Application reivew](docs/assets/application-reivew.gif)

![Batch processing](docs/assets/batch-processing.gif)

## What Problem Does It Solve?

Reviewing alcohol labels involves comparing multiple pieces of information:

- Brand name
- Product type
- Alcohol content
- Bottle size
- Bottler location
- Country of origin
- Government-required warning statement

Previously, this was a manual, time-consuming process. Specialists had to:

- Look at label images
- Manually extract information
- Type data into forms
- Compare against applications
- Document any discrepancies

This application automates the first three steps, letting specialists focus entirely on review and decision-making.

## Key Features

### Smart Recognition

- **Intelligent matching** — recognizes that "STONE'S THROW" and "Stone's Throw" refer to the same brand
- **Format flexibility** — understands that "45% ABV," "45% Alc./Vol.," and "90 Proof" are equivalent
- **Multi-image support** — reads information from front and back labels simultaneously

### Compliance Checking

- **Regulatory validation** — checks alcohol content ranges for different product types
- **Government warning verification** — requires exact matching for mandatory warning statements (no variations allowed)
- **Standard fill sizes** — confirms bottle sizes against approved standards

### Review Support

- **Clear flagging** — identifies what needs specialist review and why
- **Visual field references** — shows exactly where on the label each piece of information came from
- **Confidence indicators** — distinguishes between confident extractions and uncertain ones

### Accessibility

- **Senior-friendly design** — 28% larger text, bigger touch targets, high-contrast colors
- **No specialized training required** — straightforward interface for reviewers of all technical levels
- **Batch processing** — review multiple applications efficiently

## How It Works

1. **Upload** — Submit one or more label images (front/back pairs for alcohol bottles)
2. **Analysis** — The system automatically extracts label information using AI vision technology
3. **Comparison** — Extracted data is compared against the submitted application
4. **Review** — Specialists review flagged items and any uncertain extractions
5. **Decision** — Approve, reject, or request corrections
6. **Record** — All decisions are logged for audit purposes

## What It Does _Not_ Do

- Replace human judgment — specialists make all final decisions
- Check visual formatting — font sizes, layouts, and design elements are out of scope
- Store or persist application data — it's a review tool, not a database
- Integrate with COLAs Online — it's a standalone verification system

## Try It

The app includes 5 pre-loaded demo labels so you can see it in action immediately without needing to set up data.

The Settings page includes a "Development tools" section. These are for local development and demoing specific features/states — they only ever touch demo applications (ids prefixed `demo-`), so they're safe to use on the production deployment too.

- **Reset seed data** — Deletes every application currently in the queue and replaces them with the original fixed set of sample applications. Use this to return to a known-clean starting point after testing, e.g. after resolving or rejecting several applications and wanting the dashboard to look like a fresh install again.
- **+ Add mock application** — Inserts one randomly-generated application (based on the sample templates) into the queue in "pending" status. Use this when you want to test the pre-analysis or review flow on a new application without waiting for a real submission.
- **Run pre-analysis now** — Triggers pre-analysis on demand for all pending applications, using the OCR provider currently selected on the Settings page. Pending applications are normally pre-analyzed automatically; use this button when you've just added a mock application or changed the OCR provider and want to see results immediately instead of waiting.

## Technology

- **Vision AI** — Tesseract (free, open-source), Google Vision
- **Built with** — Next.js, React, Tailwind CSS
- **Database** — Postgres (optional; works in-memory for demos)
- **Deployment** — Vercel or self-hosted

## Regulatory Context

This tool supports the TTB's responsibility to ensure alcohol labels comply with 27 CFR regulations. It accelerates the review process while maintaining the requirement that a human specialist approves every application.
