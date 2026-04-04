.PHONY: release release-clean

RELEASE_DIR ?= ./release-public

## Build a public release artifact with private content stripped.
## Output lands in $(RELEASE_DIR) (default: ./release-public).
release:
	bash scripts/prepare-public-release.sh --force $(RELEASE_DIR)

## Remove the release artifact.
release-clean:
	rm -rf $(RELEASE_DIR)
