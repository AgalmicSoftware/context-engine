# AdminPage Runtime Map

## Quick Reference

- Entry wrapper: `client/src/components/Admin/AdminPage.tsx`
- Current shape: function component, 3572 lines, 45 `useState`, 20 `useEffect`, 17 `useCallback`, 20 `useMemo`, and 11 `useRef` calls.
- Boundary debt: `AdminPage.tsx` owns 6 `route-page-no-low-level` baseline entries: `arweaveScripts.js`, `arweaveUrls.js`, `sessionRegistry.js`, `corsProxy.js`, `workerAuth.js`, and `workerCorsOrigins.js`.
- Existing test surface: 16 Admin files cover worker config payloads, signed admin actions, allowlist normalization, metadata writes, render gating and registry retry, resource balances, helper formatting, worker errors, and test-result rendering.
- Target architecture: `AdminPage.tsx` remains the route/page shell and UI state owner while concrete worker, storage, and session-registry operations move behind typed domain ports under `client/src/domains/**`.

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
| `../../utilities/arweave/arweaveScripts.js` | `readArweaveWalletBalance`, `formatWinstonToAr`, `uploadDataToArweave`, `buildArweaveGatewayUrl` | Read Arweave wallet balance for resource display and perform the admin test-upload button flow. | `AdminPage.resourceBalances.test.jsx` pins balance display; metadata suites mock upload/gateway helpers. | `domains/storage` Arweave admin port. |
| `../../utilities/worker/workerAuth.js` | `buildSignedAdminActionAuth`, `buildSiweMessage`, `fetchWorkerWithAuth` | Sign admin action requests; perform hand-rolled SIWE login; run authenticated health, AI, and root worker probes. | `AdminPage.workerSecrets.test.jsx` pins signed admin actions without exposing secrets; `AdminPage.allowlist.test.jsx` pins nonce retry. Probe sequencing still needs page-level characterization before movement. | `domains/worker` admin-auth and SIWE-login ports, reusing the SessionWizard signed-action adapter where semantics match. |
| `../../utilities/web3/sessionRegistry.js` | `normalizeSessionIdHex`, `toRegistrySlug`, cache load/store reads, `fetchSessionFromRegistry`, cache upsert, cache update event listener, `setSessionFieldsOnChain`, `setResourceGatesOnChain`, `uploadSessionMetadata`, `updateSessionMetadataOnChain` | Load and refresh the registry cache, select requested sessions, subscribe to cache changes, and perform on-chain admin writes. | Render tests pin registry retry and cache update behavior; metadata and worker-secret tests mock write helpers. Cache listener symmetry and cache round-trip need explicit characterization before movement. | `domains/sessions/registry` read and admin-write ports, reusing shared publish-lane registry adapters and write-normalization base where semantics match. |

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

## Frontend Architecture Readiness Matrix

| Area | Controller-routed | Typed contract module present | Test-pinned | Parent-owned | Blocked reason | Next safe lane |
|---|---|---|---|---|---|---|
| Worker URL and CORS origins | No. Direct calls remain in `AdminPage.tsx`. | No domain port yet. | URL resolution is indirectly covered; allow-origin normalization is pinned. | Selected session state, worker URL display state, current browser origin, and draft mutation. | Mechanical low-level calls still sit in route code. | Add a typed `domains/worker` port for `resolveCorsProxyUrl` and `buildWorkerAllowOrigins`, then prune those two baseline entries. |
| Arweave display, balance, and upload leaves | No. Direct calls remain in `AdminPage.tsx`. | No domain port yet. | Resource balance display and metadata/upload helpers are covered by existing page suites. | Resource request tokens, display state, upload status/result state, and metadata draft state. | Leaf calls are safe to port, but upload result ordering must stay pinned. | Add a typed `domains/storage` port for Arweave balance, formatting, URL normalization, upload, and gateway URL helpers. |
| Worker admin auth and probes | No. Direct calls remain in `AdminPage.tsx`. | Session publish lane has signed admin-action adapter types; AdminPage-specific probe and SIWE login ports are absent. | Signed admin actions and nonce retry are pinned; health/AI/root probe success, 401 retry, and stale response handling need stronger page tests. | Wallet account checks, modal opening, signer acquisition, SIWE signing, probe busy/result state, retry decisions, and denied-test status. | SIWE/signing/nonce semantics are PRD 233/367 territory; signing must stay in the page and message bytes must be characterized before moving message construction. | Add characterization tests, then introduce worker admin-auth and SIWE-login ports that preserve message construction byte-for-byte. |
| Session registry reads and cache subscription | No. Direct calls remain in `AdminPage.tsx`. | Publish lane has registry fetch/upsert/refresh adapter types; AdminPage-specific read/cache subscription port is absent. | Registry retry and cache update event dispatch are covered; cache round-trip and listener add/remove symmetry need explicit characterization. | Requested session refs, selected session state, requested-refresh throttling, and route-visible refresh status. | Cache/event behavior crosses React effects and global window listeners. | Add characterization tests, then introduce a typed registry reads port with cache load/read/upsert and subscribe/unsubscribe helper. |
| Session registry admin writes | No. Direct calls remain in `AdminPage.tsx`. | SessionWizard write-normalization exists for `setSessionFieldsOnChain`; AdminPage-specific admin write port is absent. | Metadata and secret/gate write payloads are mocked in existing suites. | Form/draft state, wallet/provider selection, status/result state, and post-write cache refresh. | Payload byte equality must be preserved; write-normalization base should be shared rather than copied. | Add a typed registry admin-writes port that reuses the shared write-normalization base for session fields and wraps the other write helpers. |
| AdminPage shell decomposition | No reducer/controller ownership move is planned in this lane. | Helper modules cover formatting/display only. | Broad panel rendering, non-admin gating, metadata, worker secret, allowlist, and resource cases are covered. | All route state, render panels, wallet/provider signing, worker/storage/registry execution sequencing, and user-visible status strings. | This lane targets boundary ownership, not UI shell decomposition. | Keep route state parent-owned; only move concrete low-level operations behind typed ports. |

