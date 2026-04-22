# Public Client Config

`client/src/variables/appConfig.js` is now a thin public config reader.
Deployment URLs, feature toggles, and environment-specific client defaults can
be overridden with `REACT_APP_*` variables, while deployment endpoint ownership
stays centralized in `client/src/variables/publicDeploymentConfig.js`.

## Source of Truth

- Canonical example file: `client/.env.example`
- Deployment endpoint owner: `client/src/variables/publicDeploymentConfig.js`
- Runtime reader/re-export surface: `client/src/variables/appConfig.js`
- Shared env parsing helpers: `client/src/variables/publicEnv.js`

## How to Configure

1. Copy the example file: `cp client/.env.example client/.env`
2. Edit `client/.env` - uncomment and change only the values you need to override. For general local browsing/authoring flows an empty `.env` file is valid; the default `/new` flow now ships with a project deploy-helper URL, while healthcheck and self-host overrides still need explicit URLs when you use them.
3. Restart the dev server: `cd client && npm run dev` (CRA reads `.env` only at build time)
4. For production (Vercel, Netlify, Cloudflare Pages, etc.): set `REACT_APP_*` vars in your hosting platform's environment settings. Do not commit `client/.env` to git.

## Netlify Static Deploy

Use this flow when you want to ship the React frontend on a custom domain with
Netlify static hosting. The built app is a static bundle; it is not a Node
server.

### 1. Set frontend variables

Before building, review `client/.env.example`, `client/src/variables/publicDeploymentConfig.js`,
and `client/src/variables/appConfig.js`. CRA bakes `REACT_APP_*` values into
the browser bundle at build time, so changes require a rebuild/redeploy.

For a custom-domain self-host, the values to check first are:
- None are required solely because the app is hosted on Netlify.
- `REACT_APP_CE_SHARED_WORKER_URL` when the deployment should use your own
  default/shared `sessionCorsWorker` instead of the demo fallback.
- `REACT_APP_CE_DEPLOY_HELPER_URL` when `/new` should use your own
  deploy-helper instead of the project helper.
- `REACT_APP_CE_HEALTHCHECK_WORKER_URL` when worker diagnostics should target a
  specific worker.
- `REACT_APP_CE_WORKER_BUNDLE_URL` only when deploy flows should fetch a worker
  bundle from a non-default URL.
- `REACT_APP_DEFAULT_CHAIN_ID`, session scan variables, and registry/session
  defaults only when your deployment intentionally targets a different chain,
  registry/session surface, or profile scan scope.

Most feature toggles, Arweave read policy toggles, terminology mode, and RPC
diagnostic flags can stay at the checked-in defaults. Any worker, chain, or
registry override must match the worker and on-chain registry that the hosted
frontend will actually use.

### 2. Build the static bundle

```bash
cd client
npm run build
```

The output directory is `client/build/`.

### 3. Upload to Netlify

For a manual upload, drag `client/build/` into Netlify's deploy UI. For a
connected repo deploy, set the publish directory to:

```text
client/build
```

Because the app uses client-side routing, configure an SPA route fallback. Either
include a Netlify `_redirects` file in the published build output:

```text
/*    /index.html   200
```

Or configure the same rule in `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

For manual drag-and-drop deploys, the `_redirects` file must be present inside
the uploaded `client/build/` directory.

### 4. Attach the custom domain

In Netlify, add the domain under the site domain settings and complete the DNS
setup Netlify provides. Rebuild/redeploy after the final origin is known if any
`REACT_APP_*` values depend on that origin or point at origin-specific worker,
helper, registry, or API endpoints.

### 5. Update worker CORS

After the domain cutover, add the deployed origin to the session worker
`allowOrigins` list, for example `https://app.example`. Use the `/admin` CORS
allowlist editor or the worker admin routes documented in
[`docs/session-cors-worker.md`](session-cors-worker.md).

Smoke-test the deployed domain with:
- worker `/health`
- a basic AI request
- an Arweave upload/read path
- login/auth flows, including gated flows if the session uses SBT gates

Vercel, Cloudflare Pages, and GitHub Pages use the same static build output and
SPA fallback concept, but their redirect config syntax differs.

## Notes

- `client/.env` is optional. If it is missing, the app still uses the checked-in
  defaults from `publicDeploymentConfig.js` and `appConfig.js`.
