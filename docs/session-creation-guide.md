# Session Creation Guide

This guide walks through the current `/new` Session Wizard, including the default
Cloudflare path and the opt-in decentralized/Lit variants. The default path no
longer requires an OP Sepolia or Arweave publish step.

Related docs:

- [Cloudflare worker reference](session-cors-worker.md)
- [Arweave payload shapes](arweave-payloads.md)
- [SessionRegistry reference](session-registry.md)
- [Sponsored resource keys](resource-keys.md)

## What a New Session Needs

For the default `Fast & Cheap (Cloudflare)` preset, the visible setup requires
exactly two credentials:

1. A Cloudflare API token with the least privileges needed to deploy the
   per-session worker.
2. One API key for the selected AI provider.

The app's passkey-derived EOA supplies the admin identity and signs the worker
config, but it does not submit a transaction and needs no gas. The Cloudflare
token on this direct `/new` path is deploy-helper request input only: it must
never be placed in the session or admin URL, public metadata, Worker session
config, logs, analytics, browser storage, or any other durable store. The AI key
is written only to the worker's session-secrets store. The separate legacy
sponsored deploy-grant path is described below and retains its existing
short-lived server-side grant record.

Use this matrix when choosing a non-default profile:

| Input | Why it is needed | Required? | Can a sponsored bundle cover it? |
| --- | --- | --- | --- |
| Passkey account | Supplies the admin identity and signs worker or on-chain actions | Yes; the default path creates it in the app | No |
| OP Sepolia ETH | Pays registry/SBT transactions | Decentralized or other on-chain profiles only | Partially |
| Cloudflare Worker | Hosts worker-canonical config, auth, AI, storage, fetch, and optional faucet routes | Yes for Cloudflare profiles | Yes, if the sponsor gives you a deploy-ready bundle |
| Cloudflare API token | Deploys a new worker through the helper; request-only and nonpersistent on the direct default `/new` flow | Yes for the default self-deploy flow | Indirectly, through the separate legacy short-lived deploy-grant path |
| AI provider key | Powers AI generation, chat, and transcription routes for the selected provider | Yes for the default preset | Yes |
| Arweave JWK | Pays for Arweave metadata/payload uploads | Decentralized or explicitly Arweave-backed profiles only | Yes |
| RPC URL | Provides chain reads and writes | Decentralized, Lit/on-chain gating, or explicitly chain-backed profiles only | Yes |
| Faucet private key | Lets the session sponsor small OP Sepolia ETH grants for onboarding/publish support | Optional | Yes |
| Lit credentials for gated fields or Lit-encrypted payloads | Needed only when the session uses worker-mediated Lit/Chipotle encryption, `lit-arweave`, or Cloudflare `lit_encrypted` payload mode. The manual `/new` setup asks only for one Lit API key; E2E/deploy env should prefer `LIT_USAGE_API_KEY`, while `litAccountApiKey` remains the internal worker-secret field backing the visible input. The worker derives `litUsageApiKey` plus `litApiBase` / `litGroupId` / `litPkpId` / `litActionCid` after deploy when needed. Cloudflare `worker_sbt_gate` and `worker_envelope` modes do not require a Lit key. | Optional | Yes |

Important:

- The default worker-canonical path does not require an Arweave JWK, Lit key,
  user-supplied RPC URL/key, wallet connector, faucet key, publish funding, or
  transaction gas.
- The faucet private key remains optional for profiles that deliberately sponsor
  testnet gas; it is not part of the default path.
- Selecting Lit keeps the existing Lit credential and chain/RPC requirements.
  Selecting the decentralized preset keeps the existing Arweave, registry,
  wallet-transaction, and gas requirements.
- Secrets live in the worker's secrets store or encrypted sponsored bundles,
  never in public Worker config or Arweave session metadata.

## Sponsored Bundles: Skip Manual Config

If you do not want the recipient to paste worker secrets manually into `/new`, use `/sponsor`.

High-level flow:

