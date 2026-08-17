# Session Registry Migration (Draft)

This document defines the staged migration from `demo_sessions.json` to a hybrid
on-chain registry + Arweave metadata. It is intentionally conservative while we
test the flow. The final switch will remove the local JSON fallback.

## Goals

- Move Ethereum‑sensitive fields on-chain (permissions, gates, chain IDs).
- Store long‑form content + UI defaults on Arweave (optionally Lit‑encrypted).
- Preserve current app behavior via a fallback to `demo_sessions.json` until the
  registry is stable and deployed.
- Hybrid (a+b): keep only the essential, permissioned fields on-chain and push
  the rest to Arweave.

## Source-Of-Truth Model

- SessionRegistry (on-chain): authoritative for resource gates (`default`, `questionResponses`, `surveyResponses`, `docUploads`, `docUrls`, `ai`, `arweave`, `rpc`, `txGas`, `lit`) and gate parameters (`sbtAddresses`, `mode`, `chainId`, `perMemberLimit`).
- Arweave session metadata: non-authoritative content/config only (session text, UI defaults, contracts, block limits, encryption envelopes, etc).
- Worker config (`session:{slug}:config` in KV): operational settings only (registry address/RPCs, limits, scopes, worker/runtime pointers, admin/Hats config, and mirrored `blockLimits` for scanner bootstrap), not gate authority.

For a profile-bearing Worker-canonical session, the profile narrows that generic
description: `sessionEndsAt` and generic UI/Group defaults live in Worker
config, while block limits, faucet configuration, and registry contracts are
rejected. Explicit Worker + on-chain SBT profiles may retain only their network
and `sbtFactory` contract. Registry-canonical sessions continue to use
Arweave/registry chain fields as described below.

Rationale:
- Duplicating gate authority in Arweave created drift risk (metadata could be stale while on-chain gates changed).
- `/auth/login` already evaluates contract gates and then mints a short-lived token; duplicating gates in metadata gives minimal auth-path performance benefit while adding consistency risk.
- New session metadata writes remove authoritative gate fields so gate updates do not require metadata re-upload.

## Authority Matrix

The registry migration has several authority boundaries that should stay explicit during staged rollout:

| Concern | Authoritative Source | Compatibility / Fallback | Notes |
|---|---|---|---|
| Session identity (`slug`, `sessionId`, registry chain) | `SessionRegistry` | Demo config only while off-chain/demo fallback remains enabled | New writes should use a canonical registry slug; legacy exact-byte sessions remain readable through compatibility lookups until migration proves safe. |
| Resource gates (`default`, `questionResponses`, `surveyResponses`, `docUploads`, `docUrls`, `ai`, `arweave`, `rpc`, `txGas`, `lit`) | `SessionRegistry` | None for auth decisions | Arweave metadata can carry UI defaults, but must not override on-chain gate authority. |
| Faucet eligibility | `SessionRegistry` `txGas` resource gate | Future fallback resources must be explicit, documented, and fail closed | Current low-risk target is `txGas` first, with any broader fallback requiring opt-in semantics and tests. |
| Registry and contract address discovery | Runtime override / verified discovery, then bundled fallback | Bundled `SESSION_REGISTRY_ADDRESSES` and `SESSION_CONTRACTS_BY_CHAIN` stay as compatibility fallback | Discovery should be observable before it becomes required; stale bundled defaults should not be treated as the permanent source of truth. |
| Worker config and secrets | Worker KV / worker secret store | Browser-local overrides only for local developer preferences | Worker runtime config is operational, not gate authority. Public `appearance.colorSchemeId` may be mirrored here; secrets must not flow through Arweave metadata. |

The code-level read-only companion for these rows is
`client/src/utilities/session/sessionAuthorityMatrix.ts`. Keep this document and
that matrix aligned when changing authority or fallback semantics.

## On‑Chain: SessionRegistry.sol

