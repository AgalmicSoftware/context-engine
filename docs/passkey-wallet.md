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
   sign-in prompt. That prompt waits for the page to be in front, and a
   password manager can hold it out of sight, so the dialog's spinner has
   **Cancel**. Cancel, or closing the dialog on the spinner, stops the step:
   nothing more is saved and no one is signed in, and the dialog says to
   choose **Login** and pick the passkey just made.
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
the person's last click, tap or key press on the page. Events a script
dispatches and background signing don't count, and however much the page is
used, the wallet locks 8 hours after its passkey prompt, or one TTL after it if
the TTL is set longer. The key's worker enforces both: each use moves its expiry
forward too, at most about once a minute, and never past the limit set when it
got the key. Configure the TTL with:

```bash
NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS=3600
```

## PRF Support

The embedded wallet requires WebAuthn PRF support. If the browser,
authenticator, or platform does not return PRF output, wallet creation and
unlock fail closed.

### A device whose own passkeys have no PRF

Create asks for a passkey kept on the device (`authenticatorAttachment:
'platform'`). Windows Hello gives such a passkey PRF only with Chrome or Edge 147
or later (Chromium changes 7569106 and 7600513) on a Windows 11 whose WebAuthn
API is version 8 or later; third-party reports date that to the February 2026
update of 24H2 and 25H2. On Windows 10, an older Windows 11 or an older browser,
Windows Hello saves the passkey and the site cannot use it. A passkey app
without PRF, set as a phone's passkey provider, ends the same way.

After such a Create, the status under the buttons offers "**Scan QR with phone**
to login", then a login file (below), then, where the browser holds unsaved
answers, "**Copy this link** to paste your responses on a different device."
The first button runs Create again with `authenticatorAttachment: 'cross-platform'`
and `hints: ['hybrid']`, so the browser shows a QR code to scan with a phone.
Everything else in the request, the PRF salt included, is unchanged, and the
wallet is derived the same way. The passkey then lives on the phone: each later
sign-in on that computer asks for the phone again. A try that fails, or a prompt
that is closed, returns to the same message, so the offer stays.

- The passkey the failed Create saved stays on the device. The site cannot remove
  it (Chrome does not pass the WebAuthn Signal API on to Windows Hello by
  default); Login offers it and fails with it. It can be deleted in the device's
  passkey settings.
- A phone may return no PRF output when the passkey is made, and the site then
  asks for it once more: a second prompt on the phone.
- A phone's passkey may return a different PRF output through a QR code than on
  the phone itself (reported for some iPhone versions). The account made through
  the QR code is then reached only that way, from a computer; Login on the phone
  itself would open a different, empty account.
- A security key is not offered. The browser's sheet may list one, but later
  sign-ins name the saved passkey with the `internal` and `hybrid` transports
  only, so a key may not be asked for.
- The copy line below stays as the last resort.

### Login file: sign-in without a passkey

For someone whose device cannot use a passkey here at all. Under the log-in
window's passkey buttons, **Other options** opens two buttons: **Create login
file** and **Login with file**.

After any sign-in that failed there (a passkey without PRF, a prompt that was
closed or timed out, a browser without passkeys, a file that is not a login
file), the status box is itself the list of other ways in, so "Other options" is
not shown beside it. The box adds "**Create login file** or **Login with file**
to login without a passkey". After a Create whose passkey has no PRF that sits
between the phone and the copy link, an "or" between the three: "Scan QR with
phone to login", the login file, "Copy this link to paste your responses on a
different device." In a browser without passkeys, the link to another browser
stays first.

- The file is named as a passkey is, with the device's date and time, for
  example `ContextEngine-Login-November23-2026-1003PM.json` (letters, digits and
  hyphens only; no part of the account). The name is for finding it again: a
  login file signs in under any name, the earlier
  `context-engine-login-<6 hex>.json` among them. It holds a standard 12-word
  recovery phrase; the account is that phrase's first Ethereum address
  (`m/44'/60'/0'/0/0`). It is made in the browser and sent nowhere. Whoever holds
  the file holds the account, and a lost file cannot be replaced. It has no
  password.