1. An existing session admin opens `/sponsor`
2. They choose which worker-backed resources to sponsor
3. The page uploads an encrypted bundle to Arweave
4. It returns an ID-only share URL shaped like `/new?sponsored=<txId>` and displays
   the decryption key separately
5. The recipient opens the URL, enters the separately delivered key, and the wizard
   applies the bundled config client-side
6. Decrypted credentials and the decryption key remain memory-only; a reload requires
   the key again unless the bundle is still available in the current page runtime

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
- The recipient's passkey identity. They need it for signed worker admin actions;
  only an on-chain profile also needs it to submit registration transactions.

When a sponsored bundle is deploy-ready, the normal-mode wizard can skip the manual Worker step and go straight from Privacy to Deploy Session.

### Temporary standard sponsored links fixture

For short-lived demos or launches where the goal is "open the app and start
now," the repo includes a deliberately simple tracked fixture:

- `client/public/standard-sponsored-links.json`

This file can hold up to ten intentionally public sponsored `/new` URLs. The URLs
contain only opaque bundle ids and are not redeemable without keys delivered through
a separate channel. The
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

### 1. Cloudflare account and API token

The session worker is the canonical config, auth, AI, and payload-storage host
for the default preset. A free Cloudflare account is enough for small sessions.

You need:

- A Cloudflare account: <https://dash.cloudflare.com/>
- An API token with Workers-related permissions. The wizard expects the same scope used by the deploy-helper flow described in [session-cors-worker.md](session-cors-worker.md).
- Cloudflare token templates reference: <https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/>

The default deploy flow needs exactly `Workers Scripts: Edit` and `Workers KV Storage: Edit`. [Create a token with those permissions prefilled](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%5D&accountId=%2A&zoneId=all&name=Context%20Engine%20Session%20Worker), or use the equivalent link in the wizard onboarding banner. Those scopes cover the worker script and secrets, workers.dev setup, the canonical session config, encrypted payload envelopes and indexes, groups, audit rows, and deploy state stored in KV. The script upload also installs the worker's `SessionWriteCoordinator` Durable Object class and binding; Cloudflare accepts that module upload through `Workers Scripts: Edit`, so the default token still has only these two permission groups. Add `R2: Edit` only for an advanced deployment that explicitly manages an existing R2 bucket; the token link does not create that bucket. D1, Durable Objects API, Account Settings, Workers AI, and Queues permissions are not required by the default path. When Cloudflare preselects `All accounts`, restrict Account Resources to the one account where the worker will run before creating the token. Cloudflare only pre-fills the creation form: create the token, copy its generated value, and paste it into the wizard's Worker step. Do not put real account IDs, bucket names, API tokens, or production config in committed files.

The deploy helper consumes the direct `/new` Cloudflare token in the deploy
request and does not return or persist it. A successfully published session URL
contains only the public worker origin, never the token. This request-only rule
is distinct from the existing sponsored deploy-grant workflow documented above.
You do not need to paste or configure a Cloudflare account ID: the deploy helper
uses the token to look up exactly one visible account through Cloudflare and
stops if the token exposes zero or multiple accounts.

### 2. AI provider key

Provide one key for the provider used by the selected fast/thinking models. The
default OpenAI model choices require one OpenAI key; choosing another provider
changes which single provider key is required. The key is stored in the
per-session worker secrets envelope, not the public session config returned to
browsers.

### 3. A signing identity

The default client build is passkey-only and uses the Context Engine passkey EOA wallet to sign OP Sepolia transactions and SIWE-style messages.

- Context Engine passkey EOA wallet

Deployments built with `REACT_APP_CE_ENABLE_METAMASK_CONNECTOR=true` can also use MetaMask. The separate WalletConnect fallback remains opt-in; see `docs/public-client-config.md`.

The same identity is used for:

- Cloudflare worker admin signatures during setup
- Session registration transactions in decentralized profiles
- Optional SBT deployment transactions

### Advanced only: Arweave wallet (JWK)

The default Cloudflare preset does not use Arweave. You need a JWK only after
choosing the decentralized preset or explicitly switching storage/publish
behavior to Arweave.

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

### Advanced only: OP Sepolia ETH

