.PHONY: release release-clean sync-public sync-public-push install-private-branch-guard

RELEASE_DIR ?= ./release-public

## Build a public release artifact with private content stripped.
## Output lands in $(RELEASE_DIR) (default: ./release-public).
release:
	bash scripts/prepare-public-release.sh --force $(RELEASE_DIR)

## Remove the release artifact.
release-clean:
	rm -rf $(RELEASE_DIR)

## Replay dev commits onto public main as a per-commit public branch.
sync-public:
	bash scripts/sync-public-history.sh

## Replay dev commits onto public main and create or refresh the branch on origin.
## Use --force-with-lease if the local target branch already exists.
sync-public-push:
	bash scripts/sync-public-history.sh --push

## Install the local git hook that blocks pushing the private dev branch to origin.
install-private-branch-guard:
	bash scripts/install-private-branch-guard.sh