- Creating never signs in by itself. It saves the file, and one notice then
  stands in place of every other choice (the failed passkey's box and "Other
  options"): Back in its top-left corner, what was saved, and **Login with
  file**. The person signs in by choosing the file, which shows that they have
  it. Back returns to the choices. The 12 words alone, in a text file, sign in
  too.
- The account is a `passkey_eoa` account like any other from there on: the same
  provider, session, signatures and transactions, none of which asks again while
  the file is loaded. No Worker or contract knows the difference. It is a
  different account from any passkey's.
- The file stays loaded for 6 hours from the moment it is chosen, across reloads;
  use of the page does not extend that. In that time the key rests in the
  wallet's IndexedDB record (`keyMode: 'login-file'`), encrypted with AES-GCM
  under a non-extractable WebCrypto key kept in the same record. That keeps the
  key out of anything that reads storage as text, and no more. A script running
  in the site's origin while the file is loaded can ask the browser to open the
  sealed key, because the sealing key sits beside it, and so take the account's
  key for good. With a passkey account such a script can only ask for signatures
  while the wallet is unlocked. A copy of the browser's profile holds the key
  too.
- After 6 hours, and on Disconnect, the key is wiped from the record: by a timer
  on an open page, and otherwise at the next page load or signature. What is left
  names the account and holds no key, so another tab on that account is told
  "Your login file is needed again." rather than asked for a passkey. A browser
  that never opens the site again keeps the sealed key until it does.
- A page left open past the 6 hours still shows the account until it is
  reloaded. When a Submit of answers meets that, a window opens at once ("LOGIN
  FILE": "Your unsent answers are kept.", **Login with file**, Close), and the
  Submit waits behind it. The same file, chosen there, signs the account back in
  with no reload, and that Submit then starts again and goes ahead, as one
  Submit with one outcome; a file with a password is asked for it in the same
  window. A file for another account is refused ("That file is for another
  account.") before anything is locked or written, so the page's account is
  never switched.
  - Closing the window, signing out, or moving to another session while it is
    open sends nothing. The Submit then fails as before, with its line under the
    Submit bar: "Your login file is needed again. Reload the page, then log in
    with your file. Unsent answers are kept." A reload shows signed out and keeps
    that tab's unsent answers, which return once the same file signs in.
    Disconnect would discard them, and asks first.
  - The window is asked for once per Submit, by `askForLoginFile` in
    `utilities/session/loginFileDue.ts`, and shown by the navbar's account
    section. Every Submit of answers goes through it: the pile, All questions,
    a survey, the one-question page and the interview's Submit, and the read of
    saved answers that comes before a pile Submit. Anything else that needs a
    signature past the 6 hours (joining a group, for one) fails with the same
    message and no window.
- **A password, if asked for.** "Add a password", under "Create login file",
  takes a password, and the file made then (version 2) holds its 12 words
  encrypted: PBKDF2-SHA256 with 600,000 iterations and a random 16-byte salt
  stretches the password into an AES-GCM-256 key, used with a random 12-byte IV.
  The password is taken as UTF-8 after Unicode NFKC normalisation; the cipher's
  input is the phrase as UTF-8, with no additional data; `salt`, `iv` and
  `ciphertext` (which ends with the 16-byte tag) are base64url without padding.
  The file records the method and its numbers (`encryptedRecoveryPhrase`: `kdf`,
  `iterations`, `salt`, `cipher`, `iv`, `ciphertext`), so they can be raised later
  and older files still open; a count below 100,000 or above 5,000,000, or any
  other method, is refused as not a login file. Stretching takes about a tenth of
  a second on a fast laptop (measured in Chromium and WebKit) and is expected to
  take up to about a second on a phone (not measured).
  - Choosing such a file asks for its password before anything is tried: one box,
    in place of the other choices, with Back. A wrong password says "Wrong
    password, or the file is damaged." and leaves the box there to try again; the
    cipher cannot tell a wrong password from a protected part that was changed. A
    file that opens to another account than the one it names is refused.
  - The password is used to open the file and kept nowhere: not in storage, not
    in the wallet's record, not in the page's markup while it is typed, and it is
    sent nowhere. It cannot be recovered. A
    forgotten password leaves the file of no use, which the window says in view.
  - There is one password box with a "Show" tick, and no second "confirm" box.
    Creating never signs in, so the first sign-in with the new file is the check:
    a mistyped password fails there, while the account is still empty and another
    file can be made.
  - After the file is opened, everything is as without a password: the same
    account on every device, and the key sealed in the browser for its 6 hours,
    during which the password is not asked for again. Files without a password,
    and the 12 words alone, work as before.
  - A password protects the file at rest. It does not protect a signed-in
    browser, and a short or guessable password can be tried offline by anyone who
    has the file, at the cost of the stretching per guess.
- The page cannot tell whether a browser saved the file. The notice says where
  to look ("Check your downloads for …"), and its (?) says what to do if no file
  was saved: built-in browsers of other apps often drop downloads.
- A passkey Login or Create replaces a login file's record, and the reverse. An
  `encrypted-private-key` wallet's record is never written over. A file that is
  not a login file leaves the signed-in account as it was.

Allowed fallback behavior:

- ask the user to use a PRF-capable passkey/browser
- use an external wallet path, if the build enables one
  (`REACT_APP_CE_ENABLE_METAMASK_CONNECTOR`)
- add a clearly labeled password-encryption mode in a separate reviewed change

Forbidden fallback behavior:

- plaintext private key in localStorage
- plaintext private key in IndexedDB
- passkey prompt as a UI-only gate

## When Sign-In Fails After Answers Were Drafted

A failed sign-in changes nothing about sign-in itself. When the passkey itself is
the problem and the browser holds unsaved answers (typed on the page, or drafted
in an interview), the status under the buttons adds one sentence that starts with a
**Copy this link** button: "Copy this link and open it on your phone to recover and
submit responses." (In a browser without passkeys it names Safari or Chrome
instead.) A copy that worked puts a check on the button.

A passkey problem is: no passkeys in this browser, no PRF support, or any other
create or unlock the device or browser refused. Errors fixed in the same browser
do not count: a prompt that was closed or timed out, and the ones that point at
the other button ("Use Login.", "Sign in, or delete it first", "Use Create…").

- The copy is a link ending `#answers=…`. The answers are in the link's fragment,
  which browsers do not send; the page that opens it takes the part out of the
  address before anything is fetched. Anyone given the link can read the answers.
- It carries the browser's own signed-out records as they are: typed answers with
  their importance and conviction, and an interview's review with its edits and
  research choices. Nothing is relabelled; this is not `#prefill=`, which holds
  an AI's drafts.
- A set too long for one link (over about 2,000 characters) copies as two lines:
  a short link ending `#answers=paste`, then a code. The short link opens a box
  to paste the whole message into. A link that arrives cut off opens the same box.
  Where the browser refuses the clipboard, the copy is offered in its one-line
  box with a space between the link and the code; a link and code joined with no
  break at all still read.
- The opening browser loads the answers into its own signed-out records and says
  how many. Answers it already holds are kept, and it says how many copied ones
  stayed out. An interview's review is asked about before it shows, as any review
  kept signed out is. It is marked as copied, so a phone that is already signed
  in offers it too while the account has no review of its own; continued there,
  it becomes the account's. An ordinary signed-out review is never offered after
  sign-in, as the phone may be shared.
- With no unsaved answers the sign-in screen is unchanged; a browser without
  passkeys keeps its **Copy link**.

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
and all Agent HTTP credentials are cleared, pending requests/logins are
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
