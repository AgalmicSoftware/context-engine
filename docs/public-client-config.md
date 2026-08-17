# Public Client Config

`client/src/variables/appConfig.ts` is the public config reader.
Deployment URLs, feature toggles, and environment-specific client defaults can
be overridden with `REACT_APP_*` variables, while deployment endpoint ownership
stays centralized in `client/src/variables/publicDeploymentConfig.ts`.

## Source of Truth

- Canonical example file: `client/.env.example`
- Deployment endpoint owner: `client/src/variables/publicDeploymentConfig.ts`
- Runtime reader/re-export surface: `client/src/variables/appConfig.ts`
- Shared env parsing helpers: `client/src/variables/publicEnv.ts`

## Deployment Theme

`REACT_APP_CE_DEFAULT_THEME` selects a bundled theme for a custom frontend.
Supported values currently come from `client/src/scss/themes/registry.json`:
`context-engine` (default) and `classic-95`. Unknown values fall back to
`context-engine`; this setting cannot load a URL, remote stylesheet, or custom
CSS. It is embedded into the document for the pre-paint bootstrap, so changing
it requires a rebuild/redeploy.

`REACT_APP_CE_THEME_SELECTOR_ENABLED` defaults to `true`, exposing the bundled
app-theme selector in Settings. Set it to `false` only when a deployment
intentionally hides user theme selection. The selected ID is stored locally
and restored before first paint. Session color schemes are a separate
`appearance.colorSchemeId` metadata contract and never select an app theme.

## Session Wrapped Capability Record

Agent Session Wrapped discovery is session-scoped public config, not a
browser environment secret. A successfully verified dedicated deployment may
publish exactly this versioned record in the canonical session config:

```json
{
  "agentSessionWrapped": {
    "version": 1,
    "enabled": true,
    "origin": "https://<dedicated-bridge>.<workers-subdomain>.workers.dev",
    "protocolVersion": "agent-session-wrapped-v1",
    "revision": "wrapped-<safe-revision>",
    "verifiedAt": "<ISO-8601 timestamp>"
  }
}
```

The client accepts an HTTPS origin with no credentials, path, query, or
fragment and safe bounded protocol/revision identifiers. The record contains
no Cloudflare token, worker secret, member credential, Telegram credential, or
provider key. `sessionModeProfile.surfaces.agentHttp` is the only enablement
bit; it must mirror `agentSessionWrapped.enabled`. `surfaces.telegram` is a
separate optional adapter bit. Deploy and redeploy code preserves the last
verified record until the replacement Worker has passed activation, health,
protocol, pinned-authority, and durable-config checks.

## How to Configure

1. Copy the example file: `cp client/.env.example client/.env`
2. Edit `client/.env` - uncomment and change only the values you need to override. For general local browsing/authoring flows an empty `.env` file is valid. A production release enables native Cloudflare deployment with its reviewed public replay commit; helper and healthcheck URLs are legacy/self-host overrides.
3. Restart the dev server: `cd client && npm run dev` (client env values are bundled when the dev server or production build starts)
4. For production (Vercel, Netlify, Cloudflare Pages, etc.): set `REACT_APP_*` vars in your hosting platform's environment settings. Do not commit `client/.env` to git.

## Netlify Static Deploy

Use this flow when you want to ship the React frontend on a custom domain with
Netlify static hosting. The built app is a static bundle; it is not a Node
server.

### 1. Set frontend variables

Before building, review `client/.env.example`, `client/src/variables/publicDeploymentConfig.ts`,
and `client/src/variables/appConfig.ts`. Vite bakes `REACT_APP_*` values into
the browser bundle at build time, so changes require a rebuild/redeploy.

For a custom-domain self-host, the values to check first are:
- None are required solely because the app is hosted on Netlify.
- `NEXT_PUBLIC_RP_ID` / `REACT_APP_NEXT_PUBLIC_RP_ID` before enabling the
  embedded passkey EOA wallet in production. This is the passkey RP ID and
  should be an owned parent domain, not a preview host.
