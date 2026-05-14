# Sponsored Resource Keys

This doc covers how AI, Arweave, RPC, faucet, and Lit payer keys are stored and routed.

## Where keys live

Group-level secrets now live in worker secrets (not in Arweave metadata):

- AI provider keys (Anthropic/OpenAI/OpenRouter) → worker secrets.
- Arweave wallet JWK → worker secret.
- Faucet private key → worker secret.
- Lit payer private key (+ derived payer address/status) → worker secret / admin worker status route.
- RPC gateway key (PATH) → worker secret (if/when enabled).

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

Session-level Custom RPC URL values are stored as worker secrets and, when
sponsored worker secrets are enabled during session publish/deploy, mirrored to
the registry `rpcUrl` field so browser read providers can hydrate questions and
SBTs through the same session-specific endpoint. Treat that URL as client-visible
after publish; use a session-scoped or otherwise browser-safe RPC URL/key.

Standalone RPC API-key injection without a URL template is still unsupported.
The JSON-RPC proxy format (Authorization header vs URL template) needs a
separate design before the client can inject a bare key into on-chain JSON-RPC
calls.
