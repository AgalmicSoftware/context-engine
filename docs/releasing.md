# Releasing Public History or Artifacts

This repo now supports two public-release workflows:

- `scripts/prepare-public-release.sh` builds a stripped working-tree artifact in `release-public/`
- `scripts/sync-public-history.sh` replays `dev` commits onto public `main` one-by-one so GitHub shows readable per-commit diffs

Separately, `.github/workflows/publish-worker-bundles.yml` rebuilds the Cloudflare worker fallback bundles on every push to public `main`/`master`, publishes them as GitHub release assets, and explicitly marks that worker-bundle release as the repo's latest release so the client default bundle URL at `releases/latest/download/sessionCorsWorker.bundle.js` keeps resolving to fresh assets.

Use the history-sync flow when you want a public PR with preserved commit narrative. Use the artifact flow when you need a standalone stripped copy of the repo.

The artifact exporter copies tracked files plus untracked files that are not ignored by git, then applies the private strip list. Ignored local files such as keys, caches, build output, generated media, and previous release folders are skipped before the strip phase.

## Quick start

```bash
# Per-commit public branch replay
make install-private-branch-guard
make sync-public
make sync-public-push
bash scripts/sync-public-history.sh --dry-run release-candidate
bash scripts/sync-public-history.sh --push release-staging
# Still accepted for compatibility, but no longer required
bash scripts/sync-public-history.sh --push --force-with-lease release-staging

# Stripped release artifact
make release                 # output in ./release-public/
npm run verify:public-release-pii -- release-public
make release RELEASE_DIR=./out   # custom output path
make release-clean           # delete the artifact
```

## Incremental public history sync

`scripts/sync-public-history.sh` expects a linear local `dev` branch on top of `origin/main`. It clones the repo into a temp workspace, replays each commit onto a fresh branch from `origin/main`, strips the same private paths used by the artifact exporter, audits author/committer identity, then imports the finished branch back into the source repo.

Important behavior:

- Public replay identity is always forced to `Agalmic <[redacted-email]>`
- The first sync run installs a repo-local `pre-push` hook that allows only `main`, `release-staging*`, and tags to be pushed to public remotes. Remote deletions are still allowed for cleanup.
- Commits that only touch stripped paths are skipped automatically
- `--dry-run` lists which commits would replay vs skip without creating the replay branch
- Before the replayed branch is imported or pushed, `scripts/verify-public-release-surface.js` scans public JavaScript/TypeScript imports, exports, dynamic imports, and `require(...)` calls and fails if any public file resolves into a stripped path such as `contextEngine-cc/`
- `--push` pushes the resulting branch to `origin` only after the strip, planning-path, identity, public-surface import, public `npm run test:wiring`, public `npm run type-debt:check`, and public `npm run test:node` audits pass, and safely refreshes an existing remote target branch with `--force-with-lease` when needed
- `--source-branch <name>` lets you replay from a temporary rebased branch instead of your primary `dev`
- Existing local target branches still require `--force-with-lease` before the script rewrites them
- `--force-with-lease` remains accepted explicitly, and is required whenever the local target branch already exists
- Without `--push`, the script prints the follow-up `git push -u origin <branch>` command after importing the branch back into the local repo
- Legacy internal planning identifiers in commit messages are allowed during replay when the commit still contains public-safe changes. Prefer rewriting new commit messages before sync, but do not force public-history replay to fail only because an old subject/body has a planning ID.

Push safety:

- `make install-private-branch-guard` (or any `sync-public-history.sh` run) installs `.githooks/pre-push` and unsets any `dev` upstream so plain public pushes stay pointed at replay branches, not your private branch
- The replay branch is rebuilt from `origin/main`, not from `dev`
- Only the replayed public-safe commits become reachable from the branch you push
- The guard has no environment-variable bypass for private branch publication; leaked protected branches can still be deleted remotely.
- CI intentionally does not trigger on `dev`; add public verification through replay branches or pull requests to `main`, not by pushing private branches to GitHub.
- The same strip patterns as `prepare-public-release.sh` are applied before every replayed commit is created
- The public-surface import verifier uses the same strip-pattern helper, so newly stripped paths automatically become invalid import targets from public files
- The replayed public tree runs `npm run test:wiring`, `npm run type-debt:check`, and `npm run test:node` before push with the source checkout's `node_modules` linked into the temporary public checkout when available, so public-copy inventory, boundary/type-debt baselines, and stripped-path assumptions fail locally before PR CI

Baseline monotonicity:

