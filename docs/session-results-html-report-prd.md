# Session Results HTML Report PRD

## Problem

Context Engine sessions can already show rich results in the client: the
Polis-inspired report, raw/aggregate survey results, demo analysis, Debate Map,
and Risk Matrix. Operators can also export CSV/JSON result data and download a
PDF of the Polis-style report.

There is not yet a single portable artifact that captures a session's results
state at a point in time and lets a reviewer navigate the report, argument map,
risk matrix, and atlas nodes without reopening the live CE app. This makes
review handoff, archive workflows, offline analysis, and audit trails harder
than they need to be.

## Goals

- Add a navigable static HTML export for session results.
- Capture a point-in-time session snapshot that includes report data, argument
  map data, risk matrix data, and atlas nodes when those sections are available.
- Make the HTML file self-contained enough to open from disk without the CE app,
  a wallet, RPC access, Arweave access, or a Cloudflare Worker request.
- Preserve the existing CSV/JSON/PDF exports.
- Keep private, gated, encrypted, or personally identifying data out of exports
  unless the current user already has authority and explicitly chooses to include
  the allowed detail.
- Avoid smart contract ABI changes.
- Keep implementation mostly in pure utilities so the snapshot and renderer can
  be unit tested without a browser.

## Non-Goals

- Building a server-side hosted report publishing service.
- Adding a public route that serves exported reports.
- Replaying historical chain state from an arbitrary past block in the first
  implementation.
- Decrypting Lit-encrypted payloads without the current wallet/session already
  proving decrypt authority.
- Replacing the existing interactive in-app Report, Debate Map, or Risk Matrix
  surfaces.
- Changing the session registry, contracts, worker KV secrets, or production
  config.

## Current Surfaces

- `client/src/components/PolisReport/PolisReport.tsx` renders the Polis-style
  report and downloads the current report as PDF.
- `client/src/components/SurveyTool/SurveyResults.tsx` exports filtered
  questions/results as CSV or JSON.
- `client/src/components/OnePageSession/OnePageSession.tsx` hosts the session
  results tabs for report, analysis, debate atlas, and risk matrix.
- `client/src/components/DebateMap/DebateMap.tsx` assembles atlas node data,
  historical votes, demo cases, and risk-matrix scenario links.
- `client/src/components/MainContent/RiskMatrix.tsx` owns risk matrix
  categories, comments, heatmap derivation, and atlas-node links.

## User Stories

- As a session operator, I can click `Export HTML Report` from session results
  and choose an exported viewer, static single HTML file, or single-page PDF.
- As a reviewer, I can open the exported file from disk and use a table of
  contents, section anchors, search, and node links to navigate the report.
- As an auditor, I can see when the snapshot was created, which session/network
  it came from, and the latest known block number used by the live client.
- As a privacy-sensitive operator, I can export a redacted report that omits
  wallet addresses, raw freeform answers, encrypted ciphertext, and gated values.
- As a power user, I can inspect the embedded JSON snapshot for reproducibility
  and downstream analysis.
- As an authorized results viewer, I can generate local/session-private
  AI-derived breakdown, argument-map, risk-matrix, and atlas sections from
  viewable responses without sending wallet addresses to the AI provider.

## UX

Add an `Export HTML Report` action near the existing results export controls:

- In `SurveyResults`, include it in the expanded export area.
- In `OnePageSession`, include it in the Results section header actions when
  results are visible.

The action should open a lightweight confirmation modal before download:

- Show session name/slug and export timestamp.
- Require a connected wallet with permission to view results before download.
- Show the downloader's shortened address and embed the full downloader address
  in metadata.
- Show section availability:
  - Report
  - Argument Map
  - Risk Matrix
  - Atlas Nodes
  - Embedded Snapshot JSON
- Let the user choose an export format:
  - Exported viewer: self-contained interactive HTML with search/navigation.
  - Single HTML file: static, all-selected-sections-expanded HTML.
  - Single-page PDF: PDF capture using a print-oriented single-page layout.
- Let the user choose included sections with checkboxes.
- Show privacy mode:
  - `Redacted` by default.
  - `Include authorized decrypted values` only when decrypted values are already
    present in client state and the current user has authority.
- Show a warning that the exported file is a portable local artifact and may
  contain sensitive session information.
- Disable download until required result data is hydrated enough to produce at
  least one useful section.
- If selected analysis sections are unavailable, require `Generate Analysis
  Views` before download.
- Show explicit unavailable reasons for sections that cannot be exported yet,
  including minimum-response/participant requirements for AI generation.

The downloaded filename should follow:

```text
contextEngine_sessionReport_<session-slug-or-name>_<timestamp>.html
```

## Snapshot Contract

The HTML report should embed a versioned JSON snapshot in a script tag:

