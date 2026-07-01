# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## app documentation

| File                                         | Summary                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/context.md`                            | TTB COLA regulatory reference: mandatory label elements by product type, common rejection reasons, and AI feasibility analysis per check.                           |
| `docs/technical-requirement.md`              | Original take-home spec: TTB label fields, sample label, deliverables (repo + deployed URL), and evaluation criteria.                                               |
| `docs/CHANGELOG.md`                          | Chronological change log for the two implementation sessions (2026-06-29 and 2026-06-30).                                                                           |
| `docs/20260630-ai-label-verification-app.md` | Authoritative app spec: 19 architecture decisions, file map, verification rules, batch flow, testing strategy, stretch goals, operational notes, and build steps (Steps 0–15). All 15 steps complete: Steps 14–15 added E2E test suite (16 tests) and bounding box click-to-highlight overlay. |
| `docs/system-design.md`                      | Architecture quick-reference: request-flow diagram, API contracts, `OcrProvider` interface, verification match rules, and env vars.                                 |
| `docs/tesseract-tuning-and-playground.md`    | Guide to tuning Tesseract OCR on label images: preprocessing pipeline, PSM/OEM config, and spec for the interactive playground (`tools/tesseract-playground.html`). |
| `docs/stakeholder-interview-notes.md`        | Discovery interview notes from four TTB stakeholders establishing core requirements (≤5s response, simple UI, batch support, fuzzy + strict matching).              |
| `docs/users-flow.md`                         | User journey flows for each persona: single-label verify (incl. step 5a bounding box inspection), batch processing, edge-case table, and deferred admin journeys.   |
| `docs/ttb-cola-reference.md`                 | Real TTB COLA process reference: Form 5100.31 fields, mandatory label elements, government warning rules, allowable revisions, and domain vocabulary.               |
