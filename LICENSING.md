# Licensing Map

This repository is intentionally multi-license.

The public open-source core is licensed under `MPL-2.0`. The root [LICENSE](LICENSE) file contains the standard Mozilla Public License Version 2.0 text. Files or directories with their own license notices remain under those notices. Contributions to `MPL-2.0`-covered files are accepted under `MPL-2.0` unless otherwise stated. Third-party dependencies retain their own licenses.

## Current Status

- The public open-source core is `MPL-2.0` by default.
- The worker subtree is `MIT`.
- Project-authored annotations in `ai-discourse-corpus/` are dedicated under `CC0-1.0`.
- Files with explicit SPDX identifiers or local license notices remain under those notices.
- Third-party dependencies, assets, and tooling keep their own licenses.

## Package And Subtree Map

| Path | Current treatment | Notes |
| --- | --- | --- |
| `LICENSE` | `MPL-2.0` | Standard MPL 2.0 text for the public open-source core default. |
| `package.json` / `package-lock.json` | `MPL-2.0` | Root package metadata for repo-level project code and tooling unless a more specific notice applies. |
| `client/` | `MPL-2.0` | Main browser app/package. `client/package.json` declares `MPL-2.0`, and `client/LICENSE` points to the root MPL text. |
| Repository docs/spec prose | `MPL-2.0` unless a more specific local note says otherwise | The previous map treated remaining docs/spec material as part of the root default license. No separate documentation-content license notice was found. |
| Files with `SPDX-License-Identifier: MIT` | MIT | Explicit file-level notices control, including Solidity contracts, deployment scripts, and contract tests that carry MIT SPDX headers. |
| `workers/` | MIT | Worker subtree. `workers/LICENSE` contains the MIT text for worker-side project code. |
| `workers/sessionCorsWorker/` | MIT | Cloudflare worker/tooling package. `workers/sessionCorsWorker/package.json` declares `MIT`, and `workers/sessionCorsWorker/LICENSE` points to the subtree MIT text. |
| `workers/deploy-helper/` | MIT | Helper worker source that stays on the worker side of the boundary. |
| `ai-discourse-corpus/` | Mixed upstream rights; `CC0-1.0` for project-authored annotations | No ownership is claimed over upstream linked/source material. See `ai-discourse-corpus/LICENSE.md` for the directory-specific rights notice covering summaries, tags, and structure. |

This map does not override more specific file, directory, package, or third-party notices.

The duplicated `client/src/utilities/worker/adminTypedData.mjs` and `workers/sessionCorsWorker/adminTypedData.mjs` helpers intentionally sit on opposite sides of the client/worker license boundary. Keep them in sync intentionally until the shared shape is retired or moved to a separately managed shared module.

## Shared-File Rules

If a file or module is used across license boundaries, it must be handled in one of these ways and recorded in code or nearby docs:

- Keep it under a common license that is acceptable to both sides.
- Dual-license it explicitly.
- Move it to a neutral shared package or location.
- Duplicate and separate the implementation so the seam goes away.

Do not assume a path alone settles the licensing question. Follow the more specific subtree/package/file notice when one exists.

## How To Read The Root LICENSE

- The root [LICENSE](LICENSE) file is the full `MPL-2.0` text for the public open-source core default.
- The worker subtree uses [workers/LICENSE](workers/LICENSE) for the MIT text that applies to worker-side project code.
- The AI discourse corpus uses [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md) for its CC0 project-authored annotation notice and upstream-rights disclaimer.
- This file is the repo-level exception and boundary map.
- If a local file or package note is more specific than the root default, follow the more specific note.

## Third-Party Dependencies

Third-party dependencies retain their own licenses. Package metadata, lockfiles, vendored notices, and upstream project notices should be checked before redistributing dependency code or bundled artifacts.

## Third-Party Images And Logos

The repository includes logos and brand images from third-party organizations under `client/src/assets/img/`. These images remain the copyright and/or trademarks of their respective owners and are not covered by the `MPL-2.0`, MIT, or CC0 notices in this repository. They are used here for nominative reference and attribution purposes only and do not imply endorsement or affiliation. If a rights holder requests removal, the relevant assets will be taken down promptly.

Current third-party images:

- `metamask_icon_white.png` - MetaMask (ConsenSys). Used to identify the MetaMask wallet connection option.
- Font Awesome Free icons (`@fortawesome/*` packages) - icons under CC-BY-4.0, code under MIT, fonts under SIL OFL 1.1. See https://fontawesome.com/license/free.
- `polis_logo.png` - Pol.is / The Computational Democracy Project. Used in the About page recognition section.
- `rxc_logo.png` - RadicalxChange Foundation. Used in the About page recognition section.