The registry stores minimal, updateable session facts:

- `sessionId` (bytes16, UUID v4 stored as 16 bytes; lookup key for `/admin?sessionId=...` and `/session/<sessionId>`)
- `slug` (string)
- `chainId` (uint256)
- `metadataURI` (string) → Arweave JSON
- `encryptedMetadataURI` (string, optional) → Arweave JSON encrypted via Lit
- `admin` (address, set to msg.sender on create; set to `0x0` to lock edits)
- on-chain session fields (string key → string value), editable by admin:
  - `corsWorkerUrl` (optionally Lit-encrypted so the worker URL is not visible on-chain)
  - `sponsored_ai` (string "1"/"0", indicates worker has an AI key configured)
  - `sponsored_rpc` (string "1"/"0", indicates worker has a custom RPC URL/key configured)
  - `sponsored_faucet` (string "1"/"0", indicates worker has a faucet key configured)
  - `sponsored_arweave` (string "1"/"0", indicates worker has an Arweave key configured)
  - `sponsored_transcribe` (string "1"/"0", indicates worker can transcribe via OpenAI key)
- resource gates (per resource):
  - `sbtAddresses[]`
  - `mode` (Any/All = OR/AND)
  - `chainId`
  - `perMemberLimit` (uint256)

When the `rpc` resource gate is open, or a restricted gate has already granted
the current wallet, client Survey contract reads use the session-sponsored
`rpcUrl` / `rpcUrlsByChainId` before anonymous defaults. Restricted sponsored
RPC still fails closed to the normal fallback stack until the wallet grant is
verified.
Session publish/deploy keeps uploaded Custom RPC worker secrets out of public
registry fields. If browser reads need a sponsored RPC, configure an explicit
browser-visible session `rpcUrl` / `rpcUrlsByChainId` value.

Multi-tx flow:
- `createSession(slug, sessionId, chainId, ...)` creates the session.
- `setSessionFields(slug, keys[], values[])` applies on-chain session fields in one tx.
- `setResourceGates(slug, gates[])` applies resource gates in one tx.

Lookup helpers:
- `getSessionById(bytes16)` returns the same tuple as `getSessionBySlug`, keyed by sessionId.
- `sessionIdExists(bytes16)` is a quick guard before creating a new session.

Admin is the only on-chain role in this version. There is no Hats dependency
in SessionRegistry; you can revoke edits by setting admin to `0x0`.
Future: we may re-introduce Hats-based owner/admin/editor roles and per-field
editors once the session flow stabilizes.

Resources tracked on-chain:
- `default` (fallback gate)
- `questionResponses`
- `surveyResponses`
- `docUploads`
- `docUrls`
- `ai`
- `arweave`
- `rpc`
- `txGas`
- `lit` (optional, for key access)

## Arweave Metadata Schema (v1)

Arweave metadata is designed to look like a `demo_sessions.json` entry so the
frontend can rehydrate it easily. Suggested structure:

