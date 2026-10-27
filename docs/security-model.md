# Security Model

This wallet is a passkey-unlocked embedded EOA.

In the default `passkey-derived` mode, the WebAuthn PRF output is used to
deterministically derive the EVM private key for the configured RP ID and
derivation namespace. The derived EVM private key signs normal Ethereum
messages, typed data, and transactions. The derived key exists in browser/worker
memory while the wallet is unlocked.

An optional `encrypted-private-key` compatibility mode derives an AES-GCM key
from passkey PRF output and uses it to decrypt a stored random EVM private key.

## Protected Assets

- EVM private key
- WebAuthn PRF output
- derived EOA private key
- derived AES-GCM key in encrypted-private-key mode
- decrypted private key in worker memory in encrypted-private-key mode
- signatures before user confirmation
- encrypted wallet record metadata that links credential ID to EVM address

## Persistence Boundary

Persisted:

- credential ID
- RP ID
- EVM address
- passkey-derived key mode and derivation version
- deterministic PRF salt metadata
- AES-GCM ciphertext, salt, IV, and encryption version in encrypted-private-key mode
- timestamps

Never persisted:

- plaintext EVM private key
- WebAuthn PRF output
- derived EOA private key
- derived AES-GCM key in encrypted-private-key mode
- decrypted private key in encrypted-private-key mode

## Unlock Boundary

Unlock requires a successful WebAuthn assertion that returns PRF output. In
`passkey-derived` mode, the app derives the EOA private key with HKDF-SHA256
using the configured RP ID, derivation namespace, and versioned labels. In
`encrypted-private-key` mode, the app derives the AES key with HKDF-SHA256 and
decrypts the EOA private key in memory.

Changing RP ID, derivation namespace, derivation version, or selected passkey
changes the derived EOA address. Losing the passkey means losing access to the
derived EOA unless another recovery or transfer path was set up separately.

The passkey does not create an onchain passkey wallet or protect against every
same-origin script. JavaScript running under the configured RP ID can request
WebAuthn prompts and ask the unlocked soft-session worker to sign. Production
deployments must therefore treat app-shell script integrity and CSP as wallet
security controls, not just general web hardening.

Wallet material is locked on:

- explicit logout/disconnect
- account switch
- unlock TTL expiry
- worker lock
- tab close by normal browser memory cleanup

## Soft Session Boundary

Soft sessions are not a hard security boundary. They are a convenience and
isolation mechanism.

The worker checks local policy before signing. That policy can restrict methods,
chain IDs, sender address, target addresses, transaction value, and expiry. Raw
transaction signing requires its own explicit `eth_signTransaction` method grant.
These limits are not enforced by Ethereum. A malicious script that executes in
the same origin may be able to ask the worker to sign.

This design is simpler than smart-account systems and does not provide:

- account abstraction
- ERC-4337
- EIP-7702
- paymasters
- relayers
- onchain passkey verification
- onchain session permissions
- smart-contract recovery

## SBT Invite Credential Boundary

Limited SBT invite links are one-time bearer credentials until redemption.
Anyone who obtains an unredeemed link can use its authorization; the link does
not identify or authenticate an intended human recipient.

The current `claimWithInvite` authorization signs the SBT contract address and
a sequential nonce. It does not include the recipient address, so the wallet
that submits a valid unconsumed invite becomes the recipient. This differs from
password minting: `startClaim` records a commitment derived from the password
and `msg.sender`, and `claimWithPassword` verifies that caller-bound commitment
before minting.

The currently configured OP Stack networks use sequencer-private transaction
pools, which reduces exposure to public-mempool copying. It does not remove the
bearer-link risk: links can still leak through forwarding, browser history,
logs, analytics, screenshots, or any other channel before redemption.

A recipient-bound commit-reveal invite flow has been designed but is not
implemented. Until that contract flow ships, treat every unredeemed limited
invite link as a transferable secret and share it only through an appropriate
confidential channel.

## Browser Requirements

- WebAuthn platform credentials
- WebAuthn PRF extension
- WebCrypto `crypto.subtle`
- IndexedDB for non-secret wallet metadata and encrypted-private-key records
- HTTPS in production

Unsupported PRF environments fail closed. The app must not fall back to
plaintext key storage or a UI-only passkey prompt.

## CSP And Third-Party Script Note

The static host's `client/public/_headers` enforces `script-src 'self'` and
`worker-src 'self' blob:` alongside `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'` and `form-action 'self'`. The only inline script exception is
an exact SHA-256 hash for the bundled benchmark report's script; its `srcdoc`
frame remains sandboxed without same-origin access. A regression test checks
that the hash matches the published artifact, so a report update must review
and update that exception. The app entry has no executable inline script:
its JSON-LD is data, and the theme bootstrap and module entry are local files.
No remote scripts, eval, or arbitrary inline scripts are permitted.

The remaining CSP directives stay report-only, including the existing Google
Fonts, image, media, frame and connection sources. Font Awesome is bundled.
The browser smoke applies the actual `_headers` to local app documents because
Vite preview does not serve it. Any enforced or report-only violation fails
normal navigation and publication journeys, including passkey login, wallet
worker startup and signed requests. Isolated negative checks prove injected
inline and other-origin scripts cannot run.

After deployment, check the hosting response with
`curl -sI <site> | grep -i '^content-security-policy:'`: the enforced header must
show `script-src 'self'`. Repeat that response check when changing static-host
configuration. The local header harness verifies the file and application behavior; deployment still
requires the hosting provider to apply it.
