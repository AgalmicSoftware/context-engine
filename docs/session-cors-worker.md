# Cloudflare Worker: sessionCorsWorker

This Worker handles AI proxying, transcription, Arweave uploads, fetch helpers, and the testnet faucet.
Secrets live in Worker KV by default; when a user enables a local override, the client may send per-request credentials
(`apiKey`, `rpcUrl`, `arweaveJwk`) and the worker will use them instead of KV secrets.

It also exposes canonical session storage routes for future backend routing: `POST /storage/upload`, `GET|POST /storage/read`, and `GET|POST /storage/list`. `/arweave/upload` remains supported for compatibility.

## Agent Bridge Client Handoff

The Telegram/agent bridge worker exposes the browser-facing agent handoff under
canonical `/api/agent/*` routes:

- `GET /api/agent/session-meta?sessionSlug=<slug>` returns public metadata for
  the selected session, including the sanctioned `clientSubmitReady` boolean the
  client uses to decide whether direct submit is deploy-ready.
- `POST /api/agent/client-login/exchange` accepts a pasted raw `ceagt_` token
  once and returns a short-TTL browser envelope. The web client stores only that
  versioned envelope in tab-scoped `sessionStorage`; raw tokens must not be put
  in URLs, localStorage, sessionStorage, Redux, or logs.
- Telegram-first session reads and submits use the shared browser components
  after one page-boundary backend-mode decision. `/session/demo` keeps its
  existing demo/off-chain behavior.

Hosted origin allowlists for the bridge live in deploy environment variables,
not repo source: `AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS` for browser token
exchange/result cache reads and `AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS` for Mini
App origins. The current first-party set should include
`https://contextengine.xyz`, `https://www.contextengine.xyz`, and the planned
`https://contextengine.sh`, `https://www.contextengine.sh` origins before DNS
cutover.

## OSS worker model

- The project hosts one worker for the demo session; it can sponsor new sessions and includes the embedded deploy-helper path.
- New sessions created via `/new` are bring-your-own-worker: deploy your own `sessionCorsWorker` on a free Cloudflare Workers account.
- A full shared multi-session worker product is planned but not yet shipped.

Preferred worker sources:
- `sessionCorsWorker` source tree: `https://github.com/AgalmicSoftware/context-engine/tree/main/workers/sessionCorsWorker`
- `sessionCorsWorker` release bundle asset: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js`
- Deploy-helper source tree: `https://github.com/AgalmicSoftware/context-engine/tree/main/workers/deploy-helper`
- The repo's `.github/workflows/publish-worker-bundles.yml` workflow rebuilds and republishes both bundle assets on every push to `main`/`master`, and it explicitly marks that worker-bundle release as GitHub's latest release so the `releases/latest/download/...` URLs stay current after GitHub Actions is enabled.

## Deployment modes

- Per-session worker: set `DEFAULT_SESSION_SLUG` to the session slug (single-tenant).
- Multi-tenant worker: leave `DEFAULT_SESSION_SLUG` empty; all requests must include `X-Session-Slug` (legacy `X-Group-Slug` still accepted) or a token claim.
- Note: the registry’s default session is stored under the literal `general` slug; the worker maps an empty slug to `general` for gate lookups.

## Runtime dependency boundary

The Worker source keeps runtime wiring explicit so route logic can be tested without Cloudflare bindings or live secrets:

- `worker.js` creates the runtime through `createWorkerRuntimeDepsWithWorkerDeps`.
- `workerRuntimeDepResolution.js` resolves imported helpers and worker-local primitives into one canonical dependency record.
- `workerRuntimeInputBinding.js` splits that record into low-level helpers and route runtime input.
- `workerRouteRuntimeBinding.js` assembles named route groups: registry/login bootstrap, rate-limit/faucet support, anonymous registry access, auth/CORS/admin adapters, execution services, and the route shell.

The route-shell bundle is intentionally still a large boundary object because it is where authenticated, anonymous, admin, AI, Arweave, storage, fetch, and faucet routes meet. Keep behavior changes inside the smaller route/execution modules when possible, and update the binding tests when the boundary adds or removes a dependency.

## Wizard flow (/new + deploy-helper)

If you deploy via the Group Wizard and a deploy-helper:

1) Fill in the Cloudflare API token and worker name.
   - The "Create API token" link opens a prefilled Cloudflare token template with the required
     Workers KV, Workers Scripts, R2, D1, and Durable Objects permissions used by the deploy-helper.
     `Account Settings: Edit` is needed only when the helper must create or change the
     account-level workers.dev subdomain.
   - CLI equivalent for agents/local setup: `npm run -s cloudflare:token-link -- --slug <session-slug>`
     Add `--include-workers-dev-subdomain-setup` only when the account does not already have a
     workers.dev subdomain or when intentionally changing it.
   - The template auto-names the token as `contextEngine-corsSessionWorker-<session-slug>-MONDD-YYYY-HHMMAM` or `contextEngine-corsSessionWorker-<session-slug>-MONDD-YYYY-HHMMPM` (local time).
   - The first-party wizard no longer asks for Cloudflare account ID; the deploy-helper resolves it from the API token.
2) Fill worker secrets in the wizard (OpenAI key, Arweave JWK, RPC URL, Anthropic key only if any selected AI model uses Anthropic, and optional OpenRouter key) and then click "Deploy worker".
   - Normal mode now points deploy-helper requests at the GitHub release bundle URL automatically instead of asking for a local upload first.
   - If the helper cannot fetch that release asset, the Worker step keeps the GitHub URL as the default path and reveals one-off retry overrides: paste a direct bundle URL or upload `dist/sessionCorsWorker.bundle.js` if you want to override the hosted URL.
   - The in-wizard deployment panel links to the GitHub worker source, deploy-helper source, and worker docs instead of shipping mirrored source snapshots inside the client bundle.
3) The deploy-helper uses the Workers API to fetch or create the account subdomain,
   enables the script’s workers.dev subdomain, and returns:
   `https://<worker-name>.<subdomain>.workers.dev/`
   - When the session URL is empty, the deploy-helper reports the resolved slug as `general`.
4) The wizard auto-fills `corsWorkerUrl` with that URL so it can seed Worker KV config and the current registry compatibility mirror.
   - Default worker `allowOrigins` initialization now prepends the current browser origin, so first-run deploys on a custom host keep the creating UI origin authorized without requiring a manual CORS patch first.
   - Advanced custom-worker deploys expose an `Enable embedded deploy-helper on this worker` checkbox (default `true`). It sets the worker's `DEPLOY_HELPER_ENABLED` binding at deploy time and is not updateable later through Worker KV config.
   - Arweave metadata uploads now strip worker-only fields like `corsWorkerUrl`, `allowOrigins`, `limits`, and `rpcEndpoint` before upload.
   - Successful deploys now also refresh a browser-side worker-config replica cache with a local freshness timestamp, so client worker URL resolution only prefers that Worker-KV-shaped bridge when it is newer than the registry compatibility mirror or when the mirror is still empty.
5) Upload metadata and register the session on-chain.
6) Post-deploy secrets verification retries `/auth/nonce` + `/admin/set-secrets` with backoff.
   - If `/admin/set-secrets` returns `Admin authorization failed` (common when session config has not propagated/seeded yet), the wizard now auto-runs signed `/admin/set-config` once and retries secrets sync in the same deploy flow.
   - Deploy-helper now returns `writesSessionConfig` / `writesSessionSecrets` flags; the wizard only shows the non-fatal "helper already wrote secrets" note when those flags explicitly confirm session-key writes.
   - Deploy payloads now include normalized `blockLimits` (`start`, optional `end`) so worker KV config reflects the Session Wizard start block immediately after `/new` deploy.

## Deploy Helper

- The deploy-helper (`workers/deploy-helper/worker.js`) is a separate trusted Cloudflare Worker used by `/new` for one-click `sessionCorsWorker` deploys. It is not the `sessionCorsWorker` itself; it only proxies Cloudflare API calls, creates the target worker + KV namespace, and seeds the initial session config/secrets.
- Self-hosted deploy-helper deployments should bundle from `workers/deploy-helper/worker.js` with Wrangler. The canonical source is the GitHub tree under `workers/deploy-helper/`.
- The checked-in deploy-helper source imports shared modules from `workers/shared/`. If you deploy outside Wrangler, bundle it first; do not paste raw `workers/deploy-helper/worker.js` into the Cloudflare dashboard as a standalone script.
- `workers/deploy-helper/README.md` is the quick public reference for bindings, env vars, trust boundaries, and endpoint behavior.
- Every newly deployed `sessionCorsWorker` now also ships with embedded deploy-helper capability enabled by default. Sponsored bootstrap deploys target the sponsoring `sessionCorsWorker` first, and that worker runs the same Cloudflare deploy core locally. Grant-backed sponsored deploys now require that embedded path and no longer fall back to a standalone helper URL.
- Operating modes:
  - CE-hosted: use the default `CLOUDFLARE_DEPLOY_HELPER_URL` (`https://ce-deploy-helper.agalmic.workers.dev/`) and let Context Engine operate the shared helper.
  - Self-hosted: deploy `workers/deploy-helper/worker.js` with your own Wrangler config (`wrangler.toml` or equivalent), bind `DEPLOY_HELPER_KV`, set `ALLOWED_ORIGINS`, and set `ADMIN_SECRET` with Wrangler secrets.
  - No helper: leave the helper out entirely and deploy `sessionCorsWorker` manually with Wrangler/dashboard steps from the `Self-deploy` section below.
- Origin allowlist resolution is now:
  - `DEPLOY_HELPER_KV["deploy-helper:origins"]`
  - `env.ALLOWED_ORIGINS`
  - fallback `http://localhost:3000`
- `ALLOWED_ORIGINS` accepts comma- or newline-delimited origins. Stored admin values are normalized to origins before they are written back to KV.
- Deploy-helper origin configuration:
  - CE-hosted mode should set `ALLOWED_ORIGINS` explicitly to the public app origins it serves. Current hosted example: `https://contextengine.xyz,https://www.contextengine.xyz,http://localhost:3000`.
  - Self-hosted mode should replace that list with the origins for your own app/admin hosts. Leaving `ALLOWED_ORIGINS` unset is intentionally restrictive and only allows `http://localhost:3000` until you configure it.
  - `CE_CLOUDFLARE_API_BASE_URL` is optional and defaults to `https://api.cloudflare.com/client/v4`. Override it only for Cloudflare-compatible test or proxy endpoints.
  - This is where self-hosting can still trip over the CLI default: `npm run deploy-helper:deploy` can seed the stable CE/local defaults, but unlike the `/new` browser flow it cannot discover your current custom app origin. If your UI runs on `https://your-app.example`, pass that origin explicitly with `--allowed-origins`.
  - Worker URLs returned from deploy flows are normalized to absolute `http(s)` base URLs before auth/admin calls run. Protocol-less hosts are prefixed (`https://` except local dev hosts), while relative paths are rejected.
- Admin origin management:
  - `GET /admin/origins` with `Authorization: Bearer <ADMIN_SECRET>` returns the current `{ origins, source }`.
  - `POST /admin/origins` with the same bearer token and JSON `{ "origins": ["https://example.com"] }` stores the normalized allowlist in `DEPLOY_HELPER_KV`.
  - Posting an empty `origins` array clears the KV override, so the helper falls back to `env.ALLOWED_ORIGINS` or the localhost default.

## Sponsored bundle flow (`/sponsor` -> `/new?sponsored=<txId>#k=<secret>`)

- `/sponsor` is a dedicated paste-first UI for creating one-click sponsored-session URLs; it does not read back worker KV secrets.
- The page resolves the selected session and worker URL using the same admin-style session lookup + signed wallet auth flow used by `/admin`, then uploads an encrypted Arweave bundle through the current worker `/arweave/upload` path.
- Sponsored bundle plaintext currently supports:
  - `openaiKey`
  - `anthropicKey`
  - `openrouterKey`
  - `arweaveJwk`
  - `faucetPrivateKey`
  - `customRpcUrl`
  - `litApiBase`
  - `litGroupId`
  - `litPkpId`
  - `litActionCid`
  - `litAccountApiKey`
  - `litUsageApiKey`
  - `bootstrapWorkerUrl`
  - `deployGrantToken`
  - `faucetGrantToken`
  - `meta.label`, `meta.createdAt`, `meta.createdBy`, optional `meta.expiresAt`
  - `meta.sourceSessionSlug`, `meta.sourceWorkerUrl` (bootstrap funding/deploy provenance)
- Agreed next sponsorship hard-cut:
  - `litAccountApiKey` is the per-bundle authority field backed by one disposable Lit account per bundle
  - `/new` can use that key during redemption/bootstrap to mint a fresh group / PKP / usage key for the new session
  - scoped runtime bundles keep using `litUsageApiKey` plus `litApiBase` / `litGroupId` / `litPkpId` / `litActionCid`
