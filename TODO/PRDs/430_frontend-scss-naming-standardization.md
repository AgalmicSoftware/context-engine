# PRD 430 — Frontend SCSS Naming Standardization

## Integration Status - 2026-05-11

The first conservative naming slice is merged into
`autocoder/integration-agent-storage-modernization`, but this PRD is not
complete. Continue it only in small, isolated frontend slices that replace
styling-only IDs/selectors with semantic `className` or `data-testid` hooks and
run focused tests.

This is a good low-risk churn lane after Telegram work, but it should not be
mixed into the next Telegram bot context unless a Telegram UI/setup component
itself needs a tiny selector cleanup.

**Priority:** MEDIUM | **Effort:** LARGE | **Status:** Proposed | **Category:** Frontend Hygiene — CSS Modules / Naming / Testability
**Source:** User-requested follow-up to review of `InformationModals/Modals.module.scss` and broader SCSS naming cleanup on 2026-04-20

---

## Original Input

> please review my staged changes
>
> can we clean up scss names in modals.module.scss and/or elsewhere?
>
> i mean remove stuff like "ship" and "robot" from .scss, but I want to professionalize and standardize scss names across whole repo
>
> plaese just make this a prd instead of implementing it

---

## Summary

This PRD proposes a phased cleanup of legacy SCSS naming across the frontend, with the primary goal of replacing CSS-Module style hooks wired through `id={styles.*}` and asset-specific selector names with semantic class-based styling.

The work is intentionally framed as a sequence of mechanical, reviewable PRs rather than a single repo-wide rewrite. The first slice should target `InformationModals` and the welcome-slide configuration, then expand to the remaining legacy home-shell surfaces and larger component areas.

The outcome should be:

- semantic `className={styles.*}` styling hooks as the repo default
- real DOM `id` usage reserved for genuine document semantics
- asset/copy-specific selector names removed from styling contracts
- tests decoupled from CSS hook names and anchored to stable `data-testid` or semantic queries
- a lightweight audit script that measures remaining legacy ID-selector usage during the migration

---

## Problem

The frontend currently has two naming/stylescape dialects living side by side:

- newer modules like `CommunityTab.module.scss` already use semantic CSS Module classes
- older modules like `InformationModals/Modals.module.scss` and `MainContent.module.scss` still rely heavily on ID selectors and `id={styles.*}` style hooks

This causes several problems:

1. Styling hooks are encoded as DOM IDs rather than CSS Module classes.
2. Repeated UI elements sometimes receive style IDs even though IDs are meant to be unique.
3. Many selectors reflect artwork or stale copy rather than UI role, for example:
   - `betaViewerRobot`
   - `betaViewerShip`
   - `frontlinerImage`
   - `finalImage`
   - `greetingImage`
4. Some names are typo-prone or inconsistent, for example:
   - `betaExaplainerList`
   - `betaExplainerBulletpoint`
5. Higher-specificity ID selectors make incremental overrides and future cleanup harder.
6. Some tests assert raw CSS hook IDs, coupling tests to styling internals instead of stable UI contracts.

This makes the codebase feel less professional, harder to refactor mechanically, and less aligned with normal CSS Module usage.

---

## Goals

1. Standardize frontend SCSS naming around semantic CSS Module classes.
2. Replace `id={styles.*}` styling hooks with `className={styles.*}` across migrated surfaces.
3. Replace asset/content-specific selector names with role-based naming.
4. Preserve visuals, layout behavior, and user-facing behavior.
5. Preserve the stable E2E TestID API documented in `docs/e2e-testid-api.md`.
6. Make the migration measurable with an audit script and explicit burn-down criteria.

---

## Non-Goals

- redesigning the visual language of touched components
- rewriting Sass architecture globally beyond what is needed for selector cleanup
- adding a new classnames helper dependency
- changing route structure, product concepts, or content copy beyond selector contracts
- doing a single broad repo-wide rename in one PR
- removing valid DOM `id` attributes that are required for anchors, ARIA wiring, or third-party integration

---

## Current State

### Repo-level sizing

Current component-scope inventory from `client/src/components`:

- 50 `*.module.scss` files
- 23 `.module.scss` files still contain top-level ID selectors
- 172 JSX style hooks currently use `id={styles.*}`

### Heaviest legacy hotspots

Current large ID-selector concentrations include:

- `client/src/components/InformationModals/Modals.module.scss`
- `client/src/components/MainContent/MainContent.module.scss`
- `client/src/components/Navbar/Navbar.module.scss`
- `client/src/components/Account/Account.module.scss`
- `client/src/components/SurveyTool/SurveyTool.module.scss`

### Immediate `InformationModals` shape

The welcome-slide and modal surface currently spreads style contracts across:

- `client/src/components/InformationModals/Modals.module.scss`
- `client/src/components/InformationModals/SiteLoadOptions.jsx`
- `client/src/components/InformationModals/GreetingModal.jsx`
- `client/src/components/MainContent/welcomeSlides.js`

The slide data itself currently embeds raw styling hook names through fields like:

