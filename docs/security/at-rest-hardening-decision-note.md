# At-Rest Secret Hardening Decision Note

Date: 2026-07-07.

## Current State

The browser wallet at-rest wrapping concern is already addressed in the current wallet code. `PasskeyEoaWalletClient` stores encrypted private-key records as `passkey-prf-aes-gcm-v1`, derives the AES-GCM wrapping key from WebAuthn PRF output plus a stored salt, and fails closed when PRF is unavailable. The passkey-derived mode stores only metadata and re-derives the EOA key from PRF/HKDF. Focused verification passed on 2026-07-07:

```bash
npm --prefix client test -- --watchAll=false --runTestsByPath src/wallet/passkeyWallet.test.ts src/wallet/passkey/prf.test.ts
```

Worker session secrets are still plaintext inside the versioned KV envelope. `workers/shared/sessionSecretsEnvelope.mjs` writes `secrets: cloneRecord(secrets)`, and `workers/sessionCorsWorker/sessionConfigSecretsStore.js` unwraps that object directly.

## Decision Needed

Do not implement worker KV field encryption until these operational choices are explicit:

1. **Key source and format:** choose a Cloudflare Secret name and format, preferably a 32-byte base64url value such as `SESSION_SECRETS_ENC_KEY_V1`.
2. **Missing-key behavior:** decide whether writes of non-empty secrets fail closed when the key is absent, and whether local development gets an explicit plaintext escape hatch.
3. **Migration:** define whether legacy plaintext envelopes are read-only and re-encrypted on the next admin write, or whether an admin migration/rewrap route is required.
4. **Rotation:** define `keyRef` handling and the number of historical keys accepted for decrypt during rotation.
5. **AAD scope:** bind ciphertext to `session:<slug>:secrets`, envelope version, and field name so copied ciphertext cannot be replayed across sessions or fields.

## Recommended Path

- Add encrypted envelope version `session-secrets` v2 with `cipher: "aes-gcm-256"`, `keyRef`, `aad`, and `encryptedSecrets`.
- Keep plaintext v1 reads for migration only.
- Fail closed on writes of non-empty secrets when no encryption key is configured, except for an explicitly named local-only development override.
- Add tests before implementation for: no plaintext in stored KV JSON, legacy plaintext read compatibility, decrypt-at-use behavior, missing-key write failure, redacted error/log payloads, and keyRef rotation.

Until those decisions are approved, changing the worker write path risks either breaking existing deployments or silently preserving plaintext writes under a new-looking envelope.
