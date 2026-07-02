# ADR-0001: Client Domain Boundaries

## Status

Accepted.

## Context

Large route/page components used to import concrete low-level modules from
`client/src/utilities/{arweave,storage,web3,worker}` directly. That made page code
own transport details, contract method shapes, worker authentication wiring, and
test-spy compatibility at the same time.

The client boundary checker now treats route/page imports from those low-level
homes as `route-page-no-low-level` violations and treats pass-through facade
files as `no-passthrough-facade` violations. Existing debt is tracked in
`scripts/client-boundaries-baseline.json`; new entries fail, resolved entries
also fail until the baseline is pruned in the same commit.

## Decision

Use this boundary shape for client runtime code:

```text
Route/Page UI
  -> optional page-owned runtime wiring
  -> domain-specific ports and pure planners in client/src/domains/**
  -> concrete low-level utilities
```

Concrete imports and delegation are allowed in `client/src/domains/**` and
`client/src/app/runtime/**`. Route/page code should call a typed domain operation
or pure planner rather than importing a low-level utility directly.

Port adapters that wrap object-style modules such as `contractScripts` must use
call-time property lookup. Tests use `jest.spyOn(contractScripts, ...)`, so
capturing method references at module initialization would break the supported
late-binding behavior.

## Constraints

- Do not add pass-through barrels or one-line delegation modules outside
  `client/src/domains/**` or `client/src/app/runtime/**`.
- Do not introduce `(...args: unknown[])` signatures or `as unknown as` casts in
  domain port code.
- Prefer small purpose ports over broad adapters.
- Keep shared semantics in one tested base. Extend an existing domain port when it
  already owns the low-level operation.
- When a baseline entry is cleared, prune `scripts/client-boundaries-baseline.json`
  in the same commit.
- When type-debt counts shrink, re-bank `scripts/type-debt-baseline.json` in the
  same commit.

## Current Domain Homes

- `client/src/domains/sbts/`: SBT metadata reads, mint execution, and group mint
  authorization ports backed by `contractScripts`.
- `client/src/domains/sessions/`: session config, session media URL helpers,
  publish reducer/ports/adapters, and session registry read/write ports.
- `client/src/domains/storage/`: admin Arweave reads/uploads/URL helpers.
- `client/src/domains/worker/`: admin worker URL/CORS/auth/SIWE helpers.
- `client/src/app/runtime/`: application runtime construction that legitimately
  owns low-level setup imports.

## Consequences

The boundary checker is intentionally heuristic. It is not a substitute for
review, but it makes dishonest moves noisy: renaming route/page code or hiding
low-level calls behind local facade files no longer clears architecture debt.

The remaining boundary baseline represents explicit modernization backlog, not
permission to add adjacent coupling.
