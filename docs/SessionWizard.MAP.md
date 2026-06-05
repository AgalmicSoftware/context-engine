# SessionWizard.tsx Map

## Quick Reference

- File: `client/src/components/Sessions/SessionWizard.tsx`
- Current length: **4,765 lines**
- Shell file: `client/src/components/Sessions/SessionWizardShell.tsx` (**440 lines**)
- Contracts field file: `client/src/components/Sessions/SessionWizardContractsField.tsx` (**108 lines**)
- Storage profile field file: `client/src/components/Sessions/SessionWizardStorageProfileField.tsx` (**121 lines**)
- Component type: **React function component**
- Hook inventory: **45 `useEffect` calls**, **32 `useMemo` calls**, **13 `useCallback` calls**
- Summary: `SessionWizard` is the session-creation and publish orchestrator. It bootstraps editable session metadata, manages encryption gates and pending SBT drafts, handles sponsored-bundle overrides, deploys or verifies worker configuration, uploads session metadata, and finally registers the session on-chain.
- Status note: the section ranges below are approximate current anchors; use the live file for exact line references.
- Recent extraction note: bounded follow-up work extracted field descriptors, metadata/publish composition, worker panel sections, narrow modal shells, passive wizard chrome/status pieces, the final passive render shell, the advanced contracts field, the storage profile field, and the first publish controller slices. `SessionWizard` still owns state derivation, the public surface contract, and low-level publish side effects; `SessionWizardShell.tsx` owns passive final layout/wiring, `SessionWizardContractsField.tsx` owns passive contract-row rendering while routing draft updates/modal opens back to the parent, `SessionWizardStorageProfileField.tsx` owns passive storage-profile controls while routing normalized draft patches back to the parent, and `sessionWizardPublishController.ts` owns the publish worker auto-deploy, pending-SBT step sequencing, register-step tx/status boundary, and successful completion callbacks.

## Navigation Rules

