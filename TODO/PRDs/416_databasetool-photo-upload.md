# PRD 416 — DatabaseTool Photo Upload for Question Generation + Browse

**Priority:** HIGH | **Effort:** MEDIUM | **Status:** READY | **Category:** Feature — DatabaseTool / Document Library
**Source:** Product request + implementation plan (2026-04-18)

---

## Summary

Add first-class photo upload support to DatabaseTool’s add flow so screenshots, scans, and document photos can be used as source material for question generation.

This is a standalone PRD scoped to:

- DatabaseTool add/generate flow
- DatabaseTool browse-mode discoverability for photo-origin docs

It explicitly does **not** change plain document-library upload behavior:

- raw image uploads in `DocumentLibraryPanel` remain raw images only
- DatabaseTool photo uploads can generate an AI-written analysis sidecar
- the sidecar is persisted only when the existing save-to-doc-library toggle is enabled

---

## Problem

DatabaseTool currently accepts:

- pasted text
- URLs
- generic files
- transcript/audio flow

But it does **not** accept screenshots or document photos as a distinct source type.

That causes two gaps:

1. Users cannot turn a screenshot, photographed memo, whiteboard, or scan into survey-question source material.
2. Even if an image is saved elsewhere in the document library, DatabaseTool has no path to analyze it into text suitable for question generation.

The current code path also cannot simply treat images like generic files:

- the add-flow file picker excludes image formats
- generic additional-file processing is text-oriented and would silently mis-handle binary image input

---

## Goals

1. Accept photo uploads as a distinct DatabaseTool source type.
2. Analyze those photos with the session’s configured AI provider via the existing worker AI route.
3. Feed the resulting analysis text into question generation.
4. Reuse the existing save-to-doc-library toggle and audience model.
5. When save is enabled, persist both:
   - the original photo
   - a paired markdown analysis sidecar
6. Make saved photo docs discoverable in DatabaseTool browse mode without changing smart-contract interfaces or worker-secret configuration.

---

## Scope

### In scope

- `SurveyGenerator.jsx` / DatabaseTool add flow
- AI helper logic for photo analysis
- doc-library tags needed to label photo docs and photo-analysis sidecars
- browse-mode discoverability using existing `DocumentLibraryPanel`
- focused regression tests

### Out of scope

- OCR-specific dependency addition
- new provider integrations
- smart-contract changes
- worker route additions
- changing plain `DocumentLibraryPanel` image upload into an auto-analysis flow

---

## Product Behavior

### 1. DatabaseTool add flow

Add a dedicated photo upload control alongside existing URL/file controls.

Accepted v1 formats:

- `png`
- `jpg`
- `jpeg`
- `webp`
- `gif`

Queued photo sources must be rendered distinctly from generic files and show:

- filename
- queued / analyzing / ready / error state

### 2. Question-generation pipeline

Photo sources are **not** passed through the generic text-file extraction path.

Instead:

1. DatabaseTool detects queued `photo` sources
2. Each photo is analyzed through the session’s configured AI provider/model
3. The returned analysis text is appended into the source corpus that feeds the existing question-generation prompt

If the configured provider/model is not vision-capable:

- fail closed
- show a clear blocking error
- do not silently continue with unusable binary input

### 3. Save-to-doc-library behavior

Reuse the existing save toggle and audience picker exactly as-is.

If save is **off**:

- the original photo is not persisted by DatabaseTool
- the photo analysis remains ephemeral
- it only affects the current generation run

If save is **on**:

- upload the original photo as a doc-library file
- upload a second markdown/text sidecar containing the AI analysis
- apply the same encryption/audience policy to both uploads
- keep the sidecar associated to the photo through doc-library tags

### 4. Browse-mode discoverability

DatabaseTool browse mode should continue reusing `DocumentLibraryPanel`.

Saved entries must be visually distinguishable as:

- `photo`
- `photo analysis`

Plain document-library image uploads remain raw image assets only and must **not** auto-create analysis sidecars.

---

## Implementation Notes

### Source modeling

Extend DatabaseTool source modeling from:

- `url | file`

to:

- `url | file | photo`

### AI helper contract

Add a photo-analysis helper that:

- validates supported image formats
- resolves effective AI config
- checks provider/model support
- sends a multimodal request through the existing worker-backed AI path
- returns:
  - `text`
  - provider/model metadata useful for debugging

### Doc-library tag contract

Add metadata tags sufficient to label:

- original photo docs
- derived photo-analysis sidecars

The tag contract should support:

- doc role: `photo`
- doc role: `photo-analysis`
- derived-from relation to the original photo tx when a sidecar exists

No on-chain/public contract interface changes are required.

---

## Acceptance Criteria

- [ ] DatabaseTool accepts photo uploads as a distinct source type
- [ ] Queued photo sources show filename plus analysis status
- [ ] Photo analysis runs before question generation instead of falling through the generic file parser
- [ ] Unsupported provider/model blocks generation with a clear error
- [ ] Successful photo analysis contributes text into the generation prompt
- [ ] Save-off path keeps photo analysis ephemeral
- [ ] Save-on path uploads both the original photo and a paired markdown analysis sidecar
- [ ] Both saved artifacts reuse the same encryption/audience configuration
- [ ] Browse mode clearly labels saved photo docs and photo-analysis sidecars
- [ ] Plain document-library image upload does not fabricate a sidecar
- [ ] Existing URL/file/audio/transcript behavior remains unchanged

---

## Tests

Add focused regression coverage for:

- photo sources count as valid DatabaseTool input
- unsupported image-analysis provider/model blocks the flow
- successful photo analysis feeds the AI prompt
- save-off path does not persist the sidecar
- save-on path persists both image and sidecar
- browse-mode labeling for saved photo docs / sidecars
- existing image preview/download behavior remains intact

---

## Related PRDs

- [PRD 058 — Document Library UX overhaul](058_document-library-ux-overhaul.md)
- [PRD 256 — DatabaseTool Generalization: Browse & Access Existing Data](256_database-tool-generalization-browse-and-access.md)
