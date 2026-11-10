# Passkey EOA Wallet

Context Engine's embedded wallet is a passkey-unlocked EOA. No hosted wallet
service is involved in login, signing, or transactions.

```text
User clicks Create / Login
-> browser passkey prompt
-> wallet is unlocked in memory
-> app signs messages, typed data, and normal EVM transactions
-> routine actions may reuse a soft worker-held session until TTL
```

In Hosted & Fast sessions the account signs login and admin requests that the
Worker verifies; no transaction or gas is involved, unless a rule requires an
on-chain SBT. Claiming one is a wallet transaction, and the session can offer
test ETH for its gas. Trustless & Slower sessions send wallet transactions.

This wallet is intentionally not a smart account. It does not provide gas
sponsorship, batching, relayers, paymasters, ERC-4337, EIP-7702, onchain
passkey verification, or hard onchain session-key permissions.

## Where It Lives

- `client/src/wallet/config.ts`: RP ID, origin, mode, TTL, and capability config.
- `client/src/wallet/passkey/`: WebAuthn registration/authentication helpers and PRF handling.
- `client/src/wallet/keystore/`: deterministic EOA derivation, optional AES-GCM encrypt/decrypt, IndexedDB metadata storage.
- `client/src/wallet/passkeyWallet.ts`: client API and EIP-1193 provider facade.
- `client/src/wallet/session/`: soft-session policy, worker, and worker client.
- `client/src/components/Account/LoginAndSettingsModal.tsx`: create, sign-in, restore, logout, and account sync.
- `client/src/components/Navbar/AccountSection.tsx`: silent account restore at app start, before the login modal opens.
- `client/src/utilities/web3/providerAdapter.ts`: provider-like compatibility for app code that expects an EIP-1193 provider.
- `client/src/utilities/crypto/cryptography.ts`: passkey EOA provider resolution for Lit/self-sign flows.

Provider id:

```text
passkey_eoa
```

Provider kind in crypto utilities:

```text
passkey-eoa
```

## RP ID

RP ID means relying-party identifier. It is the WebAuthn/passkey domain. A
passkey created for one RP ID cannot be used for another unrelated RP ID.

Production deployments should set an RP ID controlled by the deployment owner,
usually the parent domain:

```bash
NEXT_PUBLIC_RP_ID=example.com
NEXT_PUBLIC_RP_NAME="Example"
NEXT_PUBLIC_APP_ORIGIN=https://app.example.com
NEXT_PUBLIC_ACCOUNT_ORIGIN=https://account.example.com
NEXT_PUBLIC_WALLET_MODE=passkey-eoa
NEXT_PUBLIC_WALLET_KEY_MODE=passkey-derived
NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE=context-engine
NEXT_PUBLIC_SESSION_MODE=soft
NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS=3600
```

Local loopback development may use:

```bash
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_ACCOUNT_ORIGIN=http://localhost:3000
```

The Vite client also supports `REACT_APP_NEXT_PUBLIC_*` aliases for older CE
deployment tooling. See `client/.env.example`.

Rules enforced by `validatePasskeyWalletConfig()`:

- An RP ID is required. When `NEXT_PUBLIC_RP_ID` is unset, it defaults to the
  page's hostname (`localhost` on loopback hosts).
- Third-party wallet domains are rejected.
- Preview-host RP IDs are rejected unless `NEXT_PUBLIC_ALLOW_PREVIEW_RP_ID=true`.
- App and account origins must be the RP ID itself or a subdomain of it.

Changing RP ID creates a different passkey namespace. Existing passkeys created
under another RP ID cannot be reused under the new deployment domain.

## Key Mode

Default key mode:

```bash
NEXT_PUBLIC_WALLET_KEY_MODE=passkey-derived
```

In this mode, the EOA private key is deterministically derived from WebAuthn PRF
output. The passkey prompt is enough to recreate the same EOA private key for
the configured RP ID and derivation namespace. No encrypted EVM private key
ciphertext is required for login.