- Start in `SessionWizard.tsx` if you need top-level state, publish guards, metadata upload, registry writes, low-level side-effect implementations, or derived props passed into the final shell.
- Start in `SessionWizardShell.tsx` for final passive render composition, section ordering, and parent-to-panel prop wiring.
- Start in `CollapsibleFieldGroup.tsx` for collapsible advanced-section chrome.
- Start in `AiFieldSelect.tsx` for AI/gate select field rendering and its option/placeholder behavior.
- Start in `sessionWizardFieldDescriptors.ts` for ordered draft field descriptors, labels, tooltip text, and normal/advanced field visibility.
- Start in `SessionWizardHeader.tsx` for the title, mode toggle, sponsored display settings, and advanced registry-chain selector.
- Start in `SessionWizardRequirementsBanner.tsx` for `/new` setup prerequisite copy and dismissal display.
- Start in `SessionWizardNormalModeRail.tsx` for the normal-mode step cards/progress rail.
- Start in `SessionWizardSponsoredStatus.tsx` for sponsored-bundle preload/import status display.
- Start in `SessionWizardSessionIdBadge.tsx` for the advanced metadata-panel session ID badge, copy button, and regenerate button.
- Start in `SessionWizardInfoTooltip.tsx` for shared SessionWizard tooltip trigger markup.
- Start in `SessionMetadataEditor.tsx` for the metadata panel composition, JSON preview controls, and More Options surface.
- Start in `SessionWizardContractsField.tsx` for advanced contract row rendering, contract tooltips, modal-trigger buttons, and address input wiring.
- Start in `SessionWizardStorageProfileField.tsx` for advanced storage backend and Cloudflare payload-access controls.
- Start in `SessionPublishSummary.tsx` for publish controls, publish progress, generated URLs, manual metadata/gas overrides, and published pending-SBT links.
- Start in `sessionWizardPublishController.ts` for publish step, register-step tx/status, and completion sequencing that calls injected side-effect ports/callbacks.
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
       -> SessionWizardModals.tsx
            -> SessionWizardCreateSbtModal.tsx
            -> SessionWizardContractViewerModal.tsx
            -> SessionHeaderPreviewModal.tsx
  -> CollapsibleFieldGroup.tsx
  -> AiFieldSelect.tsx
  -> sessionWizardFieldDescriptors.ts
  -> sessionWizardPublishController.ts
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
| Imports, re-exports, constants, pure helpers | 1-535 | File-level helper exports, worker deploy validation, sponsored-bundle helpers, session ID generation, cache helpers | `getSessionSlugValidationError`, `buildSessionWizardPublishPlan`, `resolveSessionWizardChipotleHookConfig` |
| Component bootstrap and cached draft hydration | 536-1249 | Initializes persisted wizard state, session metadata draft, gate state, worker state, sponsored-bundle state, and refs used across async flows | `SessionWizard`, sponsored-bundle lifecycle wiring |
| Derived config and synchronization effects | 1250-2237 | Keeps chain defaults, gate/resource snapshots, header preview state, and source-session inheritance aligned with the active draft | registry-chain effects, gate sync effects, session-header preview effects |
| Draft mutation and modal orchestration | 2238-2405 | Core draft updates, gate editing, resource-gate resolution, create-SBT modal wiring, contract viewer controls | `updateDraftValue`, `updateEncryptionGate`, `handleGateAddSbt`, `handleSavePendingSbtDraft` |
| Field renderer and advanced metadata fields | 2406-3201 | Recursive field rendering, lock/gate UI, compact header image controls, contracts/storage field handoffs, normal-vs-advanced metadata fields | `renderCompactSessionHeaderField`, `renderSessionHeaderPreviewSurface`, `renderField`, `SessionWizardContractsField`, `SessionWizardStorageProfileField` |
| Publish prep: metadata, SBT drafts, registry writes | 3330-3776 | Builds metadata payloads, uploads Arweave metadata, finalizes deferred SBT uploads, and prepares on-chain registration | `buildMetadataPayload`, `handleUploadMetadata`, `deployPendingSbtDrafts` |
| Publish orchestration and deploy helpers | 3777-4342 | Coordinates publish flow, delegates worker auto-deploy, pending-SBT step sequencing, register-step tx/status callbacks, and successful completion callbacks to `sessionWizardPublishController.ts`, handles copy helpers, session/admin URL generation, worker deploy inputs, and connected-admin resolution | `handlePublish`, `runSessionWizardPublishController`, `runSessionWizardRegisterStepController`, `runSessionWizardPublishCompletionController`, `handleCopyAdminUrl`, `handleDeployWorker` |
| Worker/resource cards and derived publish UI | 4161-4590 | Worker deploy result handling, config/secrets sync UI, resource secret inputs, contract modal selection, and publish progress state | `updateResourceGate`, `renderResourceInputs`, `renderResourceCard`, selected contract memoization |
| Final shell handoff | 4591-4765 | Derives and forwards the full `/new` surface state/handlers into the passive shell while retaining parent-owned side effects | `SessionWizardShell`, `export default SessionWizard` |
| Passive render composition (`SessionWizardShell.tsx`) | 1-440 | Renders header, requirements, sponsored status, normal rail, encryption, metadata, worker, publish, and modal modules without owning publish/worker/storage/SBT/wallet side effects | `SessionWizardHeader`, `SessionMetadataEditor`, `WorkerPanel`, `SessionPublishSummary`, `SessionWizardModals` |
| Passive contracts field (`SessionWizardContractsField.tsx`) | 1-108 | Renders advanced contract rows, explainer tooltip triggers, modal buttons, and address inputs while parent owns draft mutation and modal selection | `SessionWizardContractsField` |
| Passive storage profile field (`SessionWizardStorageProfileField.tsx`) | 1-121 | Renders advanced storage backend and Cloudflare payload-access controls while parent owns draft mutation and broader publish/storage side effects | `SessionWizardStorageProfileField` |

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
  -> sessionWizardPublishController optional worker deploy
  -> sessionWizardPublishController optional pending SBT deploy/finalize
  -> metadata upload
  -> sessionWizardPublishController register-step tx/status callbacks around injected session registry write
  -> session/admin URL generation
  -> sessionWizardPublishController completion callbacks
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
| `publishStep` / `publishBusy` | Publish progress state | Feeds progress UI and controls which step label is shown |
| `slugAvailability` | Async slug-check result | Blocks invalid publish/deploy attempts early |
| `resourceGateMap` | Resource-to-gate assignments for AI, Arweave, tx gas, etc. | Gets serialized into sponsored/worker config payloads |

## Edit Heuristics

- If a bug is about registry fields or contract addresses, check `sessionWizardContracts.js` first.
- If a bug is about worker config sync or post-deploy warnings, check `sessionWizardSecrets.ts` first.
- If a bug is about publish payload shape mismatch between worker config and on-chain metadata, check `sessionWizardWriteNormalization.ts` first.
- If a bug is about gated field UI, draft persistence, or wizard step order, `SessionWizard.tsx` is the right entrypoint.

## Residual Risk

`SessionWizard.tsx` is still a large hook-driven state machine even though passive final composition now lives in `SessionWizardShell.tsx`. This map helps navigation, but it does not replace the longer-term decomposition work tracked in the refactor roadmap.