- The CI `wiring-and-release` job runs `scripts/check-baseline-monotonicity.mjs` against the PR base SHA, or `origin/main` for push events
- `scripts/client-boundaries-baseline.json` may shrink or stay flat, but must not gain violation entries
- `scripts/type-debt-baseline.json` may shrink or stay flat, but must not increase any count
- Intentional checker-rule rollouts that need a larger baseline must include `[allow-baseline-growth]` in the PR title/body or commit message; the CI step still prints the growth it allowed

If `origin/<branch>` already exists, the script refreshes that PR branch automatically with `--force-with-lease`. If the remote branch was deleted but a stale local branch still exists, rerun with `--force-with-lease` so the script can safely rewrite the local branch before recreating the remote one.

If your local `dev` has not been rebased onto `origin/main` yet, create a temporary branch from `dev`, rebase that branch onto `origin/main`, and pass it via `--source-branch` so your day-to-day `dev` branch can stay untouched until you are ready.

## What gets stripped

Both workflows remove these paths from the public result:

| Path | Reason |
|------|--------|
| `TODO/` | Internal planning |
| `contextEngine-cc/` | Claude Code extension (local dev tool) |
| `docs/agent-native*.md` | Private agent-native contract docs |
| `docs/*PRD*.md`, `docs/*prd*.md` | Internal planning docs |
| `client/public/skill.md` | Private agent skill artifact |
| `workers/agentBridgeWorker/` | Private agent bridge worker |
| `CLAUDE.md` | Maintainer AI instructions |
| `.claude/`, `.codex/`, `.codex-artifacts/`, `.codex-solc/`, `.codex-tmp/` | AI agent skills, settings, caches, and scratch artifacts |
| `video-clickthrough-local/` | Durable local video workflow scripts and handoff notes |
| `.tmp-review/` | Temporary review snapshots / scratch files |
| `.secrets.baseline` | Local secret-scan baseline with private path names |
| `.env`, `.env.local`, `.env.*.local`, `.keys/`, `.e2e-secrets/`, `.e2e-cache/` | Local environment files, keys, and E2E secret/cache material |
| `artifacts/`, `output/` | Local test and generated media artifacts |
| `dist/`, `out/`, `cache/`, `broadcast/`, `coverage/`, `.npm-cache*`, `release-public/` | Generated build, dependency, and previous release outputs |
| `.DS_Store`, `docs/codebase-*.md`, `docs/assets/codebase-*`, `docs/*PRD*.md`, `docs/*prd*.md` | Local macOS metadata, ignored codebase audit exports, and private planning docs |
| `private-pack.manifest.json` (tracked repo copy) | Generated strip inventory should not ship from the dev tree |
| `Demo Integration Package/` | Raw source data |
| `scripts/test-*.js`, `scripts/seed-*.js`, `scripts/start-playwright-server.js`, `scripts/e2e/`, `scripts/lib/e2e/`, `scripts/run-agent-bridge-worker-tests.js`, `scripts/vendor-cecc-ethers-bundle.js`, `tests/root/*.private.test.*` | E2E/private helper scripts and private root tests |
| `whitepaper/Slides.pdf`, `whitepaper/IdeasMap.md` | Internal whitepaper assets |

For the artifact workflow, a fresh `private-pack.manifest.json` is generated in the output listing stripped files with SHA-256 checksums, so the strip can be verified or reversed. Private planning paths are deliberately omitted from that public manifest so roadmap filenames and planning IDs are not exposed. Any tracked repo-root copy is stripped before publish. Root npm script entries that point at stripped private test runners are also removed so public package scripts do not advertise missing private files.

## PII scan

After building the artifact, run the public PII and secrets scanner before publishing:

```bash
npm run verify:public-release-pii -- release-public
```

The scanner fails on email addresses, local home-directory paths, concrete secret assignments, PEM private-key blocks, and private-key-shaped 64-hex values. It warns on bare `0x` values because published contract addresses, transaction hashes, and demo IDs are often legitimate public data.

## Workflow

1. Develop on local `dev` with private/internal files present where needed
2. Install the private-branch guard once with `make install-private-branch-guard` if you have not already
   - Any `make sync-public` / `make sync-public-push` run also installs it automatically
3. Run `make sync-public` or `bash scripts/sync-public-history.sh --push release-staging` to build or refresh the replayed public branch
   - If `release-staging` already exists locally, add `--force-with-lease`
   - The command fails before push if any public source file still imports a stripped private path, if test wiring or type-debt checks fail, or if public Node tests fail
4. Open or update the PR from `release-staging` into `main`
5. Choose the merge method intentionally: `Merge pull request` preserves the replayed `release-staging` commit SHAs on `main`, while `Rebase and merge` keeps `main` linear but assigns new SHAs
6. For the artifact workflow, run `make release` and then `npm run verify:public-release-pii -- release-public` against the stripped output before publishing it
