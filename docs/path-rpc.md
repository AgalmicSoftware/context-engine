# PATH RPC / Provider Behavior

This doc covers how Context Engine uses Pocket Network PATH endpoints and PATH-style
session overrides.

For scan-scope, profile deep-scan, and RPC guardrail flags, see
[`docs/rpc-scan-scope.md`](rpc-scan-scope.md).

## What PATH means in this repo

- PATH is Pocket Network's gateway product.
- The built-in public endpoint family currently lives under `api.pocket.network`.
- Context Engine uses PATH in two different places:
  - client read-provider ordering (`client/src/variables/chains.ts`, `client/src/utilities/web3/contractScripts.impl.ts`)
  - worker/session RPC overrides (`workers/sessionCorsWorker/worker.js`, Session Wizard/Admin worker config payloads)

Built-in anonymous RPC defaults live in `client/src/variables/rpcDefaults.js`.

## Current client defaults

- `PREFER_PATH_RPC = true` in `client/src/variables/appConfig.ts`
- `CE_RPC_PROVIDER_MODE = "fallback"` by default
- `globalThis.CE_PREFER_PATH_RPC = false` can disable PATH-first client reads at runtime
- `globalThis.CE_RPC_PROVIDER_MODE = "infura_only"` disables PATH for any supported chain that has a configured paid diagnostics RPC and uses that paid RPC only for that chain
- No paid/keyed client RPC URL is committed in source; use one of these env/runtime-only overrides if you need that diagnostics path:
  - `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP` / `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS`
  - `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP` / `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS`
- These values are browser-visible because they are part of the client bundle config, so keep them in local uncommitted `client/.env` only when you need browser-side diagnostics

OP Sepolia client read-provider order is:

1. PATH (`https://op-sepolia-testnet.api.pocket.network`) when PATH preference is enabled
2. `https://sepolia.optimism.io`
3. `https://optimism-sepolia.publicnode.com`
4. `https://optimism-sepolia-rpc.publicnode.com`
5. `https://optimism-sepolia.gateway.tenderly.co`
6. `https://optimism-sepolia.drpc.org`

Base Sepolia client read-provider order is:

1. PATH (`https://base-sepolia-testnet.api.pocket.network`) when PATH preference is enabled
2. `https://base-sepolia-rpc.publicnode.com`
3. `https://base-sepolia.publicnode.com`
4. `https://base-sepolia.blockscout.com/api/eth-rpc`
5. `https://base-sepolia.gateway.tenderly.co`
6. `https://base-sepolia.drpc.org`
7. `https://sepolia.base.org`

When `CE_RPC_PROVIDER_MODE="infura_only"` and a paid override is configured for one
of those chains, that chain uses only the configured paid RPC while other chains
keep their normal PATH/public fallback order.

Those fallback URLs come from `client/src/variables/rpcDefaults.js`.

## Important bootstrap exception

General client read providers are PATH-first, but session-registry bootstrap reads are not.

- `client/src/utilities/web3/sessionRegistry.ts` intentionally uses `getDefaultHttpRpc(chainId, { allowPath: false })`
  for bootstrap reads.
- That means cold registry hydration and other `bootstrapRpc: true` code paths use public/default
  non-PATH RPCs first.

Treat "PATH-first" as the normal read-provider rule, not a universal rule for every bootstrap path.

## Session metadata / legacy overrides

`/session/new` no longer writes RPC config into Arweave metadata.

Current authoritative locations are:

- worker KV config (`session:{slug}:config`) for operational worker RPCs
- client chain definitions for default read-provider ordering
- legacy metadata/manual session config only when you explicitly preserve or inject old RPC fields

Legacy-compatible metadata shape, when present:

```json
{
  "rpc": {
    "provider": "path",
    "providers": {
      "path": {
        "rpcUrl": "",
        "rpcUrlsByChainId": {
          "84532": "https://base-sepolia-testnet.api.pocket.network"
        },
        "apiKey": "",
        "encryptedApiKey": ""
      }
    }
  }
}
```

Notes:

- RPC API keys in metadata are legacy-only.
- Current flows store sensitive RPC credentials in worker secrets or local overrides.
- See [`docs/resource-keys.md`](resource-keys.md) for key routing and precedence.

## How group-level PATH preference is resolved

When a session still contains `rpc` or browser-visible worker/session RPC overrides, the
main client read-provider stack resolves session preference in this order:

1. explicit/custom PATH overrides from `rpc.path.*` or, if absent, `rpc.providers.path.*` (`rpc.path.*` wins when both are present)
2. first non-empty session chain-id map: `rpc.rpcUrlsByChainId[activeChainId]` else top-level `rpcUrlsByChainId[activeChainId]` (the resolver does not merge both layers)
3. top-level/browser-visible `rpcEndpoint` or `rpcUrl` for the session default chain only
4. nested/session-root `rpc.rpcEndpoint`, `rpc.endpoint`, `rpc.rpcUrl`, or `rpc.url` for the session default chain only
5. built-in PATH default for the active chain

Behavior:

- If `rpc.provider` is `path` or `pocket`, PATH/default-PATH stays eligible, but an allowed sponsored
  session-root RPC can still take precedence unless a custom `rpc.path.*` or `rpc.providers.path.*`
  override is present.
- If `rpc.provider` is unset/default and custom `rpc.path.*` or `rpc.providers.path.*` overrides exist,
  PATH is preferred.
