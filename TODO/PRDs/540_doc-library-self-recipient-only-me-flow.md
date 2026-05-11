# Doc Library Self-Recipient Only-Me Flow

## Problem

The repo already has a non-Lit self-recipient envelope path for private data:

- `client/src/utilities/crypto/cryptography.ts`
- recipient type: `self-eip712-v1`

That path is appropriate for "only me" encryption because it wraps the CEK for the uploader's wallet/passkey-backed signer directly and does not require Lit or Chipotle.

However, the document-library upload helpers still route encrypted uploads through the Lit upload path:

- `client/src/utilities/docLibrary/uploads.js`
- `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx`

The current "only me" doc-save branch still builds a wallet-address Lit access-control condition and hands it to the Lit upload helper. That makes the private-doc case depend on Lit even though the general CE envelope system already has a local self-recipient path.

## Why this should change

- "Only me" is conceptually a self-recipient capability, not a shared gate.
- It removes an unnecessary Lit/Chipotle dependency from the private-doc path.
- It avoids the wallet-address ACC mismatch now that the active Chipotle adapter is SBT-gate oriented.
- It aligns document behavior with the rest of CE's self-recipient envelope design.

## Goal

For document-library uploads and doc saves:

- `session` audience continues to use Chipotle + SBT gates
- `only me` audience uses the local self-recipient envelope flow

## Proposed direction

1. Add a self-recipient encrypted document upload helper beside the current Lit-backed upload helper.
2. Reuse the existing `self-eip712-v1` envelope machinery instead of inventing a doc-specific private format.
3. Keep the stored document envelope shape compatible with the current document open/decrypt flow.
4. Route SurveyTool / AudioSurveyGenerator / DocumentLibrary "only me" doc-save branches to the self-recipient helper.
5. Leave shared/session-gated document saves on the Chipotle path.

## Design notes

- This is not a request to remove Lit from shared gated documents.
- The main split should become:
  - self/private doc -> local self-recipient envelope
  - session/shared gated doc -> Chipotle worker runtime
- If a future feature wants to "upgrade" a private doc into a shared gated doc, that should be modeled as re-encryption, not implicit reuse of the same wrapped CEK.

## Acceptance criteria

- Private "only me" document saves no longer require Lit hooks.
- The doc-save path does not construct wallet-address Lit ACCs for the self-only case.
- Existing session/shared gated document saves continue to use Chipotle-backed SBT gating.
- Focused tests cover:
  - private doc save/upload
  - private doc reopen/decrypt
  - session-gated doc save still using Chipotle

## Verification

- targeted Jest coverage for `uploads.js` and the relevant doc-save UI/controller paths
- one manual/browser smoke for private doc save + reopen
- existing Chipotle gated doc tests remain green