- The manual `/new` Lit card now exposes only `litAccountApiKey` / `LIT_ACCOUNT_API_KEY`; scoped runtime identifiers stay worker-side and are derived during bootstrap or supplied through admin/sponsored-bundle paths.
- The raw Cloudflare API token entered on `/sponsor` is not written into the encrypted bundle payload. `/sponsor` exchanges it for a `deployGrantToken`, and the sponsoring worker keeps the raw token only inside the server-side sponsored grant record until redeem/expiry.
- The uploaded Arweave envelope is:
  - `type: "contextengine-sponsored-bundle"`
  - `version: 1`
  - `cipher: "password-aes-gcm"`
  - `encryptedData: "<base64>"`
- The generated share URL keeps the Arweave tx id in the query string and the decrypt secret only in the hash fragment. `/new` canonicalizes that alias to `/session/new` without dropping the query or hash.
- When the wizard opens with both `sponsored` and `#k=`, it downloads the envelope, validates `type` / `version` / `encryptedData`, decrypts client-side, rejects expired bundles, forces worker-secret mode back on, disables local secret persistence for that navigation, auto-applies the supported sponsored fields, and stores the bundle's source-session context in sessionStorage for login-stage faucet fallback.
- While a sponsored bundle is active in normal mode, the dedicated Worker step is hidden and the flow jumps straight from Privacy to Deploy Session.
- Advanced mode still keeps the bundle-source controls visible for sponsored flows, so admins can switch between the default bundle URL and a manual Upload file override while testing.
- Sponsored links only switch Publish into the streamlined "auto-deploy on Publish" worker path when the applied bundle is actually deploy-ready:
  - supported sponsored bundle is active,
  - worker secrets mode is still enabled,
  - a worker name has been generated from the current session name,
  - worker bundle URL resolves,
  - and grant-backed deploy fields are present (`deployGrantToken` plus `bootstrapWorkerUrl` / source worker URL),
  - and `getMissingWorkerSecretsForDeploy(...)` is empty for the current session config.
- Sponsored deploy grants now keep only the Cloudflare API token plus the source worker bootstrap context on the sponsoring worker; the encrypted bundle itself carries only the resulting `deployGrantToken` and bootstrap worker URL. Grants do not snapshot account ID or a standalone helper URL.
- For grant-backed sponsored deploys, the browser posts to the sponsoring `sessionCorsWorker` `/sponsored/redeem-deploy` route, and that source worker must have embedded deploy enabled from its deploy-time `DEPLOY_HELPER_ENABLED` binding. `/sponsor` no longer writes a standalone deploy-helper fallback URL into the bundle or grant.
  - In that deploy-ready state, Publish deploys the worker first, then uploads metadata and registers on-chain. Both the regular normal-mode worker step and the sponsored publish path default to the hosted GitHub release asset URL.

- The worker KV config now keeps a mirrored `embeddedDeployHelperEnabled` boolean so the frontend can reopen the wizard with the current deploy-time toggle state, but runtime behavior still comes from the worker's `DEPLOY_HELPER_ENABLED` binding.
  - If the hosted release-asset fetch fails, the normal-mode worker step or sponsored normal-mode Publish panel keeps the GitHub release asset URL as the default path and offers either a manual bundle URL override or `nvm use 20 && npm run worker:bundle` plus `/dist/sessionCorsWorker.bundle.js` as an optional local upload override.
  - `dist/sessionCorsWorker.bundle.js` remains a generated local/manual fallback bundle for upload retries, but the client build no longer serves `/worker/sessionCorsWorker.bundle.js`.
  - Advanced mode still keeps `Use URL` as the default path and preserves the manual `Upload file` override for testing.
  - Scoped Chipotle identifiers and `litUsageApiKey` already flow through the worker-mediated Lit execution path.
  - Authority-bundle bootstrap now centers on `litAccountApiKey` rather than payer-wallet delegation.
- Login-stage auto-funding now retries the faucet request against `meta.sourceSessionSlug` / `meta.sourceWorkerUrl` when the new sponsored session has not published its own worker yet, so the freshly connected wallet can still get publish gas from the originating sponsored session.
- After that first worker deploy, later worker config/secrets adjustments are expected to flow through the signed `/admin/set-config` and `/admin/set-secrets` routes rather than the streamlined normal-mode auto-deploy banner.
- `customRpcKey` is intentionally out of scope for this MVP and is ignored if present in a bundle payload.

Temporary standard-link fixture:
- `client/public/standard-sponsored-links.json` is a tracked public manifest for up to ten disposable sponsored setup URLs.
- It is intentionally operator-managed and does not read back worker KV or grant state. An active fixture entry is public because the operator chose to publish that bearer URL.
- Fixture links should be created through `/sponsor` with disposable, resource-limited credentials: capped AI/provider keys, small faucet balances, short expirations, revocable Arweave wallets, and either revocable Lit usage keys or disposable Lit bundle accounts.
- Use it only for short-lived low-friction demos or launches. Replace it with a worker-backed claim service before treating sponsored-link inventory as durable availability infrastructure.

Deploy error visibility:
- If deploy-helper rejects the browser origin (`403 Origin not allowed`), the wizard now surfaces an explicit message:
  - `Deploy-helper rejected browser origin <origin>... Add this origin to the deploy-helper allowlist...`
- If the browser request fails before a response (`Failed to fetch`), the wizard now flags likely CORS/helper reachability issues and points to origin allowlist checks.

Worker URL source clarity:
- Publish panel status now distinguishes:
  - default shared worker URL,
  - custom URL verified by a successful deploy in the current run,
  - custom URL that is present but not verified in this run (or changed after deploy).
- Metadata upload is blocked for custom mode until deploy verification matches the configured custom worker URL.

Default worker URL:
- `CLOUDFLARE_CORS_WORKER_URL` remains the shared fallback worker URL.
- Normal-mode `/session/new` no longer pre-populates per-session `corsWorkerUrl` from that fallback; for now the simplified wizard assumes bring-your-own worker until a dedicated shared hosted worker product exists.
- New SessionWizard writes seed per-session `corsWorkerUrl` into Worker KV config and keep a temporary registry compatibility mirror; new Arweave metadata uploads no longer carry worker-only config.
- Client worker URL resolution now prefers a browser-side replica of Worker KV session config only when that replica is fresher than the temporary registry `corsWorkerUrl` mirror, or when the mirror is still empty.
- Shared client session-config readers now apply that same freshness guard before overlaying the worker-config replica, so app surfaces using `sessionRegistryStore`, `sessionRegistryReader`, `contractScripts`, and debate-mode session selection stop treating an older browser replica as a permanent authority override.
- Legacy untimestamped browser replicas remain a migration bridge only when the registry mirror is blank; once the mirror has a worker URL again, those old cache entries no longer outrank it.
- `client/src/utilities/session/sessionWorkerAvailability.ts` now gives UI a sync worker-config overlay surface for both "is a usable worker-backed config available?" and "what configured worker URL is currently usable?"; when callers opt in, it also returns the shared default/general fallback worker URL synchronously. `SBTsList.tsx`, `LiveDebateMode.tsx`, and `AdminPage.tsx` use it instead of component-local raw `corsWorkerUrl` truthiness.
- `client/src/utilities/session/sessionParsers.ts` now accepts compatibility worker URL aliases like `workerUrl` and `sessionWorkerUrl` too, so the lower-level parser, cache bridge, worker availability helper, and `corsProxy` share the same worker URL normalization rules.
- `client/src/utilities/session/sessionWorkerUrlCompatibility.ts` now owns that remaining worker URL compatibility alias list/read surface plus the shared metadata-strip alias keys reused by `sessionParsers.ts`, `sessionWorkerConfigCache.ts`, `sessionWorkerAvailability.ts`, `canonicalSessionContext.ts`, and `sessionWizardWriteNormalization.ts`, so worker URL compatibility reads and Arweave metadata stripping no longer drift apart.
- `client/src/utilities/worker/corsProxy.ts` now uses that same configured-worker-URL parser for plain session-config reads, so compatibility keys like `workerUrl` and `sessionWorkerUrl` stay aligned with the shared worker availability helper.
- `client/src/utilities/worker/workerSessionResolution.ts` now owns the shared active-session slug, alias-resolution, and registry/demo session-config lookup scaffold used by both `workerAuth.ts` and `corsProxy.ts`, while each caller still keeps its own default `allowDemoFallback` policy.
- `client/src/utilities/worker/workerSessionResolution.ts` now also exports the distinct default demo-fallback policy helpers used by `workerAuth.ts` and `corsProxy.ts`, so the policy-normalization logic is shared while auth still defaults fail-closed and `corsProxy` still allows non-general demo fallback in on-chain mode.
- `client/src/utilities/worker/corsProxy.ts` now trusts that shared scaffold directly instead of performing a second-pass session-config lookup after alias resolution, so the async worker URL path no longer keeps an extra copy of the same session-resolution step.
- `client/src/utilities/session/sessionWorkerAvailability.ts` now also owns the shared "default session must ignore `demoSessions.general` as worker authority in on-chain mode" rule, so sync UI reads and async `corsProxy` resolution both fall back to `CLOUDFLARE_CORS_WORKER_URL` on the same contract.
- `client/src/utilities/worker/corsProxy.ts` also now reuses the shared default/general fallback worker URL selector from `sessionWorkerAvailability.ts`, so the sync and async default-session worker URL paths stay on the same fallback contract.
- Worker auth now defaults to no silent demo-session fallback in on-chain mode; explicit demo/off-chain callers must opt in when resolving worker URLs for login.
- **Stage-B fail-closed strictness (2026-03-12):** All security-sensitive callers — Arweave uploads (`arweaveClient.js`), AI requests (`aiClient.js`), transcription (`useWhisper.ts`), faucet (`contractHelpers.ts`), image fetch (`imageFetchClient.ts`), session-config resolution (`contractScripts.impl.ts`, `resourceKeys.ts`, `aiSettings.ts`), and the canonical resolver (`canonicalSessionContext.ts`) — now require explicit `allowDemoFallback: true` opt-in to use demo session fixtures when the on-chain registry is active. The CORS proxy demo-fallback policy (`defaultCorsProxyAllowDemoFallback`) is also tightened to match auth defaults. `getSessionConfigBySlugOrDefault` returns `null` for unknown non-general slugs instead of silently mapping them to the general default config.
- In on-chain registry mode, worker auth/cors proxy no longer treat `demoSessions.general`
  as an implicit worker authority for the default session; the shared fallback is used instead.
- The shared fallback is only used for the general/default session; non-general slugs do not fall back to it.
- The deploy-helper URL reads from `CLOUDFLARE_DEPLOY_HELPER_URL`; by default it points at `https://ce-deploy-helper.agalmic.workers.dev/`. Self-hosted
  and operator-managed setups should override that to their own
  `https://<deploy-helper-name>.<account-subdomain>.workers.dev/` endpoint.

Notes:
- This flow avoids opening the Cloudflare dashboard.
- Do not send Cloudflare API tokens from the browser directly; use the deploy-helper (trusted) endpoint.

Admin test panel:
- The Session Admin page includes a Worker Tests panel to hit `/health`, run a basic AI call,
  upload a tiny JSON payload to Arweave, and record a short AudioInput transcription.
  Arweave and faucet test results include clickable tx links for quick verification.
  Arweave links use the preferred AR.IO gateway (`CE_ARWEAVE_AR_IO_URL` when set, otherwise `https://ar-io.dev`) while `CE_ARWEAVE_DIRECT_TO_AR_IO` is enabled, which is the default. In this mode, read retries stay on AR.IO and do not fan out to legacy gateways. Set `CE_ARWEAVE_DIRECT_TO_AR_IO=false` only when a deployment intentionally wants fallback reads through `ARWEAVE_GATEWAY_URL`, `https://arweave.net`, Irys, Permagate, and alternate raw/tx-data routes. Runtime overrides: `window.CE_ARWEAVE_GATEWAY_URL`, `window.CE_ARWEAVE_DIRECT_TO_AR_IO`, `window.CE_ARWEAVE_AR_IO_URL`.
  Run these while signed in as a user who holds the sponsored SBT to confirm gating + secrets are wired correctly.
- If tests fail with a browser network error like `Load failed` / `Failed to fetch`, the worker is often
  rejecting the browser origin via `allowOrigins` (CORS allowlist).
  - Local dev frequently runs at `http://localhost:3001` (and E2E may use `http://127.0.0.1:3000`).
  - Use the `/admin` CORS allowlist editor to inspect and edit the full list directly. `Add recommended origins` appends the current browser origin plus the stable defaults, and `Save allowlist` persists the exact list you entered.
  - Trusted admin origins (for example the first-party localhost admin hosts) can now reach `/admin/*` even when the session's current allowlist is wrong, so admins can repair a blocked allowlist without manual KV edits first.
