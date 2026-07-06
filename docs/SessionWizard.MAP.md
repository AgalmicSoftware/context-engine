# SessionWizard.tsx Map

## Quick Reference

- File: `client/src/components/Sessions/SessionWizard.tsx`
- Current length: **4,544 lines**
- Shell file: `client/src/components/Sessions/SessionWizardShell.tsx` (**583 lines**)
- Intro/status rail file: `client/src/components/Sessions/SessionWizardIntroStatusRail.tsx` (**63 lines**)
- Publish summary file: `client/src/components/Sessions/SessionPublishSummary.tsx` (**218 lines**)
- Publish bundle fallback file: `client/src/components/Sessions/SessionPublishBundleFallbackPanel.tsx` (**85 lines**)
- Publish advanced settings file: `client/src/components/Sessions/SessionPublishAdvancedSettingsPanel.tsx` (**128 lines**)
- Publish action controls file: `client/src/components/Sessions/SessionPublishActionControls.tsx` (**77 lines**)
- Publish progress panel file: `client/src/components/Sessions/SessionPublishProgressPanel.tsx` (**79 lines**)
- Publish result links file: `client/src/components/Sessions/SessionPublishResultLinks.tsx` (**120 lines**)
- Publish links helper: `client/src/components/Sessions/sessionWizardPublishLinks.ts` (**50 lines**)
- Publish reducer: `client/src/domains/sessions/publish/sessionPublishReducer.ts` (**256 lines**)
- Publish dispatch helper: `client/src/domains/sessions/publish/sessionPublishDispatch.ts` (**80 lines**)
- Publish port types: `client/src/domains/sessions/publish/sessionPublishPorts.ts` (**121 lines**)
- Publish adapters: `client/src/domains/sessions/publish/sessionPublishAdapters.ts` (**232 lines**)
- Contracts field file: `client/src/components/Sessions/SessionWizardContractsField.tsx` (**108 lines**)
- Mode profile field file: `client/src/components/Sessions/SessionModeProfileField.tsx`
- Storage profile field file: `client/src/components/Sessions/SessionWizardStorageProfileField.tsx` (**121 lines**)
- Requirements display helper: `client/src/components/Sessions/sessionWizardRequirementsDisplay.ts` (**95 lines**)
- Publish readiness helper: `client/src/components/Sessions/sessionWizardPublishReadiness.ts` (**326 lines**)
- Metadata payload helper: `client/src/components/Sessions/sessionWizardMetadataPayload.ts` (**146 lines**)
- Header preview hook: `client/src/components/Sessions/hooks/useSessionHeaderPreview.ts` (**142 lines**)
- Chrome state hook: `client/src/components/Sessions/hooks/useSessionWizardChromeState.ts` (**83 lines**)
- Live refs hook: `client/src/components/Sessions/hooks/useSessionWizardLiveRefs.ts` (**95 lines**)
- Publish advanced state hook: `client/src/components/Sessions/hooks/useSessionWizardPublishAdvancedState.ts` (**55 lines**)
- Publish elapsed hook: `client/src/components/Sessions/hooks/useSessionWizardPublishElapsed.ts` (**28 lines**)
- Worker state hook: `client/src/components/Sessions/hooks/useSessionWizardWorkerState.ts` (**131 lines**)
- Block limits hook: `client/src/components/Sessions/hooks/useSessionWizardBlockLimits.ts` (**141 lines**)
- New-session banner hook: `client/src/components/Sessions/hooks/useSessionWizardNewSessionBanner.ts` (**38 lines**)
- Worker sync effects hook: `client/src/components/Sessions/hooks/useSessionWizardWorkerSyncEffects.ts` (**106 lines**)
- Identity effects hook: `client/src/components/Sessions/hooks/useSessionWizardIdentityEffects.ts` (**115 lines**)
- Tooltip preference hook: `client/src/components/Sessions/hooks/useSessionWizardTooltipPreference.ts` (**28 lines**)
- Normal-mode section visibility hook: `client/src/components/Sessions/hooks/useSessionWizardNormalModeSectionVisibility.ts` (**32 lines**)
- Cleanup effect hook: `client/src/components/Sessions/hooks/useSessionWizardCleanupEffect.ts` (**44 lines**)
- Draft state helper: `client/src/components/Sessions/sessionWizardDraftState.ts` (**344 lines**)
- Session mode profile helper: `client/src/utilities/session/sessionModeProfile.ts`
- AI config helper: `client/src/components/Sessions/sessionWizardAiConfig.ts` (**150 lines**)
- Create-SBT support helper: `client/src/components/Sessions/sessionWizardCreateSbtSupport.ts` (**261 lines**)
- Contract helper: `client/src/components/Sessions/sessionWizardContracts.ts` (**149 lines**)
- Resource-gate support helper: `client/src/components/Sessions/sessionWizardResourceGateSupport.ts` (**186 lines**)
- Component type: **React function component**
- Hook inventory: **18 KPI `useState(` calls** (**30 generic-aware `useState` calls**), **15 `useEffect` calls**, **29 `useMemo` calls**, **12 `useCallback` calls**
- Summary: `SessionWizard` is the session-creation and publish orchestrator. It bootstraps editable session metadata, manages encryption gates and pending SBT drafts, handles sponsored-bundle overrides, deploys or verifies worker configuration, uploads session metadata, and finally registers the session on-chain.
- Status note: the section ranges below are approximate current anchors; use the live file for exact line references.
- Recent extraction note: bounded follow-up work extracted field descriptors, metadata/publish composition, worker panel sections, narrow modal shells, passive wizard chrome/status pieces, the final passive render shell with an explicit typed prop contract, the intro/status rail, publish action controls, publish bundle fallback controls, publish advanced settings, publish progress/result display panels, the advanced contracts field, the storage profile field, pure `/new` requirements display planning, pure publish readiness/request/action/progress/metadata identity/display planning, pure published pending-SBT link display-model planning, pure sponsored auto-deploy publish-surface planning, narrow publish controller slices, pure metadata payload/upload guard descriptors, pure registry-chain draft defaults for contracts/RPC/faucet, pure AI model-provider patch planning, typed create-SBT modal launch descriptors, typed pending SBT/gate runtime boundaries, typed worker signing/runtime handoffs, direct `SessionWizard.tsx` TypeScript coverage after removing the file-level suppression, pure worker resource-gate selection planning, pure contract-viewer modal planning, pure create-SBT modal value planning, the session-header preview/upload UI state hook, the passive chrome state hook, the live runtime-ref synchronization hook, the publish advanced form-state hook, the publish elapsed timer hook, the cleanup effect hook, the worker deploy state hook, the block-limit state/effects hook, the new-session banner state hook, the worker sync effects hook, the identity/slug effects hook, the tooltip preference hook, and the normal-mode section visibility hook. `SessionWizard` now wires the pure publish reducer and domain publish adapters for low-level Arweave/web3/worker seams while retaining React state derivation, upload/encryption ordering, and tested controller callback sequencing. `SessionWizardShell.tsx` owns passive final layout/wiring and the typed parent-to-panel prop boundary, `SessionWizardIntroStatusRail.tsx` owns passive requirements/status/normal-mode rail placement, `SessionPublishActionControls.tsx` owns publish button/settings affordance rendering from a named action display state and named publish/settings execution callback props while routing publish/settings callbacks back to the parent, `SessionPublishBundleFallbackPanel.tsx` owns passive sponsored/manual bundle fallback rendering while routing named bundle URL/file callbacks back to the parent, `SessionPublishAdvancedSettingsPanel.tsx` owns passive manual metadata/gas override rendering while routing named manual override callbacks back to the parent, `SessionPublishSummary.tsx` now renders normal/advanced mode and advanced-settings visibility from `SessionWizardPublishActionDisplayState` instead of duplicate shell props, `SessionPublishProgressPanel.tsx` owns passive publish-progress rendering from descriptor-owned eyebrow, ARIA text, percent, and step state, `SessionPublishResultLinks.tsx` owns passive metadata/register/session/admin/result-link rendering while routing the admin-copy callback back to the parent, `WorkerDeploySection.tsx` now consumes a named deploy-status/action display state instead of raw status/error/in-flight shell props while still routing deploy execution to the parent, `SessionWizardContractsField.tsx` owns passive contract-row rendering while routing draft updates/modal opens back to the parent, `SessionWizardStorageProfileField.tsx` owns passive storage-profile controls while routing normalized draft patches back to the parent, `hooks/useSessionHeaderPreview.ts` owns session-header mode/file/preview-modal/status state, object-URL preview cleanup, clipboard paste handling, and clear-preview state reset while leaving upload-to-Arweave call ordering and metadata serialization in `SessionWizard`, `hooks/useSessionWizardChromeState.ts` owns passive display-settings, metadata-collapse, prompt/JSON preview, more-options, and normal-section collapsed/open state while leaving copy timers and route/publish behavior in `SessionWizard`, `hooks/useSessionWizardNormalModeSectionVisibility.ts` owns normal-mode section visibility normalization when the worker step is hidden or visible, `hooks/useSessionWizardTooltipPreference.ts` owns Redux-backed tooltip preference state and subscription updates, `hooks/useSessionWizardCleanupEffect.ts` owns unmount cleanup for mounted state and local timeout refs, `hooks/useSessionWizardLiveRefs.ts` owns live ref synchronization for draft, deploy form, account, worker deploy status, sponsored context, and worker-secret snapshots while leaving pending modal, publish timer, and execution behavior in `SessionWizard`, `hooks/useSessionWizardPublishAdvancedState.ts` owns manual metadata/gas field state, metadata result state, and publish-advanced visibility while leaving metadata upload, register transaction, wallet, route, and publish execution in `SessionWizard`, `hooks/useSessionWizardPublishElapsed.ts` owns the publish-step elapsed timer while publish decisions stay in the parent/controller, `hooks/useSessionWizardWorkerState.ts` owns worker mode, deploy form/status, bundle fallback state, cached worker URL/completion, worker secrets, and worker allow-origin input state while leaving deploy helper execution, worker verification, publish, route, and storage behavior in `SessionWizard` and `useSessionWizardWorkerDeploy`, `hooks/useSessionWizardWorkerSyncEffects.ts` owns worker form/default URL synchronization effects while leaving deploy helper execution and verification in `useSessionWizardWorkerDeploy`, `hooks/useSessionWizardIdentityEffects.ts` owns initial registry/session ID hydration, private slug mirroring, automatic slug generation, and private-SBT slug mode toggling while the shell keeps explicit slug edits and validation, `hooks/useSessionWizardBlockLimits.ts` owns latest-block fetch/status, block-limit duration/unit state, start auto-fill, manual start suppression, and end-block derivation while leaving metadata serialization and publish/deploy consumers parent-owned, `hooks/useSessionWizardNewSessionBanner.ts` owns plain/sponsored `/new` requirements-banner dismissal state and persistence while `sessionWizardRequirementsDisplay.ts` owns the pure display decision, `sessionWizardRequirementsDisplay.ts` owns pure `/new` requirements banner visibility/status planning, `sessionWizardPublishReadiness.ts` owns pure publish readiness/request/action/execution/progress/metadata identity/display planning, `sessionWizardPublishLinks.ts` owns pure published pending-SBT link display-model planning without owning SBT deployment/finalization, route, or state effects, `sessionWizardPublishFlow.ts` owns pure sponsored auto-deploy publish-surface planning and progress display state, `sessionWizardPublishController.ts` owns worker auto-deploy dispatch, pending-SBT step sequencing, typed register tx entry shape, metadata-upload dispatch around an injected parent upload port, pure publish start/admin preflight and register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status boundary, pure register success/failure settlement planning, completion request planning, pure publish failure settlement planning, and successful completion callbacks, `client/src/domains/sessions/publish/sessionPublishReducer.ts` owns the pure publish status/effect reducer, `sessionPublishDispatch.ts` owns typed reducer-dispatch helpers for begin/success/failure wrappers, `sessionPublishPorts.ts` owns the typed effect port contract, `sessionPublishAdapters.ts` binds the Arweave, registry, worker-auth, sponsored-bundle, SBT factory receipt, and SBT metadata seams through call-time module lookup, `sessionWizardDraftState.ts` owns initial draft/cache shape plus pure registry-chain contract/RPC/faucet draft defaults, `sessionWizardAiConfig.ts` owns pure AI model/provider correction patch planning, `sessionWizardCreateSbtSupport.ts` owns typed create-SBT launch descriptors plus modal chain/network/session/JWK display planning, `sessionWizardContracts.ts` owns pure contract defaults, visible-key, registry-address, and contract-viewer modal planning, `sessionWizardResourceGateSupport.ts` owns pure worker resource-card selection fallback/update planning, and `sessionWizardMetadataPayload.ts` owns pure base metadata identity/default-featured normalization plus upload-time secret/gate budget guard planning without owning header upload, encryption, Arweave upload, wallet, worker auth, registry, route, or state effects.

