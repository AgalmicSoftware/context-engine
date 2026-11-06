# Sponsored Resource Keys

This doc covers how AI, Arweave, RPC, faucet, and Lit keys are stored and routed.

## Where keys live

Keys live in worker secrets, not in session metadata:

- AI provider keys (OpenAI, Anthropic, OpenRouter) → `openaiKey`, `anthropicKey`, `openrouterKey`.
- Arweave wallet JWK → `arweaveJwk`.
- Faucet private key → `faucetPrivateKey`.
- Lit account and usage API keys → `litAccountApiKey`, `litUsageApiKey`. The
  Worker generates its own Lit signing key (`litAuthorizationPrivateKey`); admins
  cannot set or read it.
- Custom RPC URL, including any provider credential embedded in its path →
  `customRpcUrl`.

`/session/new` strips these keys from the metadata it uploads, and the client
ignores AI and Arweave keys found in older metadata.

## Local overrides

Settings can override the AI key, RPC API key (reserved), and Arweave JWK. These
overrides are held in memory only and are cleared on reload. The AI model and
provider choices persist in `localStorage`, without the plaintext key.

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
