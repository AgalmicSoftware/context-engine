## PRD 509: Coordinated Shell Cleanup For Remaining JSX Shells

**Priority:** High
**Status:** Active
**Category:** TypeScript migration / shell decomposition
**Created:** 2026-04-23

### Summary

The repo is down to three production `.jsx` surfaces still in the final shell-cleanup lane:

- `client/src/components/MainSite/MainSite.jsx` (`12955` lines)
- `client/src/components/SurveyTool/SurveyTool.jsx` (`15984` lines)
- `client/src/components/SurveyTool/DeferredCommitSlider.jsx` (`102` lines)

`SessionWizard` has already crossed to `.tsx`, but the remaining risk is still concentrated in a few large, stateful controller-shell surfaces plus one adjacent JSX leaf. These files should not be converted as isolated rename-only slices. They now need one coordinated cleanup plan that stabilizes shared contracts first, then converts the remaining JSX surfaces in dependency order.

Current production component count before this PRD lands: `110 TSX / 3 JSX`.

### Why A Coordinated Pass Is Needed

The remaining failures are no longer simple local annotation issues. A partial attempt on `SessionWizard` showed broad type pressure across:

- worker secret metadata payloads
- session draft/template normalization
- contract viewer payload shapes
- helper callback signatures
- lockable field prop contracts
- CSS style prop typing
- route-shell wiring and lazy import consumers

That pattern means one-file-at-a-time conversion now creates repeated churn in shared helper contracts. A coordinated shell cleanup should:

- define the shared payload and callback shapes once
- extract obvious shell-agnostic helpers before conversion
- convert shells in an order that reduces downstream rewrite
- keep verification focused and route-preserving

### Goals

- Convert the last three production `.jsx` files to `.tsx`
- Avoid behavioral regressions, route changes, and UI redesign
- Preserve runtime exports, lazy imports, tests, and existing caches
- Minimize repeated local `any` islands by stabilizing shared shell contracts first

### Non-Goals

- No public route changes
- No state model redesign
- No dependency additions
- No shell renaming during this pass
- No visual or interaction redesign

### Cleanup Structure

#### Phase 0: Stabilize Shared Shell Contracts

Create or normalize coarse shared types close to the remaining shells and their helper modules:

- worker secret snapshot / grant-token payloads
- session draft and template normalization payloads
- contract viewer contract rows
- lockable field frame props
- shell helper callback contracts for async worker/deploy flows
- style object helpers that currently infer too narrowly

Keep these types honest and coarse. Favor `Record<string, any>` over overfit domain modeling where behavior is already stable but shapes vary.

#### Phase 1: Convert `DeferredCommitSlider` First

`DeferredCommitSlider` is the safest remaining leaf and sits directly beside `SurveyTool`. Converting it first removes one JSX holdout without disturbing the larger route shells and gives the `SurveyTool` pass a slightly smaller local surface.

#### Phase 2: Convert `SurveyTool`

The earlier `SessionWizard` migration exposed the broad type pressure that still exists around the remaining shells:

- worker secret assembly
- registry/session metadata normalization
- sponsored bundle payload shaping
- contract viewer wiring
- deploy helper callback choreography

That lesson still matters here: convert `SurveyTool.jsx` while reusing the stabilized shell contracts and extracting any remaining non-UI helpers into adjacent utility modules where that reduces shell surface area.

Focus areas:

- response hydration / decrypt helpers
- question and survey cache coordination
- session scope resolution
- UI-state helper extraction where already latent in the file

#### Phase 3: Convert `MainSite` Last

`MainSite` should remain the final shell in this lane because it is the broadest route coordinator and lazy-import owner. By the time it is converted:

- `SurveyTool` and `DeferredCommitSlider` imports should already be `.tsx`
- route lazy helpers should already reference the final typed surfaces
- shell-wide helper contracts should already be settled

### Proposed Order

1. Shared shell contracts and helper extraction
2. `DeferredCommitSlider.jsx -> DeferredCommitSlider.tsx`
3. `SurveyTool.jsx -> SurveyTool.tsx`
4. `MainSite.jsx -> MainSite.tsx`

### File Organization Rules

- Keep shell-owned route glue inside the shell folders
- Move only clearly reusable non-UI logic into existing utility domains
- Do not mix naming cleanup with this pass
- Do not move files merely to “look cleaner” unless it materially reduces shell typing churn