- Public `rpc.path.*` / `rpc.providers.path.*` overrides remain session-level read overrides only when `rpc.provider` is
  unset, `default`, `path`, or `pocket`.
- Browser-visible top-level session RPC fields (`rpcUrlsByChainId`, `rpcEndpoint`, `rpcUrl`) now feed the
  same participant-facing read-provider path, not just Admin diagnostics; use `rpcUrlsByChainId` (top-level
  or nested under `rpc.*`) for cross-chain contract reads because direct `rpcEndpoint`/`rpcUrl` only apply
  on the session default chain.
- If the session RPC has an explicit on-chain open gate for the `rpc` resource, the client may use it directly.
- If the session `rpc` resource is restricted, the client fails closed until wallet access has been verified;
  granted wallets switch onto the session RPC, while denied/unverified wallets stay on the normal fallback stack.
- If `rpc.provider` is a non-PATH value such as `infura`, the resolver disables PATH/session-root preference
  and uses the chain fallback stack with PATH URLs removed from the public, default, and fallback lists.
- The app still falls back to the chain's public/default RPC list after any preferred PATH URLs.
- Empty PATH override strings are ignored. On OP Sepolia and Base Sepolia, that falls back to the built-in
  chain PATH default and then the normal chain fallback list.
- SBT/profile read paths now use the same session-aware provider selection as latest-block reads, so
  session-level PATH overrides also apply to SBT discovery, profile SBT universe scans, and holder/count
  helper reads like `mintedTokens()` / `groupPasswordHash()`.

## Worker/session RPC defaults

Worker config is a separate path from client read-provider ordering.

Important current behavior on OP Sepolia (`11155420`) and Base Sepolia (`84532`):

- Session Wizard deploy payloads intentionally prefer non-PATH fallback/public RPCs first when building
  `rpcUrlsByChainId` for worker config.
- Browser-visible worker/session RPC values mirrored onto top-level `rpcUrlsByChainId`, `rpcEndpoint`, or `rpcUrl`
  can now be consumed by the main client read-provider path only when the on-chain `rpc` gate is open or the current wallet already has a cached grant.
- AdminPage worker-config payloads currently default `rpcUrl` to `getDefaultHttpRpc(chainId)`, which is
  PATH-first when PATH preference is enabled.
- AdminPage Resources -> Faucet balance is a browser read-only lookup that follows the public session
  chain values; it does not use worker secrets or wallet RPC calls.
- Authenticated faucet execution for a worker-canonical session uses its same-network
  `customRpcUrl` session secret first, then legacy `faucet.rpcUrl`, mapped/session RPC values, and
  public fallbacks. The Worker verifies `eth_chainId` before protected reads and masks private
  endpoint details in diagnostics. Decentralized sessions retain the legacy public-config ordering.
- Worker faucet fallback order is not identical to the client read-provider order.

In other words: do not assume the worker's default RPC order exactly matches the app's read-provider order.
If the exact worker RPC matters, inspect the generated payload or set it explicitly.

## Default Pocket endpoints used by the app

These are the built-in PATH defaults in `client/src/variables/rpcDefaults.js`:

- Ethereum Mainnet (1): `https://eth.api.pocket.network`
- Optimism (10): `https://op.api.pocket.network`
- BNB Chain (56): `https://bsc.api.pocket.network`
- Polygon (137): `https://poly.api.pocket.network`
- Celo (42220): `https://celo.api.pocket.network`
- Base (8453): `https://base.api.pocket.network`
- Arbitrum One (42161): `https://arb-one.api.pocket.network`
- Avalanche C-Chain (43114): `https://avax.api.pocket.network`
- Ethereum Sepolia (11155111): `https://eth-sepolia-testnet.api.pocket.network`
- Optimism Sepolia (11155420): `https://op-sepolia-testnet.api.pocket.network`
- Arbitrum Sepolia (421614): `https://arb-sepolia-testnet.api.pocket.network`
- Base Sepolia (84532): `https://base-sepolia-testnet.api.pocket.network`
- Polygon Amoy (80002): `https://poly-amoy-testnet.api.pocket.network`

## Diagnostics

Enable RPC diagnostics before app boot:

- `window.CE_LOGGING.enabled = true`
- `window.CE_LOGGING.categories.rpc = true`
- `window.CE_RPC_LOG_PROVIDER_SUCCESS = true`
- `window.CE_RPC_VERBOSE_ERRORS = true`

Useful signals:

- `RPC provider ok`
- `PATH RPC ok`
- `RPC provider error`

## Self-hosted PATH notes

This repo does not ship a PATH gateway.

If you want to run your own gateway:

1. deploy PATH separately
2. point Context Engine at it via worker config or legacy session RPC overrides
3. verify with simple calls like `eth_chainId` / `eth_blockNumber`

Suggested override fields:

- single-chain override: `rpc.path.rpcUrl` or `rpc.providers.path.rpcUrl`
- per-chain override: `rpc.path.rpcUrlsByChainId` or `rpc.providers.path.rpcUrlsByChainId`
- if both shapes are present, `rpc.path.*` wins

## Related docs

- [`docs/rpc-scan-scope.md`](rpc-scan-scope.md)
- [`docs/resource-keys.md`](resource-keys.md)
- [`docs/session-cors-worker.md`](session-cors-worker.md)