- Typed-readiness note: `SessionWizard` now typechecks directly without `@ts-nocheck`. It keeps deploy form, registry-chain, gate-selection, resource-gate map, session-header upload execution, field renderer, metadata encryption/upload, register/publish handoff, sponsored-bundle refs, render-field handoff, AI model patch, create-SBT launch, sponsored draft-gate reads, pending SBT draft/gate callbacks, provisioned sponsored context state, worker deploy runtime refs, register tx entries, and worker signing handoffs under local typed boundaries; `resourceGateMap` explicitly permits both single gate ids and multi-gate id arrays while publish/deploy/upload/worker/storage/wallet/route effects remain parent-owned. Passive tooltip render props share `SessionWizardTooltipRenderOptions['placement']`, metadata/worker shell surfaces share the `SessionWizardRenderField` callback shape, publish completion accepts readonly pending-draft snapshots, nullable sponsored-bundle refs are normalized by helper boundaries, and `rpcReadCache.ts` accepts normal ethers `send(string, params[])` providers without requiring call-site casts. Remaining readiness work should focus on reducing structural shell size and state density rather than restoring suppression.

## Navigation Rules

- Start in `SessionWizard.tsx` if you need top-level state, publish reducer dispatch, metadata upload/encryption ordering, tested publish controller callbacks, or derived props passed into the final shell.
- Start in `SessionWizardShell.tsx` for final passive render composition, section ordering, the typed shell prop contract, and parent-to-panel prop wiring.
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
- Start in `SessionModeProfileField.tsx` for the `/new` preset-first session-mode screen, advanced per-axis overrides, preset-to-custom flip, and guardrail copy. `utilities/session/sessionModeProfile.ts` owns schema normalization, preset descriptors, validity checks, and pure compile-down to the storage profile / payload-access runtime fields.
- Start in `SessionWizardStorageProfileField.tsx` for advanced storage backend and Cloudflare payload-access controls.
- Start in `SessionPublishSummary.tsx` for publish panel composition. Use `SessionPublishActionControls.tsx` for publish button/settings affordance display, `SessionPublishBundleFallbackPanel.tsx` for sponsored/manual bundle fallback display, `SessionPublishAdvancedSettingsPanel.tsx` for manual metadata/gas override display, `SessionPublishProgressPanel.tsx` for publish-progress display, and `SessionPublishResultLinks.tsx` for generated metadata/register/session/admin/SBT links.
- Start in `sessionWizardPublishReadiness.ts` for pure publish readiness, request identity, action display, metadata fallback identity/display, UI execution-step, and progress-display plans.
- Start in `sessionWizardPublishLinks.ts` for published pending-SBT link display models after publish completion; `SessionWizard.tsx` and `sessionWizardPublishController.ts` still own completion state/callback execution.
- Start in `sessionWizardPublishFlow.ts` for pure sponsored auto-deploy bundle mode, hosted-bundle fallback visibility, and normal-mode publish-surface display planning.
- Start in `sessionWizardPublishController.ts` for publish step dispatch, publish start/admin preflight, metadata-upload dispatch, register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status, register success/failure settlement planning, completion request planning, publish failure settlement planning, and completion sequencing that calls injected side-effect ports/callbacks.
- Start in `client/src/domains/sessions/publish/sessionPublishReducer.ts` for pure publish statuses, effect ordering, retry/cancel transitions, and completed-effect tracking.
- Start in `client/src/domains/sessions/publish/sessionPublishDispatch.ts` for typed reducer-dispatch helpers around begin/success/failure wrapping.
- Start in `client/src/domains/sessions/publish/sessionPublishPorts.ts` for the typed publish effect port surface.
- Start in `client/src/domains/sessions/publish/sessionPublishAdapters.ts` for concrete Arweave, registry, worker-auth, sponsored-bundle, SBT factory receipt, and SBT metadata bindings.
- Start in `sessionWizardMetadataPayload.ts` for pure metadata payload identity/default-featured normalization or upload-time secret/gate budget guard planning; `SessionWizard.tsx` still owns header upload/encryption ordering while concrete Arweave, worker-auth, registry, SBT metadata, SBT receipt, and sponsored-bundle calls route through domain publish adapters.
- Start in `hooks/useSessionHeaderPreview.ts` for session-header URL/upload mode, compact chooser mode, file preview object URLs, preview modal/status state, clipboard paste handling, and clear-preview reset. `SessionWizard.tsx` still owns upload-to-Arweave execution and metadata payload serialization.
- Start in `hooks/useSessionWizardChromeState.ts` for sponsored display-settings visibility, metadata object collapse state, prompt/JSON preview flags, More Options visibility, and normal-mode section collapse state. `SessionWizard.tsx` still owns copy timers, field rendering, route, publish, and upload behavior.
- Start in `hooks/useSessionWizardNormalModeSectionVisibility.ts` for normal-mode section visibility normalization when the worker step appears or disappears.
- Start in `hooks/useSessionWizardTooltipPreference.ts` for Redux-backed tooltip preference state and subscription updates.
- Start in `hooks/useSessionWizardCleanupEffect.ts` for unmount cleanup of mounted state and local timeout refs.
- Start in `hooks/useSessionWizardLiveRefs.ts` for live ref synchronization used by worker deploy, sponsored bundle, and async callback handoffs. `SessionWizard.tsx` still owns the behaviors that consume those refs.
- Start in `hooks/useSessionWizardPublishAdvancedState.ts` for manual metadata URI, metadata upload result fields, gas override fields, and publish advanced panel visibility. `SessionWizard.tsx` still owns metadata upload and registration execution.
- Start in `hooks/useSessionWizardPublishElapsed.ts` for publish-step elapsed timer reset/tick/cleanup. `SessionWizard.tsx` and `sessionWizardPublishController.ts` still own publish decisions.
- Start in `hooks/useSessionWizardWorkerState.ts` for worker mode, deploy form/status, bundle fallback, cached worker completion/URL, worker secrets, and worker allow-origin input state. `SessionWizard.tsx` and `useSessionWizardWorkerDeploy.ts` still own deploy helper execution, verification, publish, route, and storage behavior.
- Start in `hooks/useSessionWizardWorkerSyncEffects.ts` for admin-address autofill, generated worker name sync, default/custom worker mode sync, deploy completion invalidation, and normal-mode shared-worker fallback clearing. `useSessionWizardWorkerDeploy.ts` still owns deploy helper execution and verification.
- Start in `hooks/useSessionWizardBlockLimits.ts` for latest-block fetch/status, block-limit duration/unit state, start-block auto-fill, manual start suppression, and derived end-block updates. `SessionWizard.tsx` still owns metadata serialization and publish/deploy consumers.
- Start in `hooks/useSessionWizardNewSessionBanner.ts` for plain/sponsored `/new` requirements-banner dismissal state and persistence. `sessionWizardRequirementsDisplay.ts` still owns the pure display decision.
- Start in `hooks/useSessionWizardIdentityEffects.ts` for initial registry/session ID hydration, private slug mirroring, automatic slug generation, and private-SBT slug mode toggling. `SessionWizard.tsx` still owns explicit slug edits and validation.
- Start in `sessionWizardDraftState.ts` for default/cached draft normalization, cache write payloads, and pure registry-chain contract/RPC/faucet draft defaults; `SessionWizard.tsx` still owns when those defaults are applied.
- Start in `SessionWizardModals.tsx` for top-level `/new` modal ownership; it delegates to `SessionWizardCreateSbtModal.tsx`, `SessionWizardContractViewerModal.tsx`, and `SessionHeaderPreviewModal.tsx`. Use `sessionWizardCreateSbtSupport.ts` for pure create-SBT launch/deferred-props/modal value planning.
- Start in `WorkerPanel.tsx` for worker setup composition; its subsections live in `WorkerSecretsSection.tsx`, `WorkerDeploySection.tsx`, and `WorkerConnectionSection.tsx`.
- Start in `hooks/useSponsoredBundleLifecycle.ts` for sponsored-bundle loading, apply/restore, and baseline override behavior.
- Start in `hooks/useSessionWizardWorkerDeploy.ts` for deploy-button orchestration, worker verification, and deploy helper lifecycle.
- Start in `sessionWizardNormalModeCards.ts` for normal-mode card and publish-summary view-model builders.
- Start in `sessionWizardContracts.ts` for contract defaults, visible contract keys, registry-address resolution, or contract-viewer modal planning.
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
  -> sessionWizardPublishLinks.ts
  -> sessionWizardPublishFlow.ts
  -> sessionWizardPublishController.ts
  -> sessionWizardMetadataPayload.ts
  -> hooks/useSessionHeaderPreview.ts
  -> hooks/useSessionWizardChromeState.ts
  -> hooks/useSessionWizardNormalModeSectionVisibility.ts
  -> hooks/useSessionWizardTooltipPreference.ts
  -> hooks/useSessionWizardCleanupEffect.ts
  -> hooks/useSessionWizardLiveRefs.ts
  -> hooks/useSessionWizardPublishAdvancedState.ts
  -> hooks/useSessionWizardPublishElapsed.ts
  -> hooks/useSessionWizardWorkerState.ts
  -> hooks/useSessionWizardWorkerSyncEffects.ts
  -> hooks/useSessionWizardBlockLimits.ts
  -> hooks/useSessionWizardNewSessionBanner.ts
  -> hooks/useSessionWizardIdentityEffects.ts
  -> sessionWizardDraftState.ts
  -> SessionWizardInfoTooltip.tsx
  -> SessionWizardContractsField.tsx
  -> SessionModeProfileField.tsx
  -> SessionWizardStorageProfileField.tsx
  -> sessionWizardNormalModeCards.ts
  -> sessionModeProfile.ts
  -> hooks/useSponsoredBundleLifecycle.ts
  -> hooks/useSessionWizardWorkerDeploy.ts
  -> client/src/domains/sessions/publish/sessionPublishReducer.ts
  -> client/src/domains/sessions/publish/sessionPublishDispatch.ts
  -> client/src/domains/sessions/publish/sessionPublishPorts.ts
  -> client/src/domains/sessions/publish/sessionPublishAdapters.ts
  -> sessionWizardContracts.ts
  -> sessionWizardSecrets.ts
  -> sessionWizardWriteNormalization.ts
  -> sessionWizardStorageProfile.ts
  -> CreateSBTGroup.tsx
  -> ContractViewer.tsx