This is still an embedded EOA controlled by JavaScript running in this origin.
The passkey protects derivation of the EOA key, but malicious same-origin script
can request WebAuthn prompts or ask an unlocked soft session to sign. Treat CSP,
third-party scripts, and dependency integrity as part of the wallet security
model.

The derivation namespace is part of the deterministic wallet namespace:

```bash
NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE=context-engine
```

Changing any of these changes the derived wallet address:

- RP ID
- selected passkey credential
- derivation namespace
- derivation version

Optional compatibility mode:

```bash
NEXT_PUBLIC_WALLET_KEY_MODE=encrypted-private-key
```

That mode creates a random EOA private key, encrypts it with an AES-GCM key
derived from passkey PRF output, and requires the encrypted wallet record to be
available at unlock time.

## Create Flow

1. User clicks Create.
2. The app creates a WebAuthn credential under the configured RP ID, offering
   both ES256 and RS256 for platform-authenticator compatibility.
3. When registration returns WebAuthn PRF output, the app uses it directly.
   Authenticating the new credential is a compatibility fallback only when the
   registration result omits PRF output; it is not an unconditional second
   sign-in prompt.
4. The app derives the EOA private key with HKDF-SHA256 over PRF output,
   configured RP ID, configured derivation namespace, and versioned derivation
   labels.
5. The app saves non-secret metadata, such as credential ID and EVM address, to
   IndexedDB. If that write fails, creation fails.
6. The app initializes the worker-held soft session.

In `encrypted-private-key` compatibility mode, Create refuses before opening a
passkey prompt if this browser already stores an encrypted wallet for the RP ID.
Sign in to that wallet, or explicitly delete it before creating another. This
protects its only stored key even when a different authenticator is selected.
Creation checks the stored wallet again inside its write operation, so a wallet
saved while the authenticator prompt was open is preserved.
Passkey-derived creation remains available because its key can be re-derived.

While registration is pending, the account modal labels the operation
`creating passkey...` so it is distinguishable from the separate sign-in flow.

Passkey-derived metadata shape:

```ts
type PasskeyDerivedWalletRecord = {
  id: string;
  userId?: string;
  disconnected?: boolean;
  rpId: string;
  credentialId: string;
  evmAddress: `0x${string}`;
  keyMode: 'passkey-derived';
  derivationVersion: 'passkey-prf-hkdf-secp256k1-v1';
  prfSalt: string;
  createdAt: string;
  updatedAt: string;
};
```

Encrypted-private-key compatibility record shape:

```ts
type EncryptedWalletRecord = {
  id: string;
  userId?: string;
  disconnected?: boolean;
  rpId: string;
  credentialId: string;
  evmAddress: `0x${string}`;
  keyMode?: 'encrypted-private-key';
  encryptedPrivateKey: string;
  encryptionVersion: 'passkey-prf-aes-gcm-v1';
  salt: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
};
```

These values must never be sent to a server or persisted in logs:

- plaintext EVM private key
- passkey PRF output
- derived wallet private key
- derived AES key in encrypted-private-key mode
- decrypted private key in encrypted-private-key mode

## Unlock Flow

1. User clicks Login, or a signing action needs to re-unlock an expired soft
   session.
2. Explicit Login uses discoverable authentication for the configured RP ID,
   so the browser/OS picker can list every available passkey and the selected
   passkey-derived wallet becomes active. Background re-unlocks for an active
   wallet still supply the saved credential ID in WebAuthn `allowCredentials`,
   which prevents signing actions from unexpectedly reopening the chooser or
   switching accounts. Passkey-derived mode also uses discoverable
   authentication when local metadata was cleared.
3. The app requires PRF output.
4. In `passkey-derived` mode, the app derives the EOA private key directly from
   PRF output and versioned wallet derivation labels.
5. In `encrypted-private-key` mode, the app derives the AES-GCM key from PRF
   output and the stored salt, then decrypts the encrypted EOA private key.
6. The app initializes the worker-held soft session.
7. The EIP-1193 provider and wallet client expose the account to the app.