### Verification Plan

Each phase should keep focused verification narrow and explicit.

#### Shared contract phase

- targeted `tsc` grep for `DeferredCommitSlider|SurveyTool|MainSite`
- touched unit tests for extracted helper modules

#### DeferredCommitSlider phase

- focused `tsc` lane for `DeferredCommitSlider`
- `SurveyTool.module.test.js`
- any directly affected deferred-submit interaction tests

#### SurveyTool phase

- focused `tsc` lane for `SurveyTool`
- `SurveyTool.module.test.js`
- `SurveyPage.test.tsx`
- `MainSite.routes.test.jsx`
- any directly affected question/response render tests

#### MainSite phase

- focused `tsc` lane for `MainSite`
- `MainSite.routes.test.jsx`
- `App.wagmiAutoConnect.test.tsx`
- route/lazy-import consumer tests that touch shell wiring

### Commit Strategy

Use separate commits:

1. shared shell contract prep
2. `DeferredCommitSlider` conversion
3. `SurveyTool` conversion
4. `MainSite` conversion
5. any final route-import cleanup if needed

### Done Criteria

- All three remaining production JSX files are `.tsx`
- `client/src/components` reaches `113 TSX / 0 JSX`
- No `@ts-nocheck` added
- Focused TypeScript lanes are clean for each shell phase
- Focused Jest rings pass for each shell phase
- No unrelated worktree files are staged or reverted

### Decision Gates

Pause only if one of these becomes true:

- a shared helper contract is used inconsistently across multiple shells and cannot be safely widened locally
- shell extraction would change route behavior or cache semantics
- a helper must be moved across domains in a way that changes public ownership instead of just reducing local shell complexity

### Roadmap Graphic

Planned companion asset for this PRD:

- `TODO/PRDs/assets/509_shell_cleanup_roadmap.png`
- `TODO/PRDs/assets/509_shell_cleanup_roadmap_v2.png`

Saved graphic:

- [509_shell_cleanup_roadmap.png](/Users/charlie/Desktop/xoCortex/projects/context-engine/TODO/PRDs/assets/509_shell_cleanup_roadmap.png)
- [509_shell_cleanup_roadmap_v2.png](/Users/charlie/Desktop/xoCortex/projects/context-engine/TODO/PRDs/assets/509_shell_cleanup_roadmap_v2.png)

The graphic should visualize the dependency-led order:

- Shared contracts
- DeferredCommitSlider
- SurveyTool
- MainSite
- final verification / zero-JSX finish line

### Post-SurveyTool Replication Plan

If the `SurveyTool` decomposition lands cleanly, the same operating model should be reused for the remaining large shell/runtime surfaces instead of inventing a new agent workflow for each file.

Target follow-on surfaces:

- `client/src/components/Sessions/SessionWizard.jsx`
- `client/src/components/MainSite/MainSite.jsx`

Execution principle:

- use the completed `SurveyTool` split as the template for commit sizing, controller/helper extraction, test cadence, doc updates, and decision gates
- keep shared semantics shared; do not duplicate orchestration only to make the split look cleaner
- stop only when the next step becomes architecturally ambiguous rather than merely repetitive

### Recommended Follow-On Order

1. Finish and stabilize `SurveyTool`
2. Reuse the same bounded extraction workflow for `SessionWizard`
3. Reuse the same bounded extraction workflow for `MainSite`
4. Perform a cross-surface review of all three splits
5. Run a browser-driven regression sweep across the site with an authenticated session

### Cross-Surface Review Goals

After all three surfaces have been decomposed, do a deliberate review for lingering structural issues:

- duplicated controllers or helpers that should be shared
- shell files that are still too large or still own multiple unrelated domains
- “temporary” compatibility wrappers that can now be simplified
- test gaps where extracted seams are only covered indirectly
- route, cache, decrypt, draft, or publish flows that became harder to reason about

This review should happen before broad browser regression sweeps so the follow-up interactive pass tests the intended architecture, not an obviously incomplete transitional state.

### Browser Regression Sweep Plan

After the structural work is complete and local focused tests are green, run a manual or agent-assisted browser pass across the app using a logged-in session provided by the user.

Goals:

