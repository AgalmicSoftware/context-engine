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
npm run verify:public-release-pii -- release-public
```

## M1 Replay Procedure

M1 shipped on 2026-07-06 by merging `release-staging` into public `main` with a
history-preserving PR. The verified public base was `cee385f5d`, and the public
merge commit was `dc2974152`.

Use this procedure for a history-preserving release:

```bash
git fetch --prune origin
git ls-remote origin --heads main dev release-staging
npm run test:wiring
npm run type-debt:check
npm run typecheck:client
make release
npm run verify:public-release-pii -- release-public
bash scripts/sync-public-history.sh --dry-run release-staging
bash scripts/sync-public-history.sh --push release-staging
```

Before the operator opens or merges the PR, verify the replay branch with the
guardrails in `docs/releasing.md`: tip parity against the canonical artifact,
full-history stripped-path and commit-message sweeps, public identity audit,
public PII scan, wiring, type-debt, and public Node tests. For diverged-source
repairs, add one final `chore: true-up public tree to release artifact` commit
when the replayed tip differs from the canonical artifact.

For the artifact-only fallback:

```bash
git fetch --prune origin
make release
npm run verify:public-release-pii -- release-public
git switch release-staging
git reset --hard origin/main
# replace the release-staging working tree with release-public/ contents
git add -A
git commit -m "chore: refresh release staging source"
npm run test:wiring
npm run type-debt:check
npm run test:node
```

The operator push command for either prepared branch is:

```bash
git push origin release-staging --force-with-lease
```

Then open the comparison PR:

```text
https://github.com/AgalmicSoftware/context-engine/compare/main...release-staging
```

Post-merge, confirm the latest release asset:

```bash
bash scripts/verify-release-assets.sh
```

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
- Public main: prefer a normal revert PR for application bugs. Use an admin
  branch reset only for accidental-publication incidents, and guard it with
  `--force-with-lease=refs/heads/main:<expected-full-sha>`.
- Worker release asset: the `publish-worker-bundles` workflow creates a new
  latest release on every public `main` push. To roll back the default bundle
  URL, republish bundles from the previous known-good commit or mark that
  previous worker-bundle release as latest in GitHub.

## OPERATOR-CONFIRM

- Which hosting provider and environment currently serve the production client.
- Which Cloudflare account, worker names, KV namespaces, and release asset are
  considered production for each hosted worker.
- The exact production contract-address publication step after a redeploy.
- DNS and CDN cache-purge mechanics for the current hosting surface.
