# PATH RPC / Provider Behavior

This doc covers how Context Engine uses Pocket Network PATH endpoints and PATH-style
session overrides.

For scan-scope, profile deep-scan, and RPC guardrail flags, see
[`docs/rpc-scan-scope.md`](rpc-scan-scope.md).

## What PATH means in this repo

- PATH is Pocket Network's gateway product.
- The built-in public endpoint family currently lives under `api.pocket.network`.
- Context Engine uses PATH in two different places:
  - client read-provider ordering (`client/src/variables/chains.js`, `client/src/utilities/web3/contractScripts.impl.js`)
  - worker/session RPC overrides (`workers/sessionCorsWorker/worker.js`, Session Wizard/Admin worker config payloads)

Built-in anonymous RPC defaults live in `client/src/variables/rpcDefaults.js`.

## Current client defaults

- `PREFER_PATH_RPC = true` in `client/src/variables/appConfig.js`
- `CE_RPC_PROVIDER_MODE = "fallback"` by default
- `globalThis.CE_PREFER_PATH_RPC = false` can disable PATH-first client reads at runtime
- `globalThis.CE_RPC_PROVIDER_MODE = "infura_only"` disables PATH for any supported chain that has a configured paid diagnostics RPC and uses that paid RPC only for that chain
- No paid/keyed client RPC URL is committed in source; use one of these env/runtime-only overrides if you need that diagnostics path:
  - `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_HTTP` / `REACT_APP_CE_BASE_SEPOLIA_PAID_RPC_URL_WSS`
  - `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_HTTP` / `REACT_APP_CE_OP_SEPOLIA_PAID_RPC_URL_WSS`
- These values are browser-visible because they are part of the CRA client config, so keep them in local uncommitted `client/.env` only when you need browser-side diagnostics

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

- `client/src/utilities/web3/sessionRegistry.js` intentionally uses `getDefaultHttpRpc(chainId, { allowPath: false })`
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

When a session still contains `rpc` overrides, `contractScripts` resolves PATH preference in this order:

1. `rpc.providers.path.rpcUrlsByChainId[activeChainId]`
2. `rpc.providers.path.rpcUrl`
3. built-in PATH default for the active chain

Behavior:

- If `rpc.provider` is `path` or `pocket`, PATH is preferred.
- If `rpc.provider` is unset/default and PATH overrides exist, PATH is preferred.
- If `rpc.provider` is a non-PATH value and no PATH overrides are set, the app keeps the existing chain RPC order.
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
- AdminPage worker-config payloads currently default `rpcUrl` to `getDefaultHttpRpc(chainId)`, which is
  PATH-first when PATH preference is enabled.
- AdminPage Resources -> Faucet balance is a read-only lookup that follows the session chain first:
  `faucet.rpcUrl`, then `rpcUrlsByChainId[networkChainId]`, then `rpc.providers.path.rpcUrl`,
  then generic session `rpcUrl`, then the built-in chain default. It does not use wallet RPC calls.
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

## E2E note

The app default is PATH-first, but the E2E harness explicitly disables PATH-first ordering unless
`E2E_PREFER_PATH_RPC=1` is set.

See [`docs/e2e-setup.md`](e2e-setup.md) for the test harness behavior.

## Self-hosted PATH notes

This repo does not ship a PATH gateway.

If you want to run your own gateway:

1. deploy PATH separately
2. point Context Engine at it via worker config or legacy session RPC overrides
3. verify with simple calls like `eth_chainId` / `eth_blockNumber`

Suggested override fields:

- single-chain override: `rpc.providers.path.rpcUrl`
- per-chain override: `rpc.providers.path.rpcUrlsByChainId`

## Related docs

- [`docs/rpc-scan-scope.md`](rpc-scan-scope.md)
- [`docs/resource-keys.md`](resource-keys.md)
- [`docs/session-cors-worker.md`](session-cors-worker.md)
