# Client Toolchain Install Contract After Browser Lit Removal

## Problem

The browser-side Lit SDK packages have now been removed from the active client runtime and dependency graph:

- `@lit-protocol/auth`
- `@lit-protocol/contracts`
- `@lit-protocol/lit-client`
- `@lit-protocol/networks`

That means the old Lit-specific peer-pressure is gone.

But the client still requires `legacy-peer-deps=true` for normal installs because `react-scripts@4.0.3` still advertises a TypeScript peer of `^3.2.1 || ^4`, while the client is on TypeScript `5.8.3`.

The strict verification command:

```bash
npm install --package-lock-only --legacy-peer-deps=false
```

still fails, but it now fails only for the CRA / TypeScript mismatch rather than for Lit browser packages.

Status note for the integration branch: the active `client/package.json` no longer
declares browser-side `@lit-protocol/*` packages. Any remaining install docs that
attribute the override to Lit package peers should be treated as documentation
drift; the current technical blocker is the CRA 4 / TypeScript 5 peer mismatch.

## What this means

We are closer to removing the install override because one entire source of peer-pressure is gone.

We are not done yet because the remaining blocker is still structural:

- `react-scripts@4`
- TypeScript `5.x`

## Goal

Remove the need for the client-wide `legacy-peer-deps` install contract, or reduce it to a consciously temporary transition step with a narrower blast radius.

## Proposed direction

1. Treat the current state as a cleaner baseline: no browser Lit SDK blockers remain.
2. Evaluate the least risky path off the remaining CRA/TypeScript mismatch:
   - move off `react-scripts@4`
   - or temporarily pin TypeScript back into CRA's supported range if that does not break ongoing TS modernization work
   - or move the client build/test toolchain to a maintained replacement with equivalent behavior
3. Keep the install contract explicit until the replacement path is proven by:
   - strict peer-resolution install
   - clean client build
   - clean targeted test slice

## Recommendation

Do not try to "solve" this by force-installing peers more aggressively.

The repo is in a better position now because the Lit browser cleanup reduced the problem to one clear toolchain incompatibility. The next step should be a focused client toolchain decision, not more compatibility shims around `react-scripts@4`.

## Acceptance criteria

- `npm install --legacy-peer-deps=false` succeeds in `client/`
- `npm run build` succeeds on the supported client toolchain
- targeted client Jest coverage still passes
- docs no longer need to describe a required install override

## Notes

- This PRD is narrower and cleaner because the Chipotle migration already removed the old browser Lit SDK dependency path.
- Any solution should avoid destabilizing the ongoing TS shell-cleanup lane more than necessary.