- `buttonStyleId`
- `imageStyleId`

That means slide configuration is coupled directly to legacy selector names such as `siteExplainerMultiply` and `betaViewerRobot`.

### Test coupling

Some current tests in `InformationModals` assert raw element IDs such as:

- `greetingImage`
- `siteExplainer`
- `betaExaplainerList`
- `betaSidebarDisappeared`

That test shape should migrate toward:

- stable `data-testid`
- semantic role/text queries
- class assertions where styling state is the behavior under test

---

## Standards

### Styling hook standard

- Use `className={styles.foo}` for styling hooks.
- Do not use `id={styles.foo}` for styling-only purposes.

### Allowed DOM ID usage

DOM `id` attributes remain allowed only when they are needed for:

- hash-link targets
- ARIA relationships
- third-party library requirements
- explicit user-facing identifiers that genuinely benefit from a DOM ID

### Test stability

- Preserve the existing `ce-*` `data-testid` API.
- When tests currently rely on styling IDs, migrate them to:
  - existing `data-testid`
  - semantic queries
  - new stable `data-testid` only when necessary

### Naming contract

- Use camelCase for CSS Module exports.
- Prefer UI role + state + variant naming.
- Use `is...` or `has...` for stateful classes.
- Do not encode artwork, implementation history, or stale product copy in selector names unless the term is truly domain-meaningful.

---

## Naming Rules

### Welcome-slide image selectors

Replace asset/content names with semantic role-based names:

- `greetingImage` → `welcomeSlideImageIntro`
- `betaViewerRobot` → `welcomeSlideImageToolkit`
- `betaViewerShip` → `welcomeSlideImageGoals`
- `betaViewerSeedsman` → `welcomeSlideImageAudience`
- `frontlinerImage` → `welcomeSlideImageMotivation`
- `finalImage` → `welcomeSlideImageCollaborators`

The shared concept should be a base `welcomeSlideImage` role plus semantic variants where needed.

### Welcome-slide media button selectors

Replace:

- `siteExplainer`
- `siteExplainerMultiply`

with a semantic media-button contract centered on:

- `welcomeSlideMediaButton`

Layout-specific behavior should be driven by:

- `data-slide-layout`
- semantic modifier classes only when required

### Welcome-slide bullet selectors

Replace:

- `betaExaplainerList`
- `betaExplainerBulletpoint`
- `betaExplainerBulletText`

with:

- `welcomeSlideBulletList`
- `welcomeSlideBulletItems`
- `welcomeSlideBulletText`

Keep:

- `betaExplainerBulletTrailingText`

only if renamed to a semantic equivalent such as `welcomeSlideBulletTrailingText`.

### Visibility / state selectors

Replace names like:

- `betaSidebarDisappeared`
- `betaInfoInvisible`
- `visibleMetricsDetails`
- `invisibleMetricsDetails`
- `invisibleModal`

with state-oriented names such as:

- `isSidebarCollapsed`
- `isHidden`
- `isOpen`
- `isClosed`

The exact name should describe the UI state, not the implementation trick.

---

## Proposed Direction

The repo should adopt a hybrid migration path:

- semantic CSS Module classes are the target standard
- migration happens in mechanical, scoped phases
- each PR burns down a clearly bounded surface area

This avoids a risky big-bang rewrite while still producing a consistent end state.

---

## Implementation Plan

### Phase 1 — `InformationModals` and welcome-slide config

Target files:

- `client/src/components/InformationModals/Modals.module.scss`
- `client/src/components/InformationModals/SiteLoadOptions.jsx`
- `client/src/components/InformationModals/GreetingModal.jsx`
- `client/src/components/MainContent/welcomeSlides.js`
- related `InformationModals` tests

Required changes:

1. Convert styling-only `id={styles.*}` usage in these components to `className={styles.*}`.
2. Rename welcome-slide selectors to semantic role-based names.
3. Replace slide-config fields `buttonStyleId` and `imageStyleId` with semantic variant keys.
4. Make `SiteLoadOptions.jsx` the mapping layer between slide config and CSS Module classes.
5. Convert repeated styled elements like bullet text/list containers to classes.
6. Update unit tests to stop asserting raw styling IDs.
7. Fold the current `Modals.module.scss` bullet-list cleanup into this phase.

Acceptance for Phase 1:

- touched modal files contain zero styling-only `id={styles.*}` hooks
- touched SCSS files contain zero top-level ID selectors for migrated hooks
- welcome-slide data no longer references asset-specific selector names
- related modal tests pass

### Phase 2 — legacy home-shell surfaces

Target areas:

- `MainContent`
- `Navbar`
- `Footer`
- `RightSidebar`

Required changes:

1. Convert home-shell styling hooks from ID-based CSS Modules to class-based CSS Modules.
2. Align selector naming with the already-modern style seen in `CommunityTab.module.scss`.
3. Keep DOM shape and layout behavior unchanged.

Acceptance for Phase 2:

- touched home-shell JSX no longer uses styling-only `id={styles.*}`
- touched SCSS modules no longer rely on top-level ID selectors

