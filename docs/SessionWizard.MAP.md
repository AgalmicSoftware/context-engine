# SessionWizard.tsx Map

## Quick Reference

- File: `client/src/components/Sessions/SessionWizard.tsx`
- Current length: **4,654 lines**
- Shell file: `client/src/components/Sessions/SessionWizardShell.tsx` (**398 lines**)
- Intro/status rail file: `client/src/components/Sessions/SessionWizardIntroStatusRail.tsx` (**63 lines**)
- Publish summary file: `client/src/components/Sessions/SessionPublishSummary.tsx` (**223 lines**)
- Publish bundle fallback file: `client/src/components/Sessions/SessionPublishBundleFallbackPanel.tsx` (**85 lines**)
- Publish advanced settings file: `client/src/components/Sessions/SessionPublishAdvancedSettingsPanel.tsx` (**128 lines**)
- Publish action controls file: `client/src/components/Sessions/SessionPublishActionControls.tsx` (**77 lines**)
- Publish progress panel file: `client/src/components/Sessions/SessionPublishProgressPanel.tsx` (**79 lines**)
- Publish result links file: `client/src/components/Sessions/SessionPublishResultLinks.tsx` (**125 lines**)
- Contracts field file: `client/src/components/Sessions/SessionWizardContractsField.tsx` (**108 lines**)
- Storage profile field file: `client/src/components/Sessions/SessionWizardStorageProfileField.tsx` (**121 lines**)
- Requirements display helper: `client/src/components/Sessions/sessionWizardRequirementsDisplay.ts` (**95 lines**)
- Metadata payload helper: `client/src/components/Sessions/sessionWizardMetadataPayload.ts` (**146 lines**)
- Component type: **React function component**
- Hook inventory: **45 `useEffect` calls**, **32 `useMemo` calls**, **13 `useCallback` calls**
- Summary: `SessionWizard` is the session-creation and publish orchestrator. It bootstraps editable session metadata, manages encryption gates and pending SBT drafts, handles sponsored-bundle overrides, deploys or verifies worker configuration, uploads session metadata, and finally registers the session on-chain.
- Status note: the section ranges below are approximate current anchors; use the live file for exact line references.
- Recent extraction note: bounded follow-up work extracted field descriptors, metadata/publish composition, worker panel sections, narrow modal shells, passive wizard chrome/status pieces, the final passive render shell, the intro/status rail, publish action controls, publish bundle fallback controls, publish advanced settings, publish progress/result display panels, the advanced contracts field, the storage profile field, pure `/new` requirements display planning, pure publish readiness/request/action/progress/metadata-display planning, pure sponsored auto-deploy publish-surface planning, narrow publish controller slices, and pure metadata payload/upload guard descriptors. `SessionWizard` still owns state derivation, the public surface contract, and low-level publish side effects; `SessionWizardShell.tsx` owns passive final layout/wiring, `SessionWizardIntroStatusRail.tsx` owns passive requirements/status/normal-mode rail placement, `SessionPublishActionControls.tsx` owns publish button/settings affordance rendering from a named action display state and named publish/settings execution callback props while routing publish/settings callbacks back to the parent, `SessionPublishBundleFallbackPanel.tsx` owns passive sponsored/manual bundle fallback rendering while routing named bundle URL/file callbacks back to the parent, `SessionPublishAdvancedSettingsPanel.tsx` owns passive manual metadata/gas override rendering while routing named manual override callbacks back to the parent, `SessionPublishSummary.tsx` now renders normal/advanced mode and advanced-settings visibility from `SessionWizardPublishActionDisplayState` instead of duplicate shell props, `SessionPublishProgressPanel.tsx` owns passive publish-progress rendering from descriptor-owned eyebrow, ARIA text, percent, and step state, `SessionPublishResultLinks.tsx` owns passive metadata/register/session/admin/result-link rendering while routing the admin-copy callback back to the parent, `WorkerDeploySection.tsx` now consumes a named deploy-status/action display state instead of raw status/error/in-flight shell props while still routing deploy execution to the parent, `SessionWizardContractsField.tsx` owns passive contract-row rendering while routing draft updates/modal opens back to the parent, `SessionWizardStorageProfileField.tsx` owns passive storage-profile controls while routing normalized draft patches back to the parent, `sessionWizardRequirementsDisplay.ts` owns pure `/new` requirements banner visibility/status planning, `sessionWizardPublishReadiness.ts` owns pure publish readiness/request/action/execution/progress/metadata-display planning, `sessionWizardPublishFlow.ts` owns pure sponsored auto-deploy publish-surface planning and progress display state, `sessionWizardPublishController.ts` owns worker auto-deploy dispatch, pending-SBT step sequencing, metadata-upload dispatch around an injected parent upload port, pure publish start/admin preflight and register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status boundary, pure register success/failure settlement planning, completion request planning, pure publish failure settlement planning, and successful completion callbacks, and `sessionWizardMetadataPayload.ts` owns pure base metadata identity/default-featured normalization plus upload-time secret/gate budget guard planning without owning header upload, encryption, Arweave upload, wallet, worker auth, registry, route, or state effects.

