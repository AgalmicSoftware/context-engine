# PRD 547 - Split Client Dev Tooling Out Of Production Dependencies

## Integration Status - 2026-05-11

The first production dependency split is merged into
`autocoder/integration-agent-storage-modernization`: obvious build/test/static
serving packages moved to `devDependencies`, while runtime packages stayed in
`dependencies`. The production audit surface is smaller, but this PRD is not a
complete dependency modernization.

Remaining work is a separate client runtime/toolchain lane: runtime advisories
for packages such as `ethers` v5, `jspdf`, router/map/Markdown/wallet/storage
dependencies, and the CRA 4 / TypeScript 5 / Node 20 build split. Do not mix
that work into the Telegram bot continuation.

**Priority:** HIGH | **Effort:** MEDIUM | **Status:** Draft | **Category:** Supply Chain / Client Tooling
**Created:** 2026-05-02

---

## Summary

Move client build, test, lint, dev-server, and analysis tooling out of `client/package.json` `dependencies` and into `devDependencies`, then verify the production dependency surface with `npm audit --omit=dev`.

This is not a full CRA/Vite migration. It is a focused supply-chain hygiene step that reduces false production audit noise and makes the actual runtime dependency boundary easier to reason about.

## Problem

The 2026-05-02 Trail of Bits-style audit found that:

```bash
cd client && npm audit --omit=dev
```

reports 308 vulnerabilities:

- 10 critical
- 105 high
- 172 moderate
- 21 low

Many advisories are from build/test/dev tooling such as CRA 4, Webpack 4, Jest, dev server middleware, loaders, source-map tools, and static serving. They currently appear in production audit output because several tooling packages live under `dependencies`.

This makes it hard to answer two basic questions:

- What vulnerable packages are actually shipped to the browser/runtime?
- What vulnerable packages are only used by local/CI tooling?

## Goals

- Move dev-only packages from `dependencies` to `devDependencies`.
- Preserve existing install behavior, including the `client/.npmrc` peer-dependency contract.
- Keep `ethers` on v5.
- Make `npm audit --omit=dev` a meaningful production-runtime signal.
- Produce a before/after dependency and audit summary.
- Avoid mixing this with the full CRA exit or Vite migration.

## Non-Goals

- Do not upgrade to ethers v6.
- Do not replace CRA/Webpack in this PRD.
- Do not remove runtime packages unless verified unused in production code.
- Do not force peer-dependency upgrades as part of the split.
- Do not change app behavior.

## Candidate Packages To Move

Initial likely dev/tooling packages currently in `dependencies`:

- `@babel/core`
- `babel-jest`
- `eslint-plugin-prettier`
- `node-polyfill-webpack-plugin`
- `raw-loader`
- `react-scripts`
- `sass-loader`
- `serve`
- `source-map-explorer`
- `source-map-loader`
- `webpack`

Conditional candidates requiring import/config verification:

- `@babel/runtime`
- `sass`
- any package used only by build config but not by browser runtime

Do not move without deeper verification:

- `ethers`
- `react`
- `react-dom`
- `react-router`
- `react-router-dom`
- wallet, crypto, Arweave, Lit, survey, visualization, UI, and runtime packages

## Proposed Approach

### 1. Build a dependency classification table

For every direct client dependency, classify as:

- browser runtime
- build/test/lint/dev tool
- static serving/deploy tool
- unknown

Use targeted searches:

```bash
rg "<package>" client/src client/config client/config-overrides.js client/scripts
rg "import\\(.*<package>|require\\(['\\\"]<package>" client/src client/config client/config-overrides.js client/scripts
```

### 2. Move obvious tooling packages first

Edit only `client/package.json` and refresh `client/package-lock.json` with normal client install semantics:

```bash
cd client && npm install
```

Do not use broad `npm audit fix` in this PRD.

### 3. Verify production install shape

Run:

```bash
cd client && npm audit --omit=dev
cd client && npm run build
cd client && npm test -- --watchAll=false --runTestsByPath <focused smoke suites>
```

