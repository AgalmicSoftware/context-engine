# Forking Wallet Setup

Each fork must own its passkey RP ID. Do not launch production with an RP ID
from this project, a preview host, or a third-party wallet domain.

## Checklist

1. Choose an owned parent domain for passkeys, for example `example.com`.
2. Serve the app over HTTPS on that domain or a subdomain.
3. Set wallet env vars before building/deploying:

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

4. For Vite/older CE deployment tooling, use the alias names if needed:

```bash
REACT_APP_NEXT_PUBLIC_RP_ID=example.com
REACT_APP_NEXT_PUBLIC_RP_NAME="Example"
REACT_APP_NEXT_PUBLIC_APP_ORIGIN=https://app.example.com
REACT_APP_NEXT_PUBLIC_ACCOUNT_ORIGIN=https://account.example.com
REACT_APP_NEXT_PUBLIC_WALLET_KEY_MODE=passkey-derived
REACT_APP_NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE=context-engine
```

5. Do not launch production on preview domains such as `*.vercel.app`,
   `*.netlify.app`, `*.pages.dev`, or `*.workers.dev`. The wallet config rejects
   these by default.
6. Verify the app can create and unlock a wallet on the final domain before
   inviting users.
7. Keep external wallet fallback enabled only if the fork intentionally supports
   it.

## Namespace Rules

- RP ID is the passkey namespace.
- Existing passkeys cannot move between unrelated RP IDs.
- Each fork has its own passkey namespace.
- The default EOA is derived from the selected passkey, RP ID, derivation
  namespace, and derivation version.
- Changing RP ID or `NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE` after launch
  changes derived wallet addresses unless users can still unlock and migrate
  assets from the old address.

## What This Wallet Is

- passkey-derived EOA private key by default
- optional encrypted EOA private key compatibility mode
- unlocked by WebAuthn PRF
- normal Ethereum signer
- normal gas payer
- soft worker-held sessions for convenience

## What This Wallet Is Not

- smart account
- gas-sponsored wallet
- relayer/paymaster/bundler flow
- onchain passkey verifier
- hard onchain session-key permission system
- cross-app identity layer
