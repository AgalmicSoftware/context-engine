# Dependency Audit Hotspots

This page records the package audit decisions that should remain visible during release hygiene work.

## Production Audit Gates

Run these from the repository root after dependency changes:

```bash
npm audit --omit=dev
cd client && npm audit --omit=dev
cd workers/sessionCorsWorker && npm audit --omit=dev
cd contextEngine-cc && npm audit --omit=dev
```

The root package has no production dependencies. The client, worker, and CE-CC packages are the meaningful production audit surfaces.

## Fixed Hotspots

- `client` uses `viem@2.50.3`, which resolves the production `viem -> ws` audit path to `ws@8.20.1`.
- `workers/sessionCorsWorker` keeps `ethers@6.15.0` and uses narrow overrides for `ethers -> ws@8.20.1` and `arweave -> asn1.js -> bn.js@4.12.3`.

## Accepted Residuals

`client` and `contextEngine-cc` intentionally remain on `ethers@5.7.2`. Current npm audit output still reports low-severity `ethers@5`/`elliptic` findings, including `GHSA-848j-6mx2-7j84`, through `@ethersproject/signing-key`.

That residual is accepted only while the root/client/CE-CC wallet stack still requires ethers v5 compatibility. Revisit it when an ethers v6-compatible wallet migration is approved, or if ethers v5 receives a compatible patched signing-key path.

Full client audits can also report development-server findings through Vite/esbuild. Those belong to the client dev tooling upgrade track; production release checks should still use `npm audit --omit=dev`.