```json
{
  "v": 1,
  "sessionId": "2e9eb94e-dec1-48c0-8600-cf634123d7c2",
  "sessionIdHex": "0x2e9eb94edec148c08600cf634123d7c2",
  "slug": "my-group",
  "sessionName": "My Group",
  "sessionHeaderImg": "assets/img/header.webp",
  "sessionInfo": "Group description",
  "appearance": {
    "colorSchemeId": "ocean"
  },
  "corsWorkerUrl": "https://contextengine-proxy.<your-sub>.workers.dev/",
  "defaultTags": "example, demo",
  "questionsGenPrompt": "",
  "defaultSbtTags": "",
  "defaultFilterState": null,
  "defaultFeaturedSBTs": [],
  "autoFeatureSBTsBySessionSlug": false,
  "HIGHLIGHTED_QUESTION_IDS": [],
  "BLOCKED_QUESTION_IDS": [],
  "HIGHLIGHTED_SURVEY_IDS": [],
  "BLOCKED_SURVEY_IDS": [],
  "ignored_SBTs_LIST": [],
  "featured_SBTs_LIST": [],
  "contracts": {
    "surveys": { "address": "0x...", "chainId": 11155420 },
    "sbtFactory": { "address": "0x...", "chainId": 11155420 }
  },
  "blockLimits": { "start": 0, "end": null },
  "networkChainId": 11155420,
  "faucet": {
    "amountEth": "0.0002",
    "balanceThresholdEth": "0.001"
  },
  "ai": {
    "reasoningEffort": "low",
    "models": {
      "fast": { "model": "gpt-5", "provider": "openai" },
      "thinking": { "model": "gpt-5", "provider": "openai" },
      "transcription": { "provider": "openai", "model": "whisper-1" }
    }
  },
  "perMemberSpendLimits": {
    "ai": "",
    "arweave": "",
    "txGas": ""
  },
  "contentEncryption": {
    "questions": false,
    "questionTitles": false,
    "questionTags": false,
    "surveyTitles": false,
    "docURLs": false
  }
}
```

Notes:
- `appearance` is optional, backward-compatible presentation metadata and may
  contain only `colorSchemeId`. New Wizard publications write one of
  `context-engine`, `ocean`, or `amber`; missing, malformed, and unknown IDs
  render in memory as `context-engine` without rewriting existing metadata.
  Palette values, CSS custom-property names, URLs, CSS/SCSS, and app-theme IDs
  are not accepted. An explicit user/accessibility app theme suppresses session
  colors. This field is stored in Arweave metadata for decentralized sessions
  or public Worker config for Worker-canonical sessions; it is not duplicated
  in `SessionRegistry.setSessionFields`.
- `defaultTags` is a comma-separated list of tag *suggestions* that are fed into AI tag generation prompts.
  - Questions may use any subset (including all) or none of the default tags.
  - `defaultTags` does **not** filter which questions/surveys are shown; sessions handle scoping.
- `defaultSbtTags` is a comma-separated list of preferred SBT tags.
- `defaultGroupTags` is the Worker-native equivalent and prefills tags in
  participant and admin Group creation. Readers fall back to
  `defaultSbtTags` for older Worker configs.
- `sessionEndsAt` is an optional ISO timestamp for Worker-canonical sessions.
  It closes participant resource and mutation routes while leaving reads and
  signed admin routes available; it is not a replacement for on-chain
  `blockLimits`.
  - In `CreateSBTGroup`, relevant defaults can auto-apply from that list based on the SBT name/description.
  - The full list remains optional guidance; irrelevant defaults are not blindly injected into every new SBT.
- `sessionHeaderImg` (and similar image fields like group/SBT `logo`/`image`) can be stored as:
  - a relative asset path (`assets/...`),
  - a normal URL (`https://...`),
  - `ar://<txId>`,
  - or a bare Arweave txId (`<txId>`, 43-char base64url).
  The client normalizes `ar://` and bare txIds to the preferred Arweave gateway via `normalizeArweaveUrl` (`client/src/utilities/arweave/arweaveUrls.ts`):
  `CE_ARWEAVE_AR_IO_URL` / `https://ar-io.dev` while `CE_ARWEAVE_DIRECT_TO_AR_IO` is enabled, which is the default. Arweave reads stay on that AR.IO gateway for their retry budget instead of fanning out to legacy gateways. Set `CE_ARWEAVE_DIRECT_TO_AR_IO=false` only when a deployment intentionally wants fallback fanout through `ARWEAVE_GATEWAY_URL`, `https://arweave.net`, Irys, Permagate, and alternate raw/tx-data routes.
  Runtime overrides: `window.CE_ARWEAVE_GATEWAY_URL`, `window.CE_ARWEAVE_DIRECT_TO_AR_IO`, `window.CE_ARWEAVE_AR_IO_URL`.
  If you see console noise like `Failed to load resource ... (<txId>, line 0)`, check the Network tab for the request URL:
  - App origin (`http://localhost:3000/<txId>`): a UI path is still rendering a bare txId as a relative URL.
  - Arweave gateway (`<preferred-gateway>/<txId>`): the txId is missing/unavailable (bad pointer or propagation).
