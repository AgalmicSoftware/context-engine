# Release Runbook

This runbook is the operator checklist for moving a reviewed tree toward a
public release. It summarizes the tracked sources in `package.json`,
`.github/workflows/ci.yml`, `.github/workflows/publish-worker-bundles.yml`,
`scripts/prepare-public-release.sh`,
`scripts/lib/public-release-strip-patterns.sh`, `scripts/worker-bundle.mjs`,
`scripts/verify-worker-bundle-sync.mjs`, and `docs/releasing.md`.

## Preflight

1. Use Node 20.19+ from the repo root.
2. Install reproducibly:
   - `npm ci`
   - `npm --prefix client ci`
   - `npm --prefix workers/sessionCorsWorker ci`
3. Confirm the release branch is clean and based on the intended integration
   branch.
4. Do not carry local `.env*`, `.keys/`, `.e2e-*`, `TODO/`, `artifacts/`, or
   generated build output into the release tree.

## Gates

The CI release gate is split across jobs, but the local release rehearsal should
run the same classes of checks:

```bash
npm run test:wiring
npm run type-debt:check
npm run client-boundaries:check
npm run verify:public-release-surface
npm run verify:release
```

`verify:release` expands to client lint, client typecheck, full client Jest,
public surface verification, worker bundle build, worker bundle sync
verification, and the client production build. Contract and worker package tests
run in separate CI jobs; run them locally when touching contracts, ABIs, worker
source, or worker dependencies:

```bash
npm run test:contracts
npm run test:worker:session-cors
npm run test:root:jest
npm run test:node
```

## Public Surface

The public release workflows strip private planning, local tooling, and
operator-only test material. The authoritative strip list is
`scripts/lib/public-release-strip-patterns.sh`; `docs/releasing.md` explains
the same list in prose.

Important stripped classes include:

- `TODO/`, private planning docs, Codex/Claude scratch state, and local caches.
- `.env*`, `.keys/`, `.e2e-secrets/`, `.e2e-cache/`, and generated artifacts.
- `contextEngine-cc/` and `workers/agentBridgeWorker/`.
- Private E2E runners under `scripts/test-*.js`, `scripts/test-*.ui.js`,
  `scripts/e2e/`, and `scripts/lib/e2e/`.
- Generated output such as `dist/`, `coverage/`, `broadcast/`, `cache/`, and
  prior `release-public/` folders.

`scripts/verify-public-release-surface.js` enforces that public JavaScript and
TypeScript files do not import stripped paths. The release rehearsal must stay
green after every strip-list change.

## Build And Publish

The worker bundle build has two targets:

- `workers/sessionCorsWorker/worker.js` -> `dist/sessionCorsWorker.bundle.js`
- `workers/deploy-helper/worker.js` -> `dist/deployHelper.bundle.js`

Build and verify them with:

```bash
npm run worker:bundle
npm run verify:worker-bundle
```

The `.github/workflows/publish-worker-bundles.yml` workflow publishes both
bundle files as GitHub release assets on pushes to public `main` or `master` and
marks the release as latest so the documented `releases/latest/download/...`
URLs continue to resolve.

For a stripped artifact release:

```bash
bash scripts/prepare-public-release.sh --force release-public
```

Then run the PII and secrets review from `docs/releasing.md` inside the stripped
output before publishing.

## Rollback

- Client build: redeploy the previous known-good static build or revert the
  client release commit and rerun `npm --prefix client run build`.
- Session worker bundle: redeploy the previous
  `sessionCorsWorker.bundle.js` release asset or rebuild from the previous
  known-good commit and verify with `npm run verify:worker-bundle`.
- Deploy helper bundle: use the same asset rollback pattern as the session
  worker for `deployHelper.bundle.js`.
- Contracts: contracts are redeploy-only in this repo. There is no upgrade
  procedure in tracked sources. Roll forward by deploying a corrected contract
  set and updating the configured addresses after review.
- Public history branch: rebuild the replay branch from the intended private
  source using the sync flow in `docs/releasing.md`; do not force-push `dev`
  itself.

## OPERATOR-CONFIRM

- Which hosting provider and environment currently serve the production client.
- Which Cloudflare account, worker names, KV namespaces, and release asset are
  considered production for each hosted worker.
- The exact production contract-address publication step after a redeploy.
- DNS and CDN cache-purge mechanics for the current hosting surface.
