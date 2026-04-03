# Licensing Map

This repository is intentionally multi-license.

The root [LICENSE](LICENSE) file contains the full `CPAL-1.0` text used for the CPAL-governed portions of the repo, but contributors should not assume that one file applies uniformly to every subtree. Use this document as the checked-in boundary map.

## Current Status

- The main client/app OSS surface is `CPAL-1.0`.
- The worker subtree is `MIT`.
- Third-party worker dependencies and tooling keep their own licenses; the worker subtree's MIT designation applies to the project's own worker-side code, not to third-party packages.

## Package And Subtree Map

| Path | Current treatment | Notes |
| --- | --- | --- |
| `client/` | `CPAL-1.0` | Main browser app/package. `client/package.json` already declares `CPAL-1.0`, and `client/LICENSE` points to the root CPAL text. |
| `ai-discourse-corpus/` | Mixed upstream rights; CC0-1.0 for project-authored annotations | No ownership is claimed over upstream linked/source material. See `ai-discourse-corpus/LICENSE.md` for the directory-specific rights notice covering summaries, tags, and structure. |
| `workers/` | MIT | Worker subtree. `workers/LICENSE` contains the MIT text for worker-side project code. |
| `workers/sessionCorsWorker/` | MIT | Cloudflare worker/tooling package. `workers/sessionCorsWorker/package.json` declares `MIT`, and `workers/sessionCorsWorker/LICENSE` points to the subtree MIT text. |
| `workers/deploy-helper/` | MIT | Helper worker source that stays on the worker side of the boundary. |
| Remaining root/client/contracts/docs material | `CPAL-1.0` unless a more specific local note says otherwise | The root `LICENSE` file and current package metadata still describe the CPAL-governed OSS surface outside the worker boundary called out here. |

This map is focused on the current client/worker split. It does not make a new licensing determination for other separately managed packages or internal companion tooling.

- The live worker import seam for `client/src/utilities/worker/adminTypedData.mjs` has been removed by duplicating that helper into `workers/sessionCorsWorker/adminTypedData.mjs`. Those two files now need to stay in sync intentionally until the shared shape is retired or moved to a separately managed shared module.

## Shared-File Rules

If a file or module is used on both sides of the client/worker boundary, it must be handled in one of these ways and recorded in code or nearby docs:

- Keep it under a common license that is acceptable to both sides.
- Dual-license it explicitly.
- Move it to a neutral shared package or location.
- Duplicate and separate the implementation so the seam goes away.

Do not assume a path alone settles the licensing question. Follow the more specific subtree/package note when one exists.

## How To Read The Root LICENSE

- The root [LICENSE](LICENSE) file remains the full `CPAL-1.0` text for the CPAL-governed portions of the repo.
- The worker subtree uses [workers/LICENSE](workers/LICENSE) for the MIT text that applies to worker-side project code.
- This file is the repo-level exception and boundary map for the client/worker split.
- If a local file or package note is more specific than the root default, follow the more specific note.

## Third-Party Images And Logos

The repository includes logos and brand images from third-party organizations under `client/src/assets/img/`. These images remain the copyright and/or trademarks of their respective owners and are not covered by the CPAL-1.0 or MIT licenses in this repository. They are used here for nominative reference and attribution purposes only and do not imply endorsement or affiliation. If a rights holder requests removal, the relevant assets will be taken down promptly.

Current third-party images:

- `metamask_icon_white.png` — MetaMask (ConsenSys). Used to identify the MetaMask wallet connection option.
- Font Awesome Free icons (`@fortawesome/*` packages) — icons under CC-BY-4.0, code under MIT, fonts under SIL OFL 1.1. See https://fontawesome.com/license/free.
- `polis_logo.png` — Pol.is / The Computational Democracy Project. Used in the About page recognition section.
- `rxc_logo.png` — RadicalxChange Foundation. Used in the About page recognition section.