## Navigation Rules

- Start in `SessionWizard.tsx` if you need top-level state, publish guards, metadata upload execution, registry writes, low-level side-effect implementations, or derived props passed into the final shell.
- Start in `SessionWizardShell.tsx` for final passive render composition, section ordering, and parent-to-panel prop wiring.
- Start in `SessionWizardIntroStatusRail.tsx` for requirements banner, sponsored-bundle status, and normal-mode rail placement inside the shell.
- Start in `CollapsibleFieldGroup.tsx` for collapsible advanced-section chrome.
- Start in `AiFieldSelect.tsx` for AI/gate select field rendering and its option/placeholder behavior.
- Start in `sessionWizardFieldDescriptors.ts` for ordered draft field descriptors, labels, tooltip text, and normal/advanced field visibility.
- Start in `SessionWizardHeader.tsx` for the title, mode toggle, sponsored display settings, and advanced registry-chain selector.
- Start in `SessionWizardRequirementsBanner.tsx` for `/new` setup prerequisite copy and dismissal display.
- Start in `sessionWizardRequirementsDisplay.ts` for pure `/new` setup prerequisite visibility and connected/sponsored status planning.
- Start in `SessionWizardNormalModeRail.tsx` for the normal-mode step cards/progress rail.
- Start in `SessionWizardSponsoredStatus.tsx` for sponsored-bundle preload/import status display.
- Start in `SessionWizardSessionIdBadge.tsx` for the advanced metadata-panel session ID badge, copy button, and regenerate button.
- Start in `SessionWizardInfoTooltip.tsx` for shared SessionWizard tooltip trigger markup.
- Start in `SessionMetadataEditor.tsx` for the metadata panel composition, JSON preview controls, and More Options surface.
- Start in `SessionWizardContractsField.tsx` for advanced contract row rendering, contract tooltips, modal-trigger buttons, and address input wiring.
- Start in `SessionWizardStorageProfileField.tsx` for advanced storage backend and Cloudflare payload-access controls.
- Start in `SessionPublishSummary.tsx` for publish panel composition. Use `SessionPublishActionControls.tsx` for publish button/settings affordance display, `SessionPublishBundleFallbackPanel.tsx` for sponsored/manual bundle fallback display, `SessionPublishAdvancedSettingsPanel.tsx` for manual metadata/gas override display, `SessionPublishProgressPanel.tsx` for publish-progress display, and `SessionPublishResultLinks.tsx` for generated metadata/register/session/admin/SBT links.
- Start in `sessionWizardPublishReadiness.ts` for pure publish readiness, request identity, action display, metadata fallback/display, UI execution-step, and progress-display plans.
- Start in `sessionWizardPublishFlow.ts` for pure sponsored auto-deploy bundle mode, hosted-bundle fallback visibility, and normal-mode publish-surface display planning.
- Start in `sessionWizardPublishController.ts` for publish step dispatch, publish start/admin preflight, metadata-upload dispatch, register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status, register success/failure settlement planning, completion request planning, publish failure settlement planning, and completion sequencing that calls injected side-effect ports/callbacks.
- Start in `sessionWizardMetadataPayload.ts` for pure metadata payload identity/default-featured normalization or upload-time secret/gate budget guard planning; `SessionWizard.tsx` still owns header upload, encryption, Arweave upload, worker auth, wallet, registry, route, and state effects.
- Start in `SessionWizardModals.tsx` for top-level `/new` modal ownership; it delegates to `SessionWizardCreateSbtModal.tsx`, `SessionWizardContractViewerModal.tsx`, and `SessionHeaderPreviewModal.tsx`.
- Start in `WorkerPanel.tsx` for worker setup composition; its subsections live in `WorkerSecretsSection.tsx`, `WorkerDeploySection.tsx`, and `WorkerConnectionSection.tsx`.
- Start in `hooks/useSponsoredBundleLifecycle.ts` for sponsored-bundle loading, apply/restore, and baseline override behavior.
- Start in `hooks/useSessionWizardWorkerDeploy.ts` for deploy-button orchestration, worker verification, and deploy helper lifecycle.
- Start in `sessionWizardNormalModeCards.ts` for normal-mode card and publish-summary view-model builders.
- Start in `sessionWizardContracts.js` for contract defaults, visible contract keys, or registry-address resolution.
- Start in `sessionWizardSecrets.ts` for post-deploy worker config sync, secrets sync, or deploy warning/status handling.
- Start in `sessionWizardWriteNormalization.ts` for worker payload normalization, on-chain compatibility fields, or metadata serialization rules.
- Start in `sessionWizardStorageProfile.ts` for `/new` Advanced session storage profile defaults and Cloudflare primitive metadata.
- Start in `CreateSBTGroup.tsx` only when the issue is inside the deferred SBT authoring modal itself; `SessionWizard.tsx` mainly launches and reconciles that flow.

