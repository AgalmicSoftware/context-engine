# Plan: Convert `/contracts` → `/docs` (user-facing docs page)

Status: **implemented 2026-08-06.** Originally planned against `dev`; retained as the implementation record for the `/contracts` compatibility migration.

## Context

The `/contracts` page today is a technical reference (per-session contract addresses + Solidity source, AI prompt templates, a .json bundle, and byte-conversion utils). The goal is to turn it into a proper **Docs** page: user-facing documentation (quickstart, a full guide to session options, FAQ) with the per-session smart-contract deployment info kept as a section — "for this session, contracts X/Y/Z are deployed at these addresses on chain N."

Decisions (confirmed with operator):

- Keep the **Smart Contracts** and **Prompts** sections; **drop** the .json Bundle and Utils converters.
- Content = Quickstart + FAQ + full guide to the different session options.
- No new dependencies — hand-authored typed content modules per repo convention (no markdown renderer).
- `/contracts` and all its deep links (Session Wizard emits `/contracts?contract=…`) redirect permanently to `/docs`.

## Key existing machinery to reuse

- `client/src/components/DocsPage/` — the implemented owner for the renamed page; `ContractViewer.tsx`, `contractMetadata.ts`, `contractViewerUtils.ts`, and `contractSourceLoader.ts` retain contracts-domain names.
- **Redirect precedent:** `routeTable.ts` already supports `canonicalPath` (the `/new` → `/session/new` alias, consumed in `mainSiteRouteRenderers.tsx` via `history.replaceState(buildPublicRoute(canonicalPath) + search + hash)`); `App.tsx` patches `replaceState` (`subscribeToHistorySync`) so the app re-renders and re-syncs head tags after the rewrite. Reuse this — just hoist the consumption out of the wizard-only branch.
- Session context: `contractPageSessionResolution.ts` (slug from `/docs/:slug` → `?session=` → Redux active slug → default `general`); `getChainLabelById` from `utilities/web3/chainGateway.js` (import precedent: `SbtPageFullView.tsx`) for "OP Sepolia (11155420)"-style labels.
- Copy sources (verify each claim in code before it ships): `About/AboutPage.tsx`, `spec.md`, `docs/session-creation-guide.md`, `docs/session-registry.md`, `docs/doc-library.md`, `docs/lit-protocol-information.md`, `docs/session-listening-mode.md`, and `utilities/session/sessionTypes.ts` (`SessionConfig` = ground truth for what's configurable). Use `t('sbt')`/`t('sbtFull')` from `utilities/ui/terminology.js` and `buildPublicRoute` for internal links.
- `routeConfig.ts` already has `'docs'` in `KNOWN_ROUTE_PREFIXES` and `isStaticNonCacheRoute` already matches `/docs` — a bare `/docs` currently 404s, so claiming it is clean. `/session/:slug/docs` (Session Doc Library) is a different feature and is safe: its matching requires first segment `session`. Don't touch `NAV_SESSION_DOCS`/`PAGE_SESSION_DOCS_ROOT`.

## Step 0 — Re-point branch onto dev

The working branch sits on the `main` lineage. Rebase it onto `dev` (`git rebase dev` — expect only this plan-doc commit to replay). Base every subsequent edit on dev file contents (`git show dev:<path>` when in doubt), never main-lineage bodies.

## Commit 1 — Mechanical rename, zero behavior change

The implementation moved the former ContractPage directory to `client/src/components/DocsPage`, then inside:

- `ContractPage.tsx` → `DocsPage.tsx` (component/props renamed; still renders all four old sections this commit)
- `ContractPage.module.scss` → `DocsPage.module.scss`
- `contractPageSessionResolution.ts`/`.test.ts` → `docsPageSessionResolution.ts`/`.test.ts` (exports `resolveContractPage*` → `resolveDocsPage*`)
- `ContractPage.render.test.tsx` → `DocsPage.render.test.tsx`; `ContractPage.metadata.test.tsx` → `contractMetadata.test.tsx`
- `ContractViewer.tsx` + tests, `contractMetadata.ts`, `contractViewerUtils.ts`, `contractSourceLoader.ts` unchanged (fix the SCSS import path in ContractViewer).

Update all external import sites `../ContractPage/` → `../DocsPage/` (~15 files): `MainSite/routeLazyComponents.ts`, `MainSite/mainSiteRouteRenderers.tsx`, and the Sessions wizard family (`sessionWizardContracts.ts`, `SessionWizardContractViewerModal.tsx`, `SessionWizardModals.tsx` + test, `SessionWizardContractsField.tsx` + test, `ContractsSection.test.tsx`, `SessionWizard.*.test.*`, `SessionWizard.workerPanel.testUtils`). Plus two tooling couplings that MUST land in this commit or jest fails:

- `client/eslint.config.mjs`: `typedContractPageComponentFiles` glob → `src/components/DocsPage/**` (two sites)
- `client/src/utilities/tooling/clientPackageContract.test.js` — **5 references** (glob string, eslint-const expectation ×2, `contractSourceLoader.ts` path ×2).

Gate: `cd client && npx tsc --noEmit` + jest for `DocsPage/`, `Sessions/`, `utilities/tooling/`.

## Commit 2 — Route `/docs`, permanent `/contracts` redirect, nav/testids/head

- `MainSite/routeTable.ts`: union key `'contracts'` → `'docs'`; matcher accepts both `/docs*` and `/contracts*`; add `canonicalPath` returning the path with `/contracts` prefix rewritten to `/docs` (else `undefined`).
- `MainSite/mainSiteRouteRenderers.tsx`: **hoist** the `canonicalPath` replaceState out of `if (isWizardRoute)` to right after route match resolution; `_renderContractsRoute` → `_renderDocsRoute` ("Loading Docs..." fallback); renderers map `contracts:` → `docs:`; wrapper div **loses** its testid (today `ce-page-contracts-root` renders twice — wrapper + page root; keep the new id only on the page root).
- `MainSite/mainSiteRouteViewMap.ts`: view key `'contracts'` → `'docs'`. `AppShell.tsx`: rename the renderer binding.
- `MainSite/routeConfig.ts`: no functional change; keep `'contracts'` prefix forever (legacy alias), add a comment.
- `DocsPage.tsx`: slug parsing accepts both first segments; **critical line** — the page's own URL-normalization effect must target `buildPublicRoute('/docs')` (if it still says `/contracts`, it fights the route canonicalPath in an infinite replaceState ping-pong); root div testid → `PAGE_DOCS_ROOT`.
- `DocsPage/contractMetadata.ts`: `buildContractsPageHref` → `buildDocsContractsHref`, emits `/docs?contract=&session=`; update consumers (`sessionWizardContracts.ts` + tests).
- `utilities/e2eTestIds.js` **and** `.ts` (manually mirrored pair): add `PAGE_DOCS_ROOT: 'ce-page-docs-root'`, `NAV_DOCS: 'ce-nav-docs'`; remove `PAGE_CONTRACTS_ROOT`, `NAV_CONTRACTS`.
- `Footer/Footer.tsx`: link → `buildPublicRoute('/docs')`, label `DOCS`. `E2E/DevE2eNav.tsx`: entry → `/docs` / `NAV_DOCS`.
- `utilities/ui/publicPageHead.ts`: `isContractsPath` → `isDocsPath` matching both prefixes (keeps `?contract=`/`?session=` in canonicals, pre- and post-redirect).
- Test updates in this commit: `routeTable.test.ts` (key rename, both-prefix classification, canonicalPath assertions `/contracts` → `/docs`, `/contracts/pe4` → `/docs/pe4`, `/docs` → undefined; **add guard** that only `wizard` + `docs` definitions emit canonicalPath), `publicPageHead.test.ts`, `Footer.test.tsx` (`DOCS`, `/ce/docs`), `sessionWizardContracts.test.ts`, `SessionWizardModals.test.tsx`, `SessionWizard.render.test.jsx`, `routeConfig.test.ts` (legacy `/contracts` stays static + `/docs` twin), and a **new redirect test** in `DocsPage.render.test.tsx`: seed `/contracts?contract=surveys&session=session-alpha`, `waitFor` pathname `/docs` with query intact.

### Redirect behavior spec

| Incoming | Result (`history.replaceState` — no extra history entry) |
|---|---|
| `/contracts` | `/docs` |
| `/contracts/pe4` | `/docs/pe4` (slug preserved, interpreted as session slug as today) |
| `/contracts?contract=surveys&session=pe4` | `/docs?contract=surveys&session=pe4` (query + hash verbatim) |
| `/ce/contracts?contract=surveys` (PUBLIC_URL=/ce) | `/ce/docs?contract=surveys` (base stripped for matching, re-applied by `buildPublicRoute`) |
| `/docs?sessionSlug=x` / `?s=x` | `/docs?session=x` (existing page normalization effect, retargeted) |
| `/session/:slug/docs` | untouched (Session Doc Library) |

## Commit 3 — Page conversion: new content, drop converters, session-context strip

New `client/src/components/DocsPage/docsContent.ts` — typed frozen collections, all copy here: `QUICKSTART_STEPS`, `GUIDE_TOPICS`, `FAQ_ITEMS` (shapes: `{id,title,body,linkHref?}` / `{id,title,summary,points[]}` / `{id,question,answer}`).

Page layout (top → bottom) in `DocsPage.tsx`, rendered by ONE generic `DocsSection` collapsible (button header, `aria-expanded`/`aria-controls`, caret — clone the existing Prompts toggle pattern):

1. **Header** — "Docs" h1 + one-liner. Must appear within the first 240 chars of body text (`vite-navigation-smoke` only scans `bodyText.slice(0, 240)`).
2. **Quickstart** (default open) — 6 steps: open a session (`/session/<slug>`), create passkey wallet (WebAuthn, no seed phrase / no crypto experience), answer questions & surveys (binary/rating/multiple-choice/freeform, conviction weighting, comments), optional doc uploads, view results (clusters/filters/exports), where data lives (Arweave + on-chain anchors; encrypted fields stay encrypted).
3. **Session options guide** (collapsed) — 8 topics, each verified against `SessionConfig`: chain/network (per-session `networkChainId`, OP Sepolia default); access gates (per-resource SBT gates — `default`, `questionResponses`, `surveyResponses`, `docUploads`, `docUrls`, `ai`, `arweave`, `rpc`, `txGas`, `lit` — with Any/All modes, SessionRegistry as authority); encrypted fields (Lit-encrypted prompts/tags/responses, SBT-gated decrypt); sponsored resources (worker-proxied AI/RPC/gas/Arweave/Lit, `/sponsor` bundles); session doc library (`/session/<slug>/docs`); AI features (question generation, listening mode, cluster summaries, analysis — powered by the prompts published below); block limits & listening mode; demo vs on-chain registry sessions.
4. **Prompts** (kept verbatim, collapsed).
5. **FAQ** (collapsed) — ~7 items: crypto experience needed? cost? where's my data? can answers be private? which chain am I on? what's an SBT? who sees results?
6. **Session and Smart Contracts group** (bottom frame) — the session-context strip and unchanged `ContractViewer` share one bordered container. The strip renders `Session: {sessionName || slug || 'Default (general)'} · Chain: {getChainLabelById(resolvedChainId)}` with testid `ce-docs-session-context`; the outer frame uses `ce-docs-session-contracts-group`. `resolvedChainId` = the already-computed `networkChainId || firstContract.chainId`, falling back to `DEFAULT_CHAIN_ID`.

Removals from `DocsPage.tsx`: .json Bundle + Utils sections — their state, handlers, `jsonBundleText` memo, JSX, and now-unused imports (`deserializeFilterState`, the arweaveEncoding trio). **Leave the utilities themselves alone** — `deserializeFilterState` and `arweaveEncoding` have many other consumers (BookmarksPage, AppShell, OnePageSession, SurveyTool, arweaveClient…). Prune dead SCSS (`.converterSection*`, `.utils*`, `.json*`) and style new sections with the page's existing `--retro-blue-*` + `--ce-*` tokens, honoring the high-contrast rules (`docs/design-system.md`).

Tests: `DocsPage.render.test.tsx` adds section-render (expand Quickstart, assert a step title), session-strip assertion, and absence assertions (`.json Bundle`/`Utils` gone); `contractMetadata.test.tsx` covers `buildDocsContractsHref` (+ PUBLIC_URL `/ce` variant). Update `scripts/vite-navigation-smoke.js`: `DEFAULT_ROUTES` gets `/docs` AND keeps `/contracts`; `DEFAULT_ROUTE_TEXT`: `'/docs': ['Docs']`, `'/contracts': ['Docs']` (proves the redirect end-to-end).

## Commit 4 — Docs/spec/changelog sweep

- `spec.md` Primary Routes: `/docs` entry (+ "/contracts redirects here") — spec's Update Policy mandates same-PR.
- The repository's E2E selector contract records `ce-nav-docs`/`ce-page-docs-root` and the two retired IDs.
- `docs/discoverability.md`, `docs/public-client-config.md`, `docs/bundle-budget.md`, and `CHANGELOG.md` record the public route and user-visible change; the private route/test inventories were updated alongside the implementation.
- Sweep: `git grep -n "/contracts" -- docs/ *.md client/src scripts` — every remaining hit must be contracts-the-domain or intentional legacy-alias code.

## Verification

Per commit: `cd client && npx tsc --noEmit` + targeted jest (client tests run **from `client/`**). Before PR: full client jest, `npm run test:node` (root harness incl. `e2eTestIds.compat.test.js`), and `node scripts/vite-navigation-smoke.js` against a local dev server — `/docs` renders "Docs", `/contracts` redirects and renders "Docs". Manual spot-check: `/ce/contracts?contract=surveys` deep link auto-opens the Surveys card on `/ce/docs`, session strip shows the correct chain label, footer link says DOCS.

## Risks / gotchas

1. **Redirect ping-pong** — the page normalization effect must target `/docs` (Commit 2 critical line).
2. **Hoisted replaceState blast radius** — `canonicalPath` now fires for any route defining it; the routeTable guard test pins the set to `wizard` + `docs`.
3. **Dev-vs-main drift** — base all edits on `git show dev:<path>`; the dev tip moves daily.
4. **Tooling couplings** — the eslint glob + `clientPackageContract.test.js` (5 refs) must move with the `git mv` in Commit 1.
5. **Retired testids** break external E2E harnesses loudly by design; the repository's selector-contract checks pin the migration.
6. **Copy accuracy** — nothing enters `docsContent.ts` without a verified code/doc source.
