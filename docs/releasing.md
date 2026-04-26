# Releasing a Public Build

The public release artifact is a copy of the repo with all private/internal content stripped. It is produced by `scripts/prepare-public-release.sh` (see PRD 374).

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
make release RELEASE_DIR=./out   # custom output path
make release-clean           # delete the artifact
```

## Incremental public history sync

`scripts/sync-public-history.sh` expects a linear local `dev` branch on top of `origin/main`. It clones the repo into a temp workspace, replays each commit onto a fresh branch from `origin/main`, strips the same private paths used by the artifact exporter, audits author/committer identity, then imports the finished branch back into the source repo.

Important behavior:

- Public replay identity is always forced to `Agalmic <agalmicsoftware@protonmail.com>`
- The first sync run installs a repo-local `pre-push` hook that blocks `dev -> origin`
- Commits that only touch stripped paths are skipped automatically
- `--dry-run` lists which commits would replay vs skip without creating the replay branch
- `--push` pushes the resulting branch to `origin` and safely refreshes an existing remote target branch with `--force-with-lease` when needed
- `--source-branch <name>` lets you replay from a temporary rebased branch instead of your primary `dev`
- Existing local target branches still require `--force-with-lease` before the script rewrites them
- `--force-with-lease` remains accepted explicitly, and is required whenever the local target branch already exists
- Without `--push`, the script prints the follow-up `git push -u origin <branch>` command after importing the branch back into the local repo

Push safety:

- `make install-private-branch-guard` (or any `sync-public-history.sh` run) installs `.githooks/pre-push` and unsets any `dev` upstream so plain public pushes stay pointed at replay branches, not your private branch
- The replay branch is rebuilt from `origin/main`, not from `dev`
- Only the replayed public-safe commits become reachable from the branch you push
- The same strip patterns as `prepare-public-release.sh` are applied before every replayed commit is created

If `origin/<branch>` already exists, the script refreshes that PR branch automatically with `--force-with-lease`. If the remote branch was deleted but a stale local branch still exists, rerun with `--force-with-lease` so the script can safely rewrite the local branch before recreating the remote one.

If your local `dev` has not been rebased onto `origin/main` yet, create a temporary branch from `dev`, rebase that branch onto `origin/main`, and pass it via `--source-branch` so your day-to-day `dev` branch can stay untouched until you are ready.

## What gets stripped

The release script removes these paths from the exported copy:

| Path | Reason |
|------|--------|
| `TODO/` | Internal planning and PRDs |
| `contextEngine-cc/` | Claude Code extension (local dev tool) |
| `CLAUDE.md` | Maintainer AI instructions |
| `.claude/`, `.codex/` | AI agent skills and settings |
| `artifacts/` | Local test artifacts |
| `Demo Integration Package/` | Raw source data |
| `scripts/test-*.js`, `scripts/lib/e2e/` | E2E test layer |
| `whitepaper/Slides.pdf`, `whitepaper/IdeasMap.md` | Internal whitepaper assets |

A `private-pack.manifest.json` is generated in the output listing every stripped file with its SHA-256 checksum, so the strip can be verified or reversed.

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
2. Install the private-branch guard once with `make install-private-branch-guard` if you have not already
   - Any `make sync-public` / `make sync-public-push` run also installs it automatically
3. Run `make sync-public` or `bash scripts/sync-public-history.sh --push release-staging` to build or refresh the replayed public branch
   - If `release-staging` already exists locally, add `--force-with-lease`
4. Open or update the PR from `release-staging` into `main`
5. Choose the merge method intentionally: `Merge pull request` preserves the replayed `release-staging` commit SHAs on `main`, while `Rebase and merge` keeps `main` linear but assigns new SHAs
6. For the artifact workflow, run `make release` and then run the PII scan against the stripped output before publishing it