## Practical Hierarchy

```text
SessionWizard.tsx
  -> SessionWizardShell.tsx
       -> SessionWizardHeader.tsx
       -> SessionWizardIntroStatusRail.tsx
            -> SessionWizardRequirementsBanner.tsx
            -> SessionWizardSponsoredStatus.tsx
            -> SessionWizardNormalModeRail.tsx
       -> EncryptionPanel.tsx
       -> SessionMetadataEditor.tsx
            -> SessionWizardSessionIdBadge.tsx
       -> WorkerPanel.tsx
            -> WorkerSecretsSection.tsx
            -> WorkerDeploySection.tsx
            -> WorkerConnectionSection.tsx
       -> SessionPublishSummary.tsx
            -> SessionPublishActionControls.tsx
            -> SessionPublishBundleFallbackPanel.tsx
            -> SessionPublishAdvancedSettingsPanel.tsx
            -> SessionPublishProgressPanel.tsx
            -> SessionPublishResultLinks.tsx
       -> SessionWizardModals.tsx
            -> SessionWizardCreateSbtModal.tsx
            -> SessionWizardContractViewerModal.tsx
            -> SessionHeaderPreviewModal.tsx
  -> CollapsibleFieldGroup.tsx
  -> AiFieldSelect.tsx
  -> sessionWizardFieldDescriptors.ts
  -> sessionWizardRequirementsDisplay.ts
  -> sessionWizardPublishReadiness.ts
  -> sessionWizardPublishFlow.ts
  -> sessionWizardPublishController.ts
  -> sessionWizardMetadataPayload.ts
  -> SessionWizardInfoTooltip.tsx
  -> SessionWizardContractsField.tsx
  -> SessionWizardStorageProfileField.tsx
  -> sessionWizardNormalModeCards.ts
  -> hooks/useSponsoredBundleLifecycle.ts
  -> hooks/useSessionWizardWorkerDeploy.ts
  -> sessionWizardContracts.js
  -> sessionWizardSecrets.ts
  -> sessionWizardWriteNormalization.ts
  -> sessionWizardStorageProfile.ts
  -> CreateSBTGroup.tsx
  -> ContractViewer.tsx
```

## Section Index

