# Session Creation Guide

This guide walks through the current end-to-end session creation flow for Context Engine on OP Sepolia (`11155420`): prerequisites, the `/new` Session Wizard, worker deployment options, post-create checks, and the most common failure modes.

Related docs:

- [Cloudflare worker reference](session-cors-worker.md)
- [Arweave payload shapes](arweave-payloads.md)
- [SessionRegistry reference](session-registry.md)
- [Sponsored resource keys](resource-keys.md)

## What a New Session Needs

Use this as the quick checklist for a production-style session created from `/new`.

| Input | Why it is needed | Required? | Can a sponsored bundle cover it? |
| --- | --- | --- | --- |
| Connected browser wallet | Signs admin auth, deploy follow-ups, and on-chain session registration | Yes | No |
| OP Sepolia ETH in that wallet | Pays `SessionRegistry.createSession(...)` fee + gas | Yes | Partially. A sponsored faucet can top up publish gas, but you still need the wallet itself. |
| Cloudflare Worker | Hosts auth, AI, Arweave upload, fetch, and optional faucet routes | Yes | Yes, if the sponsor gives you a deploy-ready bundle |
| Cloudflare API token | Needed when you are deploying a new worker through the helper flow yourself | Usually | Indirectly. The raw token is not bundled; `/sponsor` exchanges it for a deploy grant token so the recipient does not have to paste the raw Cloudflare token. |
| AI provider key | Powers AI generation, chat, and transcription routes. OpenAI is required by default when the selected fast/thinking models use OpenAI; Anthropic/OpenRouter are conditional on the chosen model providers. | Usually | Yes |
| Arweave JWK | Pays for session metadata and other Arweave uploads | Yes for publish/upload flows | Yes |
| RPC URL | Used by the worker for chain reads and related operations | Yes for a deploy-ready worker | Yes |
| Faucet private key | Lets the session sponsor small OP Sepolia ETH grants for onboarding/publish support | Optional | Yes |
| Lit credentials for gated fields or Lit-encrypted payloads | Needed only when the session uses worker-mediated Lit/Chipotle encryption, `lit-arweave`, or Cloudflare `lit_encrypted` payload mode. The manual `/new` setup asks only for one Lit API key; E2E/deploy env should prefer `LIT_USAGE_API_KEY`, while `litAccountApiKey` remains the internal worker-secret field backing the visible input. The worker derives `litUsageApiKey` plus `litApiBase` / `litGroupId` / `litPkpId` / `litActionCid` after deploy when needed. Cloudflare `worker_sbt_gate` and `worker_envelope` modes do not require a Lit key. | Optional | Yes |

Important:

- The worker secret minimum for the normal deploy-ready path is: AI key(s) matching the selected provider, Arweave JWK, and RPC URL.
- The faucet private key is not required to create a session. It is only needed if you want the session to sponsor testnet gas for users or bootstrap publish funding.
- Lit-sponsored setup is optional. Today the manual deploy-ready flow centers on one visible Lit API key, normally sourced from `LIT_USAGE_API_KEY` in E2E/deploy automation. Sponsored bundles can still carry either that single authority key through the legacy internal `litAccountApiKey` field or already scoped runtime values when an admin intentionally prepares them. If `/new` Advanced selects Cloudflare `worker_sbt_gate` or `worker_envelope`, the Lit key input is hidden because access is enforced by the session worker rather than Lit.
- Secrets live in worker secrets or sponsored bundles, not in public Arweave session metadata.

## Sponsored Bundles: Skip Manual Config

If you do not want the recipient to paste worker secrets manually into `/new`, use `/sponsor`.

High-level flow:

1. An existing session admin opens `/sponsor`
2. They choose which worker-backed resources to sponsor
3. The page uploads an encrypted bundle to Arweave
4. It returns a share URL shaped like `/new?sponsored=<txId>#k=<secret>`
5. The recipient opens that URL and the wizard auto-applies the bundled config client-side

What the sponsored bundle can supply to the recipient:

- OpenAI / Anthropic / OpenRouter keys
- Arweave JWK
- custom RPC URL
- faucet private key or faucet grant token
- Lit authority-bundle mode: one disposable Lit API key per bundle, carried through `litAccountApiKey` internally, so `/new` can create a fresh group / PKP / usage key for each new session
- scoped Lit runtime values when intentionally pre-provisioned: `litApiBase`, `litGroupId`, `litPkpId`, `litActionCid`, `litUsageApiKey`
- bootstrap worker URL and deploy grant token for grant-backed worker deploys

What it does not send directly:

