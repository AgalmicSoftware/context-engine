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
  `^10.0.0`; Node 16/npm 9 are no longer supported.
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

The older `hosted/onchain` label grouped several production choices together.
It is retained as a documentation alias only: use Hosted & Fast for the
worker-canonical Cloudflare path, or Trustless & Slower for the public
EVM-and-Arweave path described below.

## Session Infrastructure Profiles

The `/new` chooser initially selects nothing. **Hosted & Fast** is the default
and recommended path once chosen; **Trustless & Slower** is an implemented
opt-in; **Company-Operated** is planned.

### Hosted & Fast — implemented default

This is labeled `Centralized (Cloudflare)` in the wizard.

- A creator deploys a per-session Cloudflare Worker with Cloudflare-backed
  canonical config and payload storage.
- `worker_canonical` authority and `worker_envelope` encryption are the defaults.
- Creator-facing setup needs a Cloudflare login and one AI-provider key. The
  native deploy flow does not ask the creator to copy a Cloudflare API token.
- The passkey-derived EOA supplies signing and admin identity, but publishing
  this profile does not submit an EVM transaction or require gas.
- EVM contracts, registry/RPC access, Arweave, and Lit are not dependencies of
  the default profile.
- The current OSS path is bring-your-own-worker; a generally available shared
  hosted worker product has not shipped.

### Trustless & Slower — implemented opt-in

This is labeled `Decentralized (Arweave + EVM)` in the wizard.

- Public EVM registry/contracts provide session and gate authority.
- Arweave stores metadata and payloads.
- Creation requires the relevant wallet transaction, gas, RPC access, and
  Arweave wallet/JWK.
- Lit credentials are required only when the creator explicitly selects Lit
  encryption; the stock preset does not enable it.

The decentralized path remains supported. It is an optional profile, not a
universal dependency of hosted operation.

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