| Section | Lines | Purpose | Key Exports / Helpers |
|---|---:|---|---|
| Imports, re-exports, constants, pure helpers | 1-516 | File-level helper exports, worker deploy validation, sponsored-bundle helpers, session ID generation, cache helpers | `getSessionSlugValidationError`, `buildSessionWizardPublishPlan`, `resolveSessionWizardChipotleHookConfig` |
| Component bootstrap and cached draft hydration | 517-1249 | Initializes persisted wizard state, session metadata draft, gate state, worker state, sponsored-bundle state, and refs used across async flows | `SessionWizard`, sponsored-bundle lifecycle wiring |
| Derived config and synchronization effects | 1250-2237 | Keeps chain defaults, gate/resource snapshots, header preview state, and source-session inheritance aligned with the active draft | registry-chain effects, gate sync effects, session-header preview effects |
| Draft mutation and modal orchestration | 2238-2405 | Core draft updates, gate editing, resource-gate resolution, create-SBT modal wiring, contract viewer controls | `updateDraftValue`, `updateEncryptionGate`, `handleGateAddSbt`, `handleSavePendingSbtDraft` |
| Field renderer and advanced metadata fields | 2406-3130 | Recursive field rendering, lock/gate UI, compact header image controls, contracts/storage field handoffs, normal-vs-advanced metadata fields | `renderCompactSessionHeaderField`, `renderSessionHeaderPreviewSurface`, `renderField`, `SessionWizardContractsField`, `SessionWizardStorageProfileField` |
| Publish prep: metadata, SBT drafts, registry writes | 3131-3554 | Builds metadata payloads using pure payload helpers, uploads Arweave metadata, finalizes deferred SBT uploads, and prepares on-chain registration | `buildMetadataPayload`, `handleUploadMetadata`, `deployPendingSbtDrafts`, `resolveSessionWizardMetadataPayloadBase`, `applySessionWizardMetadataUploadGuards` |
| Publish orchestration and deploy helpers | 3555-4196 | Coordinates publish flow, delegates worker auto-deploy, pending-SBT step sequencing, publish start/admin preflight, metadata-upload dispatch, register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status callbacks, register success/failure settlement planning, completion request planning, publish failure settlement planning, and successful completion callbacks to `sessionWizardPublishController.ts`, handles copy helpers, session/admin URL application, worker deploy inputs, and connected-admin resolution | `handlePublish`, `resolveSessionWizardPublishStartPreflightDescriptor`, `resolveSessionWizardPublishAdminPreflightDescriptor`, `runSessionWizardPublishController`, `runSessionWizardPublishMetadataUploadController`, `resolveSessionWizardRegisterStepRequest`, `resolveSessionWizardRegisterIdentityDescriptor`, `resolveSessionWizardRegisterDuplicateCheckDescriptor`, `resolveSessionWizardRegisterPreflightDescriptor`, `resolveSessionWizardRegisterArgsDescriptor`, `runSessionWizardRegisterStepController`, `resolveSessionWizardRegisterSuccessSettlementDescriptor`, `resolveSessionWizardRegisterFailureSettlementDescriptor`, `appendSessionWizardRegisterTxEntry`, `resolveSessionWizardPublishCompletionRequest`, `resolveSessionWizardPublishFailureSettlementDescriptor`, `runSessionWizardPublishCompletionController`, `handleCopyAdminUrl`, `handleDeployWorker` |
| Worker/resource cards and derived publish UI | 4197-4490 | Worker deploy result handling, config/secrets sync UI, resource secret inputs, contract modal selection, pure requirements display planning, pure sponsored auto-deploy publish-surface planning, pure publish readiness/action/progress/metadata-display plan handoff, and deploy-status/action display-state handoff | `updateResourceGate`, `renderResourceInputs`, `renderResourceCard`, `resolveSessionWizardNewSessionRequirementsDisplayState`, `resolveSessionWizardSponsoredPublishSurfaceState`, `resolveSessionWizardPublishUiPlan`, `resolveSessionWizardDeployStatusDisplayState`, selected contract memoization |
| Final shell handoff | 4491-4654 | Derives and forwards the full `/new` surface state/handlers into the passive shell while retaining parent-owned side effects | `SessionWizardShell`, `export default SessionWizard` |
| Passive render composition (`SessionWizardShell.tsx`) | 1-398 | Renders header, intro/status rail, encryption, metadata, worker, publish, and modal modules without owning publish/worker/storage/SBT/wallet side effects | `SessionWizardHeader`, `SessionWizardIntroStatusRail`, `SessionMetadataEditor`, `WorkerPanel`, `SessionPublishSummary`, `SessionWizardModals` |
| Passive intro/status rail (`SessionWizardIntroStatusRail.tsx`) | 1-63 | Places requirements banner, sponsored status, and normal-mode rail from explicit props while parent owns dismissal/retry/focus state and sponsored/publish/worker side effects | `SessionWizardRequirementsBanner`, `SessionWizardSponsoredStatus`, `SessionWizardNormalModeRail` |
| Passive publish summary (`SessionPublishSummary.tsx`) | 1-223 | Places passive publish action/bundle-fallback/advanced-settings/progress/result panels from the publish UI plan while parent owns publish/deploy/upload/register/storage/wallet side effects | `SessionPublishActionControls`, `SessionPublishBundleFallbackPanel`, `SessionPublishAdvancedSettingsPanel`, `SessionPublishProgressPanel`, `SessionPublishResultLinks` |
| Passive publish action controls (`SessionPublishActionControls.tsx`) | 1-77 | Renders normal/advanced publish buttons, loading/disabled states, and advanced-settings affordance from `SessionWizardPublishActionDisplayState` plus named execution callback props while routing publish/settings callbacks back to the parent without owning publish, upload, deploy, route, or state mutation side effects | `SessionPublishActionControls` |
| Passive publish bundle fallback (`SessionPublishBundleFallbackPanel.tsx`) | 1-85 | Renders manual bundle URL override and one-shot bundle-file retry controls while routing named bundle URL/file callbacks back to the parent without owning worker deploy, bundle fetch, publish, route, or state mutation side effects | `SessionPublishBundleFallbackPanel` |
| Passive publish advanced settings (`SessionPublishAdvancedSettingsPanel.tsx`) | 1-128 | Renders manual metadata URI and gas override controls from explicit values while routing named manual override callbacks back to the parent without owning metadata upload, register transaction, route, or state mutation side effects | `SessionPublishAdvancedSettingsPanel` |
| Passive publish progress (`SessionPublishProgressPanel.tsx`) | 1-79 | Renders publish step progress from `SessionWizardPublishProgressDisplayState` while parent/controller code owns publish step mutation and publish execution | `SessionPublishProgressPanel` |
| Passive publish result links (`SessionPublishResultLinks.tsx`) | 1-125 | Renders metadata URI, Arweave tx, register txs, session/admin URLs, published pending-SBT links, and status copy from explicit descriptors while routing admin-copy back to the parent | `SessionPublishResultLinks` |
| Passive contracts field (`SessionWizardContractsField.tsx`) | 1-108 | Renders advanced contract rows, explainer tooltip triggers, modal buttons, and address inputs while parent owns draft mutation and modal selection | `SessionWizardContractsField` |
| Passive storage profile field (`SessionWizardStorageProfileField.tsx`) | 1-121 | Renders advanced storage backend and Cloudflare payload-access controls while parent owns draft mutation and broader publish/storage side effects | `SessionWizardStorageProfileField` |
| Requirements display planning (`sessionWizardRequirementsDisplay.ts`) | 1-95 | Derives `/new` requirements banner visibility, connected status, sponsored status, and pending requirement labels without owning wallet, sponsored bundle, publish, route, worker, storage, or state application side effects | `resolveSessionWizardNewSessionRequirementsDisplayState` |
| Metadata payload planning (`sessionWizardMetadataPayload.ts`) | 1-146 | Derives base metadata identity/default-featured normalization and upload-time secret/gate budget guards without owning header upload, encryption, Arweave upload, worker auth, wallet, registry, route, or state effects | `resolveSessionWizardMetadataPayloadBase`, `applySessionWizardMetadataUploadGuards`, `normalizeSessionWizardDefaultFeaturedSbtMetadata` |

