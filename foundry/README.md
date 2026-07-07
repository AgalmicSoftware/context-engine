# foundry/

Foundry-specific Solidity entry points live here so the repo root can keep the
plural `scripts/` and `tests/` directories for general automation and root
test harnesses.

Foundry itself still uses the conventional singular directory names inside this
folder:

- `foundry/script/` contains Solidity deployment scripts used by `forge script`.
- `foundry/test/` contains Solidity Forge suites such as `*.t.sol`,
  `*.fuzz.t.sol`, and `*.invariant.t.sol`.

The active paths are configured in [`../foundry.toml`](../foundry.toml). Add new
Solidity deploy scripts under `foundry/script/` and new Forge tests under
`foundry/test/`.