- The raw Cloudflare API token. `/sponsor` swaps that for a deploy grant token and keeps the raw token only in the sponsoring worker's server-side grant record until redeem or expiry.
- The recipient's wallet. They still need a connected wallet to finish session registration and sign the required actions.

When a sponsored bundle is deploy-ready, the normal-mode wizard can skip the manual Worker step and go straight from Privacy to Deploy Session.

### Temporary standard sponsored links fixture

For short-lived demos or launches where the goal is "open the app and start
now," the repo includes a deliberately simple tracked fixture:

- `client/public/standard-sponsored-links.json`

This file can hold up to ten intentionally public sponsored `/new` URLs. The
checked-in version keeps every slot inactive and empty. Operators may paste
disposable sponsored URLs into the file, set selected entries to `"active": true`,
and publish the JSON through the app's static assets or a GitHub-hosted raw file.
Create those URLs through `/sponsor`, and back them only with low-budget,
revocable resources.

This is not a durable availability system. A link is "unused" only because the
operator has left it active in the manifest; the fixture does not mark links used
after a click. Treat every active URL as a public bearer grant and remove it once
it is consumed, expired, or reported broken. The fixture does not enforce spend
limits, so cap AI/provider keys, faucet wallets, Arweave wallets, and any Lit
usage keys or disposable Lit bundle accounts outside the manifest.

See [`docs/standard-sponsored-links-fixture.md`](standard-sponsored-links-fixture.md)
for the exact manifest contract. Long term, this should be replaced by a
worker-backed claim flow that returns one currently available setup link
without publishing the full pool.

## Prerequisites

### 1. Arweave wallet (JWK)

Context Engine stores session metadata, questions, surveys, SBT metadata, and most uploaded media on Arweave. You need an Arweave keyfile before you can publish a session with sponsored Arweave uploads.

Generate a wallet:

