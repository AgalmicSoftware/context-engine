# Releasing Public History or Artifacts

The 2026-07-06 M1 release shipped through a history-preserving
`release-staging` PR into public `main`. `origin/main` advanced to merge commit
`dc2974152`, preserving 436 public-safe commits since `cee385f5d` plus the
GitHub merge commit. Use this replay flow when public history must preserve the
reviewable commit narrative.

This repo supports two public-release workflows:

- `scripts/sync-public-history.sh` replays `dev` commits onto public `main`
  one-by-one so GitHub shows readable per-commit diffs.
- `scripts/prepare-public-release.sh` builds a stripped working-tree artifact
  in `release-public/`; use it as the canonical tip-parity artifact and as the
  fallback when full-history replay sweeps are not green.

Separately, `.github/workflows/publish-worker-bundles.yml` rebuilds the
Cloudflare worker fallback bundles on every push to public `main`/`master`,
publishes them as GitHub release assets, and explicitly marks that
worker-bundle release as the repo's latest release so the client default bundle
URL at `releases/latest/download/sessionCorsWorker.bundle.js` keeps resolving
to fresh assets.

The artifact exporter copies tracked files plus untracked files that are not ignored by git, then applies the private strip list. Ignored local files such as keys, caches, build output, generated media, and previous release folders are skipped before the strip phase.

## Quick start

```bash
# History-preserving public branch replay, the M1 path
make install-private-branch-guard
bash scripts/sync-public-history.sh --dry-run release-candidate
make release
npm run verify:public-release-pii -- release-public
bash scripts/sync-public-history.sh --push release-staging

# Stripped release artifact and fallback
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

Full-history replay guardrails:

- Build a fresh canonical artifact with `make release` and scan it with
  `npm run verify:public-release-pii -- release-public` before publishing a
  replay branch.
- Compare the replay tip tree to the canonical artifact. If a diverged replay
  drops merge-resolution diffs, keep the replayed commits for provenance and
  add one final `chore: true-up public tree to release artifact` commit that
  makes the tip byte-identical to the artifact before running gates.
- Sweep every replayed commit, not just the tip, for stripped/private path
  names such as `TODO/`, private planning docs, private companion tooling,
  private worker paths, private E2E runners, and local secret baselines.
- Sweep replayed commit messages for private planning IDs and stripped path
  names. Use `--sanitize-private-replay-messages` only when the underlying
  patch is public-safe.
- Verify replay identities independently with
  `git log --format='%ae%n%ce' <base>..<branch> | sort -u`; the only expected
  email is `[redacted-email]`.
- Do not proceed with a history-preserving push unless tip parity, full-history
  content/message sweeps, identity checks, PII scan, wiring, type-debt, and
  public Node tests are green. If those checks are not green, ship the single
  artifact branch first and repair replay history separately.

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

The scanner fails on email addresses outside known public metadata/contact surfaces, local home-directory paths, concrete secret assignments, PEM private-key blocks, and private-key-shaped 64-hex values. It warns on package-lock/corpus contact emails and bare `0x` values because published maintainer contacts, contract addresses, transaction hashes, and demo IDs may be legitimate public data.

## Workflow

1. Develop on local `dev` with private/internal files present where needed
2. Install the private-branch guard once with `make install-private-branch-guard` if you have not already
   - Any `make sync-public` / `make sync-public-push` run also installs it automatically
3. Run `make release` and `npm run verify:public-release-pii -- release-public`
   to create the canonical stripped artifact for tip parity
4. Run `make sync-public` or `bash scripts/sync-public-history.sh --push release-staging` to build or refresh the replayed public branch
   - If `release-staging` already exists locally, add `--force-with-lease`
   - The command fails before push if any public source file still imports a stripped private path, if test wiring or type-debt checks fail, or if public Node tests fail
5. Run the full-history replay guardrails above before asking the operator to push or merge
6. Open or update the PR from `release-staging` into `main`
7. Choose the merge method intentionally: `Merge pull request` preserves the replayed `release-staging` commit SHAs on `main`, while `Rebase and merge` keeps `main` linear but assigns new SHAs
8. For the artifact-only fallback, replace the `release-staging` tree with
   `release-public/`, commit `chore: refresh release staging source`, verify
   the public tree, and open the PR from that branch instead of replaying
   history
