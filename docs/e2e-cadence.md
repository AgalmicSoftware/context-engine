# E2E Cadence

This protocol complements `docs/e2e-setup.md` and `docs/e2e-commands.md`.
Private E2E entrypoints are stripped from the public release; run this cadence
from the full dev repo or a restored private pack.

## Preflight

Before any private E2E run:

```bash
npm run -s ai:harness:doctor
```

Then confirm the required local env values are present in `.env.e2e.local`,
`.env.e2e`, or an explicit `E2E_ENV_FILE`. Common requirements include
`RPC_URL`, `ARWEAVE_JWK_PATH`, `CLOUDFLARE_API_TOKEN` for fresh worker-deploy
runs, and a reusable `SESSION_SLUG` plus `SESSION_WORKER_URL` for reuse runs.

## Nightly

Run these when operator credentials and funded test wallets are available:

- `npm run test:e2e`
- `npm run ai:test-session-setup:default-worker`
- `npm run ai:test-session-setup:custom-worker-secrets`
- `npm run ai:test-survey-authoring:encryption-matrix`
- `npm run ai:test-survey-response:encryption-matrix`
- `npm run ai:test-survey-gated-decrypt:any-all`
- `SESSION_SLUG=<slug> npm run ai:test-worker-scopes:matrix`
- SBT create/collect/boundary smoke from `docs/e2e-commands.md`

Record outputs under the existing `artifacts/session-workflows/` convention.

## Pre-Release

Before a public release or worker-bundle promotion, run the nightly set plus:

- `npm run ai:test-gates:any-all`
- `npm run ai:test-gated-decrypt:all-types`
- `npm run ai:test-cf-envelope:all`
- `SESSION_SLUG=<slug> npm run ai:test-doc-library:session:multi-gate`
- `SESSION_SLUG=<slug> npm run ai:test-doc-library:url-records`
- `npm run ai:test-admin:gate-update`
- `SESSION_SLUG=<slug> npm run ai:test-gate-revocation:decrypt`

Use non-identifying session names, payloads, and wallet fixtures. Do not publish
raw worker secrets, private keys, Arweave JWKs, or Cloudflare tokens in reports.

## Per-Lane

Use the narrowest suite that exercises the changed surface:

- Session Wizard or worker deploy changes: session setup plus worker health/admin
  recovery paths.
- Survey authoring changes: authoring matrix and question-type seed.
- Survey response/decrypt changes: response matrix, gated decrypt, and one UI
  path in both full and pile modes when available.
- SBT changes: create, collect, contract-boundary, and profile multi-session
  suites.
- Worker auth/storage changes: gate verification, worker scopes, Cloudflare
  envelope/groups, and route-specific worker tests.
- Navigation, route, or layout changes: `npm run test:e2e` and mobile smoke.

## E2E-BLOCKED Protocol

If a live suite cannot run because browser binaries, credentials, funded wallets,
RPC stability, Arweave funds, or Cloudflare permissions are unavailable:

1. Complete the unit, integration, boundary, and public-surface layers that do
   not need the missing resource.
2. Record the exact command, missing resource, and failure text.
3. Mark the lane `E2E-BLOCKED/<reason>` rather than provisioning new external
   resources ad hoc.
4. Do not treat blocked E2E as green. Carry the rerun command into the handoff.

Product assertion failures are not `E2E-BLOCKED`; they are findings that need a
characterization test and a fix or an explicit product decision.