If the production audit still includes toolchain packages, identify the dependency chain and decide whether it is genuinely runtime or still misplaced.

### 4. Document remaining advisories by runtime relevance

Create a short output note in the PR or PRD implementation section:

- advisories removed from production audit by dependency split
- advisories that remain because they are runtime dependencies
- advisories that remain because a runtime package pulls old tooling transitively
- advisories deferred to modernization PRDs

## Acceptance Criteria

- `client/package.json` has dev/build/test/lint/analyze/serve tooling under `devDependencies`.
- `client/package-lock.json` is refreshed without using forced peer overrides beyond the repo's existing install contract.
- `npm audit --omit=dev` from `client/` no longer reports CRA/Webpack/Jest/dev-server advisories as production dependencies unless pulled by a true runtime package.
- `npm run build` from `client/` passes.
- Focused client smoke tests pass.
- The before/after audit counts are recorded.
- Any remaining critical/high production advisories are listed with owner and remediation path.

## Test Plan

Commands:

```bash
cd client && npm install
cd client && npm audit --omit=dev
cd client && npm run build
cd client && npm test -- --watchAll=false --runTestsByPath src/components/MainSite/MainSite.module.test.js src/components/SurveyTool/SurveyTool.module.test.js
```

If focused test paths differ after current repo state, choose equivalent high-signal client smoke suites and record the actual commands.

## Risks

- Some packages that look dev-only may be imported by CRA runtime shims or config overrides.
- Moving `sass` may affect runtime style builds in environments that install only production dependencies but still run builds there.
- Deployment environments that currently run `npm install --omit=dev` and then build the client would break. Deployment docs must state whether builds require dev dependencies.

## Rollout Plan

1. Land dependency split only.
2. Record audit delta.
3. Open follow-up PRDs or issues for true runtime advisories.
4. Continue the broader CRA/Vite modernization separately.

---

## Implementation Notes - 2026-05-10 Autocoder Pass

Direct dependency classification used for this pass:

| Package | Classification | Decision |
|---|---|---|
| `@babel/core` | build/test tool | moved to `devDependencies` |
| `@babel/runtime` | browser runtime helper | kept in `dependencies` |
| `@dnd-kit/core` | browser runtime UI | kept |
| `@dnd-kit/sortable` | browser runtime UI | kept |
| `@fortawesome/fontawesome-svg-core` | browser runtime UI | kept |
| `@fortawesome/free-brands-svg-icons` | browser runtime UI | kept |
| `@fortawesome/free-solid-svg-icons` | browser runtime UI | kept |
| `@fortawesome/react-fontawesome` | browser runtime UI | kept |
| `@metamask/eth-sig-util` | browser runtime wallet/crypto | kept |
| `@noble/secp256k1` | browser runtime crypto | kept |
| `@rainbow-me/rainbowkit` | browser runtime wallet | kept |
| `@tanstack/react-query` | browser runtime cache | kept |
| `arweave` | browser runtime storage | kept |
| `babel-jest` | test tool | moved to `devDependencies` |
| `crypto-js` | browser runtime crypto | kept |
| `d3` | browser runtime visualization | kept |
| `d3-scale` | browser runtime visualization | kept |
| `eslint-plugin-prettier` | lint tool | moved to `devDependencies` |
| `ethers` | browser runtime web3, pinned v5 | kept |
| `hark` | browser runtime audio | kept |
| `html2canvas` | browser runtime export/rendering | kept |
| `jspdf` | browser runtime export/rendering | kept |
| `ml-kmeans` | browser runtime analysis | kept |
| `networkanalysis-ts` | browser runtime analysis | kept |
| `node-polyfill-webpack-plugin` | build tool | moved to `devDependencies` |
| `poseidon-lite` | browser runtime crypto | kept |
| `prop-types` | browser runtime React compatibility | kept |
| `qrcode.react` | browser runtime UI | kept |
| `raw-loader` | build loader for contract source imports | moved to `devDependencies` |
| `react` | browser runtime UI | kept |
| `react-dom` | browser runtime UI | kept |
| `react-redux` | browser runtime state | kept |
| `react-router` | browser runtime routing | kept |
| `react-router-dom` | browser runtime routing | kept |
| `react-scripts` | CRA build/test/dev tool | moved to `devDependencies` |
| `react-simple-maps` | browser runtime visualization | kept |
| `reactstrap` | browser runtime UI | kept |
| `recordrtc` | browser runtime media | kept |
| `redux` | browser runtime state | kept |
| `redux-thunk` | browser runtime state | kept |
| `remark-gfm` | browser runtime Markdown rendering support | kept |
| `sass` | Sass compiler for SCSS build | moved to `devDependencies` |
| `sass-loader` | build loader | moved to `devDependencies` |
| `serve` | static serving/deploy helper | moved to `devDependencies` |
| `source-map-explorer` | analysis tool | moved to `devDependencies` |
| `source-map-loader` | build loader | moved to `devDependencies` |
| `superstruct` | browser runtime validation | kept |
| `umap-js` | browser runtime analysis | kept |
| `viem` | browser runtime web3 | kept |
| `wagmi` | browser runtime wallet/web3 | kept |
| `webpack` | CRA/Webpack build tool, pinned v4 | moved to `devDependencies` |
| `zod` | browser runtime validation | kept |