Sensitive material is cleared on disconnect/logout, timeout, account switch, and
worker lock. The default unlock TTL is 3600 seconds (60 minutes), counted from
the passkey prompt rather than from the last use. Configure it with:

```bash
NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS=3600
```

## PRF Support

The embedded wallet requires WebAuthn PRF support. If the browser,
authenticator, or platform does not return PRF output, wallet creation and
unlock fail closed.

Allowed fallback behavior:

- ask the user to use a PRF-capable passkey/browser
- use an external wallet path, if the build enables one
  (`REACT_APP_CE_ENABLE_METAMASK_CONNECTOR`)
- add a clearly labeled password-encryption mode in a separate reviewed change

Forbidden fallback behavior:

- plaintext private key in localStorage
- plaintext private key in IndexedDB
- passkey prompt as a UI-only gate

## Wallet Client API

`PasskeyEoaWalletClient` supports:

```ts
createWallet(): Promise<`0x${string}`>
unlockWallet(options?: { selectCredential?: boolean; expectedAddress?: string | null }): Promise<`0x${string}`>
restoreSession(options?: { requireSigner?: boolean }): Promise<`0x${string}` | null>
getAddress(): `0x${string}` | null
signMessage(message: unknown): Promise<`0x${string}`>
signTypedData(typedData: unknown): Promise<`0x${string}`>
sendTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>
signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>
disconnect(): Promise<void>
deleteWallet(): Promise<void>
```

The EIP-1193 facade is available through:

```ts
createPasskeyEip1193Provider()
```

The facade's `isUnlocked(forMs)` says whether a request would sign without a
passkey prompt, now and for the next `forMs` milliseconds. Background requests
use it: refreshes on focus, on a timer, or after a group change or a sign-in
elsewhere, group images, context files read for an AI, and pages that cover
many sessions, such as Community group counts and tag pages. They sign in to a
session's Worker only with a sign-in this page already holds, or silently while
the wallet stays unlocked for at least 30 more seconds (`getWorkerSessionToken`
and `fetchWorkerWithAuth` with `prompt: false`), and otherwise keep what they
show. Such a request also keeps a token the Worker refused for one newer scope,
unless a new one signs in silently. A page that covers many sessions stays
quiet because several passkey prompts at once would clash.

Someone signed in, whose address shows, is asked for the passkey rather than
shown what a signed-out visitor sees on a session page. Opening its Groups
panel, its context files, or the Results group filter (a filter saved or in a
link included) asks if that session needs a new sign-in, and those requests
share one prompt. Declining keeps the signed-out view, with a button to try
again, until anything else on the page signs in; closing and opening the filter
again doesn't ask. Before the first sign-in, a private session shows a
**Sign in** button there instead. A Worker sign-in lasts four hours and is kept
for the tab that made it, in that tab's sessionStorage and never localStorage,
so after a reload these don't ask again. The wallet itself still locks on a
reload, so anything it signs, such as an encrypted answer, asks for the passkey
once. A new tab needs a new sign-in, and a sign-out or account switch in any
tab ends every saved sign-in, in other tabs once they reload.

Capabilities report only what this wallet supports:

```ts
{
  passkeyWallet: true,
  eoa: true,
  softSessions: true,
  signMessage: true,
  signTypedData: true,
  sendTransaction: true,
  batching: false,
  sponsorship: false,
  paymaster: false,
  onchainPermissions: false,
  onchainPasskeyVerification: false
}
```

## Soft Sessions

Soft sessions are convenience sessions, not Ethereum-enforced permissions.

The worker holds decrypted signing material in memory and applies local policy:

```ts
type SoftSessionPolicy = {
  sessionId: string;
  address: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  allowedMethods: Array<
    | 'personal_sign'
    | 'eth_signTypedData_v4'
    | 'eth_sendTransaction'
    | 'eth_signTransaction'
  >;
  allowedChainIds?: number[];
  allowedTargets?: `0x${string}`[];
  maxTransactionValueWei?: string;
};
```