- `blockLimits.start` should be set for any real session.
  - Missing/invalid `blockLimits.start` is treated as a configuration error in current code; there is no implicit scan-from-zero fallback.
  - When registry metadata cannot be loaded, the cached registry tuple retains `createdAt` so the client can derive a bounded creation block before falling back to the `SessionCreated` event. This is recovery for unavailable metadata, not a second block-window authority.
  - Do not hardcode chain-specific "start blocks" in code; keep them in session config / registry metadata.
- `autoFeatureSBTsBySessionSlug` controls session-slug auto-feature behavior:
  when `true`, Groups featured strips auto-feature SBTs whose metadata authoritatively declares a matching `sessionSlug` for that session slug.
  Manual `defaultFeaturedSBTs` / `featured_SBTs_LIST` entries are still included, and in selected-session `list` scope the featured strip aggregates across the listed sessions while respecting each session's own toggle.
- The legacy `autoFeatureSBTsWithFeaturedSbtTags` key is still supported as a deprecated read alias.
- `/session/:slug` now also kicks off active-session light SBT discovery after the partial featured-metadata pass.
  This lets the embedded Groups strip and concrete session SBT views populate from the session page itself instead of depending on a prior `/sbts` visit.

Important: session metadata no longer writes `sponsored`/`sponsoredSbtAddress` gate authority fields.
Gate authority lives on-chain in SessionRegistry.

Note: In the worker-secrets flow, AI/RPC/Arweave/faucet keys are no longer stored
in session metadata. Configure secrets on the worker instead; legacy key fields
are still tolerated but no longer written by `/session/new`.
`/session/new` now always includes `sessionId` in uploaded Arweave metadata
(`sessionIdHex` is included when the UUID parses cleanly).
If you want to hide the worker URL on-chain, store `corsWorkerUrl` as a Lit-encrypted
envelope; the client decrypts it for users who satisfy the gate you select.

