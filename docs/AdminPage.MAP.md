# AdminPage Runtime Map

## Quick Reference

- Entry wrapper: `client/src/components/Admin/AdminPage.tsx`
- Current shape: function component, 3561 lines, 45 `useState`, 20 `useEffect`, 17 `useCallback`, 18 `useMemo`, and 11 `useRef` calls.
- Boundary debt: `AdminPage.tsx` owns 0 `route-page-no-low-level` baseline entries. The former `arweaveScripts.js`, `arweaveUrls.js`, `sessionRegistry.js`, `corsProxy.js`, `workerAuth.js`, and `workerCorsOrigins.js` seams now route through domain ports.
- Existing test surface: 16 Admin files cover worker config payloads, signed admin actions, allowlist normalization, metadata writes, render gating and registry retry, resource balances, helper formatting, worker errors, and test-result rendering.
- Port architecture: `AdminPage.tsx` remains the route/page shell and UI state owner while concrete worker, storage, and session-registry operations route through typed domain ports under `client/src/domains/**`.

## Current Runtime Hierarchy

```text
AdminPage.tsx  [route/page shell and execution owner]
  -> session selector and worker URL resolution
  -> session metadata panel
     -> metadata draft helpers
     -> SBTSelector
     -> AudioInput
  -> on-chain default gate panel
     -> SBTSelector
  -> worker secrets panel
     -> inline Arweave, faucet, and Lit resource summaries
  -> tests panel
     -> health, AI, Arweave, faucet, and transcription probes
     -> denied-access probes
  -> helper modules
     -> adminPageHelpers.ts
     -> adminPageMetadataDraftHelpers.ts
     -> adminPageResourceDisplayHelpers.ts
     -> adminPageSecretCardHelpers.ts
     -> adminPageSessionDisplayHelpers.ts
     -> adminPageSbtGateSelectionHelpers.ts
     -> adminPageTestResultHelpers.tsx
     -> adminPageWorkerErrorHelpers.ts
     -> adminPageWorkerSessionConfigHelpers.ts
```

## Boundary Seams

| Baseline import | AdminPage calls | Current responsibility | Existing coverage | Target port |
|---|---|---|---|---|
| `../../utilities/worker/corsProxy.js` | `corsProxyUtils.resolveCorsProxyUrl` in the worker URL resolution effect | Resolve the selected session's usable worker URL without auto-decrypting in `/admin`. | Mocked in all page suites; render/metadata/resource suites verify selected-session worker URL state indirectly. | `domains/worker` URL resolution port. |
| `../../utilities/worker/workerCorsOrigins.js` | `buildWorkerAllowOrigins` in suggested allow-origin computation | Build recommended CORS origins from current browser origin and extra draft origins. | `AdminPage.allowlist.test.jsx` pins CORS normalization and nonce retry behavior. | `domains/worker` pure CORS origin port. |
| `../../utilities/arweave/arweaveUrls.js` | `normalizeArweaveUrl` for session-header and metadata display URLs | Normalize Arweave metadata/header URIs for display while preserving fallback text when normalization fails. | `AdminPage.metadata.test.jsx` and render coverage exercise displayed metadata links. | `domains/storage` Arweave URL port. |
| `../../utilities/arweave/arweaveClient.js` (`arweaveScripts.js` alias remains) | `readArweaveWalletBalance`, `formatWinstonToAr`, `uploadDataToArweave`, `buildArweaveGatewayUrl` | Read Arweave wallet balance for resource display and perform the admin test-upload button flow. | `AdminPage.resourceBalances.test.jsx` pins balance display; metadata suites mock upload/gateway helpers. | `domains/storage` Arweave admin port. |
| `../../utilities/worker/workerAuth.js` | `buildSignedAdminActionAuth`, `buildSiweMessage`, `fetchWorkerWithAuth` | Sign admin action requests; perform hand-rolled SIWE login; run authenticated health, AI, and root worker probes. | `AdminPage.workerSecrets.test.jsx` pins signed admin actions without exposing secrets; `AdminPage.allowlist.test.jsx` pins nonce retry; render characterization pins authenticated probe flow and in-flight suppression. | `domains/worker` admin-auth and SIWE-login ports, reusing the SessionWizard signed-action adapter where semantics match. |
| `../../utilities/web3/sessionRegistry.js` | `normalizeSessionIdHex`, `toRegistrySlug`, cache load/store reads, `fetchSessionFromRegistry`, cache upsert, cache update event listener, `setSessionFieldsOnChain`, `setResourceGatesOnChain`, `uploadSessionMetadata`, `updateSessionMetadataOnChain` | Load and refresh the registry cache, select requested sessions, subscribe to cache changes, and perform on-chain admin writes. | Render tests pin registry retry, cache update dispatch, cache round-trip, and listener add/remove symmetry; metadata and worker-secret tests mock write helpers. | `domains/sessions/registry` read and admin-write ports, reusing shared publish-lane registry adapters and write-normalization base where semantics match. |

## Test Coverage By Seam

