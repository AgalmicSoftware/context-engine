# Releasing a Public Build

The public release artifact is a copy of the repo with all private/internal content stripped. It is produced by `scripts/prepare-public-release.sh` (see PRD 374).

## Quick start

```bash
make release                 # output in ./release-public/
make release RELEASE_DIR=./out   # custom output path
make release-clean           # delete the artifact
```

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

1. Develop on a local branch with all private files present (they are gitignored)
2. Run `make release` to build a stripped artifact
3. Run the PII scan against the artifact
4. Copy the artifact contents into the repo, commit, and push