- click through all major routes and tabs
- exercise the major creation, response, navigation, and settings surfaces
- look for console errors, stale loading states, broken buttons, missing data, layout regressions, or dead flows
- record lingering issues as concrete follow-up tasks rather than folding them into the decomposition commits silently

Suggested focus areas:

- `SurveyTool`
- `SessionWizard`
- `MainSite`
- session/demo and session detail routes
- account/login/settings surfaces
- any modal-heavy or cache-heavy screens touched by the shell/runtime splits

### Reusable Agent Prompt After SurveyTool

Use this prompt once the `SurveyTool` process is complete and stable.

```md
We are continuing the large-shell decomposition workflow in:

`/Users/charlie/Desktop/xoCortex/projects/context-engine`

`SurveyTool` has already gone through a successful bounded decomposition pass. Reuse that exact working style for the next large surfaces:

- `client/src/components/Sessions/SessionWizard.jsx`
- `client/src/components/MainSite/MainSite.jsx`

Read first:

- `TODO/PRDs/509_coordinated-shell-cleanup-for-remaining-jsx-shells.md`
- `TODO/PRDs/450_sessionwizard-agentic-composition-continuation.md`
- `TODO/PRDs/449_mainsite-agentic-runtime-decomposition-commit-plan.md`
- `docs/SurveyTool.MAP.md`
- `docs/SessionWizard.MAP.md`
- `docs/MainSite.MAP.md`

## Working style

Use Codex 5.5 as the implementation worker and next-step advisor.

At each transition point:

1. Ask Codex 5.5 for the next highest-value bounded step.
2. Prefer controller/helper extraction over duplicated shell logic.
3. Implement one semantic move at a time.
4. Add or strengthen focused tests where coverage is weak.
5. Run targeted Jest and TypeScript checks.
6. Update relevant docs and PRDs.
7. Commit.
8. Ask Codex 5.5 for the next bounded step.
9. Continue automatically.

Do not stop for ordinary refactor friction. Keep churning as long as the next step is bounded and low-to-moderate ambiguity.

## Quality bar

Tend toward:

- elegant code
- less duplication
- explicit ownership boundaries
- professional, modular structure
- strong regression coverage

Preserve behavior:

- no route changes
- no silent state-model rewrites
- no duplicated shared semantics just to make files smaller
- no dependency additions unless a human approves them

## Tests and verification

For every non-trivial refactor:

- add or update focused tests nearest to the extracted seam
- keep the large module/regression tests in the loop
- run targeted Jest first
- run `tsc` after meaningful seam changes

When the decomposition work is complete:

1. review the split across `SurveyTool`, `SessionWizard`, and `MainSite`
2. identify lingering architectural issues or duplicated seams
3. then run a browser-driven regression sweep

## Browser regression sweep

Assume the user can provide a logged-in browser session.

Once the structural work is stable:

- use the logged-in session
- click through all major parts of the site
- exercise creation, response, navigation, settings, and modal flows
- watch for console errors, dead buttons, stale loading, broken route transitions, or obvious layout regressions
- write down concrete follow-up fixes instead of hand-waving them

## Docs and planning

As you go:

- keep `docs/SessionWizard.MAP.md` and `docs/MainSite.MAP.md` current
- update `TODO/PRDs/450_sessionwizard-agentic-composition-continuation.md` and `TODO/PRDs/449_mainsite-agentic-runtime-decomposition-commit-plan.md` when the execution plan or boundary map changes
- add concise notes to the umbrella PRD if the reusable workflow evolves

## Commit style

Commit iteratively after each coherent seam lands and tests pass.

Use concise commit messages like:

- `refactor(autocoder): extract session wizard publish summary`
- `refactor(autocoder): extract app shell cache readiness controller`
- `test(autocoder): add session wizard publish regression coverage`
- `docs(autocoder): refresh main site ownership map`

Do not mention PRD numbers in commit messages.

## Stop only for real decisions

Stop and ask the user only if:

- full-mode and alternate-mode semantics appear to need to diverge
- the next move would duplicate shared logic instead of clarifying ownership
- there are two materially different architectural paths that would be hard to reverse
- tests expose ambiguous intended behavior rather than a clear regression
- a change would require a dependency addition, public route change, or contract/interface change

If you stop, present:

- the exact ambiguity
- 2-3 options
- pros and cons
- your recommendation

Begin with `SessionWizard`, continue into `MainSite`, and keep going autonomously until a real decision point appears.
```