```json
{
  "type": "ce_session_results_html_snapshot",
  "version": 1,
  "exportedAt": "2026-05-25T18:30:00.000Z",
  "exportedBy": {
    "address": "0x1234...",
    "displayAddress": "0x1234...abcd",
    "chainId": 11155420
  },
  "privacyMode": "redacted",
  "session": {
    "slug": "demo",
    "name": "Demo Session",
    "chainId": 11155420,
    "networkLabel": "OP Sepolia",
    "latestKnownBlock": 12345678
  },
  "counts": {
    "questions": 0,
    "responses": 0,
    "participants": 0,
    "atlasNodes": 0,
    "riskMatrixComments": 0
  },
  "filters": {},
  "sections": {
    "report": {
      "available": true,
      "summary": {},
      "groups": [],
      "representativeQuestions": [],
      "questions": []
    },
    "argumentMap": {
      "available": true,
      "debates": []
    },
    "riskMatrix": {
      "available": true,
      "categories": [],
      "comments": [],
      "heatmap": {},
      "scenarioLinks": []
    },
    "atlas": {
      "available": true,
      "nodes": [],
      "edges": []
    }
  },
  "redactions": []
}
```

Rules:

- Use `version = 1` for the first implementation.
- Keep section objects present even when unavailable; set `available = false`
  and include a short `reason`.
- Store enough derived fields for rendering without re-running heavy client math
  or fetching remote payloads.
- Keep raw response records out of the snapshot in redacted mode.
- Include downloader metadata for authorized exports; exported viewers should
  warn and visually degrade if the embedded downloader metadata is removed.
- Do not store private keys, API keys, worker secrets, access tokens, or wallet
  provider objects.

## AI-Generated Analysis Views

The v1 export flow may derive missing report sections from the responses already
viewable in the client:

- Users must be logged in and authorized to view the current results.
- The AI payload may include decrypted/freeform response text that is already
  viewable to that user.
- Wallet addresses and bridge identifiers must not be sent to the AI provider.
  The client maps each participant to a synthetic id such as
  `participant_001`, sends only those synthetic ids, then re-attaches the local
  address mapping to the session-private artifact after the AI result returns.
- AI output should paraphrase and generalize raw responses rather than quote
  identifying freeform text.
- The first implementation uses minimums of 3 viewable responses, 2
  participants, and 1 hydrated question before AI generation is allowed.
- Generated artifacts are saved in the local `analysisCache` for the session
  with an input signature and timestamp so the UI can reuse them without
  regenerating. Publishing or syncing generated artifacts for other users is a
  future PRD.
- Risk taxonomy is inferred per session rather than fixed globally.

## Section Requirements

### Report

The report section should include:

- Session title, exported timestamp, network label, and latest known block.
- Counts for participants, questions/comments, votes/responses, and filters.
- Opinion groups or clusters when already computed.
- Representative questions/comments when available.
- Consensus/divisive question tables when available.
- A link or anchor back to embedded JSON details.

The first implementation may render a simplified static report from the same
data used by `PolisReport`; it does not need to pixel-match the live component
or PDF export.

### Argument Map

The argument map section should include:

- Debate or argument-map title.
- Side/position labels.
- Claims, subclaims, strength values, and source labels/URLs when available.
- Collapsible argument trees in the exported HTML.

For demo sessions, use the existing Debate HUD/debate data. For normal sessions,
only include this section when session data already provides an argument-map
shape. If unavailable, render an unavailable state instead of inventing content.

### Risk Matrix

The risk matrix section should include:

- Category/subcategory definitions.
- Heatmap values derived from captured comments.
- Comment rows with valence, intensity, cell path, and source/corpus references
  when available.
- Atlas scenario links for cells when available.

The HTML should provide both a compact heatmap table and a sortable comment
table so the export remains useful without the full interactive React surface.

### Atlas Nodes

The atlas section should include:

- Flattened atlas nodes with id, title/name, path, depth, votes, comment counts,
  questions, historical votes, historical cases, scenarios, and source links
  when available.
- Parent-child edges or parent ids so the exported page can render a tree.
- Search over node title, id, path, questions, comments, and source labels.
- Anchor links from Risk Matrix scenario rows to matching atlas node entries.

For point-in-time fidelity, the export must use the data currently loaded into
the client, not lazy-fetch new atlas details after download.

## Point-In-Time Semantics

The first version should define point-in-time as:

- Data already hydrated in the CE client at the moment the export is created.
- The latest known block number from the active provider/read cache when
  available.
- The current filter state and result view context.
- The local timestamp in UTC.

This is a snapshot, not a chain replay. A future version may add `blockTag`
reads for stronger historical reconstruction, but that is outside v1.

## Privacy And Access Rules

- Default exports are redacted.
- HTML/PDF exports require a logged-in wallet that can already view the
  results. Anyone who can view a results surface can export the data available
  to that view.
- Exported artifacts show the downloader's shortened address on the artifact
  and embed the full address in metadata.
- Redacted exports must omit:
  - raw wallet addresses unless already displayed in the chosen view and the
    operator opts into address detail;
  - Telegram IDs or other bridge-specific participant identifiers;
  - raw freeform answers/additional comments unless explicitly included;
  - encrypted ciphertext and Lit envelopes unless the user chooses an archive
    mode in a later PRD;
  - private worker URLs, secrets, API keys, tokens, and provider internals.