The default worker-canonical publish uses no transaction and needs no gas. You
need OP Sepolia ETH only when the selected profile registers the session
on-chain or deploys an SBT during publish.

Useful links:

- Optimism faucet directory: <https://docs.optimism.io/app-developers/tools/faucets>
- Superchain faucet: <https://console.optimism.io/faucet>
- QuickNode faucet: <https://faucet.quicknode.com/optimism/sepolia>
- Explorer: <https://optimism-sepolia.blockscout.com/>

Registration cost notes:

- `SessionRegistry.createSession(...)` currently requires a `0.0001 ETH` creation fee on top of gas
- `setSessionFields(...)` and `setResourceGates(...)` are separate follow-up transactions in the current flow

## Session Creation Walkthrough

Open `/new`. The app canonicalizes that route to `/session/new`, but `/new` is the intended entry point.

The first screen is the session-mode choice. A blank draft has nothing
preselected. If this browser already has an explicit saved profile, the header
shows that profile and offers `Continue with saved settings` instead of silently
discarding or replacing it. Choosing a new preset immediately opens the
four-stage setup with fields prefilled from the chosen mode; there is no
separate Continue action for a new selection:

- `Fast & Cheap (Cloudflare)` compiles to a Cloudflare-backed,
  worker-canonical session shape with Cloudflare-internal worker encryption
  (`worker_envelope`) enabled by default. After selection, the requirements
  banner lists exactly the Cloudflare API token and one AI-provider key. It does
  not ask for Arweave, Lit, RPC, funding, faucet, or gas inputs.
- `Trustless & Public (Decentralized)` compiles to the public Arweave +
  EVM-registry session shape. Its requirements banner lists the Arweave
  wallet/JWK, RPC URL/key, AI provider key, and optional Lit key needed when
  encryption is enabled.

After selection, the profile remains visible in the setup header. `Customize`
switches to Advanced mode and opens Privacy instead of opening a separate
technical popover. Profile settings follow the existing stages:

- Privacy owns storage, encryption, decryption access, result visibility, and
  small-group protection. Switching from Arweave to Cloudflare installs an
  explicit role gate; switching back removes Cloudflare-only access fields.
  Admin-only and public-redacted result modes remain visible as unavailable
  until their complete read paths are enforced.
- Worker owns optional participation channels such as Telegram, Telegram Mini App, and
  Agent Session Wrapped. The website remains enabled. Wrapped is off by
  default, deploys one additional dedicated per-session Bridge, and does not
  implicitly enable Telegram. Telegram Mini App is independently selectable but
  requires Telegram; disabling Telegram also disables its Mini App.
- Deploy owns the export policy. Selected-channel export remains visible as
  unavailable until the export runtime consumes that filter.

Changing one of these values flips the profile to `custom`. Profile-based
drafts do not also show the older `Session Storage` metadata editor, so storage
has one visible authority. New session publishes write the
`sessionModeProfile` profile as the source of truth and compile it down to the
existing storage profile / payload-access fields for runtime compatibility.
The wizard validates that profile at the publish boundary and rechecks the live
draft after asynchronous identity and duplicate-session preflight. A profile
edit made while preflight is running therefore still stops before upload,
worker, or registry side effects. Invalid settings are also shown in the stage
where they are edited. Mode values are exact enums at every write boundary:
explicit blanks, friendly aliases, unknown values, and reserved key providers
are rejected rather than normalized to a less-protective default. Legacy aliases
remain readable only for stored compatibility.
Legacy `telegramOnly` fields are read only as a migration fallback and are not
written by new sessions.

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
- network/contract defaults for chain-backed profiles
- `blockLimits.start` for chain-scanned profiles
- optional session header image

AI configuration also lives in the session metadata draft:

- `ai.models.fast`
- `ai.models.thinking`
- `ai.models.transcription`

What gets stored where:

- For `worker_canonical`, the session worker stores the sanitized canonical
  identity, text metadata, AI model choices, authority policy, and storage
  profile in Worker KV. Publish verifies a read-after-write of that config
  before showing the session URL.
