# test/

This is the source-of-truth root test directory for non-client contract and Node-side harnesses.

Path roles at repo root:

- `script/` = Foundry Solidity deploy scripts
- `scripts/` = JS/Python tooling, E2E runners, audits, and automation
- `test/` = source-of-truth Foundry and root Node test files
- `tests/` = index/symlink view over selected test surfaces

Typical contents here:

- Foundry Solidity suites such as `*.t.sol`, `*.fuzz.t.sol`, and `*.invariant.t.sol`
- root `node:test` suites for workers, deploy helpers, and integration harnesses
- shared root test helpers under `test/helpers/`

If you want the indexed/symlinked overview surface used by some tooling, see [`../tests/`](../tests/).