- Web wallet: [arweave.app](https://arweave.app) and download the keyfile JSON (JWK)
- Wallet guide: [Arweave.app Web Wallet](https://docs.arweave.org/developers/wallets/arweave-wallet)
- CLI option: `npx arweave key-create arweave-keyfile.json`

Fund the wallet with AR:

- Send AR directly to the wallet address from an exchange or another wallet
- Or use ArDrive/Turbo if you want a fiat-friendly path into Arweave uploads:
  [Fund Your Wallet](https://help.ardrive.io/hc/en-us/articles/5258520347419-Fund-Your-Wallet)
  and [Turbo overview](https://docs.ardrive.io/docs/turbo/what-is-turbo.html)

Operational notes:

- Treat the JWK like a private key. Anyone with the file controls the wallet.
- Keep a backup offline.
- In Context Engine, the JWK belongs in worker secrets, not in public metadata.

### 2. Cloudflare account and API token

The session worker handles auth, AI proxying, Arweave uploads, fetch helpers, and the optional faucet. A free Cloudflare account is enough for small sessions.

You need:

- A Cloudflare account: <https://dash.cloudflare.com/>
- An API token with Workers-related permissions. The wizard expects the same scope used by the deploy-helper flow described in [session-cors-worker.md](session-cors-worker.md).
- Cloudflare token templates reference: <https://developers.cloudflare.com/fundamentals/api/reference/template/>

In practice, the deploy flow needs least-privilege permission to manage Workers scripts, Workers KV, R2 buckets/objects for CE payload blobs, D1 or KV metadata/index resources where configured, and Durable Objects only for signer/runtime coordination. `Account Settings: Edit` is needed only if the helper must create or change the account-level `workers.dev` subdomain; omit it when the account already has a workers.dev subdomain and the helper only enables a script URL. Do not put real account IDs, bucket names, API tokens, or production config in committed files.

### 3. OP Sepolia ETH

You need OP Sepolia ETH in the connected browser wallet to register the session on-chain and to pay gas for any optional SBT deployment done during publish.

Useful links:

- Optimism faucet directory: <https://docs.optimism.io/app-developers/tools/faucets>
- Superchain faucet: <https://console.optimism.io/faucet>
- QuickNode faucet: <https://faucet.quicknode.com/optimism/sepolia>
- Explorer: <https://optimism-sepolia.blockscout.com/>

Registration cost notes:

- `SessionRegistry.createSession(...)` currently requires a `0.0001 ETH` creation fee on top of gas
- `setSessionFields(...)` and `setResourceGates(...)` are separate follow-up transactions in the current flow

### 4. A connected browser wallet

Use any wallet that can connect to OP Sepolia and sign both transactions and SIWE-style messages:

- MetaMask
- Context Engine passkey EOA wallet
- Coinbase Wallet
- Other WalletConnect-compatible wallets

The same wallet is used for:

- Cloudflare worker admin signatures during setup
- Session registration transactions
- Optional SBT deployment transactions

## Session Creation Walkthrough

Open `/new`. The app canonicalizes that route to `/session/new`, but `/new` is the intended entry point.

The first screen is the session-mode choice. Nothing is preselected, and
Continue stays disabled until the creator chooses a preset. The four-stage
setup stays hidden until Continue, then opens with fields prefilled from the
chosen mode:

- `Fast & Cheap (Cloudflare)` compiles to a Cloudflare-backed,
  worker-canonical session shape. Its card lists the Cloudflare API token,
  AI provider key, Arweave JWK, RPC URL/key, and optional Lit key needed
  for Lit encryption.
- `Trustless & Public (Decentralized)` compiles to the public Arweave +
  EVM-registry session shape. Its card lists the Arweave wallet/JWK, RPC
  URL/key, AI provider key, and optional Lit key needed when encryption is
  enabled.

Advanced per-axis changes, such as enabling the Telegram surface or changing
storage/authority/encryption independently, flip the profile to `custom`. New
session publishes write the `sessionModeProfile` profile as the source of truth
and compile it down to the existing storage profile / payload-access fields for
runtime compatibility. Legacy `telegramOnly` fields are read only as a migration
fallback and are not written by new sessions.

The normal-mode wizard is effectively four stages:

1. Session Details
2. Privacy & Access
3. Worker
4. Deploy Session

### 1. Naming and session details

Enter the core session metadata:

- `sessionName`
- `sessionInfo`
- slug
  Use lowercase letters, numbers, `_`, or `-`. The reserved aliases `general`, `debate`, and `rxc` are not allowed for new sessions.
- session ID
- network/contract defaults
- `blockLimits.start`
- optional session header image

AI configuration also lives in the session metadata draft:

- `ai.models.fast`
- `ai.models.thinking`
- `ai.models.transcription`

What gets stored where:

- Arweave metadata stores the human-readable session config: name, description, AI defaults, block limits, contract pointers, featured lists, and any Lit-encrypted metadata fields
- `/new` Advanced can select `storageProfile.backend = "cloudflare"` for canonical session payload storage. Its default payload access mode is `worker_sbt_gate`: the session worker stores Cloudflare objects and checks the requester's SBT gate with configured chain/RPC before serving bytes. This is worker-enforced access control, not end-to-end encryption, so the Lit key input is hidden.
- Advanced encryption options are `none` (payload bytes are stored as provided), `lit` (Cloudflare stores caller-supplied Lit ciphertext and rejects plaintext uploads until the Lit path sends `payloadEncrypted=true`), and `worker_envelope`: Encrypted at rest. Keys are held by the session worker; decryption is gated by session conditions. `worker_envelope` is available only with Cloudflare storage. The operator and Cloudflare runtime can decrypt; it is not decentralized, not end-to-end, and not private from the session operator or Cloudflare runtime.
- When `/new` deploys a custom worker for Cloudflare storage, the deploy helper receives the normalized storage profile before Worker upload so it can bind the storage index KV and any requested R2 bucket. If `worker_envelope` is selected, the helper also generates the worker secret used as the deployment KEK; the generated value is not written to session metadata.
- Worker-envelope key provider is fixed to `worker_secret` in this release. Session-level conditions may use `worker_role`, `sbt_onchain`, or `agent_grant_scope` with `match: any|all`; the wizard writes them to `storageProfile.payloadAccessControl.accessConditions` for the worker.
- `SessionRegistry` does not store this long-form content directly; it stores the metadata URI pointer plus the minimal session identity fields

Important:

- `blockLimits.start` is required for a real session. Missing or invalid `start` breaks later question/survey scans.
- The wizard strips secrets and worker-only runtime config out of the Arweave payload before upload.

### 2. Privacy, SBT gates, and access control

Use the privacy section to decide who can decrypt locked metadata fields and who can access sponsored resources.

What you configure here:

- One or more SBT gates
- Gate mode: `Any` or `All`
- Default gate for the session
- Optional per-resource overrides (`ai`, `arweave`, `rpc`, `txGas`, `lit`, and other resource keys)
- Optional inline SBT creation if the required SBT does not exist yet

What happens later:

- If you created new SBT drafts in the wizard, publish can deploy them first through `SBTFactory.createSBT(...)` or its deterministic variant
- The final gate definitions are written on-chain through `SessionRegistry.setResourceGates(...)`
- Lit-encrypted metadata keeps references to the selected gate IDs, but gate authority itself remains on-chain in `SessionRegistry`

### 3. Worker deploy and secrets

The wizard needs a worker URL before it can upload session metadata to Arweave.

In the default helper flow you provide:

- Cloudflare API token
- worker name
- worker secrets such as:
  - OpenAI / Anthropic / OpenRouter key as needed by the selected AI models
  - Arweave JWK
  - RPC URL
  - optional faucet private key
  - optional custom RPC credentials

Common combinations:

- Minimal publish-capable session:
  - Cloudflare API token
  - worker name
  - AI provider key(s) matching the selected models
  - Arweave JWK
  - RPC URL
- Session with testnet gas sponsorship:
  - everything above
  - faucet private key
- Session created from a sponsored bundle:
  - connected wallet
  - session details
  - no manual worker-secret entry, as long as the bundle is deploy-ready

What happens during deploy:

- The deploy-helper calls Cloudflare’s Workers API
- It creates or updates the worker
- It fetches the account `workers.dev` subdomain and creates/changes it only when explicitly needed
- It returns the final worker URL
- The wizard auto-fills `corsWorkerUrl`
- The wizard signs admin requests and calls `/admin/set-config` and `/admin/set-secrets` to verify or backfill the per-session worker data

What gets stored where:

| Store | Contents |
| --- | --- |
| Worker KV `session:{slug}:config` | runtime config such as registry address, RPC URL, allowOrigins, limits, block limits, contracts, faucet settings, and worker URL |
| Worker KV `session:{slug}:secrets` | OpenAI/Anthropic/OpenRouter keys, Arweave JWK, faucet private key, and other runtime secrets |
| Arweave metadata | no worker secrets |
| `SessionRegistry` | compatibility session fields such as `corsWorkerUrl` and sponsored capability flags (`sponsored_ai`, `sponsored_arweave`, etc.) |

### 4. Registration and publish

When you click `Publish`, the current flow is:

1. Deploy any queued SBT drafts
2. Upload sanitized session metadata to Arweave through the worker `/arweave/upload` path
3. Register the session on-chain

The on-chain registration sequence is:

1. `SessionRegistry.createSession(slug, sessionId, chainId, metadataURI, encryptedMetadataURI)`
2. `SessionRegistry.setSessionFields(...)`
3. `SessionRegistry.setResourceGates(...)`

What each write does:

- `createSession(...)`
  - stores the slug, session ID, chain ID, metadata URI, encrypted metadata URI, admin address, and timestamps
- `setSessionFields(...)`
  - stores lightweight string fields such as `corsWorkerUrl` and the sponsored capability flags
- `setResourceGates(...)`
  - stores the authoritative SBT gate config per resource

After success, the wizard generates:

- the session URL: `/session/<slug>`
- an admin URL shaped like `/admin?sessionId=<uuid>&chainId=11155420`

## Worker Deployment Options

### CE-hosted deploy helper

This is the default path exposed in `/new`.

Use it when you want:

- the easiest path from the wizard
- automatic worker URL discovery
- automatic worker config and secrets bootstrap

High-level flow:

1. Enter the Cloudflare API token and worker name
2. Enter worker secrets in the wizard. Normal mode automatically uses the GitHub-hosted `sessionCorsWorker.bundle.js` release asset for deploy-helper requests.
3. Click `Deploy worker`
4. Wait for the helper to create/update the worker and return the `workers.dev` URL
5. If the helper cannot fetch the release asset, keep the default GitHub release URL and either paste a direct bundle URL override or run `nvm use 20 && npm run worker:bundle` and upload `dist/sessionCorsWorker.bundle.js`
6. Confirm that the worker URL is now filled in before publishing metadata

The first-party wizard now infers the Cloudflare account from the API token during deploy instead of asking for account ID separately.

Reference: [session-cors-worker.md](session-cors-worker.md)

### Sponsored `/sponsor` handoff

Use this when one session admin wants to help someone else launch a session without manually sharing raw worker secrets.

Best fit:

- onboarding a collaborator who should not have to paste OpenAI / Arweave / faucet credentials by hand
- creating a near-one-click `/new` flow for internal pilots
- preloading a worker deploy grant so the recipient does not need to enter a raw Cloudflare API token

What the recipient still needs:

- a connected wallet
- session name / slug / metadata choices
- enough publish authorization to complete the flow

Deep reference: see the `Sponsored bundle flow` section in [session-cors-worker.md](session-cors-worker.md).

### Self-hosted with Wrangler

Use this when you want to own the Cloudflare project directly and deploy the worker outside the helper flow.

Repo path:

- `workers/sessionCorsWorker/`

Minimal setup:

1. Install the worker dependencies:

   ```bash
   cd workers/sessionCorsWorker
   npm install
   ```

2. Create a `wrangler.toml` in that folder. The repo does not currently ship one for this worker, so create your own minimal config:

   ```toml
   name = "my-session-worker"
   main = "worker.js"
   compatibility_date = "2025-01-01"
   compatibility_flags = ["nodejs_compat"]

   [[kv_namespaces]]
   binding = "GROUP_KV"
   id = "<cloudflare-kv-namespace-id>"

   [vars]
   DEFAULT_SESSION_SLUG = ""
   DEPLOY_HELPER_ENABLED = "false"
   ```

3. Add the required secret:

   ```bash
   npx wrangler secret put TOKEN_HMAC_SECRET
   ```

4. Deploy:

   ```bash
   npx wrangler deploy
   ```

Operational notes:

- `GROUP_KV` is required
- `TOKEN_HMAC_SECRET` is required
- Leave `DEFAULT_SESSION_SLUG` empty for a multi-tenant worker, or set it to a specific session slug for a single-tenant worker
- After deploy, paste the resulting worker URL back into the wizard before publishing

If you also want one-click deploys from your own wizard instance later, separately self-host the deploy-helper described in [session-cors-worker.md](session-cors-worker.md).

### Manual Cloudflare dashboard upload

Use this when you want to avoid Wrangler and upload the worker bundle manually.

Recommended source files:

- Bundled release asset: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js`
- Generated repo-local fallback bundle after `nvm use 20 && npm run worker:bundle`: `dist/sessionCorsWorker.bundle.js`
- Canonical worker source: `https://github.com/AgalmicSoftware/context-engine/tree/main/workers/sessionCorsWorker`

Dashboard checklist:

1. Create a new Worker in Cloudflare
2. Paste or upload the bundled worker source
3. Enable Node.js compatibility
4. Add the `GROUP_KV` binding
5. Add the required vars/secrets, especially `TOKEN_HMAC_SECRET`
6. Deploy the worker
7. Copy the worker base URL into the wizard or `/admin`

This is the most manual option, but it works if the helper path is unavailable.

## Post-Creation

### Verify the session on `/admin`

Open the admin URL generated by the wizard, or manually visit:

`/admin?sessionId=<session-id>&chainId=11155420`

Confirm that `/admin` can resolve:

- session slug and session ID
- metadata URI
- registry chain and registry address
- worker URL
- sponsored capability flags
- resource gates

### Test worker health

Use the `Worker Tests` panel in `/admin` to run:

- `/health`
- AI test
- Arweave upload test
- transcription test
- faucet test

If `/health` or the other worker calls fail with browser network errors, use the `/admin` button `Allow this origin (CORS)` and test again.

### Add questions

Once the session exists, you can start populating it:

- use `/admin` to set session defaults and the question-generation prompt
- add questions or surveys through the normal authoring flow for that session
- use the AI audio generator flow if you want AI-assisted question generation

When questions/surveys are published:

- their JSON payloads go to Arweave
- the `Surveys` contract receives the question/survey registration write

For payload examples, see [arweave-payloads.md](arweave-payloads.md).

### Share the session URL

The public entry point is:

`/session/<slug>`

That route is what you share with participants after the session has been registered and checked in `/admin`.

## Troubleshooting

### Worker deploy fails

Check these first:

- the Cloudflare API token has permission to manage Workers scripts and KV
- the selected Cloudflare account is the one that should own the worker
- the account has an active `workers.dev` subdomain
- the worker name is unique enough for the target account

If the helper can deploy the worker but setup still fails afterward:

- re-open `/admin`
- verify the worker URL
- use the Worker Tests panel to confirm `/health`

### Questions are not loading

The two most common causes are bad scan bounds and a missing `Surveys` contract reference.

Check:

- `blockLimits.start` in session metadata
- `contracts.surveys.address`
- `contracts.surveys.chainId`

Why this matters:

- the app uses `blockLimits.start` to decide where question and survey discovery begins
- question creation later fails if the session does not have a valid `Surveys` contract address

### Auth issues

Check both CORS and SIWE assumptions:

- `allowOrigins` in the worker config must include the exact browser origin you are using
- the SIWE message domain must match the request URI host
- the connected wallet must be the session admin wallet for signed admin actions

Typical symptoms:

- `Failed to fetch` or `Load failed` from worker auth endpoints usually means the origin is missing from `allowOrigins`
- `SIWE domain does not match URI host.` means the login or admin signature was created for a different host than the one receiving the request
