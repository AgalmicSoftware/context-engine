# SessionWizard.tsx Map

## Quick Reference

- File: `client/src/components/Sessions/SessionWizard.tsx`
- Current length: **5,901 lines**
- Component type: **React function component**
- Hook inventory: **50 `useEffect` calls**, **32 `useMemo` calls**, **15 `useCallback` calls**
- Named export count before default export: **39**
- Summary: `SessionWizard` is the session-creation and publish orchestrator. It bootstraps editable session metadata, manages encryption gates and pending SBT drafts, handles sponsored-bundle overrides, deploys or verifies worker configuration, uploads session metadata, and finally registers the session on-chain.
- Status note: the section ranges below were captured from an earlier snapshot and need a fuller refresh; use the live file for exact line anchors.

## Navigation Rules

- Start in `SessionWizard.tsx` only if you need the top-level UI flow or the full publish pipeline.
- Start in `sessionWizardContracts.js` for contract defaults, visible contract keys, or registry-address resolution.
- Start in `sessionWizardSecrets.ts` for post-deploy worker config sync, secrets sync, or deploy warning/status handling.
- Start in `sessionWizardWriteNormalization.ts` for worker payload normalization, on-chain compatibility fields, or metadata serialization rules.
- Start in `CreateSBTGroup.jsx` only when the issue is inside the deferred SBT authoring modal itself; `SessionWizard.jsx` mainly launches and reconciles that flow.

## Practical Hierarchy

```text
SessionWizard.tsx
  -> sessionWizardContracts.js
  -> sessionWizardSecrets.ts
  -> sessionWizardWriteNormalization.ts
  -> CreateSBTGroup.jsx
  -> ContractViewer.jsx
```

## Section Index

| Section | Lines | Purpose | Key Exports / Helpers |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-2327 | File-level helpers, worker deploy validation, sponsored-bundle helpers, session ID generation, cache helpers | `getSessionSlugValidationError`, `resolveSessionWizardDeployBundlePayload`, `buildSessionWizardPublishPlan`, `resolveSessionWizardLitPaymentDelegation` |
| Component bootstrap and cached draft hydration | 2329-3006 | Initializes persisted wizard state, session metadata draft, gate state, worker state, sponsored-bundle state, and refs used across async flows | `SessionWizard`, `resolveSessionWizardSelectorSourceConfig`, `applyWorkerSecretsUpdate` |
| Derived config and synchronization effects | 3010-4054 | Keeps chain defaults, gate/resource snapshots, header preview state, and source-session inheritance aligned with the active draft | registry-chain effects, gate sync effects, session-header preview effects |
| Draft mutation and modal orchestration | 4070-4655 | Core draft updates, gate editing, resource-gate resolution, create-SBT modal wiring, contract viewer controls | `updateDraftValue`, `updateEncryptionGate`, `handleGateAddSbt`, `handleSavePendingSbtDraft` |
| Field renderer and advanced metadata editor | 4656-5880 | Recursive field rendering, lock/gate UI, compact header image controls, normal-vs-advanced metadata surface | `renderCompactSessionHeaderField`, `renderSessionHeaderPreviewSurface`, `renderField` |
| Publish prep: metadata, SBT drafts, registry writes | 5881-6373 | Builds metadata payloads, uploads Arweave metadata, finalizes deferred SBT uploads, and performs on-chain registration | `buildMetadataPayload`, `handleUploadMetadata`, `deployPendingSbtDrafts`, `handleRegisterGroup` |
| Publish orchestration and deploy helpers | 6374-7200 | Coordinates publish flow, copy helpers, session/admin URL generation, worker deploy inputs, and connected-admin resolution | `handlePublish`, `handleCopyAdminUrl`, `resolveWorkerBaseUrl`, `resolveConnectedAdminAddress`, `handleDeployWorker` |
| Worker/resource cards and derived publish UI | 7201-8076 | Worker deploy result handling, config/secrets sync UI, resource secret inputs, tooltips, and publish progress state | `updateResourceGate`, `renderResourceInputs`, `renderResourceCard`, `renderEmbeddedDeployHelperToggle` |
| Main render tree and modals | 8087-9392 | Renders the full `/new` surface, progress UI, modal flows, contract viewer, and image preview modal | `return (...)`, `export default SessionWizard` |

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
  -> optional worker deploy
  -> optional pending SBT deploy/finalize
  -> metadata upload
  -> session registry write
  -> session/admin URL generation
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
| `deployForm` / `deployWorkerUrl` / `deployComplete` | Worker deploy input and result state | Drives worker verification UI and publish readiness |
| `publishStep` / `publishBusy` | Publish progress state | Feeds progress UI and controls which step label is shown |
| `slugAvailability` | Async slug-check result | Blocks invalid publish/deploy attempts early |
| `resourceGateMap` | Resource-to-gate assignments for AI, Arweave, tx gas, etc. | Gets serialized into sponsored/worker config payloads |

## Edit Heuristics

- If a bug is about registry fields or contract addresses, check `sessionWizardContracts.js` first.
- If a bug is about worker config sync or post-deploy warnings, check `sessionWizardSecrets.ts` first.
- If a bug is about publish payload shape mismatch between worker config and on-chain metadata, check `sessionWizardWriteNormalization.ts` first.
- If a bug is about gated field UI, draft persistence, or wizard step order, `SessionWizard.jsx` is the right entrypoint.

## Residual Risk

`SessionWizard.tsx` is still a large hook-driven state machine. This map helps navigation, but it does not replace the longer-term decomposition work tracked in the refactor roadmap.