## Key Workflows

### Draft bootstrap

```text
cache/session query params
  -> initialDraft + initial gates
  -> source-session inheritance
  -> derived registry chain / worker defaults
  -> editable draft state
```

### Pending SBT flow

```text
CreateSBTGroup modal
  -> deferred draft saved in sessionStorage
  -> SessionWizard keeps predicted addresses and gate selections stable
  -> publish path finalizes uploads before on-chain session registration
```

### Publish flow

```text
draft + gates + worker state
  -> sessionWizardRequirementsDisplay pure `/new` prerequisite display plan
  -> sessionWizardPublishFlow pure sponsored auto-deploy bundle/fallback surface plan
  -> sessionWizardPublishReadiness pure readiness/request/action/progress/metadata-display UI plan
  -> sessionWizardMetadataPayload pure base metadata identity/default-featured and upload guard plans
  -> sessionWizardPublishController pure publish start preflight descriptor plan
  -> sessionWizardPublishController pure publish admin preflight descriptor plan
  -> sessionWizardPublishController optional worker deploy
  -> sessionWizardPublishController optional pending SBT deploy/finalize
  -> sessionWizardPublishController metadata upload dispatch around SessionWizard-owned upload execution
  -> sessionWizardPublishController pure register-step request plan
  -> sessionWizardPublishController pure register identity readiness plan
  -> sessionWizardPublishController pure duplicate-check request plan
  -> SessionWizard-owned duplicate registry contract reads
  -> sessionWizardPublishController pure register preflight descriptor plan
  -> sessionWizardPublishController pure register-args descriptor plan
  -> sessionWizardPublishController register-step tx/status callbacks around injected session registry write
  -> sessionWizardPublishController pure register-success settlement plan
  -> SessionWizard-owned session/admin URL, cache, session ID, registry-refresh state application
  -> sessionWizardPublishController pure register-failure settlement and tx append planning
  -> SessionWizard-owned error status, tx state application, and rethrow
  -> sessionWizardPublishController pure completion request plan
  -> sessionWizardPublishController completion callbacks
  -> if any publish step throws: sessionWizardPublishController pure publish-failure settlement plan
  -> if any publish step throws: SessionWizard-owned error status and publish-progress reset application
```