Wizard UX notes:
- `/session/new` now stores a provider per model (`ai.models.fast.provider`, `ai.models.thinking.provider`).
- The wizard no longer writes AI/RPC/Arweave/faucet secrets into metadata.
- The wizard no longer writes authoritative gate fields (`sponsored`, `sponsoredSbtAddress`) into metadata; resource gates are written on-chain during session registration.
- In `/session/new`, `autoFeatureSBTsBySessionSlug` means "auto-feature SBTs whose metadata authoritatively declares a matching `sessionSlug` for this session slug"; the session can also contribute those SBTs to the shared featured strip when selected-session scope is `list`.
- In `/session/new`, new session drafts seed `defaultSbtTags` with `group, event, idea, demographic, location`.
- In `/session/new`, new session drafts seed OpenAI `gpt-5` for both fast/thinking models and set `ai.reasoningEffort` to `low`.
- Session metadata now uses `sessionName`/`sessionInfo`/`sessionInfoEncrypted`/`sessionHeaderImg` as canonical keys; legacy `org*` aliases are not consumed in `/session/new`.
- The wizard no longer invents default legacy Lit network metadata for new sessions; active Lit runtime now comes from worker-mediated Chipotle config.
- In `/session/new`, worker secrets are configured before the deploy action. OpenAI key is required by default, Anthropic key appears (and becomes required) when any AI model provider is set to Anthropic, OpenRouter key is available as an optional worker secret, and manual Lit setup now centers on a single worker-mediated Chipotle authority key (`litAccountApiKey` / `LIT_ACCOUNT_API_KEY`) that can mint or refresh the scoped group / PKP / usage key after deploy.
- In `/session/new`, the AI metadata block is collapsible; model provider options show OpenAI/Anthropic/OpenRouter/Custom, with OpenRouter and Custom currently disabled.
- In `/session/new`, the Lit metadata block is collapsible and `arweave` / `litCredentials` metadata sections are hidden from the form. `litCredentials` reads are now intentionally fenced off so payer material does not flow through metadata.
- The worker code preview in `/session/new` shows unbundled source only and is collapsed by default.
- In `/session/new`, Session ID now lives in the Metadata section as a read-only single-line field with icon actions (regenerate/copy).
- In `/session/new`, Smart Contracts includes an editable `Session Registry` address field that defaults from `getSessionRegistryAddress(chainId)` (from `client/src/variables/chains.ts`) and is used as the registry-address override for deploy/register actions in that wizard.
- In `/session/new`, saved metadata `contracts` now keeps only `surveys`, `sbtFactory`, and `sessionRegistry`; non-authoritative extras like `xp` are excluded from the published metadata contract block.
- In `/session/new`, SBT selector manual entry is inline (`+ By Address`) and no longer a full-width button row.
- In `/session/new`, SBT creation is now available inline through a modal. New SBT drafts show a predicted deterministic address immediately, can be reused in the wizard before deployment, and are deployed during Publish before the session registration transaction is sent.
- In `/session/new`, worker mode labels are now `Using Default Worker` and `Use My Own`, each with tooltip explainers.
- In `/session/new`, worker URLs now normalize endpoint-like inputs (for example `.../auth/nonce` or `.../arweave/upload`) back to the worker base URL before auth/upload calls, and auth network failures now show a CORS/allowOrigins hint instead of a raw `Failed to fetch`.
- Transcription supports `openai` today; `local` is present but disabled until implemented.
- The wizard auto-fills `corsWorkerUrl` after a successful deploy-helper call.
- After deploy-helper success, the wizard retries signed `/admin/set-secrets` sync against the resolved worker URL for post-deploy verification/backfill.
- If secrets sync hits `Admin authorization failed` during deploy, the wizard now auto-runs signed `/admin/set-config` once and retries secrets sync before surfacing status.
- The non-fatal "deploy-helper already wrote secrets" note is now shown only when deploy-helper explicitly reports `writesSessionSecrets: true` in its `/deploy` response.
- Deploy-helper payloads map an empty slug to `general` for worker deployment.
- New registry writes validate the canonical slug before wallet signing. The client trims/lowercases the slug, maps empty/default input to `general`, and rejects non-canonical characters or reserved internal slugs.
- Advanced `/session/new` worker settings now expose a deploy-time `embedded deploy-helper` toggle (default comes from `REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED`, fallback `true`). It maps to the worker's `DEPLOY_HELPER_ENABLED` binding during deployment and is mirrored into worker config for frontend hydration, but changing Worker KV config later does not change the runtime binding.
- Sponsored deploy grants now require embedded deploy-helper on the sponsoring worker. The raw Cloudflare API token stays in the sponsoring worker's server-side grant record, while the encrypted sponsored bundle carries only the resulting deploy grant token plus bootstrap worker context; grants no longer snapshot Cloudflare account ID or a standalone helper URL.
- Worker `/ai` provider selection now resolves from explicit `provider` first, then infers from `model` (`gpt-*`/`o*` => OpenAI, `claude*` => Anthropic), and otherwise defaults to OpenAI (no Anthropic hard-default).
- Empty slug represents the default "general" session. The wizard keeps metadata `slug` as `""` but maps it to `general` for on-chain registry calls.
- Frontend constants now centralize this mapping: `DEFAULT_GROUP_SLUG = ""` and `DEFAULT_GROUP_SLUG_ALIAS = "general"`.
- Frontend session routing/config now treats `activeSessionSlug` / `sessionSlug` / `sessionSlugPinned` / `sessionName` as canonical names, while still accepting legacy `activeGroupSlug` / `groupSlug` / `groupSlugPinned` / `groupName` aliases during migration. Plan: remove `group*` session aliases after call-sites and worker clients no longer depend on them.
- The slug field’s lock icon enables "private slug mode" (slug = session ID); it does not Lit-encrypt the slug.
- `/session/:slug` now keeps the requested slug while registry cache warms (loading/not-found UI) instead of redirecting to a demo fallback slug.
- Admin `/admin` "Update default gate on-chain" now surfaces a clickable explorer tx link after success.
- Admin `/admin` "On-chain default gate" uses the SBT selector UI (instead of a raw address textarea), preventing duplicate default-gate addresses in the editor.
- Admin `/admin` "Session metadata" now exposes a broader advanced editor for safe metadata-backed session defaults (default tags/prompts, featured/filter defaults, curated highlight/block lists, AI model defaults, and faucet thresholds) while keeping `contracts` read-only in that UI.
- Admin `/admin` metadata summary values now link out to the session page, admin `/u/:address` page, and Arweave metadata URL, and the raw metadata viewer now uses the shared JSON panel with a copy control.
- `getSbtMetadata` / provider resolution now avoids chainId `0` fallthrough by using configured chain ids plus `DEFAULT_CHAIN_ID` fallback.
- Registry write calls in `/session/new` now preserve `estimateGas` when no manual override is provided and fall back to a 1,000,000 gas limit only if estimation fails.
- Arweave uploads now resolve worker auth `sessionSlug` from explicit request fields or `groupConfig.slug`, preventing cross-session slug mismatches during question/survey uploads. Legacy `groupSlug` remains migration-only compatibility and new non-SBT callers should use `sessionSlug`.
- Arweave upload responses now normalize `id`/`txId`/`arweaveTxId`/`url`/`arweaveUrl` payload variants (including `*.arweave.net` gateway URLs) back to a canonical tx id before returning to callers.

