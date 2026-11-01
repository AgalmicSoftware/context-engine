# Context Engine Results Sync

The standalone HTML report currently ports the visual vocabulary of Context
Engine's live Results view. Until the benchmark and client can import shared
components directly, a hash gate makes upstream drift explicit.

## Check For Drift

From `ai-discourse-bench/`:

```bash
npm run check:results-sync
```

The command hashes the canonical OnePageSession, PolisReport, Debate Map,
Breakdown, Risk Matrix, and Survey Results source files in the parent Context
Engine checkout and compares them with
`data/context-engine-results-sync.json`. It fails and lists changed paths when
the client has moved ahead of the standalone renderer.

Use the repository skill when drift is reported:

```text
$ai-discourse-bench-results-sync
```

The portable skill source is
`ai-discourse-bench/skills/ai-discourse-bench-results-sync/`. Tool-specific
installed copies are mirrors and may remain gitignored.

The skill requires a semantic port and visual verification. It does not blindly
copy CSS module files, because generated class names, React state, and live
session dependencies do not transfer directly into a static artifact.

After the report has been updated, tested, and checked at desktop and mobile
sizes, accept the new source baseline:

```bash
npm run sync:results-snapshot
```

The snapshot records the source commit and per-file hashes. It is a drift
detector, not proof of visual parity by itself.

The latest shell review covers the conditional test-ETH offer beside the
session title in `OnePageSessionStandardShell.tsx`. It does not change Results
structure, controls, or styles. Benchmark reports have no session faucet, so
they do not render that offer. Report tests and desktop/mobile interaction
checks confirmed that the existing Results presentation remains aligned.

The accompanying `OnePageSession.tsx` review preserves the canonical Worker
session identity when a demo route uses a display alias. This changes answer
draft scoping, without changing Results structure or presentation. Fresh report
tests and browser checks at 1280px, 390px, and 320px confirmed the existing
standalone rendering, including beeswarm and participant hover states.

The 0.9.0 contrast review ports the responsive Raw Results title sizing and
word wrapping from `SurveyResults.module.scss`, along with paired primary-action
colors for its export buttons. Risk Matrix title colors are scoped to their
own modal so they cannot override the light Results heading. Export controls
retain their visible download names in the accessibility tree. The standalone
modal already uses explicit dark
text on light backgrounds for its table, disclosures and information notices;
it does not render live question-response cards, bookmarks, synchronization
controls, or group notices. The binary summary changes in
`SingleQuestionResponse.module.scss` do not affect its distribution charts.

The accompanying review covers `OnePageSession.module.scss`,
`OnePageSession.tsx`, and `OnePageSessionStandardShell.tsx`: context-source
management, per-question agent submission state, and the removal of the session
Join panel do not alter the standalone Results shell. The benchmark has neither
live session administration nor participant authentication. Its integrity,
preview and model-participant notices remain intact. Browser checks include
Raw Results title geometry and export-button default/hover/focus contrast at
1280px, 653px, 390px and 320px, plus the existing beeswarm and participant states.

## Intended Migration

When repository boundaries permit it, replace the copied renderer vocabulary
with a shared report-data adapter and direct imports of the live Results
components. Keep benchmark aggregation, release eligibility, manifests, and
analysis-overlay validation in this package; move only presentation contracts
and reusable view components into a shared client boundary. At that point the
hash snapshot and sync skill can be removed.