- Authorized decrypted values may be included only when:
  - they are already present in client state;
  - the current user passed the same access gates used by the live UI;
  - the confirmation modal makes the sensitivity explicit.
- The export should record `redactions` in the snapshot, such as
  `wallet_addresses`, `raw_responses`, `encrypted_payloads`, or `gated_values`.
- AI generation must use synthetic participant ids in provider payloads and
  keep address re-association local/session-private.

## HTML Renderer

The renderer should be a pure utility that accepts a snapshot and returns a full
HTML string:

- Inline CSS and small inline JavaScript only.
- No CDN dependencies.
- No remote image fetches unless the snapshot explicitly embeds public image
  URLs and the page degrades cleanly when offline.
- Escape all dynamic text.
- Treat embedded JSON as data, not executable source.
- Include keyboard-accessible navigation and collapsible sections.
- Include a search input for atlas nodes and argument claims.
- Include a `Download Snapshot JSON` button generated inside the static report.
- Support both interactive viewer HTML and static single-file HTML render modes.
- Provide a PDF-oriented render mode whose visualizations and tables fit a
  single-page capture path.
- Include an artifact watermark showing the shortened downloader address.

## Proposed Implementation Slices

1. Add pure export helpers under
   `client/src/utilities/sessionResultsExport/`:
   - filename helpers
   - HTML escaping
   - snapshot schema normalizers
   - static HTML renderer
   - browser download helper
2. Extract or re-export pure data builders:
   - atlas tree flattening from `DebateMap`
   - risk matrix heatmap/comment helpers from `RiskMatrix`
   - argument-map normalizers for demo debate data
3. Add `buildSessionResultsSnapshot` orchestration for `SurveyResults` and
   `OnePageSession`.
4. Add the confirmation modal and `Export HTML Report` buttons.
5. Add login gating, exporter metadata, selected-section controls, and explicit
   unavailable reasons.
6. Add local/session-private AI analysis generation with synthetic participant
   ids and local address re-association.
7. Add unit tests for helpers and targeted component tests for the buttons/modal.
8. Add one browser/manual verification path for opening the exported HTML from a
   demo session and checking navigation/search.

## Test Plan

Unit tests:

- filename sanitization and timestamp formatting
- HTML escaping for unsafe text
- JSON embedding that cannot break out of the script tag
- redaction behavior for addresses/raw responses/encrypted fields
- atlas flattening preserves ids, parent paths, and links
- risk matrix heatmap snapshot matches existing helper output
- renderer includes required sections and anchors
- synthetic participant payloads omit addresses before AI calls
- generated analysis artifacts normalize into report/argument/risk/atlas
  sections and preserve local-only participant mapping

Component tests:

- `SurveyResults` renders `Export HTML Report` in the export area.
- `OnePageSession` exposes the action when Results are visible.
- Confirmation modal defaults to redacted mode.
- Download is disabled when no wallet is connected.
- Selected unavailable analysis sections require `Generate Analysis Views`.
- Clicking download calls the browser download helper with `.html` content or
  the PDF helper for single-page PDF.

Manual or Playwright smoke:

- Open a demo session.
- Hydrate results.
- Export HTML.
- Open the generated file.
- Verify table of contents, Report, Argument Map, Risk Matrix, Atlas Nodes,
  search, and embedded JSON download work.

Recommended targeted commands from `client/`:

```bash
npm test -- --watchAll=false --runTestsByPath <new-export-helper-tests> <touched-component-tests>
npm run lint
```

## Acceptance Criteria

- A logged-in authorized user can export an interactive `.html` viewer, a static
  single `.html` report, or a single-page `.pdf` report from a session results
  view.
- The file opens locally and remains navigable without network or wallet access.
- The report includes all available v1 sections:
  report, argument map, risk matrix, atlas nodes, and snapshot JSON.
- Missing sections render explicit unavailable states instead of breaking export.
- Missing sections show explicit unavailable reasons in the confirmation modal.
- AI-generated analysis uses synthetic participant ids in provider payloads and
  stores generated artifacts locally/session-privately with timestamp/signature
  metadata.
- Exported artifacts visibly show the shortened downloader address and embed the
  full downloader address in metadata.
- Redacted mode is the default and is covered by tests.
- Dynamic content is escaped and script-tag JSON embedding is safe.
- Existing CSV/JSON/PDF exports continue to work.
- No new production secrets, contract ABI changes, or ethers v6 migration.

## Open Questions

- Should the embedded snapshot JSON include enough raw aggregate data to
  regenerate charts, or only the simplified derived values used by the static
  renderer?
- Should a later v2 add a worker-backed signed archive manifest for provenance?
- Future PRD: session-level privacy settings should let participants choose
  whether their responses may be sent to AI for generated analysis.
- Future PRD: publish/sync generated analysis artifacts to shared storage
  such as Arweave so authorized viewers can reuse or refresh them.