### Phase 3 — medium-risk mixed modules

Target areas:

- `PolisReport`
- `MainSite`
- `SBTs`
- `UserPage`
- `OnePageSession`

Required changes:

1. Migrate one bounded subsystem per PR.
2. Keep each PR focused on naming and selector-style conversion only.
3. Avoid bundling unrelated UX or logic work into the cleanup.

### Phase 4 — largest legacy surfaces

Target areas:

- `SurveyTool`
- `Account`

Required changes:

1. Break migration into sub-passes due to size and test coupling.
2. Convert styling IDs, rename selectors semantically, and update tests in narrow slices.
3. Do not combine these migrations with feature work.

---

## Cross-Phase Tooling

Add a repo audit script that reports:

- `.module.scss` files containing top-level `#...` selectors
- JSX files containing `id={styles.*}` style hooks

The script should:

- run from the repo root
- be safe to run locally and in CI
- produce a compact per-file summary
- serve as the burn-down tracker for the migration

Suggested output should include:

- total `.module.scss` count
- total SCSS files with ID selectors
- total JSX style-hook ID usages
- top remaining offender files by count

This script should become the acceptance guardrail for each future migration PR, even if it is not enforced as a hard CI blocker immediately.

---

## Testing And Acceptance

### Testing approach

For each migration PR:

1. Run focused Jest suites for the touched component area.
2. Run at least one broader client smoke pass for surfaces whose tests are updated.
3. Keep E2E selectors stable by preserving or adding `data-testid` where needed.

### Acceptance criteria

For every touched file set:

- visuals remain materially unchanged
- layout behavior remains unchanged
- no stable E2E `data-testid` contract is broken
- no touched JSX uses styling-only `id={styles.*}`
- no touched `.module.scss` relies on top-level ID selectors for migrated hooks
- new selector names are semantic and role-based

### Phase 1-specific acceptance

Phase 1 must preserve:

- `data-slide-layout` behavior
- titleless-slide bullet alignment behavior
- dimmed trailing bullet-copy behavior
- modal open/closed/sidebar-collapsed behavior

while moving tests away from styling-hook ID assertions.

---

## Risks

### Risk: accidental visual regressions

Mitigation:

- keep each PR narrow
- rely on focused tests and small reviewable diffs
- avoid unrelated CSS cleanup inside the same PR

### Risk: test churn from selector migration

Mitigation:

- anchor tests to `data-testid` and semantic behavior
- add stable test hooks where the current test depends on styling internals

### Risk: inconsistent halfway state

Mitigation:

- explicitly document that the repo will be mixed-style during migration
- use the audit script as the shared source of truth for what remains

### Risk: over-refactoring during cleanup

Mitigation:

- treat this as a naming and styling-hook standardization effort, not a redesign
- defer visual or structural improvements to separate PRDs

---

## 2026-05-10 Implementation Notes

Completed the first conservative Phase 1 slice in commit `3533f5a1`:

- Converted `InformationModals` styling-only `id={styles.*}` hooks to semantic `className` hooks in `GreetingModal.tsx`, `SiteLoadOptions.tsx`, and `WelcomeSlideRenderer.tsx`.
- Replaced welcome-slide config fields `buttonStyleId` and `imageStyleId` with semantic `mediaButtonVariant` and `imageVariant` keys.
- Renamed the welcome-slide SCSS selectors to role/state names, including media button/image variants, bullet-list hooks, sidebar collapsed state, hidden panels, and the welcome-slide embed/layout wrappers.
- Updated modal tests away from raw CSS ID selectors and toward `data-testid`, semantic queries, and class assertions for state/layout behavior.

Verification:

```text
InformationModals SiteLoadOptions/GreetingModal/Modals.module tests + OnboardingOverlay test: PASS, 4 suites, 12 tests
npx tsc --noEmit --pretty false: PASS
git diff --check: PASS
```

Follow-up notes:

- `Modals.module.scss` now has no remaining top-level selector IDs for migrated hooks; `#` matches in the file are color literals.
- The audit script was not added in this slice to keep the change limited to the approved InformationModals/welcome-slide surface.
- Later PRD 430 passes should continue with the home-shell hotspots and can add the audit script as a separate mechanical commit.

---

## Open Questions

These do not block the PRD, but they should be resolved before or during implementation:

1. Should the audit script become a required CI check once the first two phases land?
2. Should a short frontend naming contract be added to `docs/` after Phase 1, or should this PRD remain the canonical reference until the migration is farther along?
3. Should `cx`/`classnames`-style composition remain manual, or should the repo continue using string templates consistently everywhere?

Default assumption for implementation:

- no new dependency is introduced
- composition remains manual
- the audit script starts as informational before becoming gating

---

## Recommended First PR Slice

The first implementation PR should be limited to:

- `InformationModals`
- `welcomeSlides.js`
- modal tests
- the audit script if it fits cleanly

It should not expand into `MainContent`, `Navbar`, `SurveyTool`, or `Account` in the same change.

That keeps the first slice mechanical, testable, and aligned with the user’s original request that began in `Modals.module.scss`.