| Suite | Coverage relevant to boundary seams |
|---|---|
| `AdminPage.test.tsx` | Worker config payload helpers and health/auth mismatch display helpers. |
| `AdminPage.workerSecrets.test.jsx` | Signed admin action requests, stored secret presence, nonce handling, and secret persistence without exposing secret values. |
| `AdminPage.allowlist.test.jsx` | Allow-origin normalization, admin nonce mismatch retry, and saved worker config behavior. |
| `AdminPage.metadata.test.jsx` | Metadata draft behavior, metadata upload/write wiring, mocked Arweave upload helpers, and registry write helpers. |
| `AdminPage.render.test.jsx` | Non-admin gating, requested registry refresh/retry, cache update event dispatch behavior, and render-level selected-session behavior. |
| `AdminPage.resourceBalances.test.jsx` | Arweave and faucet resource balance display states. |
| Helper suites | Pure formatting, metadata draft, resource display, SBT gate selection, secret-card, session display, test-result, worker-error, and worker config helpers. |

## Domain Port Inventory

| Domain port | Concrete low-level imports | AdminPage surface |
|---|---|---|
| `client/src/domains/worker/adminWorkerPorts.ts` | `worker/corsProxy.js`, `worker/workerCorsOrigins.js`, `worker/workerAuth.js` | Worker URL resolution, suggested CORS origins, signed admin-action auth, authenticated worker probes, and SIWE nonce/message preparation. Wallet signing remains parent-owned in `AdminPage.tsx`. |
| `client/src/domains/storage/adminArweavePorts.ts` | `arweave/arweaveClient.js` (`arweaveScripts.js` alias), `arweave/arweaveUrls.js` | Arweave wallet balance reads, Winston formatting, admin upload probe, gateway URL building, and registry metadata URL normalization. |
| `client/src/domains/sessions/sessionMediaUrls.ts` | `arweave/arweaveUrls.js` | Session-header media URL normalization for the hero image. |
| `client/src/domains/sessions/registry/sessionRegistryAdminPorts.ts` | `web3/sessionRegistry.js` | Registry cache load/read/upsert, requested session fetch, cache update subscription, field/gate/metadata writes, and shared session-field normalization. |
| `client/src/domains/sessions/registry/sessionRegistryWriteNormalization.ts` | None | Shared sponsored-field and compatibility-mirror normalization used by SessionWizard and AdminPage registry field writes. |

## Frontend Architecture Readiness Matrix

| Area | Controller-routed | Typed contract module present | Test-pinned | Parent-owned | Blocked reason | Next safe lane |
|---|---|---|---|---|---|---|
| Worker URL and CORS origins | Yes. `AdminPage.tsx` calls `adminWorkerPorts.workerUrl`. | Yes. `AdminWorkerUrlPort`. | Yes. URL resolution is covered by render characterization; allow-origin normalization remains pinned. | Selected session state, worker URL display state, current browser origin, and draft mutation. | None for this lane. | Future shell decomposition may move surrounding state, but low-level ownership is clear. |
| Arweave display, balance, and upload leaves | Yes. `AdminPage.tsx` calls `adminArweavePort` for Admin storage actions and `normalizeSessionMediaUrl` for session-header media. | Yes. `AdminArweavePort` and `normalizeSessionMediaUrl`. | Yes. Resource balance, metadata/upload, gateway-link, and session-header media behavior are covered by page and port suites. | Resource request tokens, display state, upload status/result state, and metadata draft state. | None for this lane. | Future storage lanes can split balance and upload ports if additional consumers appear. |
| Worker admin auth and probes | Yes. Signed actions and authenticated fetches route through `adminWorkerPorts.adminAuth`; SIWE nonce/message preparation routes through `adminWorkerPorts.siweLogin`. | Yes. `WorkerAdminAuthPort` and `WorkerSiweLoginPort`. | Yes. Signed admin actions, nonce retry, probe flows, and byte-preserving SIWE message construction are pinned. | Wallet account checks, modal opening, signer acquisition, SIWE signing, probe busy/result state, retry decisions, and denied-test status. | Signing intentionally stays parent-owned to avoid PRD 233/367 semantic drift. | A later auth controller can move page state only after separate SIWE/signing requirements. |
| Session registry reads and cache subscription | Yes. Cache load/read/upsert, requested fetches, and subscription cleanup route through `adminSessionRegistryPorts.reads`. | Yes. `SessionRegistryReadsPort`. | Yes. Registry retry, cache round-trip, and listener add/remove symmetry are pinned. | Requested session refs, selected session state, requested-refresh throttling, and route-visible refresh status. | None for this lane. | Future controller work can reduce page state once routing behavior is separately modeled. |
| Session registry admin writes | Yes. Field, gate, metadata upload, and metadata URI writes route through `adminSessionRegistryPorts.writes`. | Yes. `SessionRegistryAdminWritesPort` plus shared `sessionRegistryWriteNormalization`. | Yes. Metadata and secret/gate write payloads remain pinned by existing page suites and new port tests. | Form/draft state, wallet/provider selection, status/result state, and post-write cache refresh. | None for this lane. | Future registry lanes can extract higher-level write controllers without changing low-level adapters. |
| AdminPage shell decomposition | No reducer/controller ownership move is planned in this lane. | Helper modules and domain ports cover formatting/display and low-level operations. | Yes. Broad panel rendering, non-admin gating, metadata, worker secret, allowlist, resource, and port cases are covered. | All route state, render panels, wallet/provider signing, worker/storage/registry sequencing, and user-visible status strings. | This lane targets boundary ownership, not UI shell decomposition. | Keep route state parent-owned; consider controller extraction only with new behavior characterization. |
