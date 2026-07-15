# Sponsored Resource Keys

This doc covers how AI, Arweave, RPC, faucet, and Lit payer keys are stored and routed.

## Where keys live

Group-level secrets now live in worker secrets (not in Arweave metadata):

- AI provider keys (Anthropic/OpenAI/OpenRouter) → worker secrets.
- Arweave wallet JWK → worker secret.
- Faucet private key → worker secret.
- Lit payer private key (+ derived payer address/status) → worker secret / admin worker status route.
- Custom RPC URL, including any provider credential embedded in its path →
  worker session secret (`customRpcUrl`). A separate bare RPC key is not
  injected into JSON-RPC requests.

Legacy metadata fields (`ai.providers.*.apiKey`, `rpc.providers.path.apiKey`,
`arweave.jwk`, `faucet.privateKey`) are still tolerated on read for older
sessions, but `/session/new` no longer writes them.

Legacy/dormant metadata-backed `litCredentials` reads are now fenced off; Lit payer
material should only live in worker secrets, sponsored bundles, or transient runtime state.

## Local overrides

The settings panel exposes per-group local overrides stored only in
localStorage:

- AI API keys
- Arweave JWK
- RPC API key (reserved)
- Faucet private key + faucet config (optional)

## Resolution order

Per request, the client resolves keys in this order:

1. If a local override is enabled, send the local key.
2. Otherwise, send no key and let the worker use its configured secrets.
3. If a local override is enabled but empty, the request still goes out without a key and the worker fallback applies.

## Per-request routing

- AI requests include `payload.apiKey` only for local overrides. Otherwise the
  worker uses its environment keys.
- Arweave uploads include `arweaveJwk` only for local overrides. Otherwise the
  worker uses its configured JWK.
- If the worker has no fallback configured, it rejects the request and the
  client surfaces the error.

## RPC key routing

Session-level Custom RPC URL values that are supplied as worker secrets stay
worker-private during session publish/deploy. For worker-canonical sessions, the
worker attaches that URL only to an in-memory, non-serializable request config
for same-network SBT association/storage-gate checks and faucet execution. It is
loaded lazily for Cloudflare storage, so public/group/role reads do not depend on
the secret store. The Worker verifies `eth_chainId` before protected contract
reads and masks private endpoint details in errors and logs. Browser read
providers only use explicit browser-visible registry `rpcUrl` /
`rpcUrlsByChainId` values.

Standalone RPC API-key injection without a URL template is still unsupported.
The JSON-RPC proxy format (Authorization header vs URL template) needs a
separate design before the client can inject a bare key into on-chain JSON-RPC
calls.