### Sponsored bundle flow

```text
bundle link / imported bundle
  -> apply sponsored worker secrets + deploy form overrides
  -> optionally auto-deploy worker
  -> track baseline state for restore
  -> clear or restore overrides when flow changes
```

## State Machine (High-Signal State)

| State | Meaning | Main effect |
|---|---|---|
| `draft` | Canonical editable session metadata snapshot | Feeds metadata upload and on-chain registration |
| `encryptionGates` | Session-level gate definitions | Drives lock UI, sponsored resource gates, and Lit defaults |
| `pendingSbtDrafts` | Deferred SBT drafts waiting for publish-time finalize/deploy | Pins slug-sensitive state and injects deploy work into publish flow |
| `workerSecrets` / `workerSecretsEnabled` | Worker-side secrets and whether the wizard should manage them | Controls deploy validation and post-deploy secret sync |
| `draft.storageProfile` | Advanced-mode session-owned storage profile | Defaults to Arweave; Lit-Arweave keeps encrypted Arweave docs/context available; Cloudflare mode records worker-enforced R2/D1/KV/Durable Object primitives without making `/worker-setup` own storage policy |
| `deployForm` / `deployWorkerUrl` / `deployComplete` | Worker deploy input and result state | Drives worker verification UI and publish readiness |
| `publishStep` / `publishBusy` | Parent-owned publish progress and busy state | Feeds `sessionWizardPublishReadiness.ts` progress/action UI planning; `SessionPublishProgressPanel` and `SessionPublishActionControls` consume descriptor-owned display state through `SessionPublishSummary` instead of receiving raw busy props |
| `slugAvailability` | Async slug-check result | Blocks invalid publish/deploy attempts early |
| `resourceGateMap` | Resource-to-gate assignments for AI, Arweave, tx gas, etc. | Gets serialized into sponsored/worker config payloads |

## Edit Heuristics

- If a bug is about registry fields or contract addresses, check `sessionWizardContracts.js` first.
- If a bug is about worker config sync or post-deploy warnings, check `sessionWizardSecrets.ts` first.
- If a bug is about publish payload shape mismatch between worker config and on-chain metadata, check `sessionWizardWriteNormalization.ts` first.
- If a bug is about gated field UI, draft persistence, or wizard step order, `SessionWizard.tsx` is the right entrypoint.

## Residual Risk

`SessionWizard.tsx` is still a large hook-driven state machine even though passive final composition now lives in `SessionWizardShell.tsx`. This map helps navigation, but it does not replace the longer-term decomposition work tracked in the refactor roadmap.