- Static custom-domain frontend deploys must add the final browser origin (for
  example `https://app.example`) to the same `allowOrigins` list after DNS
  cutover. See the Netlify/static hosting checklist in
  [`docs/public-client-config.md#netlify-static-deploy`](public-client-config.md#netlify-static-deploy).
- When AI/Arweave/Faucet tests hit `Session config not found.`, the panel now auto-attempts
  a signed `/admin/set-config` using the selected session metadata, then retries the test once.
  This recovery also covers login-stage 404s (`Worker login failed (404)`) so fresh workers can be
  bootstrapped from the selected session without manual KV edits.
- If selected metadata omits `registryAddress`/`rpcUrl`, the admin payload now backfills those from
  chain defaults (`chains.ts`) before calling `/admin/set-config`.
- Admin metadata saves now also reuse the same signed `/admin/set-config` path after a successful
  Arweave + SessionRegistry metadata update, so worker-relevant config such as `blockLimits`,
  faucet thresholds, and registry/rpc/contracts context stay aligned with the latest admin-edited session metadata.
- `/health` now follows the same recovery path: admin tests auto-attempt `/admin/set-config` on
  `Session config not found.` and retry once.
- The faucet test sends a micro transfer (0.0000001) to a fresh random address; it does not fund the connected wallet.
- The SBT gate negative tests expect a 403 on login when you connect a wallet without the sponsored SBT.

## Session Storage Routes

Authenticated clients can use the worker as the session storage boundary:

- `POST /storage/upload`: accepts JSON or multipart payloads for CE payload resources (`docsContext`, `questions`, `surveys`, `responses`, `generatedArtifacts`, and `media`). `arweave` and `lit-arweave` delegate to the existing Arweave upload behavior and return both `arweaveTxId` and `storageRef`. `cloudflare` writes blobs to R2 and metadata/index rows to KV/D1-style bindings when R2 is available. For small JSON/demo deployments where R2 is not enabled, the worker can store opaque payload envelopes in KV-only Cloudflare storage. Both modes return an opaque 32-byte base64url Cloudflare `storageRef.id` that existing Surveys `bytes32` pointer fields can carry without changing the ABI.
  - Upload bodies are capped at 25 MB by default before Arweave or Cloudflare storage handoff. Set `CE_MAX_UPLOAD_BYTES` on the Worker to lower or raise that limit for `/storage/upload` and `/arweave/upload`.
- `GET|POST /storage/read`: reads a Cloudflare object by opaque `storageRef.id` after the configured Cloudflare payload access check. Public-read sessions may be served anonymously; gated sessions require authenticated route preflight. It returns the payload bytes with `X-CE-Storage-Backend: cloudflare`, `X-CE-Payload-Access-Mode`, and no raw object keys.
- `GET|POST /storage/list`: lists Cloudflare metadata/index rows for a resource such as `docsContext`, returning safe `storageRef` objects, tag metadata, and the configured payload access mode. Public-read sessions may list anonymously; gated sessions require authenticated route preflight.
- `GET|POST /storage/export-envelopes`: returns ciphertext plus envelope metadata for encrypted Cloudflare payloads in the requested resource. It does not decrypt payload bytes and does not include session KEK material.

Cloudflare storage bindings are optional until a session selects `storageProfile.backend = "cloudflare"` at creation time in `/new`; legacy doc-library configs with `docLibrary.provider = "cloudflare"` are also accepted by the worker for storage route compatibility. Backend mutation/migration is out of scope for now. This is payload storage for session context, docs, media, questions, surveys, responses, and generated artifacts; it is not user preference/profile storage. Tests use mocked R2/KV contracts; no Cloudflare credentials are needed for local verification. The worker accepts `CE_STORAGE_R2`/`STORAGE_R2`/`R2_BUCKET` for preferred blob storage and `CE_STORAGE_INDEX_KV`/`STORAGE_INDEX_KV`/`STORAGE_KV` for metadata indexes plus the KV-only payload fallback. One-click deploys that receive a Cloudflare storage profile bind the created session KV namespace as both `GROUP_KV` and `CE_STORAGE_INDEX_KV`, then persist a sanitized `storageProfile` in `session:{slug}:config`. If the deploy request explicitly asks for R2 storage, it must provide an existing bucket name so the helper can bind it as `CE_STORAGE_R2`; otherwise the helper fails before provisioning partial Cloudflare resources. Cloudflare refs must not include account IDs, bucket names, raw object keys, worker tokens, long-lived URLs, or secrets.

`storageProfile.payloadAccessControl` is the worker enforcement contract. New configs use:

```json
{ "gate": "none|sbt_gate|group_gate|role_gate", "encryption": "none|worker_envelope|lit" }
```

The worker still read-normalizes legacy `payloadAccessControl.mode`, `cloudflare.payloadAccessMode`, and stored `payloadAccessMode` values forever:

- `public_read` -> `{ "gate": "none", "encryption": "none" }`
- `worker_sbt_gate` -> `{ "gate": "sbt_gate", "encryption": "none" }`
- `lit_encrypted` -> `{ "gate": "none", "encryption": "lit" }`

Where older clients still need one string, the worker and client derive the legacy `payloadAccessMode` from the v2 object.

- `gate: "sbt_gate"` is the default for Cloudflare-backed Telegram/demo sessions. It is worker-enforced access control, not end-to-end encryption. The worker resolves the resource gate (`docsContext` -> `docUploads`, `questions`/`responses` -> `questionResponses`, `surveys`/`generatedArtifacts` -> `surveyResponses`) and checks the requester against the configured SBTs on the gate chain using the configured RPC before upload, list, or read bytes are exposed.
- `gate: "group_gate"` checks worker-native group membership before upload, list, or read bytes are exposed. The gate reads group ids from `storageProfile.payloadAccessControl.groupId`/`groupIds`, or from payload metadata for per-payload group storage refs. Missing, deleted, or unreadable groups fail closed.
- `gate: "none"` keeps canonical payloads in Cloudflare but serves read/list requests without wallet auth. Uploads still require authenticated session worker requests unless the caller is already on an anonymous read/list route. Use this for public question prompts or public response summaries that should render identically across Arweave, Cloudflare, Telegram, Mini App, and the CE client.
- `encryption: "lit"` keeps the existing Lit scaffold. Cloudflare stores only caller-supplied encrypted payload envelopes and Lit governs decrypt. The worker rejects plaintext Cloudflare uploads in this mode until the client/session path supplies `payloadEncrypted=true` with a Lit-encrypted envelope.
- `encryption: "worker_envelope"` encrypts payload bytes at rest inside the session worker trust domain, then releases keys only after worker-evaluated conditions pass. The operator and Cloudflare runtime can decrypt. This mode protects against storage-layer dumps of R2/KV/D1 data, backups, or bucket/index misconfiguration; it is not decentralized, not end-to-end, and not private from the session operator or Cloudflare runtime. Audience removal stops future key release, but cannot un-read plaintext already fetched.

Lit credentials are required only for `lit-arweave` storage or Cloudflare `encryption: "lit"` payload mode. Cloudflare `sbt_gate`, `worker_envelope`, and `none` modes hide the `/new` Lit key input; `sbt_gate` relies on the session worker SBT check while `none` relies on the operator intentionally publishing the payload. In `/new`, `worker_envelope` is selectable only when `storage.backend` is `cloudflare`; Arweave-backed encrypted artifacts remain Lit-managed.

### Worker Envelope Encryption

`worker_envelope` uses WebCrypto AES-256-GCM and the existing session config/index stores:

- Deployment KEK: read from the Worker secret `CE_STORAGE_ENVELOPE_KEK` through the `worker_secret` key provider. The plaintext KEK is never stored in KV, D1, or R2. `CE_STORAGE_ENVELOPE_PREVIOUS_KEK` is optional during deployment-key rotation so old session KEKs can be unwrapped and rewrapped under the current secret.
- Session KEK: generated on the first envelope write for a session, wrapped by the deployment KEK, and stored in `session:{slug}:config` under `storageEnvelope.sessionKey`.
- Payload DEK: generated per payload, used to encrypt the stored bytes, wrapped by the session KEK, and stored in payload metadata with the envelope algorithm, IVs, key id, and condition reference.

Reads authorize first, then unwrap the DEK, decrypt the payload, return `Cache-Control: private, no-store`, and write one key-release audit event. The audit store is D1 when a `CE_STORAGE_AUDIT_D1`/`STORAGE_AUDIT_D1`/`DB` binding is present; otherwise it uses `CE_STORAGE_AUDIT_KV` or the storage index KV. If no audit store is available, key release fails closed.

Access conditions may be attached per payload or at session level:

```json
{
  "match": "any",
  "conditions": [
    { "kind": "worker_role", "role": "admin" },
    { "kind": "sbt_onchain", "chainId": 11155420, "contract": "0x...", "anyOrAll": "any" },
    { "kind": "agent_grant_scope", "scope": "storage" }
  ]
}
```

`match: "any"` releases when any condition passes; `match: "all"` requires every condition. Empty or missing conditions fall back to the configured gate. Unknown condition kinds fail closed. `worker_group` checks canonical worker group membership and deleted groups fail closed.

`POST /admin/rotate-envelope-keys` is admin-signed. It rewraps payload DEKs under a new session KEK and stores the session KEK wrapped by the current deployment KEK without re-encrypting payload bytes.

### Envelope Export And Re-Host

Admin-signed `POST /admin/export-storage-envelopes` returns a re-hostable bundle for Cloudflare encrypted payloads. The response includes a manifest, ciphertext payload entries, per-payload envelope metadata, and the wrapped session KEK material needed by an operator-controlled re-host flow. For `worker_envelope`, payload entries carry the wrapped DEK, IV, algorithm, key provider, and condition document reference. For Cloudflare `lit` payloads, the worker passes through the ciphertext as stored and does not attempt Lit decrypt.

The export manifest includes `exportScope: "encrypted_envelopes_only"`, `storageBackend`, `encryptedPayloadCount`, `partial`, `readErrors`, `wrappedKeysIncluded`, `keyProvider`, and `rewrapRequiredForNewDeployment: true`. Telegram response export honors the same scope by calling `/storage/export-envelopes?resource=responses` with a session export/admin principal; that route packages ciphertext and envelope metadata, omits session KEK material, and skips `/storage/read`.

Admin-signed `POST /admin/rewrap-envelope-deployment-key` accepts `{ "newDeploymentKek": "<secret value>" }` and re-wraps the stored session KEK under that new deployment KEK without changing payload ciphertext or wrapped payload DEKs. Use this during an operator-controlled re-host to move a session to a worker with a different `CE_STORAGE_ENVELOPE_KEK`, then retire the old deployment secret after verification. Rotation or re-wrap stops future key release under retired keys; it cannot un-read plaintext that was already fetched.

### Worker-Native Groups

Groups are canonical in `sessionCorsWorker`; the agent bridge and clients are future consumers, not owners, of this state. Group membership is visible to the worker/operator by design. This is the same trust domain as worker-enforced gates.

Group records and membership rows are stored separately in the worker group store. The worker uses `CE_WORKER_GROUPS_D1` when present, otherwise the same D1 aliases used by envelope audit, otherwise `CE_WORKER_GROUPS_KV` or the storage index KV aliases. Membership rows are keyed by normalized principals and are not embedded in group objects.

Implemented routes:

- `POST /admin/groups/create`: admin-signed create. `joinMode` supports `admin_add` and `open`; `password` and `invite` are recognized but rejected with `join_mode_not_implemented`.
- `POST /admin/groups/update`: admin-signed update for label, description, join mode, and member visibility.
- `POST /admin/groups/delete`: admin-signed tombstone. Deletion revokes future `group_gate` and `worker_group` condition checks.
- `POST /admin/groups/add-member` / `POST /admin/groups/remove-member`: admin-signed membership mutation.
- `POST /admin/groups/list` and `POST /admin/groups/list-members`: admin-signed group/member views.
- `GET|POST /groups/list`: authenticated member route. It returns session-visible groups and member-visible groups for the caller.
- `GET|POST /groups/my-memberships`: authenticated self view. A principal can always see its own memberships.
- `POST /groups/join`: authenticated self-join for `joinMode: "open"` groups only.

`memberVisibility` defaults to `admin_only`. `members` lets members see the group metadata, and `session` lets any authenticated session principal see the group metadata. Self-membership visibility is always allowed. `passkey_account` and `evm_address` principals use normalized EVM addresses, `telegram` uses the bridge principal id string, and `agent` uses the grant id. Malformed principals fail closed.

Upload policy `group_allowlist` may be supplied on Cloudflare storage uploads with `groupId`/`groupIds`; the uploader must be a member before payload bytes are persisted. Existing SBT upload behavior is unchanged.

## Required bindings

KV:
- `GROUP_KV`
- `CE_STORAGE_INDEX_KV` (or `STORAGE_INDEX_KV` / `STORAGE_KV`) when Cloudflare payload storage uses KV metadata/index rows, and required for KV-only payload fallback. The deploy helper aliases the same newly created namespace as `GROUP_KV` and `CE_STORAGE_INDEX_KV` for Cloudflare-backed sessions.
- `CE_STORAGE_AUDIT_KV` (optional) for worker-envelope key-release audit events. If omitted, the worker uses the storage index KV for audit rows when no D1 audit binding is present.
- `CE_WORKER_GROUPS_KV` (optional) for worker-native group records and membership rows. If omitted, the worker uses the storage index KV aliases. Membership rows remain separate from group records.

R2/D1:
- `CE_STORAGE_R2` (or `STORAGE_R2` / `R2_BUCKET`) for preferred Cloudflare payload blobs. One-click deploys bind this only when the request supplies an existing R2 bucket name.
- `CE_STORAGE_AUDIT_D1` (or `STORAGE_AUDIT_D1` / `DB`) for worker-envelope key-release audit events when the deployment wants a queryable audit table.
- `CE_WORKER_GROUPS_D1` (optional) for queryable worker-native group records and membership rows. If absent, group storage can use the same D1 aliases as envelope audit; any D1 group store is preferred over KV.
- D1 may be linked for queryable metadata/indexes where a deployment models those indexes in D1 instead of KV; ordinary payload bytes should stay in R2.
- Durable Objects are for signer/runtime coordination only, not ordinary session payload blobs.

Vars:
- `TOKEN_HMAC_SECRET` (HMAC secret for session tokens)
- `CE_STORAGE_ENVELOPE_KEK` (Worker secret for `worker_envelope`; required only when sessions use `encryption: "worker_envelope"`. `/new` custom-worker deploys that select worker-envelope storage ask the deploy helper to generate and set this secret during Worker provisioning; manual deployments must set it themselves.)
- `CE_STORAGE_ENVELOPE_PREVIOUS_KEK` (optional Worker secret used only while rewrapping old session KEKs after deployment-key rotation)
- `CE_WORKER_GROUP_MAX_GROUPS_PER_SESSION` (optional; defaults to `100`)
- `CE_WORKER_GROUP_MAX_MEMBERS_PER_GROUP` (optional; defaults to `1000`)
- `DEFAULT_SESSION_SLUG` (optional; canonical)
- `DEFAULT_GROUP_SLUG` (optional; legacy alias still read for compatibility)
- `DEPLOY_HELPER_ENABLED` (optional; only if you embed deploy endpoints in the same worker)
- `CE_OPENAI_TRANSCRIBE_URL` (optional; defaults to `https://api.openai.com/v1/audio/transcriptions`)
- `LIT_ACCOUNT_API_KEY` or `LIT_USAGE_API_KEY` (optional; used for worker-mediated Lit Chipotle execution when no per-session Lit account or usage key has been stored yet, or when a sponsor intentionally runs a shared-account model)
- `LIT_API_BASE` (optional; defaults to `https://api.chipotle.litprotocol.com`; production requests are restricted to the approved Chipotle API host)
- `LIT_CHIPOTLE_ALLOW_LOCAL_API_BASE` (optional; dev/test only, allows `LIT_API_BASE` to target localhost/loopback Chipotle stubs over `http` or `https`)

For local `wrangler dev` placeholders, see `workers/sessionCorsWorker/.dev.vars.example`. Keep real `.dev.vars` files untracked.

Runtime:
- Enable Node.js compatibility when deploying from the dashboard.
- Add npm deps if using dashboard source: `ethers`, `arweave`.

## KV data layout

- `session:{slug}:config` JSON:
  ```json
  {
    "storageProfile": {
      "backend": "cloudflare",
      "resources": { "docsContext": "active", "questions": "active", "surveys": "active", "responses": "active" },
      "payloadAccessControl": { "gate": "sbt_gate", "encryption": "none" },
      "cloudflare": { "payloadAccessMode": "worker_sbt_gate" }
    },
    "storageEnvelope": {
      "version": 1,
      "keyProvider": "worker_secret",
      "sessionKey": {
        "version": 1,
        "keyProvider": "worker_secret",
        "alg": "AES-256-GCM",
        "wrapAlg": "AES-GCM-KW-v1",
        "iv": "base64url-wrapped-iv",
        "wrappedKey": "base64url-wrapped-session-kek"
      }
    },
    "slug": "test-72",
    "networkChainId": 11155420,
    "registryAddress": "0x...",
    "registryChainId": 11155420,
    "adminAddress": "0x...",
    "hatsAddress": "0x...",
    "adminHatId": "123",
    "rpcUrl": "https://...",
    "blockLimits": { "start": 12345678, "end": null },
    "contracts": {
      "surveys": { "address": "0x...", "chainId": 11155420 }
    },
    "allowOrigins": ["https://app.example"],
    "limits": { "perWalletPerDay": 1000 },
    "scopes": { "ai": true, "arweave": true, "transcribe": true, "faucet": true, "fetch": true }
  }
  ```
  For `"backend": "cloudflare"`, new `/new` configs default canonical CE payload
  resources (`docsContext`, `questions`, `surveys`, `responses`, media, and
  generated artifacts) to `"active"` unless an advanced draft explicitly stages
  a resource for legacy fallback.
  - `hatsAddress` / `adminHatId` are optional; leave blank/zero to use `adminAddress` only.
  - Worker KV config is normalized on read/write:
    - `allowOrigins` accepts legacy comma/newline-delimited strings but is stored/read as a trimmed array.
    - saving an empty `allowOrigins` list is intentional and means "open CORS" for that session (no allowlist).
    - if a `slug` field is present in the config payload, the authenticated request slug / KV key remains authoritative and overwrites mismatched values.
    - `/admin/set-config` preserves existing `limits` / `scopes` object branches when malformed non-object patches are sent, instead of letting those branches degrade into corrupted shapes.
- `session:{slug}:secrets` v1 envelope JSON:
  ```json
  {
    "v": 1,
    "kind": "session-secrets",
    "createdAt": 1760000000000,
    "updatedAt": 1760000000000,
    "secrets": {
      "openaiKey": "...",
      "anthropicKey": "...",
      "openrouterKey": "...",
      "customRpcUrl": "...",
      "customRpcKey": "...",
      "arweaveJwk": "{...}",
      "faucetPrivateKey": "..."
    }
  }
  ```
  - Worker KV secrets are normalized on write:
    string values are trimmed, plain objects are persisted as JSON strings,
    and non-object scalars are stringified before storage.
  - Reads still accept legacy unversioned secrets objects, but new admin and
    deploy-helper writes store the v1 envelope.

## Session authority model

The session config resolution follows a strict authority matrix that determines which
sources are authoritative for each field group. This is defined in
`client/src/utilities/session/sessionAuthorityMatrix.ts` and partially adopted by
`client/src/utilities/session/canonicalSessionContext.ts`; full gate and secret
enforcement is deferred to stage-B strictness work.

### Authority sources

| Source | Key | Description |
|---|---|---|
| Registry | `registry` | On-chain SessionRegistry contract (authoritative for identity and gates) |
| Arweave | `arweave` | Arweave metadata uploads (authoritative for text metadata) |
| Worker KV | `worker-kv` | Cloudflare Worker KV store (authoritative for worker config) |
| Worker Secrets | `worker-secrets` | Cloudflare Worker secrets (authoritative for API keys) |
| Browser | `browser` | Browser localStorage (authoritative for local preferences) |
| Demo | `demo` | Demo session configs (fallback only for identity and text metadata) |
| Cache | `cache` | Cache replicas (never authoritative) |

### Field group authority

| Field Group | Authoritative Source | Allowed Fallbacks | Must Not Override |
|---|---|---|---|
| Identity (slug, sessionId, metadataURI, chainId) | Registry | Demo | Arweave, Browser, Cache |
| Gates (sponsored, sponsoredSbtAddress, gates) | Registry | — | Arweave, Browser, Demo, Cache |
| Text Metadata (sessionName, sessionInfo, tags, ai, lit, encryption) | Arweave | Demo, Cache | Browser |
| Worker Config (corsWorkerUrl, allowOrigins, limits, rpcEndpoint) | Worker KV | — | Arweave, Browser, Demo, Cache |
| Secrets (arweaveJwk, apiKey, privateKey) | Worker Secrets | Browser | Arweave, Demo, Cache |
| Local Preferences (rpc.useLocal, rpc.apiKey, arweave.useLocal, arweave.jwk, faucet.useLocal, faucet.privateKey) | Browser | — | All other sources |
| Cache Replica (__fromCache) | — | — | All other sources |

### Client-side helpers

- `routeSessionResolution.ts` — route/session precedence for MainSite
- `litSessionConfig.ts` — Lit protocol chain/network/gate resolution
- `surveyToolSessionResolution.ts` — SurveyTool session context resolution
- `canonicalSessionContext.ts` — canonical session config assembly with provenance
- `sessionWorkerConfigCache.ts` — browser-side replica cache for Worker KV session config, used as the preferred bridge over the registry worker URL mirror
- `sessionWorkerAvailability.ts` — sync "usable worker-backed config" helper for UI loading-state reads; overlays the cached worker-config replica and preserves the default/general shared worker fallback
- `sessionWizardWriteNormalization.ts` — SessionWizard Stage-A producer write-target normalization for Arweave metadata, registry compatibility fields, and Worker KV config payloads

### Worker-side boundaries

The worker decomposes session handling into ~80 narrow authority/normalization
modules under `workers/sessionCorsWorker/`. Key boundary files:

- `workerTopLevelBinding.js` — static ABI/default/error bundle
- `workerRuntimeDepsBinding.js` — imported helper wiring
- `workerRuntimeInputBinding.js` — runtime-input orchestration
- `workerLowLevelHelperInputResolution.js` — low-level helper bundle shaping
- `workerRouteRuntimeInputResolution.js` — route-runtime bundle shaping
- `authLoginRequestAuthority.js` — /auth/login authority chain
- `adminRequestAuthority.js` — /admin/* authorization chain
- `loginGateAuthority.js` — on-chain gate/scope evaluation
- `faucetGateAuthority.js` — faucet gate lookup/validation
- `faucetEligibilityAuthority.js` — faucet proof decision tree

## Worker module extraction boundaries

- Shared JSON response + KV JSON helper operations now route through
  `workers/sessionCorsWorker/responseKvHelpers.js`, preserving
  `Content-Type: application/json`, cloned base headers, malformed-KV
  `null` fallback, and `expirationTtl` option behavior used by session
  config/secrets reads and writes.
- Shared session config / secrets store operations now route through
  `workers/sessionCorsWorker/sessionConfigSecretsStore.js`, preserving
  normalized config reads, fail-closed invalid-config rejection on writes,
  and the existing session config/secrets KV key layout used by auth, admin,
  bootstrap, and authenticated route flows.
- Shared CORS primitive operations now route through
  `workers/sessionCorsWorker/corsPrimitives.js`, preserving `allowOrigins`
  parsing, origin-allowance checks, reflected `Access-Control-Allow-Origin`
  behavior, and the common auth/admin/bootstrap/anonymous/authenticated
  header contract.
- Shared default route-base-header shell operations now route through
  `workers/sessionCorsWorker/routeBaseHeaders.js`, preserving request
  `Origin` extraction plus the default/no-allowlist
  `corsHeaders(origin, null)` behavior used by `OPTIONS`, `/auth/*`,
  `/admin/*`, bootstrap `/arweave/upload`, anonymous `/ai` /
  `/transcribe` pre-config failures, and authenticated pre-auth responses
  like `/health`.
- Shared top-level route selection now routes through
  `workers/sessionCorsWorker/topLevelRouteSelection.js`, preserving
  `OPTIONS`, auth, admin, bootstrap/authenticated Arweave, anonymous, and
  authenticated-fallback branch matching plus admin-action trimming and the
  current authorization-header classification used before deeper helpers run.
- Shared auth request binding now routes through
  `workers/sessionCorsWorker/authRequestBinding.js`, preserving the
  worker-specific `/auth/nonce` nonce-builder/KV-write binding plus the
  `/auth/login` used-nonce/token-ttl binding into the extracted auth
  request dispatch helpers.
- Shared auth login request authority now routes through
  `workers/sessionCorsWorker/authLoginRequestAuthority.js`, preserving
  signed slug resolution, existing-session CORS passthrough,
  SIWE/signature/nonce validation, missing-config `404`, and on-chain scope
  computation before token signing runs.
- Shared admin request binding now routes through
  `workers/sessionCorsWorker/adminRequestBinding.js`, preserving the
  used-nonce ttl binding plus the worker-specific admin auth/config/secrets
  helper bundle into the extracted admin request dispatcher.
- Shared admin request authority now routes through
  `workers/sessionCorsWorker/adminRequestAuthority.js`, preserving signed
  slug resolution, existing-session CORS passthrough, SIWE/signature/nonce
  validation, bootstrap-vs-configured-admin authorization sequencing, and
  the final `Admin authorization failed.` contract before config/secrets/
  limits writes.
- Shared bootstrap Arweave upload binding now routes through
  `workers/sessionCorsWorker/bootstrapArweaveUploadBinding.js`,
  preserving the bootstrap request log plus the env-bound slug/config/admin/
  secrets helper bundle into the extracted bootstrap upload dispatcher.
- Shared bootstrap admin-signature binding now routes through
  `workers/sessionCorsWorker/adminSignatureVerificationBinding.js`,
  preserving used-nonce ttl binding plus the worker-specific logging and
  slug-mismatch constant bundle into the extracted bootstrap admin-signature
  verifier.
- Shared Arweave upload execution now routes through
  `workers/sessionCorsWorker/arweaveUploadExecution.js`, preserving
  Arweave module resolution, upload-payload/JWK/tag/association
  composition, upload-start/success/error logging, and the
  `transactions.post(...)` fallback error contract for both bootstrap and
  authenticated uploads.
- Shared Arweave upload execution binding now routes through
  `workers/sessionCorsWorker/arweaveUploadExecutionBinding.js`,
  preserving the worker-local logging/json helpers plus the
  contract/tag/association deps bundle into the extracted Arweave upload
  execution helper.
- Shared transcribe execution now routes through
  `workers/sessionCorsWorker/transcribeExecution.js`, preserving provider
  selection, request-vs-worker key precedence, blocked-custom-url
  rejection, upstream error mapping, and final `{ text }` response
  normalization for authenticated and anonymous transcribe requests.
- Shared transcribe execution binding now routes through
  `workers/sessionCorsWorker/transcribeExecutionBinding.js`, preserving the
  worker-local `safeFetch` / blocked-url / default-URL deps bundle into the
  extracted transcribe execution helper.
- Shared AI provider execution now routes through
  `workers/sessionCorsWorker/aiProviderExecution.js`, preserving
  Anthropic/OpenRouter request header/body/error normalization, OpenAI
  request-vs-worker key precedence, responses-vs-chat request shaping,
  custom RPC request-vs-worker `rpcUrl` / key precedence, blocked-target
  rejection, `safeFetch(...)` passthrough, and final `{ completion, raw }`
  response normalization for authenticated and anonymous AI requests.
- Shared AI provider execution binding now routes through
  `workers/sessionCorsWorker/aiProviderExecutionBinding.js`, preserving the
  worker-local JSON response helper plus `safeFetch(...)` / blocked-url deps
  bundle into the extracted AI provider execution helper.
- Shared fetch helper execution now routes through
  `workers/sessionCorsWorker/fetchExecution.js`, preserving normalized-target
  failure passthrough, `safeFetch(...)` passthrough handling,
  content-length/status/type validation, HTML stripping, and final
  image/HTML/JSON response normalization for authenticated `fetch_image` and
  `fetch_url` requests.
- Shared fetch helper execution binding now routes through
  `workers/sessionCorsWorker/fetchExecutionBinding.js`, preserving the
  worker-local JSON response helper plus normalized-target / blocked-url /
  `safeFetch(...)` deps bundle into the extracted fetch execution helper.
- Shared faucet execution binding now routes through
  `workers/sessionCorsWorker/faucetExecutionBinding.js`, preserving the
  worker-local JSON response/logging helpers plus `ethers.Wallet`,
  RPC/proof-validation deps, and default faucet constants into the
  extracted faucet execution helper.
- Shared auth/CORS/admin adapter binding now routes through
  `workers/sessionCorsWorker/authCorsAdminBinding.js`, preserving the
  worker-local CORS deps bundle, existing-session config lookup binding,
  auth token/slug binding, and admin registry/hats deps into the extracted
  auth/admin/CORS helper boundaries.
- Shared registry/login/bootstrap adapter binding now routes through
  `workers/sessionCorsWorker/registryLoginBootstrapBinding.js`, preserving
  the worker-local SessionRegistry RPC/json deps bundles, bound login
  authority-preflight + scope-evaluation wiring, bootstrap-admin
  session-read binding, and call-time logging behavior into the extracted
  helper boundaries.
- Shared anonymous / registry-support adapter binding now routes through
  `workers/sessionCorsWorker/anonymousRegistrySupportBinding.js`,
  preserving the worker-local anonymous slug-resolution deps bundle,
  on-chain anonymous gate authority/session-read binding, anonymous
  rate-ID constants, and call-time warning behavior into the extracted
  helper boundaries.
- Shared rate-limit / faucet-support binding now routes through
  `workers/sessionCorsWorker/rateLimitFaucetSupportBinding.js`,
  preserving the worker-local KV-backed rate-limit keying/ttl behavior while
  `workers/sessionCorsWorker/faucetGateAuthority.js` now owns the deeper
  on-chain session-gate lookup ordering, faucet validation-state reads, and
  password-validation RPC fallback accumulation into the extracted helper
  boundary.
- Shared low-level RPC / contract / probe binding now routes through
  `workers/sessionCorsWorker/rpcContractProbeBinding.js`, preserving RPC URL
  masking, JSON-RPC request/error handling, contract-call
  encoding/decoding, SessionRegistry interface binding, and RPC probe
  logging/ordering into the extracted helper boundary.
- Shared ethers interface/provider/gate binding now routes through
  `workers/sessionCorsWorker/ethersInterfaceProviderGateBinding.js`,
  preserving interface caching, provider/contract construction,
  positive-balance coercion, and SBT gate failure logging into the
  extracted helper boundary.
- Shared ethers primitive/value binding now routes through
  `workers/sessionCorsWorker/ethersPrimitiveValueBinding.js`, preserving
  session-id canonicalization, BigInt coercion, ethers-function fallback
  order, exact unavailable error strings, raw-address passthrough, and
  ethers v5-compatible `utils` fallbacks into the extracted helper
  boundary.
- Shared group-proof / address / hashing binding now routes through
  `workers/sessionCorsWorker/groupProofAddressHashBinding.js`, preserving
  canonical address normalization, group faucet proof hash construction,
  recovered-signer normalization, exact missing/invalid proof error
  strings, and thrown-error normalization into the extracted helper
  boundary.
- Shared outbound URL blocking / redirect safety binding now routes through
  `workers/sessionCorsWorker/outboundUrlSafetyBinding.js`, preserving
  localhost/private target rejection, IPv4-mapped IPv6 handling, metadata
  endpoint blocking, redirect header filtering, single-redirect follow
  behavior, and blocked-target / too-many-redirect `403` behavior into the
  extracted helper boundary.
- Shared registry/faucet RPC binding now routes through
  `workers/sessionCorsWorker/registryFaucetRpcBinding.js`, preserving
  registry slug canonicalization, registry/gate/faucet RPC list resolution
  ordering, Base Sepolia/Base mainnet faucet fallback ordering, first-RPC
  selection, and bytes32 hash validation into the extracted helper
  boundary.
- Shared execution-service assembly binding now routes through
  `workers/sessionCorsWorker/workerExecutionServiceBinding.js`, preserving
  the exact deps/constants/defaults bundles passed into the extracted AI,
  transcribe, fetch, faucet, Arweave upload, and bootstrap admin-signature
  helpers before the top-level route shell invokes them.
- Shared top-level worker route-shell binding now routes through
  `workers/sessionCorsWorker/workerRouteShellBinding.js`, preserving
  URL/path/method derivation, shared route selection/base-header
  composition, `OPTIONS` `204` handling, `/arweave/upload` preflight
  logging, env-slug resolution, and the auth/bootstrap/admin/anonymous/
  authenticated handoff order before the downstream route-entry helpers run.
- Shared worker route-runtime assembly now routes through
  `workers/sessionCorsWorker/workerRouteRuntimeBinding.js`, preserving the
  higher-level registry/login/bootstrap, anonymous/rate-limit, auth/CORS/
  admin, execution-service, and final route-shell composition that feeds
  the exported worker runtime contract.
- Shared worker low-level helper assembly now routes through
  `workers/sessionCorsWorker/workerLowLevelHelperBinding.js`, preserving
  the worker-specific outbound URL safety, ethers primitive,
  registry/faucet RPC, ethers interface/provider/gate, group-proof hashing,
  and RPC/contract probe composition that feeds the extracted route-runtime
  boundary.
- Shared top-level worker runtime-input binding now routes through
  `workers/sessionCorsWorker/workerRuntimeInputBinding.js`, preserving the
  worker-local `console.log`, `Date.now`, `fetch`, `globalThis.fetch`, and
  `ethers.Wallet` handoff plus the remaining low-level-helper assembly (now
  delegated to the extracted low-level-helper input resolution helper) and
  exported `workerAuthGateUtils` / `fetch` contract while delegating the
  deeper route-runtime bundle shaping to the extracted helper.
- Shared worker low-level-helper input resolution now routes through
  `workers/sessionCorsWorker/workerLowLevelHelperInputResolution.js`,
  preserving the low-level-helper `deps` / `constants` / `defaults` bundle
  shaping before the binding hands it to `workerLowLevelHelperBinding.js`.
- Shared worker route-runtime input resolution now routes through
  `workers/sessionCorsWorker/workerRouteRuntimeInputResolution.js`,
  preserving the large low-level-helper-aware route-runtime
  `deps` / `constants` / `defaults` bundle before the binding hands it to
  `workerRouteRuntimeBinding.js`.
- Shared worker runtime-deps binding now routes through
  `workers/sessionCorsWorker/workerRuntimeDepsBinding.js`, preserving the
  thinner handoff into the extracted runtime dep-resolution helper and the
  unchanged runtime-input contract before `worker.js` applies only the
  remaining static constants/defaults and export shell.
- Shared worker runtime dep resolution now routes through
  `workers/sessionCorsWorker/workerRuntimeDepResolution.js`, preserving the
  imported normalization, auth, token, config, Arweave, faucet, and route
  dispatch helper fallback bundle plus missing-slug / slug-mismatch
  constant fallback shaping before runtime-input assembly.
- Shared top-level worker runtime binding now routes through
  `workers/sessionCorsWorker/workerTopLevelBinding.js`, preserving the
  static ABI/default/error bundle plus final worker-global `ethers` / `URL`
  / `Headers` / `console.log` / `fetch` / `globalThis.fetch` / `Date.now`
  handoff into the extracted runtime-deps boundary before `worker.js`
  exposes the final `workerAuthGateUtils` and `fetch` entry contract.
- Anonymous route-entry setup now routes through
  `workers/sessionCorsWorker/anonymousRouteEntry.js`, preserving anonymous
  slug resolution, missing-slug selection, session-config lookup, CORS
  passthrough, rate-identity + rate-limit setup, and the final
  `/ai` / `/transcribe` handoff into the anonymous route dispatcher.
- Authenticated route-entry setup now routes through
  `workers/sessionCorsWorker/authenticatedRouteEntry.js`, preserving
  `requireAuth(...)`, authenticated `/health` success, authenticated route
  context resolution, and the final authenticated route dispatcher handoff.
- Anonymous route-entry binding now routes through
  `workers/sessionCorsWorker/anonymousRouteEntryBinding.js`, preserving the
  worker-specific missing-slug/session-config constant binding plus the
  env-bound handoff from the extracted anonymous route-entry helper into the
  extracted anonymous route-dispatch binding.
- Authenticated route-entry binding now routes through
  `workers/sessionCorsWorker/authenticatedRouteEntryBinding.js`,
  preserving the worker-specific authenticated route-context deps bundle,
  missing-config constant binding, and the env-bound handoff from the
  extracted authenticated route-entry helper into the extracted
  authenticated route-dispatch binding.
- Anonymous route-dispatch binding now routes through
  `workers/sessionCorsWorker/anonymousRouteDispatchBinding.js`, preserving
  the worker-specific provider/transcribe helper bundle, env-bound
  session-secrets lookup, and anonymous route-denied constant handoff into
  the extracted anonymous dispatcher.
- Authenticated route-dispatch binding now routes through
  `workers/sessionCorsWorker/authenticatedRouteDispatchBinding.js`,
  preserving the worker-specific secret-path, non-secret action, and
  secret-action helper bundles plus the existing fetch/AI/faucet helper
  wiring into the extracted authenticated dispatcher.
- `nonce:{slug}:{address}` → nonce string (TTL 5m)
- `usedNonce:{slug}:{nonce}` → "1" (TTL 10m)
- `authToken:{slug}:{sub}:{jti}` → "1" for minted login tokens (TTL 4h)
- `rate:{slug}:{address}` → JSON counter (stubbed)

## Registry fields (on-chain)

- `corsWorkerUrl` can be stored as a Lit-encrypted envelope string so the worker
  URL is not visible on-chain. Members who satisfy the chosen gate can decrypt
  it in the client.
- `sponsored_*` flags (string "1"/"0") are optional UX hints indicating which
  worker secrets are configured (e.g., `sponsored_ai`, `sponsored_arweave`).
- Shared SessionRegistry `sessionExists(...)` reads now route through
  `workers/sessionCorsWorker/sessionExistenceRead.js`, preserving ordered RPC
  fallback, masked per-RPC error details, and the existing
  `session-not-registered` vs `session-check-unavailable` fail-closed behavior
  used by login, bootstrap-admin fallback, anonymous gate authority, and
  session-gate lookup paths.
- Shared SessionRegistry `getResourceGate(...)` reads now route through
  `workers/sessionCorsWorker/sessionResourceGateRead.js`, preserving ordered
  RPC fallback, decoded gate normalization, masked per-RPC errors, and the
  existing login/anonymous/session-gate authority behavior that depends on the
  `default`, `ai`, `arweave`, `rpc`, and `txGas` gate reads.
- The login-side SessionRegistry bytecode diagnostic probe now routes through
  `workers/sessionCorsWorker/sessionRegistryCodeRead.js`, preserving ordered
  RPC fallback, bytecode-size calculation, masked per-RPC errors, and the
  existing `registry code probe` logging contract used when default gate
  lookup is unavailable during login.
- Shared SessionRegistry `getSessionBySlug(...)` reads now route through
  `workers/sessionCorsWorker/sessionTupleRead.js`, preserving ordered RPC
  fallback, tuple passthrough, masked per-RPC errors, and the existing
  bootstrap-admin + Arweave session-id association behavior that depends on
  SessionRegistry tuple reads.
- Login gate/scope evaluation now routes through
  `workers/sessionCorsWorker/loginScopeEvaluation.js`, which now keeps the
  default-gate denial plus final scope mapping/override shell while
  `workers/sessionCorsWorker/loginGateAuthority.js` owns the deeper
  resource-gate read ordering, default-gate diagnostic log/probe branch,
  SBT gate evaluation ordering, and default-gate RPC diagnostics before the
  outer login session-authority preflight hands off.
- Login session-authority preflight now routes through
  `workers/sessionCorsWorker/loginAuthorityPreflight.js`, preserving registry
  config validation, canonical registry slug selection, shared
  `sessionExists(...)` authority checks, and the existing fail-closed
  warning/error contract before the extracted login-scope helper runs.
- Shared gate-chain RPC list resolution now routes through
  `workers/sessionCorsWorker/gateRpcResolution.js`, preserving direct
  `config.rpcUrl` normalization, mapped `rpcUrlsByChainId` lookup,
  registry-chain merge + dedupe behavior, and the existing caller contracts
  used by login gate evaluation, Arweave SBT association, and faucet RPC
  selection.
- Shared registry/faucet RPC resolution now routes through
  `workers/sessionCorsWorker/registryFaucetRpcResolution.js`, preserving
  registry-chain mapped + direct fallback ordering, explicit faucet `rpcUrl`
  precedence, `faucet.chainId -> networkChainId -> registryChainId`
  selection, Base Sepolia special ordering, Base mainnet fallbacks, and the
  existing caller contracts used by login/admin/anonymous registry reads,
  Arweave association checks, and authenticated faucet RPC selection.
- Shared RPC URL list normalization now routes through
  `workers/sessionCorsWorker/rpcUrlListNormalization.js`, preserving trimmed
  scalar/array normalization plus first-seen dedupe ordering across merged
  URL lists for the extracted gate, registry, faucet, and bootstrap-admin
  helper paths.
- Shared chain-id normalization now routes through
  `workers/sessionCorsWorker/chainIdNormalization.js`, preserving the
  existing Number-based chain-id coercion and `0` fallback behavior used by
  the extracted gate, registry/faucet, login-scope, session-gate, Arweave,
  and faucet helper paths.
- Shared base string coercion plus deps-aware trimmed-string normalization
  now route through `workers/sessionCorsWorker/stringCoercion.js`,
  preserving the existing `string -> same`, `nullish -> ''`, and
  `String(value)` fallback behavior plus the shared `deps.toStr(...)`
  override-before-trim behavior plus shared one-argument and string-only trim
  normalization used by extracted login, anonymous, session-read,
  request/body/env, session-config, Arweave bootstrap/tag/JWK, admin
  bootstrap, and faucet helper paths.

## Auth flow (SIWE-style)

1) `POST /auth/nonce` body: `{ address, sessionSlug }`
   - Nonce request dispatch now also routes through a shared helper:
     it preserves nonce JSON parse failures, address validation, body/env slug resolution,
     missing-slug selection, existing-session CORS passthrough, lowercase nonce KV storage,
     and the final `{ nonce }` response contract.
   - Nonce generation/consumption now also route through a shared helper:
     it preserves 16-byte base64url nonce creation, lowercase nonce KV keys,
     `Nonce mismatch or expired.`, `Nonce already used.`, used-nonce TTL writes,
     and delete-on-success behavior across login, signed admin requests, and
     bootstrap admin verification.
2) Build a SIWE message client-side and sign with `personal_sign`.
3) `POST /auth/login` body: `{ address, message, signature, sessionSlug }`
   - Signed login request authority now also routes through a shared helper:
     it preserves slug resolution, address/message/slug preconditions,
     existing-session CORS passthrough, SIWE/signature/nonce validation,
     missing-config `404`, and on-chain scope computation before token signing.
   - Signed login request dispatch remains the thinner shared helper shell:
     it preserves login JSON parse failures, token signing, and the final
     `{ token, exp }` response contract after the extracted authority helper
     resolves the signed request. New tokens include a crypto-random `jti`
     and are returned only after the matching KV token marker is persisted.
   - Token signing / verification now also route through a shared helper:
     it preserves `JSON.stringify(payload)` signing, `base64url(payloadJson) + "." + base64url(hmac(payloadJson))`,
     cached HMAC key reuse, the exact token verification error strings, `jti`
     type validation, and `exp` comparison in epoch seconds.
   - SIWE message parsing/validation now also routes through a shared helper:
     it preserves trimmed `URI` / `Chain ID` / `Nonce` / `Issued At` / `Expiration Time` extraction,
     required field checks, URI host vs domain matching, and invalid/expired expiration rejection
     across login, signed admin requests, and bootstrap admin verification.

On success, the worker returns `{ token, exp }` where `exp` is now + 4h.

Token format:
```
base64url(payloadJson) + "." + base64url(hmac(payloadJson))
```
New payloads: `{ sub, slug, scopes, exp, jti }`.

The worker stores `authToken:{slug}:{sub}:{jti}` in `GROUP_KV` with a TTL aligned
to the token lifetime. Authenticated routes reject `jti` tokens when that marker
is missing or expired, using the existing `401 { error: "Invalid token." }`
contract. Legacy signed tokens without `jti` continue to verify by signature,
shape, slug binding, and `exp` only until their natural 24h expiration window
has passed; the worker no longer mints no-`jti` tokens.

## Required headers

Authenticated requests must include:
- `Authorization: Bearer <token>`
- `X-Session-Slug: <slug>` when `DEFAULT_SESSION_SLUG`/`DEFAULT_GROUP_SLUG` are empty and the token has no slug claim (`X-Group-Slug` remains accepted as a legacy alias).
- Authenticated auth-header + token/request slug binding now routes through a shared helper:
  it preserves the existing `401 Missing Authorization header.`, `verifyToken(...)` error passthrough, `X-Session-Slug` before legacy `X-Group-Slug`, `400 Missing sessionSlug.`, and `403 Token does not match requested session slug.` behavior.
  For new `jti` tokens, the same helper also requires the live
  `authToken:{slug}:{sub}:{jti}` KV marker before route context resolution.
- Authenticated post-auth route context now also routes through a shared helper:
  it preserves the existing `404 Session config not found.`, fail-closed authenticated CORS rejection, and common authenticated context derivation (`slug`, `headers`, token `scopes`, lowercased `sub` address, and `limits.perWalletPerDay`) before route-specific scope/rate-limit handling runs.
- Authenticated route scope/rate-limit preflight now also routes through a shared helper:
  it preserves per-scope `403 Token missing ... scope.` failures, `429 Rate limit exceeded.` selection, shared `checkRateLimit(...)` inputs, and the faucet bypasses that now allow `request_test_eth` to continue without token faucet scope when either an SBT proof payload is present or the request is funding the authenticated wallet and current `txGas` gate access is re-checked downstream.
- Authenticated secret-backed route secrets resolution now also routes through a shared helper:
  it preserves the shared `getSessionSecrets(env, slug)` lookup plus `401 Session secrets not configured.` failure before authenticated `ai`, `transcribe`, `arweave/upload`, and `request_test_eth` dispatch continue.
- Authenticated secret-backed path-route dispatch now also routes through a shared helper:
  it preserves the downstream handoff for authenticated `POST /transcribe` and `POST /arweave/upload`, including the existing preflight + secrets helper composition and the arweave uploader/config handoff shape, while leaving authenticated action-route dispatch unchanged.
- Authenticated secret-backed action-route dispatch now also routes through a shared helper:
  it preserves the downstream handoff for authenticated `/ai` and `request_test_eth`, including AI provider dispatch (`anthropic`, `openai`, `openrouter`, `custom`), unsupported-provider `400` handling, and the faucet proof-backed bypass / `tokenHasFaucetScope` handoff, while leaving non-secret fetch action routes unchanged.
- Authenticated non-secret action-route dispatch now also routes through a shared helper:
  it preserves the downstream handoff for authenticated `fetch_url` and `fetch_image`, including the shared fetch scope/rate-limit preflight and the existing URL/image validation behavior that still lives in the downstream fetch helpers.
- Authenticated route dispatch ordering now also routes through a shared helper:
  it preserves secret path-route checks before authenticated JSON parsing, keeps authenticated parse errors on the existing `Expected application/json.` / `Invalid JSON.` path with authenticated headers, runs non-secret action routes before secret action routes, and retains the final authenticated `404 Not found.` response contract.

Anonymous exception (AI/transcribe only):
- `POST /ai` and `POST /transcribe` may run without `Authorization` only when either:
  - request includes a non-empty `apiKey`, or
  - on-chain gate authority is available and both `default` + `ai` gates are explicitly open.
- Anonymous `apiKey` bypass does not inherit worker secrets:
  - For `provider: "custom"` on `POST /ai`, request must include `rpcUrl` (no fallback to secret `customRpcUrl`).
- Session scope overrides still apply to anonymous requests:
  - `scopes.ai=false` denies anonymous `POST /ai` (even when a request `apiKey` is present).
  - `scopes.transcribe=false` denies anonymous `POST /transcribe`.
- If on-chain gate authority is unavailable/unresolved, anonymous access fails closed.
- For the canonical default session slug (`""`), clients should send `X-Session-Slug: general` on anonymous-first attempts.
- Anonymous requests are still rate-limited with an anonymous identity key.
  - That rate identity now routes through a shared helper:
    native Cloudflare runtime prefers `CF-Connecting-IP`; otherwise the worker only uses a valid
    `X-Anonymous-Client-Id` as a best-effort sharding key and falls back to `anon:unknown`.
  - Anonymous slug selection now also routes through a shared helper:
    it prefers `X-Session-Slug`, still accepts legacy `X-Group-Slug`, and preserves the current
    fail-closed missing-slug behavior when no explicit anonymous slug is provided.
  - Anonymous route dispatch now also routes through a shared helper:
    it preserves `/transcribe` multipart parse failures before anonymous gate evaluation, keeps
    request-`apiKey` bypass from touching worker secrets, retains the anonymous custom-provider
    `rpcUrl` validation for `/ai`, and preserves downstream provider/transcribe dispatch behavior.

## Admin endpoints (signed message, no token)

Admin requests require a fresh signed SIWE message (no session token):
- `POST /admin/set-config`
- `POST /admin/set-secrets`
- `POST /admin/secret-presence`
- `POST /admin/set-limits`
- `POST /admin/lit-chipotle-status`

Never return secrets in responses.

`/admin/set-config` notes:
- The session slug is taken from the signed request context, not trusted from `config.slug`.
- Legacy string `allowOrigins` payloads are accepted and normalized into arrays.
- `limits` and `scopes` only merge from object payloads; malformed non-object patches are ignored rather than corrupting stored branches.
- Signed request validation is shared with login/bootstrap flows:
  - the recovered signer must match request `address`
  - the SIWE message address must also match request `address`
- Bootstrap admin fallback for missing-config `set-config` now also routes through a shared helper:
  it preserves the legacy requested-admin match when the worker is not registry-wired or the slug is not yet registered,
  and still switches to on-chain admin authorization once the registry proves the slug exists.
- Configured admin authorization now also routes through a shared helper:
  it preserves direct `adminAddress` authorization, uses config-derived RPC URLs for optional Hats `isWearerOfHat(...)`
  checks, and still fails closed when Hats config is incomplete or no configured RPC can prove the wearer.
- Signed admin request authority now also routes through a shared helper:
  it preserves signed slug resolution, address/message/slug preconditions,
  existing-session CORS passthrough, SIWE/signature/nonce validation,
  bootstrap-admin fallback sequencing for missing-config `set-config`, and
  the final `Admin authorization failed.` response contract.
- Admin audience validation now accepts the current browser origin when that origin is already present in the session worker `allowOrigins`, and bootstrap `set-config` can seed that allowlist in the same signed request.
  - Non-browser callers still need either `ADMIN_TRUSTED_ORIGINS` or the worker origin itself.
- Signed admin request dispatch remains the thinner shared helper shell:
  it preserves admin JSON parse failures plus the explicit `Missing config.` /
  `Missing secrets.` / `Missing limits.` / `Unknown admin action.`
  responses and the existing config/secrets/limits persistence handoff.
- Admin secret value normalization now also routes through a shared helper:
  it preserves trimmed string secrets, JSON-stringified object secrets such as
  `arweaveJwk`, scalar-to-string normalization, and the existing allowed-key
  filter before `set-secrets` persists session secrets.
- `/admin/secret-presence` uses the same signed admin authority path as
  `/admin/set-secrets`, but returns only allowed-key booleans such as
  `{ "openaiKey": true }`. It never returns raw values, previews, derived
  addresses, or unrecognized secret keys. The `/admin` Worker secrets cards use
  this manifest so blank write-only inputs are shown as unknown until verified
  instead of being mislabeled as empty.
- Lit sponsorship now adds:
  - `litUsageApiKey` as a supported worker-secret field for scoped Chipotle execution
  - `litAccountApiKey` as a server-only session secret for per-session-account provisioning and later action management
  - `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid }` as worker config
    metadata; these are not cryptographic secrets, but they stay worker-side by
    default because they still reveal operational topology
  - worker env fallback to `LIT_ACCOUNT_API_KEY` (or `LIT_USAGE_API_KEY`) for
    Chipotle-backed requests when a session-specific Lit account/usage key is not present
  - `/lit/chipotle-action` now receives the worker `env` during authenticated
    dispatch, so the deployment-level Lit env fallback applies to runtime
    execution as well as status/provisioning paths
  - v2 Chipotle wrapped keys bind `{ chainId, gateMode, sbtAddresses,
    litActionCid, litPkpId }` into the encrypted plaintext via a policy
    fingerprint; decrypt returns the CEK only when the embedded fingerprint
    matches the worker-approved policy
  - `encrypt` does not require target SBT ownership, while `check` and
    `decrypt` still enforce the SBT gate
  - `check` / `decrypt` derive RPC from worker-approved config, secrets, or
    defaults. Request `rpcUrl` / `customRpcUrl` is rejected unless it exactly
    matches that allowlist, and the Lit Action rejects endpoints whose reported
    chain ID does not match the gate chain.
  - stored Chipotle metadata omits RPC URLs; legacy v1 / bare-hex Chipotle
    wrapped keys are rejected by default and must be recreated with v2 metadata
  - admin `POST /admin/lit-chipotle-status` to query worker-mediated Chipotle
    readiness, billing balance, and configured group/action/PKP membership
    without returning the stored API key
  - admin `POST /admin/lit-chipotle-provision` to register the default CE action
    into an existing Lit account using a stored session `litAccountApiKey` or a
    deployment-level fallback account key
  - admin `POST /admin/lit-chipotle-bootstrap-session` to either create a
    brand-new Lit account for the session or, when a session/deployment
    `litAccountApiKey` already exists, derive the missing group / PKP / usage
    key / CE action inside that account, then persist the returned
    `litCredentials` plus any newly generated session secrets in the same
    worker-side flow
  - planned sponsored-bundle authority mode: carry a disposable per-bundle
    `litAccountApiKey` in the encrypted `/sponsor` payload so `/new` can mint a
    fresh group / PKP / usage key for each redeemed session, then keep using
    only the scoped runtime during day-to-day execution
  - after default action-source changes, operators must re-run
    `lit-chipotle-provision` or `lit-chipotle-bootstrap-session` so session
    `litCredentials.litActionCid` points at the newly derived action CID; there
    is no compatibility fallback to the old action source

## Gating on login (on-chain)

On `/auth/login`, the worker checks:
- `default` gate (if unset, login is allowed and other gates only affect scopes)
- `ai`, `arweave`, `txGas`, `rpc`, `lit` gates

Precedence and fallback:
- SessionRegistry gates are authoritative and required for login/resource scope checks.
- Legacy metadata/config gate fields are ignored for auth decisions.
- If on-chain gate authority is unavailable/uninitialized, `/auth/login` fails closed (with warning logs).
- Client auth now retries transient `on-chain gate data unavailable` login failures (short backoff, then fail closed if still unavailable).

If a non-default gate has no SBT addresses, it allows by default. Modes:
- `Any` → user must own at least one SBT
- `All` → user must own all listed SBTs

Scopes map to worker resources (`ai`, `arweave`, `transcribe`, `faucet`, `fetch`).

Signed login/bootstrap requests:
- The worker normalizes signed request `address`, `message`, `signature`, and `requestId` before verification.
- The recovered signer and the SIWE message address must both match request `address`; mismatches fail with `400`.
- Bootstrap `/arweave/upload` payload parsing now routes both JSON and multipart requests through a shared helper:
  it trims bootstrap `requestId`, keeps `sessionSlug` as the canonical session field, and detects caller-provided
  `arweaveJwk` presence the same way for both content types while preserving `Invalid JSON.`, `Expected multipart/form-data.`,
  and `Unsupported Content-Type.` bootstrap errors.
- Authenticated `arweaveUpload()` payload parsing also routes both JSON and multipart requests through a shared helper:
  it centralizes `data` / `file`, `contentType`, `tags`, request `arweaveJwk`, and upload `requestId` extraction while preserving
  `Invalid JSON`, `Expected multipart/form-data`, `Missing "data" in JSON body`, `Missing "file" or "data" field`, and
  `Unsupported Content-Type` upload errors.
- Arweave JWK resolution also routes through a shared helper:
  request `arweaveJwk` overrides worker-stored `arweaveJwk`, and malformed request overrides fail closed with
  `Invalid arweaveJwk (must be JSON)` instead of silently falling back to worker secrets.
- Arweave `CE-*` tag parsing also routes through a shared helper:
  it owns tag JSON/object parsing, duplicate/reserved-name rejection, `CE-` prefix enforcement, and the tag-array
  get/set helpers used by the downstream session-id and SBT association checks.
- Arweave association enforcement also routes through a shared helper:
  `workers/sessionCorsWorker/arweaveAssociationNormalization.js` now acts as the
  small association-normalization shell, and the authority-heavy session-id / SBT checks route through
  `workers/sessionCorsWorker/arweaveAssociationAuthority.js`; together they preserve `CE-SessionId`
  registry resolution/mismatch enforcement, `CE-SbtChainId` / `CE-SbtAddress` pair validation,
  uploader holder/admin/owner authorization checks, and canonical tag rewrites while preserving the
  existing fail-closed `400`/`403` behavior.
- AI request parsing/provider resolution also routes through a shared helper:
  it preserves the existing `Expected application/json.` / `Invalid JSON.` failures, trims request `apiKey` /
  `rpcUrl`, centralizes provider inference, and keeps the anonymous custom-provider request-`rpcUrl` requirement
  behind one boundary.
- Transcribe request parsing also routes through a shared helper:
  it preserves the existing `Expected multipart/form-data.`, missing-file, unsupported-provider, and custom
  request-`rpcUrl` failures while centralizing multipart field normalization for anonymous and authenticated
  `/transcribe` calls.
- Authenticated root action parsing also routes through a shared helper:
  it preserves the existing `Expected application/json.` / `Invalid JSON.` failures and centralizes trimmed
  `action` extraction for authenticated `POST /` action payloads and authenticated `/ai`.
- Anonymous AI/transcribe route authority also routes through a shared helper:
  it preserves route validation, request-`apiKey` bypass precedence, scope override denial, fail-closed
  on-chain authority checks, and the open `default` + `ai` gate requirement for anonymous access.
- Anonymous rate-identity normalization also routes through a shared helper:
  it preserves the existing Cloudflare-only `CF-Connecting-IP` trust rule, `X-Anonymous-Client-Id`
  lowercasing/validation, and `anon:unknown` fallback used for anonymous rate limiting.
- Anonymous request slug resolution also routes through a shared helper:
  it preserves `X-Session-Slug` before legacy `X-Group-Slug`, still routes through worker slug canonicalization,
  and keeps the anonymous missing-explicit-slug contract before config lookup.
- Existing-session CORS resolution also routes through a shared helper:
  it preserves normalized config lookup plus the current pass-through behavior for missing config, successful
  allowlisted origins, and fail-closed `Origin not allowed.` responses on auth/admin paths before deeper processing.
- Shared CORS evaluation also routes through a shared helper:
  it preserves `allowOrigins` parsing, `Access-Control-Allow-Origin` calculation inputs, and fail-closed
  `Origin not allowed.` response selection used across auth, admin, anonymous AI/transcribe, and authenticated routes.
- Shared default route-base-header selection also routes through a shared helper:
  it preserves reflected-origin default headers before config-backed CORS and deeper auth checks run on
  `OPTIONS`, auth/admin entry routes, bootstrap `/arweave/upload`, anonymous missing-slug/missing-config failures,
  and authenticated pre-`requireAuth(...)` responses such as `/health`.
- Shared top-level route selection also routes through a shared helper:
  it preserves the current `OPTIONS` / auth / admin / anonymous / authenticated branch selection order plus
  the Arweave bootstrap-vs-authenticated handoff and admin-action trimming before the downstream route helpers execute.
- Shared top-level worker route shell also routes through a shared helper:
  it preserves URL/path/method derivation, default base-header selection, `OPTIONS` `204`, `/arweave/upload`
  preflight logging, env-slug resolution, and the auth/bootstrap/admin/anonymous/authenticated handoff order
  before the downstream route-entry helpers execute.
- Shared worker route runtime also routes through a shared helper:
  it preserves the higher-level registry/login/bootstrap, anonymous/rate-limit, auth/CORS/admin,
  execution-service, and final route-shell assembly before `worker.js` exports `workerAuthGateUtils` and `fetch`.
- Shared worker low-level helper assembly also routes through a shared helper:
  it preserves outbound URL safety, ethers primitive/interface, registry/faucet RPC, group-proof hashing,
  and RPC/contract probe cross-wiring before the extracted route-runtime helper consumes those low-level adapters.
- Anonymous route-entry setup also routes through a shared helper:
  it preserves missing explicit slug, `Session config not found.`, fail-closed CORS passthrough, and
  `Rate limit exceeded.` selection before the downstream anonymous dispatcher runs.
- Authenticated route-entry setup also routes through a shared helper:
  it preserves `Missing Authorization header.`, authenticated `/health`, authenticated context resolution,
  and downstream authenticated dispatch handoff before route-specific scope/rate-limit logic runs.
- Anonymous route-dispatch binding also routes through a shared helper:
  it preserves the env-bound worker-secrets lookup and the existing anonymous provider/transcribe helper
  wiring before the extracted anonymous dispatcher runs.
- Authenticated route-dispatch binding also routes through a shared helper:
  it preserves the env-bound secret-path/non-secret-action/secret-action helper wiring and the existing
  fetch/AI/faucet helper bundle before the extracted authenticated dispatcher runs.
- Fetch target normalization also routes through a shared helper:
  it preserves the existing `Missing url`, `Invalid URL`, `URL must be http(s)`, and blocked-target failures
  before `fetch_url` / `fetch_image` execute outbound requests.
- Faucet request/config preflight also routes through a shared helper:
  it preserves `address|recipient|to` alias resolution, faucet RPC/chain precedence, smaller-only requested
  `amountEth`/`amount` overrides, existing threshold/amount parse failures, the missing-`faucetPrivateKey`
  `401`, and the stable `[faucet] request` log fields before proof validation and RPC send attempts.
- Faucet proof eligibility also routes through a shared helper:
  `workers/sessionCorsWorker/faucetEligibilityValidation.js` now keeps the
  authenticated-wallet recipient match and `sbtAddress` preconditions in the
  shell while `workers/sessionCorsWorker/faucetEligibilityAuthority.js` owns
  session-gate lookup passthrough, validation-state fail-closed handling,
  password-vs-group-vs-open proof branching, and the preserved faucet
  eligibility `flow` / `reason` / `status` / `error` behavior before the
  transfer loop executes.
- Faucet transfer execution also routes through a shared helper:
  it preserves normalized faucet request/eligibility composition, stable `[faucet] request` /
  `[faucet] chainId mismatch` / `[faucet] send failed` logging, `ethers.Wallet` creation from the worker secret,
  ordered per-RPC chain/balance/nonce/gas/send fallback handling, `eth_gasPrice` fallback to `0x3b9aca00`,
  per-RPC error accumulation, and final `{ txHash | error, attempts }` response normalization before the
  extracted faucet binding helper applies worker-local deps/constants.
- Faucet transfer binding now also routes through a shared helper:
  it preserves the worker-local JSON response helper, faucet logging wrapper, `ethers.Wallet` constructor,
  RPC/proof-validation deps bundle, and default faucet constants before the extracted execution helper runs.

## Endpoints

- `GET /health` (requires Authorization token; does not require session KV config, so it works for newly registered sessions during bootstrap)
- `GET /resource-presence` with `X-Session-Slug`
  - Validates the selected session and its browser-origin CORS policy.
  - Returns only `{ ai, arweave, rpc, txGas }` booleans derived from worker-held
    secrets. It never returns secret names, values, previews, or provider URLs.
  - The account/settings sponsorship cards use this as operational truth for
    the active session and retain registry flags as a compatibility fallback
    for older workers that return `404`.
- `POST /ai` or `POST /` with JSON `{ action: "ai", provider: "anthropic"|"openai"|"openrouter"|"custom", ... }`
  - Anonymous access is allowed only under the rules above (request `apiKey`, or explicit open `default+ai` gates with available on-chain authority).
  - Optional overrides: `apiKey` (all providers), `rpcUrl` (custom provider only).
  - Anonymous `apiKey` + `provider: "custom"` requires `rpcUrl`; worker secret `customRpcUrl` is not used for this bypass path.
  - Anonymous gate-authority checks now route through a shared helper before provider-specific validation:
    route scope disables still fail before request-`apiKey` bypass, and anonymous access without `apiKey`
    still requires on-chain `default` and `ai` gates to be explicitly open.
  - Request parsing/provider inference now routes through the AI helper:
    omitted/`default`/`auto` providers infer from `model` (`claude*` => Anthropic, slash models => OpenRouter, `gpt-*`/`o*`/`chatgpt` => OpenAI) before falling back to OpenAI.
- `POST /transcribe` (multipart/form-data, file field `file` or `audio`)
  - Anonymous access is allowed only under the rules above (request `apiKey`, or explicit open `default+ai` gates with available on-chain authority).
  - Optional overrides: `provider` (`openai` or `custom`), `apiKey`, `rpcUrl` (custom only).
  - Upstream size limit: OpenAI currently caps each speech-to-text file upload at 25 MB.
    Source: [Speech to text guide](https://platform.openai.com/docs/guides/speech-to-text) and [Audio API FAQ](https://help.openai.com/en/articles/7031512-audio-api-faq).
    Keep client uploads below that limit or chunk them before forwarding to `/transcribe`.
  - Anonymous gate-authority checks for `/transcribe` route through the same helper used by anonymous `/ai`,
    so route validation, request-`apiKey` bypass, scope denial, and fail-closed on-chain gate checks share one path.
  - Request parsing now routes through the transcribe helper:
    it accepts `file` or legacy `audio`, defaults `model` to `whisper-1`, trims request `apiKey` / `rpcUrl`,
    and requires request `rpcUrl` whenever `provider: "custom"` is selected.
  - Upstream transcribe execution now also routes through `workers/sessionCorsWorker/transcribeExecution.js`,
    preserving provider selection, blocked custom-target rejection, request-vs-worker key precedence,
    upstream 401/general error mapping, and final `{ text }` response normalization.
  - The remaining worker-specific transcribe binding now also routes through
    `workers/sessionCorsWorker/transcribeExecutionBinding.js`, preserving the worker-local
    `safeFetch` / blocked-url / default-URL deps bundle before the execution helper runs.
- `POST /arweave/upload` (multipart or JSON)
  - Optional override: `arweaveJwk` (JSON string or object).
  - Upload bodies are capped at 25 MB by default. The Worker rejects oversized `Content-Length`, JSON `data`, or multipart file bytes with `413`; set `CE_MAX_UPLOAD_BYTES` to configure the limit.
  - Bootstrap parsing for unauthenticated uploads is normalized across JSON and multipart before slug validation/admin checks.
  - Unauthenticated bootstrap upload dispatch now also routes through a shared helper:
    it preserves the no-auth-only bootstrap handoff, the missing-config + request-`arweaveJwk` bootstrap rule,
    fail-closed bootstrap CORS handling, admin verification passthrough, and downstream upload context handoff.
  - Bootstrap admin-signature verification now also routes through a shared helper:
    `workers/sessionCorsWorker/adminSignatureVerification.js` now keeps the
    slug alias/worker-slug mismatch handling and logging shell while
    `workers/sessionCorsWorker/adminSignatureAuthority.js` owns the deeper
    address/signature/SIWE/nonce/admin-authorization chain, the
    bootstrap-no-config bypass for caller-supplied `arweaveJwk` uploads,
    and the final `Admin authorization failed.` gate before upload
    execution.
  - The remaining worker-specific bootstrap admin-signature binding now also routes through
    `workers/sessionCorsWorker/adminSignatureVerificationBinding.js`, preserving the used-nonce ttl binding
    plus the current logging and slug-mismatch constants before the verifier runs.
  - Authenticated/bootstrap Arweave upload execution now also routes through
    `workers/sessionCorsWorker/arweaveUploadExecution.js`, preserving module resolution,
    upload-start/success/error logging, tag/association rejection logs, and the `transactions.post(...)`
    fallback error contract while leaving upload behavior unchanged.
  - The remaining worker-specific authenticated/bootstrap Arweave upload binding now also routes through
    `workers/sessionCorsWorker/arweaveUploadExecutionBinding.js`, preserving the worker-local logging/json helpers
    plus the contract/tag/association deps bundle before the execution helper runs.
  - Authenticated upload parsing is also normalized across JSON and multipart before JWK parsing, tag validation, and upload execution.
  - If request `arweaveJwk` is present, it is authoritative for that upload; malformed overrides fail closed rather than falling back to the worker secret.
  - Optional `tags`:
    - JSON: `tags: [{ name: "CE-...", value: "..." }, ...]`
    - multipart: `tags` form field containing the same JSON string.
    - Malformed JSON in `tags` is rejected with `400`.
    - Non-`CE-` custom tags and reserved names like `Content-Type` / `App-Name` are rejected with `400`.
    - The worker only accepts caller-supplied tags starting with `CE-` and enforces size/count limits.
  - Association integrity and anti-spam checks for `CE-*` tags:
    - These checks now route through a dedicated normalization shell plus an authority helper before upload execution.
    - If `CE-SessionId` is present, the worker resolves the authenticated session’s `sessionIdHex` from `SessionRegistry.getSessionBySlug(slug)`
      and rejects mismatches (and overwrites the tag to the canonical value).
    - If `CE-SbtChainId` + `CE-SbtAddress` are present, the worker requires the uploader is a holder (`balanceOf > 0`) or an `admin()`/`owner()`
      where available; it fails closed when no RPC URL is available for that chain, and accepted tags are rewritten to canonical chain/address values.
  - Bootstrap admin upload (no token): include `address`, `message`, `signature`, and `sessionSlug` in the JSON or multipart body to
    authorize upload. Legacy `groupSlug` is migration-only compatibility and should not be used for new non-SBT callers.
  - New-session bootstrap rule: if session KV config does not exist yet, include `arweaveJwk` in the same request.
    Without `arweaveJwk`, bootstrap uploads fail with:
    `Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.`
- `POST /` with JSON `{ action: "fetch_url" | "fetch_image" | "request_test_eth", ... }`
  - Authenticated JSON body parsing for these action routes now shares the same helper used by authenticated `/ai`,
    so `application/json` parse failures and trimmed `action` normalization are handled in one place before fetch/faucet/AI dispatch.
  - `fetch_url` / `fetch_image` target URL parsing now also routes through a shared helper before outbound fetch:
    it trims the request URL, requires `http(s)`, and preserves the existing blocked-target behavior.
  - `request_test_eth` faucet preflight now also routes through a shared helper before proof validation and RPC send:
    it resolves `to|recipient|address`, keeps `faucet.chainId -> networkChainId -> registryChainId` precedence,
    and only applies request `amountEth` / `amount` overrides when they are parseable, positive, and no larger than
    the configured faucet amount.
  - Proof-backed faucet eligibility now also routes through a shared helper after preflight:
    it keeps the authenticated-wallet recipient requirement when `scopes.faucet` is absent and now re-checks the
    current `txGas` gate for same-wallet generic funding requests before falling back to the existing
    `Missing sbtAddress.`, `Invalid sbtAddress.`, `Invalid password.`, and group-signature failure behavior.
  - For SBT proof-backed faucet eligibility, the `txGas` resource gate is authoritative by default. The worker
    only checks other session resource gates when session config explicitly sets
    `faucet.allowResourceGateFallback: true`.
  - Faucet RPC execution now also routes through a shared helper after preflight + eligibility:
    it keeps the ordered per-RPC fallback loop, threshold `403` when `currentBalanceWei > thresholdWeiBig`,
    `eth_gasPrice` fallback to `0x3b9aca00`, per-RPC error accumulation, and the final
    `{ txHash, status: null }` success / `{ error, attempts }` failure response shapes.
  - For `request_test_eth`, you may include `amountEth` to request a smaller amount than the configured faucet
    amount (larger values are ignored).
  - Authenticated callers that already have `scopes.faucet=true` may continue using the generic payload
    `{ action: "request_test_eth", address|to, amountEth? }`.
  - Same-wallet generic funding requests (`address|to` matches the authenticated bearer wallet) may also proceed
    without `scopes.faucet=true` when the worker can re-check the current on-chain `txGas` gate and confirm access.
  - For pre-claim funding before the wallet holds the gate SBT, include `sbtAddress`. Password-mint SBTs also
    require `hashedPassword`; group-password SBTs require `signature` for the group mint authorization
    message `(sbtAddress, recipientAddress)`. Public `groupPasswordHash` values are not accepted as faucet proof.
  - Proof-backed faucet requests must fund the authenticated wallet tied to the bearer token.
  - `request_test_eth` is always token-required. Third-party generic transfers still require `scopes.faucet=true`;
    same-wallet generic requests may re-check `txGas` access without that scope, and proof-backed pre-claim funding
    may proceed without that scope when the request includes `sbtAddress` plus the required proof.

## Self-deploy

Manual:
- Download the latest release bundle asset: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js`.
- Or rebuild local fallback bundles from the repo root with `nvm use 20 && npm run worker:bundle`.
  - Session worker paste/upload file: `dist/sessionCorsWorker.bundle.js`
  - Deploy-helper paste/upload file: `dist/deployHelper.bundle.js`
- Enable Node.js compatibility + add deps in the dashboard.
- Create KV namespace `GROUP_KV` and add vars.

Deploy-helper (trusted, self-host via CLI or Wrangler):
- For a copyable starting point, use `workers/deploy-helper/wrangler.example.toml` and `workers/deploy-helper/.dev.vars.example`.
- Deploy `workers/deploy-helper/worker.js` with your own Wrangler config (`wrangler.toml` or equivalent).
  - If you insist on dashboard/manual upload instead of Wrangler, pre-bundle the helper first because the checked-in source imports `../shared/*.mjs`.
- Or publish it directly with the repo automation helper:
  - `nvm use 20 && npm run deploy-helper:deploy -- --worker-name <your-helper-name> --api-token <cloudflare-token> --allowed-origins https://your-app.example,http://localhost:3000`
  - If you omit `--allowed-origins`, the CLI seeds the stable hosted/local defaults only. Unlike `/new`, it does not know your current self-hosted browser origin, so custom hosts still need an explicit `--allowed-origins`.
  - If you omit `--admin-secret`, the script generates one and prints it after deploy so you can still manage `/admin/origins`.
- `POST /deploy` with CF API token, worker name, admin address, registry info, rpcUrl (optional hats config).
  - `accountId` remains optional for low-level callers, but the first-party wizard now omits it and lets the helper resolve the account from the API token.
  - Provide either `bundleUrl` (release asset) or `bundleText` (raw bundle contents) from the `/new` UI.
- The helper fetches the latest bundled worker asset and configures KV + bindings.
- Optional: pass `subdomain` (or `workersSubdomain`) to set the account-level workers.dev subdomain
  when none exists yet (falls back to a deterministic `ce-<accountId>` name). This is the only
  deploy-helper path that needs `Account Settings: Edit`; script-level Workers.dev enablement uses
  the Workers script scope.
- `allowOrigins` entries are normalized to origins (`https://host`, `http://localhost:3000`), and the
  helper returns a normalized `workerUrl` with protocol. The first-party Session Wizard default seed list includes the hosted app plus local dev/E2E origins for ports `3000`, `3001`, and `7391`.
- `/new` now uses the project helper by default at `https://ce-deploy-helper.agalmic.workers.dev/`.
- If you self-host a different helper, set `REACT_APP_CE_DEPLOY_HELPER_URL=https://<deploy-helper-name>.<account-subdomain>.workers.dev/` in `client/.env` so the local `/new` flow uses your override instead.

Warning: passing a Cloudflare API token to a deploy-helper requires trust.

## Release bundle

- The default deploy-helper bundle URL is the GitHub release asset: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js`
- Canonical worker sources live under `workers/sessionCorsWorker/` and `workers/deploy-helper/`.
- This repo no longer mirrors `.js.txt` worker copies into the client asset tree.
- Rebuild local fallback bundles with `nvm use 20 && npm run worker:bundle` and verify they match source with `npm run verify:worker-bundle`.
- `dist/sessionCorsWorker.bundle.js` and `dist/deployHelper.bundle.js` are generated local/manual fallback bundles for worker upload flows; they are not tracked git artifacts anymore.
- GitHub bundle publishing is now automated via `.github/workflows/publish-worker-bundles.yml`. Once Actions are enabled in the GitHub repo, every push to `main`/`master` creates a fresh release containing both bundle assets and explicitly marks that release as latest, which keeps `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js` live.
- The worker currently pins `ethers@6.15.0` intentionally. The root app and client remain on `ethers@5.7.2` until the broader client migration is done, so this version split is expected.

## Future work

We plan to explore TEE/attested proxy options for stronger trust guarantees in a future version.
We may also migrate the proxy to alternate compute hosts to reduce reliance on a single edge provider.
