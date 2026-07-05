# Passkey EOA Wallet

Context Engine's embedded wallet is a passkey-unlocked EOA. It keeps the
existing account UX while removing hosted wallet infrastructure from the normal
login, signing, and transaction path.

```text
User clicks Continue / Sign in
-> browser passkey prompt
-> wallet is unlocked in memory
-> app signs messages, typed data, and normal EVM transactions
-> routine actions may reuse a soft worker-held session until TTL
```

This wallet is intentionally not a smart account. It does not provide gas
sponsorship, batching, relayers, paymasters, ERC-4337, EIP-7702, onchain
passkey verification, or hard onchain session-key permissions.

## Where It Lives

- `client/src/wallet/config.ts`: RP ID, origin, mode, TTL, and capability config.
- `client/src/wallet/passkey/`: WebAuthn registration/authentication helpers and PRF handling.
- `client/src/wallet/keystore/`: deterministic EOA derivation, optional AES-GCM encrypt/decrypt, IndexedDB metadata storage, migration types.
- `client/src/wallet/passkeyWallet.ts`: client API and EIP-1193 provider facade.
- `client/src/wallet/session/`: soft-session policy, worker, and worker client.
- `client/src/components/Account/LoginAndSettingsModal.tsx`: create, sign-in, restore, logout, and account sync.
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
NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS=900
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

- RP ID is required outside loopback local development.
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

1. User clicks Create account or Continue.
2. The app creates a WebAuthn credential under the configured RP ID.
3. The app authenticates the credential with the WebAuthn PRF extension.
4. The app derives the EOA private key with HKDF-SHA256 over PRF output,
   configured RP ID, configured derivation namespace, and versioned derivation
   labels.
5. The app records non-secret metadata such as credential ID and EVM address
   when browser storage is available.
6. The app initializes the worker-held soft session.

Passkey-derived metadata shape:

```ts
type PasskeyDerivedWalletRecord = {
  id: string;
  userId?: string;
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
  rpId: string;
  credentialId: string;
  evmAddress: `0x${string}`;
  keyMode: 'encrypted-private-key';
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

1. User clicks Continue or Sign in.
2. The app performs discoverable WebAuthn authentication for the configured RP
   ID, allowing the browser/OS passkey picker to search the passkey keychain.
3. The app requires PRF output.
4. In `passkey-derived` mode, the app derives the EOA private key directly from
   PRF output and versioned wallet derivation labels.
5. In `encrypted-private-key` mode, the app derives the AES-GCM key from PRF
   output and the stored salt, then decrypts the encrypted EOA private key.
6. The app initializes the worker-held soft session.
7. The EIP-1193 provider and wallet client expose the account to the app.

Sensitive material is cleared on disconnect/logout, timeout, account switch, and
worker lock. The default unlock TTL is 900 seconds and can be configured with:

```bash
NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS=900
```

## PRF Support

The embedded wallet requires WebAuthn PRF support. If the browser,
authenticator, or platform does not return PRF output, wallet creation and
unlock fail closed.

Allowed fallback behavior:

- ask the user to use a PRF-capable passkey/browser
- use an already-supported external wallet path
- add a clearly labeled password-encryption mode in a separate reviewed change

Forbidden fallback behavior:

- plaintext private key in localStorage
- plaintext private key in IndexedDB
- passkey prompt as a UI-only gate

## Wallet Client API

`PasskeyEoaWalletClient` supports:

```ts
createWallet(): Promise<`0x${string}`>
unlockWallet(): Promise<`0x${string}`>
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

Important: a malicious script running in the same origin may still ask the
worker to sign. The worker reduces accidental exposure and isolates signing
code, but it is not equivalent to smart-account permissions or onchain session
keys.

## Server Endpoint Contract

This Vite app can unlock `passkey-derived` wallets without an encrypted wallet
record. IndexedDB metadata improves silent account display after reload, but it
is not required to derive the EOA after a passkey prompt.

Deployments that use `encrypted-private-key` mode or add server-side account
storage should use the following endpoint contract and must verify WebAuthn
challenges server-side:

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

## Deterministic Test Wallets

The root AI/E2E scripts still use deterministic non-identifying wallet fixtures
for repeatable OP Sepolia testing. `npm run ai:wallet` prints the deterministic
address and, with `SHOW_PRIVATE_KEY=1`, private local-only fixture material for
automation. Do not use fixture keys for production funds.

`scripts/seed-survey-question-types.js` now seeds passkey-derived wallet
metadata in IndexedDB for browser automation instead of storing a plaintext
session record. The mock PRF output stays in the E2E harness payload and is not
written into the wallet record.
