# PRD: SBT-Gated Question Prompt Decryption for contextEngine-cc
## Status: TODO
## Priority: MED | Effort: MED
## Category: Feature — encryption

## Problem
`contextEngine-cc` can encrypt outgoing gate-audience response fields via the session worker's worker-mediated Chipotle Lit route (`lib/litNodeHooks.mjs` + `lib/envelopeV1.mjs`), but it cannot decrypt Lit-protected question prompts.

When CE-CC encounters an SBT-gated encrypted question prompt:
- the fetched prompt is missing or reduced to the literal placeholder `'[encrypted]'`
- `lib/questions.mjs` already treats `promptEncrypted` questions without a usable prompt as unusable and skips them
- users who actually hold the required SBT still cannot answer those questions through the CE-CC hook/server flow

That creates a capability gap with the web client, which already has worker-mediated Chipotle decrypt support for gated question prompts when a session worker is configured.

## Goal
Decrypt SBT-gated question prompts in `contextEngine-cc` when the authenticated wallet satisfies the question's Lit access control conditions, and otherwise keep the current silent-skip behavior so encrypted placeholders are never surfaced.

## Scope
1. Extend `contextEngine-cc/lib/litNodeHooks.mjs` with a worker-mediated Chipotle decrypt path alongside the existing encrypt (`saveKey`) flow.
   - reuse the stored worker token/session-slug route instead of adding a direct Lit SDK client
   - keep `@lit-protocol/*`, `viem`, and sibling `client/node_modules` out of CE-CC runtime dependencies
   - accept the encrypted prompt payload, `dataToEncryptHash`, and access control conditions needed for decryption
2. Integrate prompt decryption into the question-fetching pipeline in `contextEngine-cc/lib/questions.mjs` and any router plumbing required in `contextEngine-cc/lib/router.mjs`.
   - when `promptEncrypted` is set and the prompt is missing or `'[encrypted]'`, attempt decryption before classifying the question as unusable
   - resolve the encrypted payload and access control conditions from existing question metadata / Arweave-backed question data
   - on success, replace the prompt with decrypted text and continue serving the question normally
3. Add a local decrypted-prompt cache, likely in a new `contextEngine-cc/lib/decryptCache.mjs`.
   - key cache entries by question id plus the current metadata / Arweave tx identity so stale decrypts are invalidated automatically
   - store cache data under the local CE-CC state/data directory to avoid repeated Lit round-trips across hook invocations
4. Reuse CE-CC worker/session authentication for the Chipotle route required for decryption.
   - avoid introducing a parallel auth flow
   - cache successful decrypted prompt values locally so repeated hook invocations do not re-run worker/Lit calls unnecessarily
5. Add a defense-in-depth guard in `contextEngine-cc/hook/hook.mjs`.
   - if a question still arrives with prompt `'[encrypted]'`, skip it and request the next question instead of showing it to the AI/user

## Requirements
1. A wallet that satisfies the SBT gate can read the decrypted prompt through CE-CC without changing existing response submission behavior.
2. A wallet that does not satisfy the gate never sees `'[encrypted]'`; the question is skipped silently.
3. Lit network failures or malformed encrypted payloads fail closed by skipping the question instead of surfacing unusable prompt text.
4. Successfully decrypted prompts are cached locally and invalidated when the underlying question metadata changes.
5. Existing worker-mediated response encryption behavior in `lib/litNodeHooks.mjs` and `lib/envelopeV1.mjs` remains unchanged.
6. The implementation stays aligned with the client-side worker-mediated Chipotle decrypt model already used in `client/src/utilities/crypto/litProtocol.ts`.

## Acceptance Criteria
1. `contextEngine-cc/lib/litNodeHooks.mjs` exports a worker-mediated decrypt function alongside the existing encrypt path.
2. A regression test proves encrypted question prompts are decrypted when the authenticated wallet holds the required SBT.
3. A regression test proves undecryptable prompts (missing SBT, Lit error, or invalid encrypted payload) are skipped silently.
4. A regression test proves decrypted prompts are served from a local cache on subsequent reads until the metadata / Arweave identity changes.
5. `contextEngine-cc/hook/hook.mjs` never surfaces `'[encrypted]'` as a question prompt.
6. Existing worker-mediated response-encryption behavior remains unchanged.
7. `cd contextEngine-cc && npm test` passes.