- `NEXT_PUBLIC_APP_ORIGIN` / `REACT_APP_NEXT_PUBLIC_APP_ORIGIN` and
  `NEXT_PUBLIC_ACCOUNT_ORIGIN` / `REACT_APP_NEXT_PUBLIC_ACCOUNT_ORIGIN` when
  the wallet app and account origin differ.
- `NEXT_PUBLIC_WALLET_KEY_MODE` / `REACT_APP_NEXT_PUBLIC_WALLET_KEY_MODE`
  defaults to `passkey-derived`, where the passkey PRF output derives the EOA
  private key directly.
- `NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE` /
  `REACT_APP_NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE` is part of the derived
  wallet address namespace. Changing it changes derived wallet addresses.
- `REACT_APP_CE_SHARED_WORKER_URL` when the deployment should use your own
  default/shared `sessionCorsWorker` instead of the demo fallback.
- `REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT` to enable the native
  Cloudflare deploy card. The value must be the exact 40-character commit that
  publicly contains the reviewed `deploy/cloudflare/session-worker/` package.
  Branch names, tags, abbreviated hashes, and non-GitHub sources fail closed.
- `REACT_APP_CE_DEPLOY_HELPER_URL` when `/new` should use your own
  deploy-helper for the explicit legacy fallback.
- `REACT_APP_CE_HEALTHCHECK_WORKER_URL` when worker diagnostics should target a
  specific worker.
- `REACT_APP_CE_WORKER_BUNDLE_URL` only when deploy flows should fetch a worker
  bundle from a non-default URL.
- `REACT_APP_CE_WORKER_RELEASE_MANIFEST_URL` alongside any Worker bundle URL
  override. The manifest must come from the same immutable release and provides
  the expected SHA-256 for both Session and Wrapped deploys.
- `REACT_APP_DEFAULT_CHAIN_ID`, session scan variables, and registry/session
  defaults only when your deployment intentionally targets a different chain,
  registry/session surface, or profile scan scope.

Most feature toggles, Arweave read policy toggles, terminology mode, and RPC
diagnostic flags can stay at the checked-in defaults. Any worker, chain, or
registry override must match the worker and on-chain registry that the hosted
frontend will actually use.

The public posts route is enabled by default:

- `REACT_APP_CE_ABOUT_POSTS_ENABLED=false` renders `/posts` as disabled for
  deployments that do not want the public posts surface. Posts remains a footer
  navigation destination and is not duplicated in the About hero.
- Authored posts live in the repository root `posts/` directory and are copied
  into the static build output as `/posts/*`. See [`docs/posts.md`](posts.md).

### 2. Build the static bundle

```bash
cd client
npm run build
```

The output directory is `client/build/`.
Before building, the build script removes stale legacy `client/build-vite/` and
`client/vite-build/` directories if they exist locally.

### 3. Publish to Netlify

The repository-root `netlify.toml` is the canonical connected-build contract.
Connect only the public `AgalmicSoftware/context-engine` repository, select
`main` as the production branch, and leave the dashboard's build overrides
blank. Netlify then runs the following contract from the repository:

```text
base: client
command: npm ci && REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT=$COMMIT_REF npm run build
publish: build
Node: 20
```

`COMMIT_REF` is supplied by Netlify for Git-backed builds. Passing it through
to `REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT` binds the native
Cloudflare Deploy Button to the exact reviewed public commit that produced the
client. Manual or local builds without `COMMIT_REF` keep the native button
disabled rather than guessing a private or mutable source ref.

Enable pull-request Deploy Previews so a candidate can be inspected before it
reaches `main`. Leave general branch deploys disabled unless a named release
workflow explicitly needs them. Never connect a private development branch or
grant Netlify access to private planning repositories.

Deploy Previews prove the static build and browser routes. Worker-backed flows
also require the exact preview origin in the relevant worker allowlist, so keep
full production verification on an approved custom domain rather than adding a
wildcard preview origin.

