# Releasing a Public Build

This repo now supports two public-release workflows:

- `scripts/prepare-public-release.sh` builds a stripped artifact from the tracked checkout in `release-public/`
- `scripts/sync-public-history.sh` replays `dev` commits onto public `main` one-by-one so GitHub shows readable per-commit diffs

Separately, `.github/workflows/publish-worker-bundles.yml` rebuilds the Cloudflare worker fallback bundles on every push to public `main`/`master`, publishes them as GitHub release assets, and explicitly marks that worker-bundle release as the repo's latest release so the client default bundle URL at `releases/latest/download/sessionCorsWorker.bundle.js` keeps resolving to fresh assets.

Use the history-sync flow when you want a public PR with preserved commit narrative. Use the artifact flow when you need a standalone stripped copy of the repo.

## Quick start

```bash
# Per-commit public branch replay
make sync-public
make sync-public-push
make verify-public-branch
bash scripts/sync-public-history.sh --dry-run release-candidate
bash scripts/sync-public-history.sh --push release-staging
# Still accepted for compatibility, but no longer required
bash scripts/sync-public-history.sh --push --force-with-lease release-staging

# Stripped release artifact
make release                 # output in ./release-public/
make release RELEASE_DIR=./out   # custom output path
make release-clean           # delete the artifact

# Verify a branch/ref after any manual public-branch edits
bash scripts/verify-public-branch.sh release-staging
```

## Incremental public history sync

`scripts/sync-public-history.sh` expects a linear local `dev` branch on top of `origin/main`. It clones the repo into a temp workspace, replays each commit onto a fresh branch from `origin/main`, strips the same private paths used by the artifact exporter, audits author/committer identity, then imports the finished branch back into the source repo.

Important behavior:

- Public replay identity is always forced to `Agalmic <agalmicsoftware@protonmail.com>`
- Commits that only touch stripped paths are skipped automatically
- `--dry-run` lists which commits would replay vs skip without creating the replay branch
- `--push` pushes the resulting branch to `origin` and safely refreshes an existing remote target branch with `--force-with-lease` when needed
- `--source-branch <name>` lets you replay from a temporary rebased branch instead of your primary `dev`
- Existing local target branches still require `--force-with-lease` before the script rewrites them
- `--force-with-lease` remains accepted explicitly, and is required whenever the local target branch already exists
- Without `--push`, the script prints the follow-up `git push -u origin <branch>` command after importing the branch back into the local repo

Push safety:

- The replay branch is rebuilt from `origin/main`, not from `dev`
- Only the replayed public-safe commits become reachable from the branch you push
- The same strip patterns as `prepare-public-release.sh` are applied before every replayed commit is created

If `origin/<branch>` already exists, the script refreshes that PR branch automatically with `--force-with-lease`. If the remote branch was deleted but a stale local branch still exists, rerun with `--force-with-lease` so the script can safely rewrite the local branch before recreating the remote one.

If your local `dev` has not been rebased onto `origin/main` yet, create a temporary branch from `dev`, rebase that branch onto `origin/main`, and pass it via `--source-branch` so your day-to-day `dev` branch can stay untouched until you are ready.

If you manually patch `release-staging` after replaying history, run `make verify-public-branch` before pushing. It checks the tracked tree for any files that still match the public strip list.

## What gets stripped

The release script removes these paths from the exported copy:

| Path | Reason |
|------|--------|
| `TODO/` | Internal planning and PRDs |
| `CLAUDE.md`, `.claude/`, `.codex/` | Maintainer-only AI instructions and local skill/config state |
| `contextEngine-cc/`, `local-private-version/`, `video-clickthrough-local/` | Private or local-only companion tooling |
| `.env.e2e*`, `artifacts/`, `tests/artifacts/` | Local test inputs and generated artifacts |
| `.tmp-review/` | Temporary review or migration snapshot files that are not part of the public source tree |
| `Demo Integration Package/`, `whitepaper/Slides.pdf`, `whitepaper/IdeasMap.md` | Raw source data and internal whitepaper assets |
| `scripts/test-*.js`, `scripts/test-*.ui.js`, `scripts/lib/e2e/`, `scripts/run-e2e-*`, `scripts/run-ux-*`, `scripts/capture-ux-*`, `scripts/build_external_llm_prompt.py` | Private/local automation and prompt handoff scripts |
| `client/src/components/MainSite/MainSite.module.test.js`, `client/src/utilities/worker/sessionCorsWorker.*.proxy.test.js`, `client/src/utilities/web3/contractScripts.*.proxy.test.js`, `test/contextEngineCc.sw-cache-policy.test.mjs` | Internal or private-only regression tests |
| `private-pack.manifest.json` | Stripped from the source-tree copy and replaced with a fresh manifest for the export |

A `private-pack.manifest.json` is generated in the output listing every stripped file with its SHA-256 checksum, so the strip can be verified or reversed.

The artifact exporter copies tracked files from the current checkout and intentionally ignores untracked scratch files.

## PII scan

After building the artifact, run a PII and secrets scan before publishing:

```bash
cd release-public

# Email addresses
rg -n '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' --type-not binary

# Wallet addresses
rg -n '0x[0-9a-fA-F]{40}' --type-not binary

# Home directory paths
rg -n '/Users/|/home/' --type-not binary

# Secrets
rg -n -i '(api[_-]?key|secret|password|token|credential)\s*[:=]' --type-not binary

# Internal hostnames
rg -n '(\.internal|\.local|\.corp|\.private)' --type-not binary
```

Review each match. Published contract addresses, `localhost`, and `example.com` are typically safe.

## Workflow

1. Develop on local `dev` with private/internal files present where needed
2. Run `make sync-public` or `bash scripts/sync-public-history.sh --push release-staging` to build or refresh the replayed public branch
   - If `release-staging` already exists locally, add `--force-with-lease`
3. If you manually cherry-pick or patch the public branch afterward, run `make verify-public-branch` before pushing
4. Open or update the PR from `release-staging` into `main`
5. Choose the merge method intentionally: `Merge pull request` preserves the replayed `release-staging` commit SHAs on `main`, while `Rebase and merge` keeps `main` linear but assigns new SHAs
6. For the artifact workflow, run `make release` and then run the PII scan against the stripped output before publishing it