By default, value-bearing transactions are rejected by local policy, and raw
transaction signing is not included in the default method grant. Any transaction
with value should have explicit user confirmation in the calling UI.
The Worker and in-memory fallback use the same request handler. Transaction
quantities accept only non-negative safe integers, bigints, decimal/hex strings,
or genuine ethers BigNumber instances. Invalid quantities fail before signing;
byte arrays and BigNumber-shaped plain objects are rejected. Both send and raw
signing apply policy to the exact normalized transaction passed to ethers.

Important: a malicious script running in the same origin may still ask the
worker to sign. The worker reduces accidental exposure and isolates signing
code, but it is not equivalent to smart-account permissions or onchain session
keys.

## Server Endpoint Contract

This Vite app can unlock `passkey-derived` wallets without an encrypted wallet
record. IndexedDB metadata improves silent account display after reload, but it
is not required to derive the EOA after a passkey prompt.

This repository implements none of the endpoints below, and
`encrypted-private-key` mode keeps its record in IndexedDB only. A deployment
that adds server-side account storage should use this contract and must verify
WebAuthn challenges server-side:

```text
POST /api/passkey/register/options
POST /api/passkey/register/verify
POST /api/passkey/login/options
POST /api/passkey/login/verify
GET  /api/wallet/encrypted-key
PUT  /api/wallet/encrypted-key
```

The server may store credential metadata, public key material, credential ID,
EVM address, passkey-derived metadata, encrypted private key ciphertext, salt,
and IV. It must not receive plaintext EVM private keys, PRF output, derived EOA
private keys, derived AES keys, or decrypted keys.

## Existing Hosted-Wallet Users

Passkeys created under another RP ID cannot be reused under this deployment's
RP ID. Existing users should create a new passkey EOA wallet under the current
RP ID and treat the new EOA address as a distinct wallet.

If legacy wallet addresses were stored as canonical account identity, migrate to
a multi-wallet model:

```ts
type UserWallet = {
  userId: string;
  provider: 'passkey-eoa' | 'external' | 'legacy-porto';
  address: `0x${string}`;
  isPrimary: boolean;
  createdAt: string;
};
```

Optional linking should require the user to prove ownership of the old address.
Moving assets remains a normal user transaction unless the app adds an explicit
transfer flow.

## Test Coverage

Passkey derivation, encrypted wallet persistence, unlock behavior, and account
recovery are covered by the client unit and integration suites. Test fixtures
are non-identifying and must never be used for production funds.

Locking or disconnecting a passkey soft session rejects pending Worker signing
requests with a locked-wallet error and terminates the signer. A lock during
lazy Worker startup also cancels that startup.

After a reload, the navbar restores a saved, connected account from the
IndexedDB wallet metadata without a passkey prompt; signing still unlocks the
wallet first.

Both Settings logout and agent logout share client-auth teardown: Worker tokens
and all session agent credentials are cleared, pending requests/logins are
invalidated, mounted views and account state reset, and the saved passkey wallet
is disconnected. Returning to a session cannot restore authorization until a
fresh login. This local cleanup does not revoke server tokens.

Every logout, including the agent screen, starts wagmi disconnect and records
explicit disconnect intent inside shared teardown before clearing account props.
Both wallet hydration paths respect that intent while disconnect is pending or
failed; a later explicit wallet connection clears it. If the wallet cannot be
reached (WalletConnect offline, for example), the bridge still ends the local
wagmi connection in a tab that is no longer signed in with it, so the wallet
button can start that new connection. Passkey disconnect failures appear in the login modal even after the account state has reset, as a one-sentence notice; its "?" button explains that the app session is cleared but the saved-wallet disconnect failed.

Logout, deletion, and a replacing create invalidate older wallet operations.
Late passkey replies cannot save metadata, activate a signer, or retry a signature
after logout. Logout waits for metadata writes and signer initialization already
in progress before completing. Cancelled actions do not show a login error.
TTL/idle expiry still permits one signature re-unlock; it does not cancel the
operation like logout does.

Disconnect also saves a local disconnected flag with the wallet record. Reloading
does not restore the account automatically until the user signs in again. Locking
alone retains account discovery, and disconnect never deletes recovery material.