- Decentralized and explicit Arweave-backed profiles keep storing the
  human-readable session config on Arweave: name, description, AI defaults,
  block limits, contract pointers, featured lists, and any Lit-encrypted fields.
- The Fast & Cheap preset combines `storageProfile.backend = "cloudflare"`
  with `worker_envelope` encryption. Advanced Cloudflare profiles can instead
  select `worker_sbt_gate`, where the session worker checks the requester's SBT
  gate with configured chain/RPC before serving bytes. That is worker-enforced
  access control, not end-to-end encryption.
- Advanced encryption options are `none` (payload bytes are stored as provided), `lit` (Cloudflare stores caller-supplied Lit ciphertext and rejects plaintext uploads until the Lit path sends `payloadEncrypted=true`), and Cloudflare `worker_envelope`: data is encrypted before Cloudflare stores it, and the session worker decrypts only after checking access. `worker_envelope` is available only with Cloudflare storage. The operator and Cloudflare runtime can decrypt; it is not decentralized, not end-to-end, and not private from the session operator or Cloudflare runtime.
- When `/new` deploys a custom worker for Cloudflare storage, the deploy helper receives the normalized storage profile before Worker upload so it can bind the storage index KV and any requested R2 bucket. If `worker_envelope` is selected, the helper also generates the worker secret used as the deployment KEK; the generated value is not written to session metadata.
- Worker-envelope key provider is fixed to `worker_secret` in this release. The default Cloudflare rule permits configured session admins or agents granted the `storage` scope; normal participant responses use their dedicated submission route. An explicit override can combine Session role (`worker_role`), SBT holders (`sbt_onchain`), or Authorized agents (`agent_grant_scope`) rules with any/all matching; the wizard writes those conditions to `storageProfile.payloadAccessControl.accessConditions` for the worker.
- `SessionRegistry` does not store long-form content directly. Decentralized
  profiles store a metadata URI pointer plus minimal session identity fields;
  the default worker-canonical profile skips registry writes entirely.

Important:

- `blockLimits.start` is required for chain-scanned profiles. The default
  worker-canonical profile does not require a chain scan window.
- The wizard strips secrets and worker-only runtime config out of the Arweave payload before upload.

### 2. Privacy and access control

Use the privacy section to decide who can decrypt locked metadata fields and who can access sponsored resources.

The default worker-canonical preset uses worker roles/groups and the persisted
version-1 `workerAuthority` policy. It does not require an SBT, registry, RPC,
or Lit key. Participant and anonymous scopes, plus any login gate, are evaluated
by the session worker.

Advanced chain-backed profiles retain the existing controls:

- One or more SBT gates
- Gate mode: `Any` or `All`
- Default gate for the session
- Optional per-resource overrides (`ai`, `arweave`, `rpc`, `txGas`, `lit`, and other resource keys)
- Optional inline SBT creation if the required SBT does not exist yet

For those advanced profiles:

- If you created new SBT drafts in the wizard, publish can deploy them first through `SBTFactory.createSBT(...)` or its deterministic variant
- The final gate definitions are written on-chain through `SessionRegistry.setResourceGates(...)`
- Lit-encrypted metadata keeps references to the selected gate IDs, but gate authority itself remains on-chain in `SessionRegistry`

The standalone Create SBT (`/sbts/new`) and Contracts pages remain global on-chain tools.
When opened from a Worker-native session, they are labelled
**Advanced/external** and do not change that session's native Groups authority.

### 3. Worker deploy and secrets

The default wizard deploys a worker before publishing the canonical session
config.

In the default native handoff you provide:

- Cloudflare API token
- one OpenAI / Anthropic / OpenRouter key matching the selected AI models

The wizard derives the worker name. Advanced profiles may additionally expose
Arweave, Lit, RPC, faucet, or custom-provider inputs when their selected
capabilities actually require them.

Common combinations:

- Default Fast & Cheap session:
  - Cloudflare API token
  - one AI provider key matching the selected models
- Decentralized or explicit Lit/chain-backed session:
  - the profile-specific Arweave, Lit, RPC, wallet-transaction, and gas inputs
    shown by the wizard