For a manual fallback, drag `client/build/` into Netlify's deploy UI. Do not
upload `client/build-vite/` or `client/vite-build/`. Those names are legacy
ignored artifacts from older local builds and can contain partial or stale CSS
output. Set `REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT` to the exact
public source commit before a manual build when the native Deploy Button must
be available. If a deploy looks unstyled or low-contrast, rebuild from
`client/` and upload the fresh `client/build/` directory.

Because the app uses client-side routing, the root `netlify.toml` owns the Git
deploy redirects. The matching `client/public/_redirects` file is retained in
the published bundle for manual deploys and other Netlify-compatible static
uploads:

```text
/demo/dacc /about 301
/*    /index.html   200
```

The connected-build equivalent is:

```toml
[[redirects]]
  from = "/demo/dacc"
  to = "/about"
  status = 301

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Keep specific legacy redirects above the SPA fallback rule in both files.

For rollback, use Netlify's deploy history to republish the previous known-good
production deploy, then correct `main` normally. A frontend rollback does not
roll back workers, contracts, or externally stored session data.

When hosting the app under a subpath, set `PUBLIC_URL` to that mount path before
building, for example `PUBLIC_URL=/ce npm run build`. Internal session,
question/results, docs, and group routes strip that configured base before
matching app routes and reapply it when generating links, so deep links such as
`/ce/session/demo/questions`, `/ce/docs`, and `/ce/groups` stay inside the
mounted app. Legacy `/ce/contracts` deep links are rewritten to `/ce/docs`
without dropping their path suffix, query, or hash. The SPA fallback must also
be scoped to the same deployed base path by the hosting platform.

Set browser cache headers so search-result clicks and fresh navigations
revalidate the deployed files after each deploy. For manual drag-and-drop
deploys, keep the `_headers` file inside `client/public/` so Vite copies it into
the uploaded `client/build/` directory:

```text
/*
  Cache-Control: no-cache, max-age=0, must-revalidate
  Pragma: no-cache
  Expires: 0
```

This cannot replace already-running JavaScript in an open tab. It makes the
browser re-check the app shell on the next navigation, reload, or new visit.

### 4. Attach the custom domain

In Netlify, add the domain under the site domain settings and complete the DNS
setup Netlify provides. Rebuild/redeploy after the final origin is known if any
`REACT_APP_*` values depend on that origin or point at origin-specific worker,
helper, registry, or API endpoints.

The domain does not need to be registered with Netlify or use Netlify DNS.
Keeping registration and DNS at an external registrar is supported; point only
the web records at the Netlify project and preserve unrelated MX, TXT, and
service records.

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
  defaults from `publicDeploymentConfig.ts` and `appConfig.ts`.
- Shared worker fallback now defaults to `https://demo-worker-030226.agalmic.workers.dev` unless `REACT_APP_CE_SHARED_WORKER_URL` overrides it.
- The deploy-helper now defaults to `https://ce-deploy-helper.agalmic.workers.dev/`.
- Healthcheck still stays blank until the official project-owned endpoint is finalized for OSS.
- Only `REACT_APP_*` keys are exposed to the browser in the Vite client
  compatibility env.
- `publicDeploymentConfig.ts` is the single owner of deployment endpoint
  fallbacks; `appConfig.ts` re-exports those values for the existing client API.
- Browser/runtime overrides still exist for some flags (`globalThis`,
  `localStorage`, URL params). The env values only set the boot defaults.

## Lit / Chipotle config boundary

- Do **not** add Lit API keys to `client/.env` or any `REACT_APP_*` variable.
- Chipotle auth is now intended to stay server-side:
  - preferred deployment/sponsor worker env fallback: `LIT_USAGE_API_KEY`
  - legacy-compatible deployment/sponsor worker env fallback: `LIT_ACCOUNT_API_KEY`
  - per-session worker-secret overrides: `litAccountApiKey` (internal field behind the visible "Lit API key" input), `litUsageApiKey`
- Session-scoped non-secret Chipotle identifiers are no longer treated like browser env vars:
  - `litApiBase`
  - `litGroupId`
  - `litPkpId`
  - `litActionCid`
- Those values are authored through the Session Wizard / Admin flows and persist in worker config as `litCredentials`, not in the public client bundle.
- `litApiBase`, `litGroupId`, `litPkpId`, and `litActionCid` are not cryptographic secrets, but CE still treats them as worker-side operational metadata by default:
  - exposing them can reveal app architecture and action identity
  - they also make abuse easier if a scoped usage key later leaks
- Do not rely on hiding those identifiers as the main security boundary. The real boundary is the Lit API key scope, the permitted group/PKP/action relationship, and the Lit Action code itself.
- If a deployment intentionally makes those identifiers public, treat that as an explicit tradeoff rather than an accident. Never expose `LIT_USAGE_API_KEY`, `LIT_ACCOUNT_API_KEY`, `litUsageApiKey`, wallet private keys, or paid RPC URLs that embed provider secrets.
- If a sponsored bundle intentionally carries `litAccountApiKey`, treat that as an explicit Lit authority transfer rather than an ordinary config convenience. The durable OSS-friendly version of that pattern is one disposable Lit key per bundle, not one long-lived deployment key copied into many bundles.
- Chipotle v2 metadata may store the non-secret policy fields and policy fingerprint needed to bind a wrapped CEK to an audience, but it must not store secret-bearing RPC URLs. Decrypt/check RPC selection is derived from worker-approved config, secrets, or defaults.
- Re-provision Chipotle-enabled sessions after default Lit Action source changes so `litActionCid` matches the currently bundled action source. Old v1 / bare-hex Chipotle wrapped keys are not a compatibility target.
- Current public prod/dev Chipotle environments both report Base mainnet, so environment isolation should come from separate Chipotle accounts, usage keys, groups, and PKPs rather than from shipping different public chain IDs alone.
- The default CE automation path is now one new Lit account per session. Groups are reserved for internal trust boundaries or future action families inside that session account rather than as the primary cross-session isolation primitive.
- There is no longer a client-side Lit payer-wallet feature gate in `/new`; the manual `/new` Lit card asks only for one Lit API key. E2E/deploy env should prefer `LIT_USAGE_API_KEY`; `litAccountApiKey` remains the internal worker-secret field backing that visible input for backward compatibility.

## RPC Defaults

- Canonical anonymous RPC defaults live in `shared/rpcDefaults.cjs`. The
  `client/src/variables/rpcDefaults.js` and `.ts` modules are thin CommonJS and
  Vite adapters; Node scripts and worker fallbacks consume the same shared
  manifest.
- Session-sponsored RPC is not an anonymous default. For Survey contract reads,
  browser-visible session `rpcUrl` / `rpcUrlsByChainId` values are used only
  when the on-chain `rpc` gate is open or the current wallet already has a
  verified restricted grant.
- Custom RPC URLs supplied as worker secrets stay worker-private and are not
  mirrored into public registry fields. Client reads use only explicit
  browser-visible session `rpcUrl` / `rpcUrlsByChainId` values.
- OP Sepolia anonymous browser reads use only the official
  `https://sepolia.optimism.io` endpoint. PublicNode, dRPC, and Tenderly are not
  anonymous fallbacks because their browser-facing endpoints have returned
  sustained `400`, `403`, or `429` responses under registry/SBT discovery load.
  Production deployments should configure a session-visible sponsored RPC or
  another authenticated provider instead of adding anonymous fanout.
- Ethers read providers serialize distinct reads per endpoint. After a network
  request returns `429` or an endpoint rejects browser access with `403`,
  queued reads fail locally and use normal provider
  fallback without issuing more requests to the cooling endpoint. Actual
  network `429` responses increase the endpoint-level exponential cooldown;
  locally generated cooldown errors do not extend it. Active-session SBT cache
  warming also fetches only the selected registry slug instead of enumerating
  every session.
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

- `REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT=false`
  - Sets the first-run default for `demoSurfaceMode`, which controls the surface-level demo affordances.
  - Stored `ce:demoSurfaceMode` localStorage preferences win over this setting.
  - This only takes effect on fresh installs or when no stored preference exists.

- `REACT_APP_CE_DEMO_SESSION_SLUGS=demo-sh,demo-1,demo-3,demo-2,demo`
  - Sets the ordered list of session slugs that receive public demo-session affordances.
  - The first slug is used by the About-page Demo CTA when no explicit list-scoped session is selected.
  - `demo`, `demo-1`, `demo-3`, and `demo-sh` reuse the bundled legacy Context
    Polis fixture. `demo-2` uses its own 40-question generated dataset.
  - `demo-sh` is the current first/default public demo and has a dedicated
    worker-canonical Session Worker. `demo-2` is a direct-route preview with an
    empty Worker URL and `temporary: true`; keep it behind `demo-sh` until its
    dedicated Worker, canonical question seed, and Worker-held AI key pass live
    voice and AI verification. Never store provider credentials in this public
    list or in `demo_sessions.json`.

- `REACT_APP_CE_ENABLE_METAMASK_CONNECTOR=false`
  - Selects the browser-wallet profile at build time. The default `false` profile is passkey-only: the login screen has no MetaMask button, and the emitted browser bundle excludes RainbowKit, WalletConnect, the MetaMask connector, and the MetaMask login asset.
  - Set `true` before `npm run build` only for deployments that intentionally offer MetaMask login. Because this is a build-time profile, changing it requires rebuilding the client.
  - After a default or explicitly disabled build, run `npm run verify:passkey-only-bundle` from `client/`. The verifier fails if the build profile is enabled or forbidden connector symbols/assets are present.

- `REACT_APP_CE_ENABLE_WALLETCONNECT_FALLBACK=false`
  - Controls RainbowKit's MetaMask fallback when MetaMask is not injected, but only when `REACT_APP_CE_ENABLE_METAMASK_CONNECTOR=true`.
  - Default `false` keeps an enabled MetaMask profile on the injected connector and avoids opening WalletConnect bridge sockets during normal startup.
  - Setting this to `true` cannot re-enable MetaMask in a passkey-only build.

## Arweave Read Policy Toggles

- `REACT_APP_CE_ARWEAVE_DIRECT_TO_AR_IO=true`
  - Controls whether browser Arweave payload reads stay on the configured AR.IO gateway for their retry budget.
  - Default `true` uses `REACT_APP_CE_ARWEAVE_AR_IO_URL` / `window.CE_ARWEAVE_AR_IO_URL` when provided, otherwise `https://ar-io.dev`.
  - Display-critical metadata reads for sessions, SBTs, surveys, and questions
    plus SBT image/link candidates also stay on AR.IO while this is enabled;
    their legacy gateway hints do not re-enable fanout. Use
    `REACT_APP_CE_ARWEAVE_AR_IO_URL` for a custom AR.IO base. Legacy gateways
    become candidates again only when direct mode is intentionally disabled,
    including the maintained explicit per-request opt-out.
  - Set `false` only when a deployment intentionally wants legacy fallback fanout through `https://arweave.net`, Irys, Permagate, and alternate raw/tx-data routes.

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
  - The repo default is the active public demo slug, currently `demo-sh`.

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

- `litActionCid` can be omitted during session setup.
  - If the wizard only has the visible Lit API key (`litAccountApiKey` internally), the worker can now auto-bootstrap the default group, PKP, usage key, and CE action for that session, using the default Chipotle API base unless worker config/env overrides it.
  - If the wizard already has `litGroupId` and `litPkpId`, the worker can still auto-provision the default CE Lit action into an existing account and write the returned CID back into worker config after deploy.