### Encrypted Fields

Any field can be encrypted with Lit. In the current worker-secrets flow the
wizard mainly locks on-chain fields like `corsWorkerUrl`. When a field is locked,
we store:

```json
{
  "encryptedFields": {
    "sessionInfo": { "v": 1, "cipher": "...", "...": "..." }
  },
  "encryption": {
    "gate": {
      "sbtAddresses": ["0x..."],
      "mode": "any",
      "chainId": 11155420,
      "litChain": "optimismSepolia"
    }
  }
}
```

Multi-gate configs may also include:

```json
{
  "encryptedFieldGates": {
    "sessionInfo": ["gate-1", "gate-2"],
    "corsWorkerUrl": "gate-2"
  },
  "encryption": {
    "gates": {
      "gate-1": { "sbtAddresses": ["0x..."], "mode": "any", "chainId": 11155420, "litChain": "optimismSepolia" },
      "gate-2": { "sbtAddresses": ["0x..."], "mode": "all", "chainId": 11155420, "litChain": "optimismSepolia" }
    },
    "gate": { "sbtAddresses": ["0x..."], "mode": "any", "chainId": 11155420, "litChain": "optimismSepolia" }
  }
}
```

Notes:
- `encryptedFieldGates` maps field paths to gate ids in `encryption.gates`. Values are `string | string[]`:
  - 1 gate: store as `string` (legacy format)
  - 2+ gates: store as `string[]` (OR semantics: any selected gate can decrypt)
