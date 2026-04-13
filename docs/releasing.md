# Releasing Public History or Artifacts

This repo now supports two public-release workflows:

- `scripts/prepare-public-release.sh` builds a stripped working-tree artifact in `release-public/`
- `scripts/sync-public-history.sh` replays `dev` commits onto public `main` one-by-one so GitHub shows readable per-commit diffs

Use the history-sync flow when you want a public PR with preserved commit narrative. Use the artifact flow when you need a standalone stripped copy of the repo.

## Quick start

```bash
# Per-commit public branch replay
make sync-public
make sync-public-push
bash scripts/sync-public-history.sh --dry-run release-candidate
bash scripts/sync-public-history.sh --push release-staging
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
- Commits that only touch stripped paths are skipped automatically
- `--dry-run` lists which commits would replay vs skip without creating the replay branch
- `--push` pushes the resulting branch to `origin`
- `--source-branch <name>` lets you replay from a temporary rebased branch instead of your primary `dev`
- `--force-with-lease` safely refreshes an existing PR branch such as `release-staging`
- Without `--push`, the script prints the follow-up `git push -u origin <branch>` command after importing the branch back into the local repo

Push safety:

- The replay branch is rebuilt from `origin/main`, not from `dev`
- Only the replayed public-safe commits become reachable from the branch you push
- The same strip patterns as `prepare-public-release.sh` are applied before every replayed commit is created

If `origin/<branch>` already exists, rerun with `--force-with-lease` to refresh that PR branch safely instead of creating a new one.

If your local `dev` has not been rebased onto `origin/main` yet, create a temporary branch from `dev`, rebase that branch onto `origin/main`, and pass it via `--source-branch` so your day-to-day `dev` branch can stay untouched until you are ready.

## What gets stripped

Both workflows remove these paths from the public result:

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
2. Run `make sync-public` or `bash scripts/sync-public-history.sh --push release-staging` to build a replayed public branch
3. If the PR already exists, rerun with `--push --force-with-lease release-staging` to refresh the same branch
4. Open or update the PR and use GitHub's `Rebase and merge` option when landing it on `main`
5. For the artifact workflow, run `make release` and then run the PII scan against the stripped output before publishing it
