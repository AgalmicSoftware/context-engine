---
name: ai-discourse-bench-results-sync
description: Detect and reconcile visual or structural drift between the standalone ai-discourse-bench HTML Results report and Context Engine's live OnePageSession Results components. Use when PolisReport, OnePageSession Results controls, DebateMap, RiskMatrix, DemoAnalysis, SurveyResults styles, or the benchmark render-html implementation changes; when the Results sync check fails; or before accepting a new standalone report parity snapshot.
---

# AI Discourse Bench Results Sync

Keep the standalone benchmark report aligned with live Context Engine Results while both implementations remain separate. Treat the hash snapshot as a drift alarm, not proof of visual parity.

## Workflow

1. Work from the dedicated benchmark worktree. Preserve unrelated checkout changes.
2. Run `npm run check:results-sync` from `ai-discourse-bench/`.
3. If it fails, read `data/context-engine-results-sync.json` and diff its `sourceCommit` against the current commit for every reported source path.
4. Inspect the changed live JSX and SCSS plus the corresponding sections in `src/render-html.mjs` and `test/report-surfaces.test.mjs`.
5. Port semantic structure, labels, accessibility behavior, breakpoints, and required style tokens. Do not copy SCSS module selectors blindly; the standalone HTML does not receive React's generated module class names.
6. Preserve benchmark-only integrity notices, model-participant semantics, analysis provenance, and preview/release distinctions even when live session markup lacks them.
7. Add or update focused report-surface tests for each behavior changed.
8. Run `npm test`, regenerate a representative report, and inspect desktop and mobile screenshots plus beeswarm and participant hover states.
9. Only after the port and visual check pass, run `npm run sync:results-snapshot` to accept the new live-source hashes.
10. Run `npm run check:results-sync` again and report the exact source files reviewed.

## Source Map

- `OnePageSession.tsx`, `OnePageSessionStandardShell.tsx`, and `OnePageSession.module.scss`: Results shell, mode controls, and pane ordering.
- `PolisReport.tsx` and `PolisReport.module.scss`: report sections, beeswarm, participant graph, and controls.
- `DebateMap.tsx` and `DebateMap.module.scss`: Debate Map structure and interactions.
- `RiskMatrix.tsx` and `RiskMatrix.module.scss`: matrix, selectors, and modal behavior.
- `DemoAnalysisWorkspace.tsx`, `WorldResultsMap.tsx`, and the workspace module stylesheet: Breakdown composition and country-map behavior.
- `SurveyResults.module.scss`: Raw Results and export surfaces.

## Guardrails

- Never update the snapshot merely to make the gate pass.
- Never reintroduce unrelated seeded Risk Matrix claims into measured benchmark output.
- Never allow incomplete or fixture runs to lose the visible Preview label.
- Keep one averaged model/question response as the participant-level unit; repeated runs remain nested observations.
- When Context Engine and the benchmark share a package or route in the future, replace this workflow with direct component imports and remove the duplicated renderer deliberately.
