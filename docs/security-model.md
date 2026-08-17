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

The current static app shell still loads Google Fonts from third-party origins
and includes inline JSON-LD structured data. Font Awesome icons are loaded from
bundled `@fortawesome` packages, not the remote kit script. A stricter CSP for
wallet unlock screens should be deployed before production wallet rollout:

- keep wallet unlock/sign routes free of third-party scripts where practical
- remove or nonce inline scripts
- use `script-src 'self'` plus explicit reviewed exceptions only
- keep `connect-src` limited to configured RPC, worker, Arweave, and API origins
