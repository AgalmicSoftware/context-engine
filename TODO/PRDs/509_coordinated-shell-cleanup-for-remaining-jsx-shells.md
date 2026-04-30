## PRD 509: Coordinated Shell Cleanup For Remaining JSX Shells

**Priority:** High  
**Status:** Draft  
**Category:** TypeScript migration / shell decomposition  
**Created:** 2026-04-23

### Summary

The repo is down to three production `.jsx` shells:

- `client/src/components/MainSite/MainSite.jsx` (`12998` lines)
- `client/src/components/Sessions/SessionWizard.jsx` (`8504` lines)
- `client/src/components/SurveyTool/SurveyTool.jsx` (`16106` lines)

Everything else in the migration lane is already on `.tsx`, leaving the final risk concentrated in a few large, stateful controller-shell surfaces. These files should not be converted as isolated rename-only slices. They now need one coordinated cleanup plan that stabilizes shared contracts first, then converts the shells in dependency order.

Current production component count before this PRD lands: `100 TSX / 3 JSX`.

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

#### Phase 1: Convert `SessionWizard` First

`SessionWizard` is the highest-leverage shared shell because it owns the most cross-cutting payload construction:

- worker secret assembly
- registry/session metadata normalization
- sponsored bundle payload shaping
- contract viewer wiring
- deploy helper callback choreography

Once its shared contracts are stabilized, later shell conversions should require less local containment.

#### Phase 2: Convert `SurveyTool`

After `SessionWizard`, convert `SurveyTool.jsx` while reusing the stabilized shell contracts and extracting any remaining non-UI helpers into adjacent utility modules where that reduces shell surface area.

Focus areas:

- response hydration / decrypt helpers
- question and survey cache coordination
- session scope resolution
- UI-state helper extraction where already latent in the file

#### Phase 3: Convert `MainSite` Last

`MainSite` should remain the final shell in this lane because it is the broadest route coordinator and lazy-import owner. By the time it is converted:

- `SessionWizard` and `SurveyTool` imports should already be `.tsx`
- route lazy helpers should already reference the final typed surfaces
- shell-wide helper contracts should already be settled

### Proposed Order

1. Shared shell contracts and helper extraction
2. `SessionWizard.jsx -> SessionWizard.tsx`
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

- targeted `tsc` grep for `SessionWizard|SurveyTool|MainSite`
- touched unit tests for extracted helper modules

#### SessionWizard phase

- focused `tsc` lane for `SessionWizard`
- `SessionWizard.render.test.jsx`
- `SessionWizard.blankBundle.render.test.tsx`
- `SessionWizard.sponsoredBundle.test.jsx`
- `SessionWizard.workerVerification.test.js`
- `SessionWizard.allowedOrigins.test.js`
- `MainSite.routes.test.jsx`

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
2. `SessionWizard` conversion
3. `SurveyTool` conversion
4. `MainSite` conversion
5. any final route-import cleanup if needed

### Done Criteria

- All three remaining production shell files are `.tsx`
- `client/src/components` reaches `103 TSX / 0 JSX`
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
- SessionWizard
- SurveyTool
- MainSite
- final verification / zero-JSX finish line