- Session created from a sponsored bundle:
  - the profile's signing identity: passkey for a pure Worker session, or wallet
    plus passkey support for a registry session
  - session details
  - no manual worker-secret entry, as long as the bundle is deploy-ready

What happens during deploy:

- The deploy-helper calls Cloudflare’s Workers API
- For a worker-canonical publish, it creates an isolated physical worker name
  by appending a random deployment suffix to the requested display name. A
  retry cannot overwrite an earlier same-name worker.
- It fetches the account `workers.dev` subdomain and creates/changes it only when explicitly needed
- It returns the final worker URL
- The wizard auto-fills `corsWorkerUrl`
- The wizard signs the canonical config with the passkey-derived EOA, persists
  it, and verifies `/session-config` before it reports success.
- A custom Worker is publish-ready only while that verified deployment still
  matches the selected Worker identity, the complete canonical session-mode
  profile, each effective AI provider/model assignment, and every required
  secret value. Changing any of them requires a new deploy/sync verification.
  Sponsored auto-deploy writes this verified tuple to the live publish runtime
  before its promise resolves, so the same publish attempt can consume it without
  depending on a React render. This proof is kept in memory only: secret values
  and secret verifiers are not written to the wizard cache. After a reload, the
  wizard may retain the safe public Lit runtime descriptor, but it must replay
  deployment/synchronization checks before a custom Worker becomes publish-ready
  again. The shared default Worker and a deploy-ready sponsored flow keep their
  separate readiness paths.
- Worker config persistence captures one immutable draft/identity/secrets
  snapshot. After the signed write and `/session-config` readback, the wizard
  compares the live publish inputs and rebuilt canonical config with that exact
  snapshot, then repeats that comparison immediately before writing settlement
  markers or clearing the cache. Any edit made before settlement stops the flow
  and leaves the draft intact for an explicit retry; an unchanged publish settles
  and clears only the captured verified session identity.
- For Lit profiles, an account key authorizes bootstrap but is not runtime
  readiness evidence. Publish stays blocked until the Worker has a usage key
  and the complete Lit runtime descriptor, and failed post-deploy synchronization
  retains enough local bootstrap authority for an exact retry.
- Cleanup deletes a failed deployment only when the deploy helper can prove the
  script still carries that deployment's ownership marker. It preserves
  pre-existing or ownership-ambiguous scripts and reports any orphaned resource.
- If a remote bundle is definitively rejected after stable resources were
  staged, the manual-file fallback reuses the same deployment request, Worker,
  and KV namespace. Only corrected bundle bytes may change; all non-bundle
  deployment fields stay bound, existing secret bindings are preserved, and
  the request remains recoverable until its terminal receipt is durable.
- The requested Worker name is always a readable prefix rather than an exact
  physical script name. The suffix is derived before existence checks or
  mutable Cloudflare operations: first-party callers with different request
  generations receive different deterministic names, while legacy callers
  without `deploymentRequestId` receive random names. The helper still verifies
  its ownership marker after upload and stops before hostname/secret activation
  if ownership does not match.

When `Agent Session Wrapped` is selected, the same request-only Cloudflare
token may also deploy the dedicated Bridge in that setup operation. The Bridge
receives an explicit one-session policy and the exact paired session-Worker
origin. Setup does not publish its version-1 `agentSessionWrapped` capability or
report success until upload, secrets, bindings, activation, health, protocol,
authority probing, and the durable session-config write have all succeeded.
Failure preserves the prior verified capability, if any, and leaves the
session config intact. Telegram is a separate optional surface and remains off
unless selected.

Compatibility is determined by the paired session Worker:

- Worker-canonical sessions use their canonical Worker directly.
- Registry-canonical sessions use the same Wrapped flow when their existing
  `corsWorkerUrl` is usable or when an unlocked registry session can first
  attach a compatible Worker. The session Worker—not the Bridge—performs SIWE,
  registry/RPC, chain-gate, and SBT checks.
- An unlocked workerless registry session must attach a Worker before Wrapped
  can be enabled. That owner attachment may require an Admin registry
  transaction.
