# Architecture Overview

Start here when reviewing the repo for runtime boundaries, deployment surfaces,
and verification gates. This document links the source-of-truth docs instead of
duplicating their full detail.

## Client Boundary Model

The client follows the boundary accepted in
`docs/adr/0001-client-domain-boundaries.md`:

```text
route/page UI
  -> page-owned runtime wiring when needed
  -> purpose-specific ports and planners in client/src/domains/**
  -> low-level utilities in client/src/utilities/**
```

Route and page components should not import concrete low-level Web3, Arweave,
worker, or storage utilities directly. Domain ports may import low-level modules
and must preserve call-time object lookup where tests spy on object-style modules
such as `contractScripts`.

Primary navigation maps:

- `docs/MainSite.MAP.md`
- `docs/SurveyTool.MAP.md`
- `docs/contractScripts.MAP.md`
- `docs/AdminPage.MAP.md`
- `docs/SessionWizard.MAP.md`

## Enforcement System

The tracked checks work together:

- `npm run client-boundaries:check` runs
  `scripts/check-client-boundaries.mjs` and the zero-entry boundary baseline.
- `npm run type-debt:check` runs `scripts/check-type-debt-ratchet.mjs` against
  `scripts/type-debt-baseline.json`.
- CI runs baseline monotonicity in `.github/workflows/ci.yml`; baselines may
  shrink or stay flat unless an intentional rollout explicitly allows growth.
- `npm run verify:public-release-surface` prevents public files from importing
  stripped private paths.
- `npm run test:wiring` verifies test inventory, boundary checks, and text
  hygiene.
- `npm run verify:release` adds client lint, typecheck, full client tests,
  worker bundle build/sync, public surface verification, and the production
  client build.

## Worker Topology

The worker surface is documented in `docs/session-cors-worker.md`.

- `workers/sessionCorsWorker/` is the session worker. It handles AI proxying,
  transcription, Arweave uploads, storage routes, fetch helpers, auth, gates,
  faucet support, and sponsored/deploy-helper paths.
- `workers/deploy-helper/` is a separate helper worker used by `/new` and
  self-hosted deployments to call Cloudflare APIs, create the target worker and
  KV namespace, and seed initial session config/secrets.
- `workers/agentBridgeWorker/` is an agent/Telegram bridge worker. It is private
  to the full dev repo and stripped from the public release.
- `scripts/worker-bundle.mjs` bundles `sessionCorsWorker` and `deploy-helper`
  into `dist/`; `scripts/verify-worker-bundle-sync.mjs` verifies those bundles
  are in sync with source.

Auth decisions:

- `docs/adr/0002-worker-auth-revalidation.md` records 4-hour login tokens with
  `jti` markers in KV and fail-closed marker checks for authenticated routes.
- `docs/adr/0004-worker-auth-consistency-risk-acceptance.md` accepts the
  remaining cross-isolate KV consistency limits for nonce and rate-limit state.

## Storage Model

Arweave remains the durable public payload store for metadata, payloads, and
most uploaded images. The session worker also exposes canonical storage routes:

- `POST /storage/upload`
- `GET|POST /storage/read`
- `GET|POST /storage/list`

`docs/session-cors-worker.md` describes how those routes map to Arweave,
Cloudflare storage, worker envelopes, and gated access checks.

## Release And Public Surface

Use `docs/releasing.md` for public history replay and stripped artifact release
details. Use `docs/release-runbook.md` for the operator checklist. The strip
patterns live in `scripts/lib/public-release-strip-patterns.sh`, and the public
surface verifier makes imports into stripped paths fail locally and in CI.

## E2E Harness

The public smoke runner is `npm run test:e2e`, backed by the navigation smoke.
The private full-repo E2E layer includes session setup, SBT, survey, gated
decrypt, worker scope, and Cloudflare envelope/group suites. Details live in:

- `docs/e2e-setup.md`
- `docs/e2e-commands.md`
- `docs/e2e-cadence.md`

Private E2E entrypoints are intentionally stripped from the public release; the
public release keeps the lightweight smoke path and documentation.