- `encryption.gate` is a compatibility alias; prefer `encryption.gates` + `encryptedFieldGates`.
- In `/session`, encrypted `sessionName` / `sessionInfo` fields render as `Encrypted` until a wallet with gate access decrypts them (no legacy placeholder text).
- In `/session/new`, if a locked field points to a gate with no SBT addresses, encryption is skipped for that field (value stays plaintext) so metadata upload still works for open/no-gate sessions.
- Open/general sessions do not require selecting SBTs unless a field is explicitly being Lit-encrypted.
- Survey/question creation now throws explicit errors when a session is missing `contracts.surveys.address` (instead of returning undefined and causing `receipt` destructure errors in UI).
- CreateQuestionsAndSurveys submit now performs a one-shot registry refresh for the active slug before contract writes when `contracts.surveys.address` is missing, so newly registered sessions are less likely to fail with stale local config.
- The app bootstraps registry reads via public RPCs (no PATH)
  even if `USE_ONCHAIN_SESSION_REGISTRY` is false, so SBT addresses + metadata resolve reliably.
  TODO: resolve default registry/contract addresses from `<chainId>.contracts.contextengine.eth`.
- Legacy key paths may still appear in older metadata, but `/session/new` no longer writes them.
- Legacy metadata gate fields may still appear in historical records, but they are ignored for auth/resource gate decisions.
- Response/doc encryption now has resource-specific defaults: `questionResponses`, `surveyResponses`, `docUploads`, and `docUrls` can be mapped to different gates from session defaults.
- Survey/question upload encryption and SurveyTool response encryption now attach Lit recipients for all applicable resource gates (plus default when applicable), so CEKs can be decrypted by every intended gate cohort.
- For SurveyTool response encryption, when a resource gate resolves on-chain as explicit open (`lookupStatus: ok` with no SBTs), the client does not fall back to default/global Lit access-control conditions.
- SBT metadata name lookups now use capped exponential backoff when metadata is missing/unnamed, reducing repeated refetch loops under transient RPC/indexing failures.
- Other encrypted fields are stored in `encryptedFields` and blanked in place.

QA:
- Create a session with multiple encryption gates and verify Admin, Database, and CreateQuestionsAndSurveys prefill SBTs + mode from the primary gate.

## Runtime Mapping

When `USE_ONCHAIN_SESSION_REGISTRY` is enabled:

1. Frontend loads sessions from the registry and hydrates metadata from Arweave.
2. Frontend marks gate authority as on-chain and maps on-chain gates into a compatibility `sponsored` shape for UI consumers.
3. If on-chain gate lookups are unavailable, frontend gate resolution returns no gate rather than falling back to metadata.
4. Worker `/auth/login` requires on-chain session gate authority; if unavailable/uninitialized, login fails closed.
5. Open-gate implications by worker resource:
   - Anonymous `POST /ai` and `POST /transcribe` are allowed only when on-chain authority is available and both `default` + `ai` gates are explicitly open (or when request-local `apiKey` is supplied).
   - Session `scopes` overrides remain authoritative for anonymous paths (`scopes.ai=false` blocks `/ai`; `scopes.transcribe=false` blocks `/transcribe`).
   - `txGas` still controls `scopes.faucet` for logged-in tokens, but same-wallet `request_test_eth` requests now re-check the current on-chain `txGas` gate when that scope is missing. Third-party generic transfers still require `scopes.faucet=true`, and faucet has no anonymous path.

## Current Default and Remaining Cleanup

- `USE_ONCHAIN_SESSION_REGISTRY` defaults to `true` in
  `client/src/variables/appConfig.ts`; on-chain registry resolution is the
  normal runtime path.
- `SESSION_REGISTRY_ADDRESSES` contains the checked-in per-chain registry
  defaults, with local overrides merged for local development.
- The `demo_sessions.json` fallback remains compatibility behavior only when an
  operator explicitly disables on-chain registry mode. Removing that fallback
  is a future compatibility decision, not a pending production switch.
- Large metadata can be split into multiple Arweave objects if payload size
  becomes an operational issue.

## Deployment Verification Checklist

- Confirm the target chain has a configured `SessionRegistry` address.
- Populate or create sessions through `/session/new`.
- Verify registry reads, Arweave metadata, and Lit decryption for locked fields.
- Exercise disabled registry mode only when maintaining an intentional legacy
  deployment that still requires the demo-session fallback.
