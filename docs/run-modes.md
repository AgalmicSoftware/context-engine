# Run Modes

Context Engine's developer run mode, static web-app hosting, session access
policy, and session infrastructure profile are separate choices. For example,
the same hosted web app can open a private worker-canonical session or a public
decentralized session; making the app public does not make every session public
or on-chain.

## Developer Run Modes

### `core-local`

Frontend development and local client work only.

- Use the React client without chain, worker, or Arweave dependencies.
- Client workflows support Node.js `^20.19.0` or `>=22.12.0` with npm
  `^10.0.0`.
- Install client dependencies with plain `npm install`; strict peer resolution
  is the normal install contract.

```bash
cd client
nvm use 20
npm install
npm run dev
```

Vite is the canonical client dev/build path:

```bash
cd client
npm run dev
npm run build
npm run preview
```

The Vite production build writes to `client/build/`. Both `npm start` and
`npm run preview` open Vite's local preview server for that existing build;
production hosting should serve the static `build/` output through the chosen
deployment platform. Client unit tests run through standalone Jest 30:

```bash
cd client
npm test -- --watchAll=false
```

### `local-chain`

Local blockchain development with Anvil and Foundry.

- Use this mode for contract work, local deploys, and chain-backed development
  flows.
- Root scripts use Node.js 20.19+ or 22.12+.
- See [local-chain.md](local-chain.md) for chain startup, deploy flow, and local
  contract testing.

### `manual-fork` verification (advanced)

Hybrid E2E verification against real deployed contract state without spending
live gas for every repeated validation.

- Start Anvil in fork mode yourself against the target chain.
- Point E2E `RPC_URL` at that local fork.
- Keep `CHAIN`, `CHAIN_ID`, `SESSION_REGISTRY`, and `SBT_FACTORY` aligned to the
  upstream chain you forked.
- First-class fork orchestration is not part of the published command surface.

These developer modes do not select a production session-infrastructure
profile. That choice happens separately in `/new`.

## Session Infrastructure Profiles

`/new` is one page and starts on **Hosted & Fast**. The `Runs on` toggle at the
top switches to **Trustless & Slower**. **Company-Operated** is planned.

### Hosted & Fast — implemented default

`Runs on` shows this as `Centralized`.

- A creator deploys a per-session Cloudflare Worker with Cloudflare-backed
  canonical config and payload storage, under `worker_canonical` authority.
- New sessions start with unencrypted answers that every signed-in session
  member can read and signed-out visitors can't. Choosing public results opens
  them to everyone; choosing own-answers visibility keeps each person to their
  own.
- Setup needs a Cloudflare account, an AI-provider key (OpenAI by default), and
  either a Cloudflare API token, sent once through the deploy helper and never
  saved, or the token-free dashboard handoff.
- The passkey-derived EOA supplies signing and admin identity, but publishing
  this profile does not submit an EVM transaction or require gas.
- EVM contracts, registry/RPC access, Arweave, and Lit are not dependencies of
  the default profile.
- The current OSS path is bring-your-own-worker; a generally available shared
  hosted worker product has not shipped.

### Trustless & Slower — implemented opt-in

`Runs on` shows this as `Decentralized`.

- Public EVM registry/contracts provide session and gate authority.
- Arweave stores metadata and payloads, which are public and permanent. Anyone
  can read them unless they are locked with Lit encryption, which covers only
  the fields you lock.
- Creation requires a compatible Session Worker, an Arweave wallet/JWK, RPC
  access, and a wallet that sends the registry transactions and pays gas and the
  0.0001 ETH creation fee.
- Lit credentials are required only when the creator explicitly selects Lit
  encryption; the stock preset does not enable it.

### Company-Operated — planned

This profile is not generally available. Target environments include existing
hardware, private clouds, and internal networks. Planned adapters cover
organizational identity/IAM, KMS or key release, storage, AI gateways,
networking, and observability.

Company-Operated may be entirely off-chain. A private EVM could be offered as a
future optional compatibility adapter, but it is not required by the planned
architecture. Do not treat the reserved source types as a shipped corporate
edition or adapter package.

## Credential Boundary

Creators provide deployment credentials only when provisioning their chosen
infrastructure. Participants joining or using an existing session never need a
Cloudflare token, AI-provider key, Arweave JWK, RPC credential, or any other
deployer API key.

See the [session creation guide](session-creation-guide.md),
[Cloudflare worker reference](session-cors-worker.md), and
[scaling guide](scaling.md) for profile-specific setup and architecture.
