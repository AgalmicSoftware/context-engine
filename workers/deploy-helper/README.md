# Deploy Helper

`workers/deploy-helper/` is an optional supported OSS component for one-click `sessionCorsWorker` deployment from the Session Wizard.

It is a trusted helper:

- browsers send a Cloudflare API token to this worker
- the helper creates the target worker, KV namespace, and initial session config/secrets
- the helper operator can therefore see and misuse that Cloudflare token

Prefer self-hosting it on infrastructure you control.

## Quick Self-Host Bootstrap

Starter files shipped in this folder:

- `wrangler.example.toml`
  - copy to `wrangler.toml` if you want a Wrangler-managed deploy path
- `.dev.vars.example`
  - copy to `.dev.vars` for local `wrangler dev` testing or secret placeholders you do not want in `wrangler.toml`
- `LICENSE`
  - mirrors the worker-subtree MIT notice for this package

## Supported Local Outputs

- `npm run worker:bundle` now emits generated local fallback bundles at `dist/deployHelper.bundle.js` and `dist/sessionCorsWorker.bundle.js`
- `npm run deploy-helper:deploy -- --worker-name <name> --api-token <token>` bundles and publishes this helper to your Cloudflare account without requiring Wrangler
  - if you omit `--admin-secret`, the script generates one and prints it after deploy
  - if you omit `--allowed-origins`, the CLI seeds the stable Context Engine hosted/local defaults used by `/new`
  - unlike the in-browser `/new` flow, the CLI cannot infer your current self-hosted app origin, so custom hosts must still pass `--allowed-origins https://your-app.example,...`
  - the upload binds `CE_SESSION_COORDINATOR` and installs the SQLite-backed
    `SessionWriteCoordinator` migration; a repeat deploy keeps the binding and
    retries without replaying an already-installed migration
  - this does not add a third token permission: `Workers Scripts: Edit` covers
    the module, Durable Object binding, and class migration, while `Workers KV
    Storage: Edit` covers `DEPLOY_HELPER_KV`

Quick command:

```bash
nvm use 20
npm run deploy-helper:deploy -- \
  --worker-name ce-deploy-helper \
  --api-token "$CLOUDFLARE_API_TOKEN" \
  --allowed-origins http://localhost:3000
```

Typical first-worker bootstrap:

1. `nvm use 20 && npm run worker:bundle`
2. `nvm use 20 && npm run deploy-helper:deploy -- --worker-name <your-helper-name> --api-token <cloudflare-token> --allowed-origins http://localhost:3000`
3. Set `REACT_APP_CE_DEPLOY_HELPER_URL=https://<your-helper-name>.<account-subdomain>.workers.dev/` in `client/.env`

## Deployment Contract

Required binding:

- `DEPLOY_HELPER_KV`
  - stores the optional `/admin/origins` override and the secret-free deploy
    request journal used for response-loss recovery
- `CE_SESSION_COORDINATOR`
  - Durable Object namespace for the exported SQLite-backed
    `SessionWriteCoordinator` class
  - serializes each stable `deploymentRequestId` before Cloudflare mutation and
    replays terminal safe receipts without repeating deployment side effects

Recommended env vars / secrets:

- `ALLOWED_ORIGINS`
  - comma- or newline-delimited browser origins allowed to call the helper
  - for your own Wrangler/manual deploys, if unset, the helper intentionally falls back to `http://localhost:3000` only
- `ADMIN_SECRET`
  - bearer token required for `GET /admin/origins` and `POST /admin/origins`
- `WORKER_BUNDLE_URL`
  - optional default `sessionCorsWorker` bundle URL when callers omit `bundleUrl`
- `WORKER_COMPATIBILITY_DATE`
  - optional compatibility date for the worker the helper deploys
- `DEFAULT_SESSION_SLUG`
  - optional default slug when low-level callers omit `sessionSlug`

Wrangler is the preferred deploy path. The checked-in `worker.js` imports `../shared/deployHelperCore.mjs` and `../shared/deployHelperOrigins.mjs`, so it is not a dashboard-ready single file by itself. If you deploy manually in the Cloudflare dashboard, bundle it first.

## Endpoints

- `POST /account`
  - input: `{ apiToken }`
  - output: `{ accountId, accountName }`
- `POST /deploy`
  - input: Cloudflare token, worker name, worker bundle (`bundleUrl` or
    `bundleText`), initial session config/secrets, and optional
    `deploymentRequestId` (the first-party wizard always supplies one)
  - output: absolute `workerUrl`, the non-secret `deploymentId` ownership marker,
    and `subdomainStatus`, `subdomainEnabled`, `subdomainError`,
    `scriptSubdomainEnabled`, and `scriptSubdomainError` so callers can surface
    `workers.dev` activation state and clean up only exactly owned test resources
  - the requested worker name is a readable prefix, not an exact physical
    script name. Requests with `deploymentRequestId` derive a stable suffix and
    KV title marker; legacy requests without it use a random suffix. The helper
    reserves stable requests in `SessionWriteCoordinator` before mutation,
    keeps the resumable step journal in KV, replays a terminal safe receipt for
    response-loss retries, and rejects reuse of the ID with a conflicting
    immutable identity. Coordinator and journal state contain no raw tokens,
    secrets, or bundle bytes
- `GET /admin/origins`
  - requires `Authorization: Bearer <ADMIN_SECRET>`
  - returns `{ origins, source }`
- `POST /admin/origins`
  - requires `Authorization: Bearer <ADMIN_SECRET>`
  - stores a normalized allowlist in `DEPLOY_HELPER_KV["deploy-helper:origins"]`

## Public OSS Posture

- Canonical source: `workers/deploy-helper/worker.js`
- Shared implementation: `workers/shared/deployHelperCore.mjs`
- Canonical docs: `docs/session-cors-worker.md`
- License boundary: worker subtree MIT, documented in `workers/README.md` and `LICENSING.md`