- Shared worker fallback now defaults to `https://demo-worker-030226.agalmic.workers.dev` unless `REACT_APP_CE_SHARED_WORKER_URL` overrides it.
- The deploy-helper now defaults to `https://ce-deploy-helper.agalmic.workers.dev/`.
- Healthcheck still stays blank until the official project-owned endpoint is finalized for OSS.
- Only `REACT_APP_*` keys are exposed to the browser in the CRA client.
- `publicDeploymentConfig.js` is the single owner of deployment endpoint
  fallbacks; `appConfig.js` re-exports those values for the existing client API.
- Browser/runtime overrides still exist for some flags (`globalThis`,
  `localStorage`, URL params). The env values only set the boot defaults.

## RPC Defaults

- Canonical anonymous RPC defaults now live in `client/src/variables/rpcDefaults.js`.
  That manifest is shared by the client runtime, Node scripts, and worker fallbacks.
- Optional paid testnet read RPCs are env/runtime-only and are no longer
  committed in source.
  - `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP`
  - `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS`
  - `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP`
  - `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS`
- The existing paid-RPC diagnostics toggles still apply:
  `REACT_APP_CE_USE_INFURA_RPC=true` and
  `REACT_APP_CE_RPC_PROVIDER_MODE=infura_only` only inject a paid RPC for chains
  that have one of the paid URL overrides above (or the matching runtime globals)
  configured.
- Because these are `REACT_APP_*` values, they are exposed to the browser bundle.
  Keep them in uncommitted `client/.env` for local diagnostics, not in a shared
  production client config if you need a true secret boundary.

## Current Migration Toggle

- `REACT_APP_TERMINOLOGY_MODE=plain`
  - Controls whether user-facing membership copy defaults to plain-language
    (`Group`, `Collect`, `Account`) or crypto-native (`SBT`, `Mint`, `Wallet`) terms.
  - Supported values: `plain` (default), `crypto`

- `REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT=true`
  - Sets the first-run default for `demoSurfaceMode`, which controls the surface-level demo affordances.
  - Stored `ce:demoSurfaceMode` localStorage preferences win over this setting.
  - This only takes effect on fresh installs or when no stored preference exists.

- `REACT_APP_ENABLE_LIT_SESSION_PAYER_WALLET_INPUT=false`
  - Temporary rollout flag for the `/new` SessionWizard Lit payer-wallet UI.
  - `false` hides the Lit worker-secret card in `/new`.
  - `true` enables the existing Lit payer-wallet inputs in `/new`.
  - This is migration scaffolding for the Naga-to-Chipotle Lit transition, not
    the long-term Chipotle config surface.

## Arweave Read Policy Toggles

- `REACT_APP_CE_ARWEAVE_PREFLIGHT_SESSION_METADATA=false`
  - Controls GraphQL tx-existence precheck for session metadata reads.
  - Default `false` keeps session metadata gateway-first so fresh uploads can display before GraphQL indexing catches up.

- `REACT_APP_CE_ARWEAVE_PREFLIGHT_SBT_METADATA=false`
  - Controls GraphQL tx-existence precheck for SBT tokenURI metadata reads.
  - Default `false` keeps SBT metadata gateway-first for initial display parity with session metadata.

- `REACT_APP_CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS=true`
  - Controls GraphQL tx-existence precheck for survey/question response payload reads.
  - Default `true` keeps the existing conservative response-payload behavior unless a deployment intentionally disables it.

## Profile Scan Fanout Toggles

- `REACT_APP_CE_SESSION_SCAN_SCOPE=list`
  - Controls the default session scan mode (`active|general|list|all`).

- `REACT_APP_CE_SESSION_SCAN_SLUGS=slug-a,slug-b`
  - Sets the default list-scope session slugs.
  - The repo no longer hardcodes a fallback slug; leave this unset for an empty default list.

- `REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS=false`
  - Legacy broad override for per-user deep scans.
  - `true` widens SBT, survey, and question profile scans together outside `list` scope.

- `REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS=false`
  - Allows off-list SBT discovery in `UserPage` / compare deep scans when enabled.
  - Default `false` keeps list-scoped profile SBT scans on the selected session list only.

- `REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS=false`
  - Allows off-list survey activity discovery in `UserPage` / compare deep scans when enabled.

- `REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS=false`
  - Allows off-list question activity discovery in `UserPage` / compare deep scans when enabled.
