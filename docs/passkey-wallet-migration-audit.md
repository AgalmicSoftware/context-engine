# Passkey Wallet Migration Audit

Audit date: 2026-07-03

This report tracks Porto removal and the passkey EOA migration issues found in
the codebase.

| Severity | Path | Problem | Recommended fix | Fixed in this PR |
| --- | --- | --- | --- | --- |
| blocker | `client/src/utilities/web3/portoFunctions.ts` | Legacy wallet runtime depended on Porto-shaped session behavior and deterministic passkey material. | Remove the runtime and replace it with a passkey PRF-derived EOA plus internal provider. | yes |
| high | `client/src/variables/chains.js` | Chain metadata carried Porto relay URLs, fee-token metadata, and sidecar assumptions. | Remove Porto relay helpers and use normal chain RPC URLs for EOA sends. | yes |
| high | `client/src/utilities/crypto/cryptography.ts`, `client/src/utilities/web3/providerAdapter.ts`, `client/src/utilities/web3/contractScripts.impl.ts` | Provider resolution preferred Porto-specific identifiers. | Resolve `passkey_eoa` through the internal EIP-1193 provider and keep external wallet handling isolated. | yes |
| high | `client/src/components/Account/LoginAndSettingsModal.tsx` | Login/logout/restore flow was coupled to the old wallet provider. | Keep account UX while routing create/sign-in/logout through the passkey EOA wallet client. | yes |
| high | `scripts/seed-survey-question-types.js`, `scripts/seed-polis-binary-multi-wallet.js`, `scripts/ai-wallet.js`, `scripts/mint-test-sbt.js` | Deterministic E2E wallets still used raw credential ID hashing and encrypted-record seeding after the runtime switched to passkey-derived EOA keys. Funded fixture addresses could differ from the browser unlock address. | Share a tracked passkey-derived wallet helper, seed only derived-wallet metadata for browser E2E, and update fixture addresses. | yes |
| high | `contextEngine-cc/public/porto-derivation.mjs`, `contextEngine-cc/public/js/auth.mjs` | The CE-CC auth page still used a Porto-named raw credential derivation path while claiming to match the main client wallet. | Rename the derivation asset and use WebAuthn PRF output plus the same HKDF labels as the main client. | yes |
| high | server API surface | The repo does not currently include server-side WebAuthn challenge verification endpoints for `/api/passkey/*` or server storage for `/api/wallet/encrypted-key`. Default passkey-derived mode can unlock without server-stored ciphertext, but encrypted-private-key compatibility mode still needs a record. | Add a server or worker-backed account service before using server-stored wallet records. Verify challenges server-side and store only ciphertext plus metadata for encrypted-private-key mode. | no |
| medium | `client/public/_headers`, `client/index.html` | Current static shell does not define a strict CSP and still loads third-party script/font resources on the app shell. | Add a strict route-aware CSP before production embedded-wallet rollout; remove or nonce inline JSON-LD and keep wallet unlock screens free of third-party scripts where practical. | no |
| medium | `docs/porto-information.md`, docs indexes | Public docs still described Porto setup, relay networks, and legacy session-key behavior. | Replace with passkey EOA wallet, forking, and security-model docs. | yes |
| medium | account model | The client account state still treats the active address as the main identity for many flows; a durable multi-wallet user model is not present in this SPA. | When server-side accounts are added, use a `UserWallet` table with `passkey-eoa`, `external`, and `legacy-porto` providers and a primary flag. | no |
| low | `client/src/utilities/logging.ts` | Logging category still exposed a Porto-specific category label. | Rename the category to generic wallet logging. | yes |
| low | `CHANGELOG.md` | Historical entries mention Porto behavior. | Leave historical changelog text intact; do not treat it as current wallet setup docs. | n/a |

## Remaining Acceptance Risks

- Server-side WebAuthn challenge verification and wallet record endpoints are
  documented but not implemented in this SPA worktree.
- CSP hardening is reviewed and documented, but not enforced yet.
- Existing users with legacy hosted-wallet addresses need a product migration
  flow if those addresses are canonical in any backend outside this repo.