```

## Section Index

| Section | Lines | Purpose | Key Exports / Helpers |
|---|---:|---|---|
| Imports, re-exports, constants, pure helpers | 1-666 | File-level helper exports, worker deploy validation, sponsored-bundle helpers, session ID generation, cache helpers, local typed state aliases, typed metadata/encryption boundaries, and typed wrapper boundaries for contract metadata/worker auth helpers | `getSessionSlugValidationError`, `buildSessionWizardPublishPlan`, `buildPublishedPendingSbtLinks`, `resolveSessionWizardChipotleHookConfig` |
| Component bootstrap and cached draft hydration | 652-1240 | Initializes persisted wizard state, session metadata draft, gate state, worker/deploy hook state, sponsored-bundle state, publish-advanced state, session-header preview hook state, chrome hook state, and refs used across async flows | `SessionWizard`, sponsored-bundle lifecycle wiring, `useSessionWizardWorkerState`, `useSessionWizardPublishAdvancedState`, `useSessionHeaderPreview`, `useSessionWizardChromeState` |
| Derived config and synchronization effects | 1241-1999 | Keeps chain defaults, gate/resource snapshots, AI model-provider patches, sponsored default SBT lookup state, source-session inheritance, and live refs aligned with the active draft while delegating publish advanced state to `useSessionWizardPublishAdvancedState`, block-limit state/effects to `useSessionWizardBlockLimits`, header preview state to `useSessionHeaderPreview`, chrome state to `useSessionWizardChromeState`, live ref synchronization to `useSessionWizardLiveRefs`, and pure registry-chain contract/RPC/faucet draft default patching to `sessionWizardDraftState.ts` | registry-chain effects, gate sync effects, AI model patch effect, `useSessionWizardLiveRefs`, `useSessionWizardBlockLimits` |
| Draft mutation and modal orchestration | 2000-2417 | Core draft updates, gate editing, pending SBT draft/selection reconciliation, resource-gate resolution, create-SBT modal wiring, contract viewer controls | `updateDraftValue`, `updateEncryptionGate`, `handleGateAddSbt`, `handleSavePendingSbtDraft` |
| Field renderer and advanced metadata fields | 2418-2926 | Recursive field rendering, lock/gate UI, compact header image controls, contracts/storage field handoffs, normal-vs-advanced metadata fields | `renderCompactSessionHeaderField`, `renderSessionHeaderPreviewSurface`, `renderField`, `SessionWizardContractsField`, `SessionWizardStorageProfileField` |
| Publish prep: metadata, SBT drafts, registry writes | 2886-3413 | Builds metadata payloads using pure payload helpers, applies parent-owned encryption, uploads Arweave metadata including the session-header file through the publish adapter, finalizes deferred SBT uploads through the receipt adapter, and prepares on-chain registration through the registry adapter | `applyEncryption`, `buildMetadataPayload`, `handleUploadMetadata`, `deployPendingSbtDrafts`, `handleRegisterGroup`, `resolveSessionWizardMetadataPayloadBase`, `applySessionWizardMetadataUploadGuards` |
| Publish orchestration and deploy helpers | 3414-4050 | Coordinates publish flow, dispatches the pure publish reducer through `sessionPublishDispatch.ts`, delegates worker auto-deploy, pending-SBT step sequencing, publish start/admin preflight, metadata-upload dispatch, register-step request/identity/duplicate-check/preflight/register-args descriptor planning, register-step tx/status callbacks, register success/failure settlement planning, completion request planning, publish failure settlement planning, and successful completion callbacks to `sessionWizardPublishController.ts`, handles copy helpers, session/admin URL application, worker deploy inputs, worker auth signing handoffs, and connected-admin resolution | `handlePublish`, `dispatchSessionPublish`, `sessionPublishReducer`, `beginSessionPublishReducerAttempt`, `runSessionPublishEffect`, `resolveSessionWizardPublishStartPreflightDescriptor`, `resolveSessionWizardPublishAdminPreflightDescriptor`, `runSessionWizardPublishController`, `runSessionWizardPublishMetadataUploadController`, `resolveSessionWizardRegisterStepRequest`, `resolveSessionWizardRegisterIdentityDescriptor`, `resolveSessionWizardRegisterDuplicateCheckDescriptor`, `resolveSessionWizardRegisterPreflightDescriptor`, `resolveSessionWizardRegisterArgsDescriptor`, `runSessionWizardRegisterStepController`, `resolveSessionWizardRegisterSuccessSettlementDescriptor`, `resolveSessionWizardRegisterFailureSettlementDescriptor`, `appendSessionWizardRegisterTxEntry`, `resolveSessionWizardPublishCompletionRequest`, `resolveSessionWizardPublishFailureSettlementDescriptor`, `runSessionWizardPublishCompletionController`, `handleCopyAdminUrl`, `handleDeployWorker` |
| Worker/resource cards and derived publish UI | 4051-4382 | Worker deploy result handling, config/secrets sync UI, resource secret inputs, resource-card selection plans, contract modal selection, create-SBT modal value planning, pure requirements display planning, pure sponsored auto-deploy publish-surface planning, pure publish readiness/action/progress/metadata identity/display plan handoff, and deploy-status/action display-state handoff | `updateResourceGate`, `renderResourceInputs`, `renderResourceCard`, `resolveSessionWizardResourceGateSelectionState`, `resolveSessionWizardResourceGateSelectionUpdate`, `resolveSessionWizardCreateSbtModalPlan`, `resolveSessionWizardContractViewerPlan`, `resolveSessionWizardNewSessionRequirementsDisplayState`, `resolveSessionWizardSponsoredPublishSurfaceState`, `resolveSessionWizardPublishUiPlan`, `resolveSessionWizardDeployStatusDisplayState` |
| Final shell handoff | 4383-4544 | Derives and forwards the full `/new` surface state/handlers into the passive shell while retaining parent-owned state application and routed publish side effects | `SessionWizardShell`, `export default SessionWizard` |
| Publish reducer (`client/src/domains/sessions/publish/sessionPublishReducer.ts`) | 1-256 | Pure publish status/effect reducer covering idle, editing, checking requirements, worker deploy, pending-SBT deploy, metadata upload, registry write, published, recoverable failure, terminal failure, retry, and cancel transitions | `sessionPublishReducer`, `buildSessionPublishEffectQueue`, `getNextSessionPublishEffect`, `createInitialSessionPublishState` |
| Publish dispatch helper (`client/src/domains/sessions/publish/sessionPublishDispatch.ts`) | 1-80 | Pure helper layer for translating controller execution plans and async effect outcomes into reducer actions without making the page own repeated dispatch wrappers | `buildSessionPublishReducerPlan`, `beginSessionPublishReducerAttempt`, `runSessionPublishEffect`, `markSessionPublishEffectSucceeded` |
| Publish ports (`client/src/domains/sessions/publish/sessionPublishPorts.ts`) | 1-121 | Typed publish effect surface used by the reducer/controller seam; concrete modules stay out of the pure reducer | `SessionWizardPublishPorts`, `SessionPublish*Input`, `SessionPublish*Result` |
| Publish adapters (`client/src/domains/sessions/publish/sessionPublishAdapters.ts`) | 1-232 | Binds concrete Arweave upload/options/gateway helpers, session registry reads/writes/cache helpers, worker auth signing/normalization, sponsored-bundle normalization, SBT factory receipt parsing, and the existing SBT metadata reads port through call-time module lookup | `arweavePublishAdapter`, `sessionRegistryPublishAdapter`, `workerAuthPublishAdapter`, `sponsoredBundlePublishAdapter`, `sbtFactoryReceiptPublishAdapter`, `sessionPublishSbtMetadataAdapter` |
| Draft state planning (`sessionWizardDraftState.ts`) | 1-344 | Normalizes default/cached draft shape, builds cache write payloads, and plans pure registry-chain contract/RPC/faucet draft defaults without owning state application | `buildSessionWizardDefaultTemplate`, `buildSessionWizardInitialDraftFromCache`, `applySessionWizardRegistryChainDraftDefaults`, `buildSessionWizardCacheWritePayload` |
| Contract planning (`sessionWizardContracts.ts`) | 1-149 | Resolves contract defaults, visible keys, registry address, sanitized visible contracts, and contract-viewer modal contracts/selection/hrefs without owning draft mutation or modal state | `getSessionWizardContractDefaults`, `resolveSessionWizardRegistryAddress`, `resolveSessionWizardContractViewerPlan` |
| Create-SBT modal planning (`sessionWizardCreateSbtSupport.ts`) | 1-261 | Resolves create-SBT target gates, launch state, deferred component props, and modal chain/network/session/JWK display values while parent keeps modal state and save callbacks | `resolveSessionWizardCreateSbtTargetGateId`, `buildSessionWizardCreateSbtModalLaunchState`, `resolveSessionWizardCreateSbtModalPlan`, `buildSessionWizardDeferredCreateSbtComponentProps` |
| Passive render composition (`SessionWizardShell.tsx`) | 1-583 | Renders header, intro/status rail, encryption, metadata, worker, publish, and modal modules through an explicit typed prop contract without owning publish/worker/storage/SBT/wallet side effects | `SessionWizardHeader`, `SessionWizardIntroStatusRail`, `SessionMetadataEditor`, `WorkerPanel`, `SessionPublishSummary`, `SessionWizardModals` |
| Passive intro/status rail (`SessionWizardIntroStatusRail.tsx`) | 1-63 | Places requirements banner, sponsored status, and normal-mode rail from explicit props while parent owns dismissal/retry/focus state and sponsored/publish/worker side effects | `SessionWizardRequirementsBanner`, `SessionWizardSponsoredStatus`, `SessionWizardNormalModeRail` |
| Passive publish summary (`SessionPublishSummary.tsx`) | 1-218 | Places passive publish action/bundle-fallback/advanced-settings/progress/result panels from the publish UI plan while parent owns publish/deploy/upload/register/storage/wallet side effects | `SessionPublishActionControls`, `SessionPublishBundleFallbackPanel`, `SessionPublishAdvancedSettingsPanel`, `SessionPublishProgressPanel`, `SessionPublishResultLinks` |
| Passive publish action controls (`SessionPublishActionControls.tsx`) | 1-77 | Renders normal/advanced publish buttons, loading/disabled states, and advanced-settings affordance from `SessionWizardPublishActionDisplayState` plus named execution callback props while routing publish/settings callbacks back to the parent without owning publish, upload, deploy, route, or state mutation side effects | `SessionPublishActionControls` |
| Passive publish bundle fallback (`SessionPublishBundleFallbackPanel.tsx`) | 1-85 | Renders manual bundle URL override and one-shot bundle-file retry controls while routing named bundle URL/file callbacks back to the parent without owning worker deploy, bundle fetch, publish, route, or state mutation side effects | `SessionPublishBundleFallbackPanel` |
| Passive publish advanced settings (`SessionPublishAdvancedSettingsPanel.tsx`) | 1-128 | Renders manual metadata URI and gas override controls from explicit values while routing named manual override callbacks back to the parent without owning metadata upload, register transaction, route, or state mutation side effects | `SessionPublishAdvancedSettingsPanel` |
| Passive publish progress (`SessionPublishProgressPanel.tsx`) | 1-79 | Renders publish step progress from `SessionWizardPublishProgressDisplayState` while parent/controller code owns publish step mutation and publish execution | `SessionPublishProgressPanel` |
| Passive publish result links (`SessionPublishResultLinks.tsx`) | 1-120 | Renders metadata URI, Arweave tx, register txs, session/admin URLs, published pending-SBT links, and status copy from explicit descriptors while routing admin-copy back to the parent | `SessionPublishResultLinks` |
| Published pending-SBT link planning (`sessionWizardPublishLinks.ts`) | 1-50 | Builds pure published pending-SBT link display models from newly deployed drafts plus already-finalized pending draft snapshots without owning deploy/finalization, route, or state effects | `buildPublishedPendingSbtLinks` |
| Passive contracts field (`SessionWizardContractsField.tsx`) | 1-108 | Renders advanced contract rows, explainer tooltip triggers, modal buttons, and address inputs while parent owns draft mutation and modal selection | `SessionWizardContractsField` |
| Mode profile field (`SessionModeProfileField.tsx`) | current file | Renders the preset-first `/new` mode selection, advanced surface/storage/authority/encryption overrides, validation copy, and preset-to-custom transitions while parent owns draft mutation | `SessionModeProfileField` |
| Session mode profile planning (`utilities/session/sessionModeProfile.ts`) | current file | Owns session mode schema normalization, `fast_cheap_cloudflare` / `trustless_public_decentralized` presets, validity matrix, compile-down to storage profile and payload-access fields, and legacy `telegramOnly` read-normalization | `cloneSessionModePreset`, `validateSessionModeProfile`, `compileSessionModeProfile`, `profileFromLegacyConfig` |
| Passive storage profile field (`SessionWizardStorageProfileField.tsx`) | 1-121 | Renders advanced storage backend and Cloudflare payload-access controls while parent owns draft mutation and broader publish/storage side effects | `SessionWizardStorageProfileField` |
| Requirements display planning (`sessionWizardRequirementsDisplay.ts`) | 1-95 | Derives `/new` requirements banner visibility, connected status, sponsored status, and pending requirement labels without owning wallet, sponsored bundle, publish, route, worker, storage, or state application side effects | `resolveSessionWizardNewSessionRequirementsDisplayState` |
| Publish readiness/UI planning (`sessionWizardPublishReadiness.ts`) | 1-326 | Derives publish readiness, request identity, execution/action/progress display descriptors, and metadata identity/display state using an injected gateway URL builder without owning metadata upload, Arweave writes, worker deploy, registry, route, wallet, or state effects | `resolveSessionWizardPublishReadiness`, `resolveSessionWizardPublishRequestDescriptor`, `resolveSessionWizardPublishMetadataIdentityState`, `resolveSessionWizardPublishUiPlan` |
| Metadata payload planning (`sessionWizardMetadataPayload.ts`) | 1-146 | Derives base metadata identity/default-featured normalization and upload-time secret/gate budget guards without owning header upload, encryption, Arweave upload, worker auth, wallet, registry, route, or state effects | `resolveSessionWizardMetadataPayloadBase`, `applySessionWizardMetadataUploadGuards`, `normalizeSessionWizardDefaultFeaturedSbtMetadata` |
| Header preview state (`hooks/useSessionHeaderPreview.ts`) | 1-142 | Owns session-header URL/upload mode state, compact chooser mode, selected file, preview object URL cleanup, preview modal/status state, paste handling, and clear-preview reset while parent keeps upload-to-Arweave execution and metadata serialization | `useSessionHeaderPreview` |
| Chrome state (`hooks/useSessionWizardChromeState.ts`) | 1-83 | Owns passive sponsored display-settings visibility, metadata object collapse state, prompt/JSON preview flags, More Options visibility, and normal-mode section collapse normalization while parent keeps copy timers, field rendering, route, publish, upload, and worker behavior | `useSessionWizardChromeState` |
| Normal-mode section visibility (`hooks/useSessionWizardNormalModeSectionVisibility.ts`) | 1-32 | Owns normal-mode section visibility normalization when the worker step appears or disappears | `useSessionWizardNormalModeSectionVisibility` |
| Tooltip preference (`hooks/useSessionWizardTooltipPreference.ts`) | 1-28 | Owns Redux-backed tooltip preference state and subscription updates | `useSessionWizardTooltipPreference` |
| Cleanup effect (`hooks/useSessionWizardCleanupEffect.ts`) | 1-44 | Owns unmount cleanup for mounted state and local timeout refs | `useSessionWizardCleanupEffect` |
| Live ref synchronization (`hooks/useSessionWizardLiveRefs.ts`) | 1-95 | Synchronizes draft, deploy form, wallet account, worker deploy status, sponsored context, and worker-secret refs for async consumers while parent keeps pending modal, publish timer, deploy, upload, route, and state mutation behavior | `useSessionWizardLiveRefs` |
| Publish advanced state (`hooks/useSessionWizardPublishAdvancedState.ts`) | 1-55 | Owns manual metadata URI, metadata upload result fields, manual gas override fields, and publish advanced panel visibility while parent keeps metadata upload, register transaction, wallet, route, and publish execution | `useSessionWizardPublishAdvancedState` |
| Publish elapsed timer (`hooks/useSessionWizardPublishElapsed.ts`) | 1-28 | Owns publish-step elapsed timer reset, tick, and cleanup while publish decisions stay in the parent/controller | `useSessionWizardPublishElapsed` |
| Worker state (`hooks/useSessionWizardWorkerState.ts`) | 1-131 | Owns worker mode, deploy form/status, bundle fallback state, cached worker completion/URL, worker secrets, and worker allow-origin inputs while parent/deploy hook keep deploy helper execution, verification, publish, route, and storage behavior | `useSessionWizardWorkerState` |
| Worker sync effects (`hooks/useSessionWizardWorkerSyncEffects.ts`) | 1-106 | Owns admin-address autofill, generated worker name sync, default/custom worker mode sync, deploy completion invalidation, and normal-mode shared-worker fallback clearing while deploy helper execution and verification stay in `useSessionWizardWorkerDeploy` | `useSessionWizardWorkerSyncEffects` |
| Identity effects (`hooks/useSessionWizardIdentityEffects.ts`) | 1-115 | Owns initial registry/session ID hydration, private slug mirroring, automatic slug generation, and private-SBT slug mode toggling while the shell keeps explicit slug edits and validation | `useSessionWizardIdentityEffects` |
| Block-limit state/effects (`hooks/useSessionWizardBlockLimits.ts`) | 1-141 | Owns latest-block fetch/status, block-limit duration/unit state, start-block auto-fill, manual start suppression, and derived end-block updates while parent keeps metadata serialization and publish/deploy consumers | `useSessionWizardBlockLimits` |
| New-session banner state (`hooks/useSessionWizardNewSessionBanner.ts`) | 1-38 | Owns plain/sponsored `/new` requirements-banner dismissal state and persistence while pure display decisions stay in `sessionWizardRequirementsDisplay.ts` | `useSessionWizardNewSessionBanner` |

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
  -> sessionWizardPublishReadiness pure readiness/request/action/progress/metadata identity/display UI plan
  -> sessionPublishReducer begins the publish effect queue and records status/completed effects
  -> domain publish adapters bind concrete Arweave, registry, worker-auth, sponsored-bundle, SBT receipt, and SBT metadata seams
  -> sessionWizardMetadataPayload pure base metadata identity/default-featured and upload guard plans
  -> sessionWizardPublishController pure publish start preflight descriptor plan
  -> sessionWizardPublishController pure publish admin preflight descriptor plan
  -> sessionWizardPublishController optional worker deploy
  -> sessionWizardPublishController optional pending SBT deploy/finalize
  -> sessionWizardPublishController metadata upload dispatch around SessionWizard-owned upload execution
  -> sessionWizardPublishController pure register-step request plan
  -> sessionWizardPublishController pure register identity readiness plan
  -> sessionWizardPublishController pure duplicate-check request plan
  -> SessionWizard duplicate checks through the registry publish adapter
  -> sessionWizardPublishController pure register preflight descriptor plan
  -> sessionWizardPublishController pure register-args descriptor plan
  -> sessionWizardPublishController register-step tx/status callbacks around injected session registry write
  -> sessionWizardPublishController pure register-success settlement plan
  -> SessionWizard session/admin URL, cache, session ID, registry-refresh state application through the registry publish adapter
  -> sessionWizardPublishController pure register-failure settlement and tx append planning
  -> SessionWizard-owned error status, tx state application, and rethrow
  -> sessionWizardPublishController pure completion request plan
  -> sessionWizardPublishController completion callbacks
  -> sessionWizardPublishLinks pure published pending-SBT link display model
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
| `publishStep` / `publishBusy` | Parent-owned compatibility progress and busy state | Feeds `sessionWizardPublishReadiness.ts` progress/action UI planning; `SessionPublishProgressPanel` and `SessionPublishActionControls` consume descriptor-owned display state through `SessionPublishSummary` instead of receiving raw busy props |
| `sessionPublishState` | Pure reducer state for publish statuses, current effect, completed effects, retry, cancel, and failures | Mirrors the tested publish pipeline without owning side effects; `SessionWizard.tsx` dispatches it while ports/adapters perform work |
| `slugAvailability` | Async slug-check result | Blocks invalid publish/deploy attempts early |
| `resourceGateMap` | Resource-to-gate assignments for AI, Arweave, tx gas, etc. | Stores single gate ids or multi-gate id arrays and gets serialized into sponsored/worker config payloads |

## Edit Heuristics

- If a bug is about registry fields or contract addresses, check `sessionWizardContracts.ts` first.
- If a bug is about publish state transitions, check `client/src/domains/sessions/publish/sessionPublishReducer.ts` first.
- If a bug is about Arweave, registry, worker-auth, sponsored-bundle, SBT receipt, or SBT metadata call routing during publish, check `client/src/domains/sessions/publish/sessionPublishAdapters.ts` first.
- If a bug is about worker config sync or post-deploy warnings, check `sessionWizardSecrets.ts` first.
- If a bug is about publish payload shape mismatch between worker config and on-chain metadata, check `sessionWizardWriteNormalization.ts` first.
- If a bug is about gated field UI, draft persistence, or wizard step order, `SessionWizard.tsx` is the right entrypoint.

## Residual Risk

`SessionWizard.tsx` is still a large hook-driven state machine even though passive final composition now lives in `SessionWizardShell.tsx` and publish status/effect routing lives in `client/src/domains/sessions/publish/`. The publish-flow restructuring that PRD 450 previously stopped short of is now owned by PRD 645 Phase 4 on this branch. This map helps navigation, but it does not replace the longer-term decomposition work tracked in the refactor roadmap.
