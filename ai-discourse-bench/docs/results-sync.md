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
`skills/ai-discourse-bench-results-sync/`. Repository-local `.codex/skills` and
`.claude/skills` copies are installed mirrors and may remain gitignored.

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

## Intended Migration

When repository boundaries permit it, replace the copied renderer vocabulary
with a shared report-data adapter and direct imports of the live Results
components. Keep benchmark aggregation, release eligibility, manifests, and
analysis-overlay validation in this package; move only presentation contracts
and reusable view components into a shared client boundary. At that point the
hash snapshot and sync skill can be removed.