- A permanently locked workerless session cannot attach a new Worker and fails
  closed without a partial Bridge deployment.

After a member has a session-Worker credential, the agent exchanges it for a
shorter session-bound `ceagt_` credential and submits Wrapped answers over
HTTPS/KV. The agent performs no EVM transaction. The Bridge credential lasts
at most 24 hours and never outlives the Worker credential, so access revocation
propagates no later than that shorter remaining lifetime.

What gets stored where:

| Store | Contents |
| --- | --- |
| Worker KV `session:{slug}:config` | canonical worker session identity/content plus public authority, storage, CORS, and limits config; no credentials |
| Worker KV `session:{slug}:secrets` | OpenAI/Anthropic/OpenRouter keys, Arweave JWK, faucet private key, and other runtime secrets |
| Arweave metadata | decentralized/Arweave profiles only; no worker secrets |
| `SessionRegistry` | decentralized/registry profiles only; skipped by `worker_canonical` |

### 4. Registration and publish

When you click `Publish` with the default worker-canonical profile, the flow is:

1. Deploy the per-session worker if it is not already ready
2. Persist the sanitized, admin-signed canonical config to the session worker
3. Read it back and verify its identity, revision, authority, and worker URL
4. Surface reload-safe session and admin URLs containing the public HTTPS
   `worker` query parameter

There is no `uploadMetadata`, `registerSessionOnChain`, registry cache refresh,
or gas-funded transaction on this path. Decentralized and explicit
Arweave/registry profiles keep the existing upload and registration sequence:

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

- worker-canonical session URL:
  `/session/<slug>?worker=https%3A%2F%2F<worker-origin>`
- worker-canonical admin URL:
  `/admin?sessionId=<uuid>&sessionSlug=<slug>&worker=https%3A%2F%2F<worker-origin>`
- decentralized session URL: `/session/<slug>`
- decentralized admin URL:
  `/admin?sessionId=<uuid>&chainId=11155420`

## Worker Deployment Options

### Native Cloudflare dashboard handoff (default)

This is the default path exposed in `/new`.

High-level flow:

1. Click the onboarding banner's `Cloudflare API token` link. Cloudflare opens
   the token form with the two required permissions prefilled. Restrict Account
   Resources to the intended account, create the token, copy its generated
   value, and paste it into the Worker step with one AI-provider key. Normal
   mode automatically derives the worker name and uses the GitHub-hosted
   `sessionCorsWorker.bundle.js` release asset.
2. Click `Deploy worker`
3. Wait for the helper to create an isolated physical worker, persist its
   canonical config, and return the `workers.dev` URL
4. If the helper cannot fetch the release asset, keep the default GitHub release URL and either paste a direct bundle URL override or run `nvm use 20 && npm run worker:bundle` and upload `dist/sessionCorsWorker.bundle.js`
5. Publish only after the wizard verifies the public config readback

The first-party wizard does not ask for an account ID. During deploy, the helper
discovers exactly one visible Cloudflare account using the API token and stops on
zero or multiple accounts.

Reference: [session-cors-worker.md](session-cors-worker.md)

### Legacy CE-hosted deploy-helper fallback

The collapsed Advanced/fallback section retains the request-only Cloudflare API
token flow for existing operators. It can create the Worker, discover its URL,
and seed config automatically, but it requires trusting the helper with the
request-only token. It is not required by the default Cloudflare path.

### Sponsored `/sponsor` handoff

Use this when one session admin wants to help someone else launch a session without manually sharing raw worker secrets.

Best fit:

- onboarding a collaborator who should not have to paste OpenAI / Arweave / faucet credentials by hand
- shortening the guided `/new` handoff for internal pilots
- preloading a worker deploy grant so the recipient does not need to enter a raw Cloudflare API token

What the recipient still needs:

- the signing identity required by the selected profile (passkey for a pure
  Worker session; wallet plus passkey support for a registry session)
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

If you also want helper-assisted deployments from your own wizard instance
later, separately self-host the legacy deploy-helper described in
[session-cors-worker.md](session-cors-worker.md).