Moved packages:

```text
@babel/core
babel-jest
eslint-plugin-prettier
node-polyfill-webpack-plugin
raw-loader
react-scripts
sass
sass-loader
serve
source-map-explorer
source-map-loader
webpack
```

Audit delta:

| Command | Low | Moderate | High | Critical | Total |
|---|---:|---:|---:|---:|---:|
| `npm audit --omit=dev --json` before split | 21 | 158 | 111 | 10 | 300 |
| `npm audit --omit=dev --json` after split | 15 | 31 | 17 | 3 | 66 |

Remaining production advisories are runtime-owned, not CRA/Webpack/Jest tooling-owned. Direct runtime packages still represented in the production audit include:

- `ethers` and `@ethersproject/*`: deferred because `ethers` must stay pinned to v5 until a separately approved runtime migration.
- `jspdf`: runtime export path; upgrade needs PDF/export regression coverage.
- `react-router` / `react-router-dom`: runtime route behavior; upgrade needs route and deep-link regression coverage.
- `react-simple-maps`: runtime visualization path; upgrade needs map/render smoke coverage.
- `arweave`, `wagmi`, `remark-gfm`: runtime storage/wallet/Markdown paths; upgrade or replacement needs targeted runtime review.

Verification:

```bash
cd client && npm install
cd client && npm audit --omit=dev --json
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/utilities/tooling/clientPackageContract.test.js \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/SurveyTool.compat.test.js \
  src/components/MainSite/MainSite.routes.test.jsx
cd client && npx tsc --noEmit --pretty false
git diff --check
```

Build verification:

```bash
cd client && npm run build
```

Result on the default Node 20 shell: FAIL before app compilation with Webpack 4/OpenSSL 3 `ERR_OSSL_EVP_UNSUPPORTED`.

Rerun on the frontend-supported Node line:

```bash
cd client && source ~/.nvm/nvm.sh && nvm use 16 && npm run build
```

Result: PASS with existing React hook warnings in `DocumentLibraryPanel.tsx` and `SurveyTool.tsx`.

Focused tests: PASS, 4 suites, 319 tests.
`npx tsc --noEmit --pretty false`: PASS.
`git diff --check`: PASS.

## Related PRDs

- PRD 021 - Dependency audit cleanup
- PRD 383 - Easy client dependency peel-offs
- PRD 385 - Client supply chain prune and local replacements
- PRD 396 - Client modernization sequencing
- PRD 436 - Client Vite compatibility contract and gradual CRA exit
- PRD 541 - Client toolchain install contract after browser Lit removal