### Manual Cloudflare dashboard upload

Use this when you want to avoid Wrangler and upload the worker bundle manually.

Recommended source files:

- Bundled release asset: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js`
- Adjacent provenance manifest: `https://github.com/AgalmicSoftware/context-engine/releases/latest/download/worker-release-manifest.json` (the deploy helper verifies its expected SHA-256 before Cloudflare mutation)
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

- worker canonical:
  `/admin?sessionId=<session-id>&sessionSlug=<slug>&worker=<encoded-https-worker-origin>`
- decentralized:
  `/admin?sessionId=<session-id>&chainId=11155420`

Confirm that `/admin` can resolve:

- session slug and session ID
- worker URL
- resource gates
- canonical name/content from Worker KV for `worker_canonical`
- metadata URI, registry chain/address, and sponsored flags for decentralized
  sessions

### Manage Agent Session Wrapped

Compatible worker-canonical and registry-canonical sessions show an Agent
Session Wrapped panel in `/admin`. Enter a fresh request-only Cloudflare token
for each enable, disable-access, or explicit redeploy operation; the browser
clears it when the request finishes and does not restore it from storage.
`Check health` verifies the recorded protocol, session slug, access bit, and
pinned session-Worker origin. Disabling access retains deployed resources and
publishes `enabled: false`; resource deletion is a separate confirmed live
operation. An unhealthy or failed redeploy does not replace the last verified
origin/revision.

### Test worker health

Use the `Worker Tests` panel in `/admin` to run:

- `/health`
- AI test
- Arweave upload test when the selected profile uses Arweave
- transcription test
- faucet test when the selected profile configures a faucet

If `/health` or the other worker calls fail with browser network errors, use the `/admin` button `Allow this origin (CORS)` and test again.

### Add questions

Once the session exists, you can start populating it:

- use `/admin` to set session defaults and the question-generation prompt
- add questions or surveys through the normal authoring flow for that session
- use the AI audio generator flow if you want AI-assisted question generation

When questions/surveys are published:

- worker-canonical sessions store active question/survey payload resources in
  Cloudflare worker storage
- decentralized sessions keep the existing Arweave payload and `Surveys`
  contract registration flow

For payload examples, see [arweave-payloads.md](arweave-payloads.md).

### Share the session URL

The public entry point is:

`/session/<slug>?worker=<encoded-https-worker-origin>` for worker-canonical
sessions, or `/session/<slug>` for registry-discovered decentralized sessions.

Keep the `worker` query parameter in copied worker-canonical links. A fresh
browser uses it only to locate `GET /session-config`; it is not an authorization
credential. The client rejects unsafe production targets (non-HTTPS origins,
URL credentials, paths, and private-network hosts), binds the worker origin to
the exact slug/session identity, and prompts before replacing a conflicting
trust-on-first-use pin.

## Troubleshooting

### Worker deploy fails

For the default native handoff, check these first:

- the selected Cloudflare account owns the newly deployed Worker
- the account has an active `workers.dev` subdomain
- the deploy helper can confirm the generated physical worker name is absent

If deployment succeeds but verification fails:

- re-open `/admin`
- verify or restore the Worker URL
- use the Worker Tests panel to confirm `/health`
- confirm the canonical config slug and public admin identity match the wizard

For the collapsed legacy fallback, also verify that the request-only Cloudflare
API token has permission to manage Workers scripts and KV and that the helper
can access the selected account.

### Questions are not loading

The two most common causes are bad scan bounds and a missing `Surveys` contract reference.

These checks apply to chain-scanned profiles. A verified worker-canonical
session obtains its questions from its dedicated Worker and does not require
`blockLimits.start` or a `Surveys` contract.

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
- the shared worker-canonical URL still includes the original HTTPS `worker`
  query parameter

Typical symptoms:

- `Failed to fetch` or `Load failed` from worker auth endpoints usually means the origin is missing from `allowOrigins`
- `SIWE domain does not match URI host.` means the login or admin signature was created for a different host than the one receiving the request
