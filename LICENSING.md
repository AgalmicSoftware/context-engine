# Project license

Project-authored code is licensed under **MPL-2.0** throughout: the browser
client, Workers, deployment package, contracts, tools, shared modules and
repository add-ons. The root [LICENSE](LICENSE) contains the complete Mozilla
Public License Version 2.0. Contributions to project code use MPL-2.0.

Earlier releases keep the licenses they shipped with. Deployed contracts keep
their verified source notices; newly distributed source uses MPL-2.0.

## Package and material map

| Material | License | Notes |
| --- | --- | --- |
| Root tools, `client/`, `mcp/`, `ai-discourse-bench/`, `shared/` and add-ons | MPL-2.0 | The root license applies to project code. |
| `workers/` | MPL-2.0 | Includes the Session Worker, Agent Bridge, deploy helper and shared Worker modules. |
| `deploy/cloudflare/session-worker/` | MPL-2.0 for project code | The standalone package includes the project license and bundled dependency notices in `THIRD_PARTY_NOTICES.md`. |
| `contracts/` and `foundry/` | MPL-2.0 | Source files carry matching SPDX identifiers. |
| Repository documentation | MPL-2.0 | Except material with a specific third-party or corpus notice. |
| `ai-discourse-corpus/` annotations | CC0-1.0 | Project-authored summaries, tags and structure are dedicated under [the corpus notice](ai-discourse-corpus/LICENSE.md). Upstream source material retains its own rights. |
| Third-party dependencies, fonts, images and logos | Their own licenses | Preserve the notices described below. |

## Shared-file rules

Project modules can share code under the root MPL-2.0 license. Third-party and
CC0 material must retain its source, license and attribution notices when
copied, bundled or shared; moving it into a project directory does not change
those rights.

The `adminTypedData.mjs` wrappers inject hashing utilities into shared EIP-712
rules in `shared/auth/`. The client uses ethers v5 and the Session Worker uses
v6; sharing rules preserves that dependency boundary.

## Third-Party Dependencies

Third-party dependencies retain their own licenses. Package metadata, lockfiles, vendored notices, and upstream project notices should be checked before redistributing dependency code or bundled artifacts.

The Session Worker deploy package generates `THIRD_PARTY_NOTICES.md` from its
esbuild input packages, preserving each package's version, license and full
license text. Template verification checks these notices against the bundle.
The released Session Worker, deploy-helper and Agent Bridge JavaScript bundles
also carry their own generated notices in a trailing comment, so installations
and copies retain them. Inputs with no local license file must have a full
license grant in their README, or be an ethers v5 subpackage whose exact version
and repository match the installed umbrella package's shared license. Missing
license evidence fails the build.
The add-on's vendored `ethers.umd.min.js` is ethers 5.7.2 under MIT; its notice
is kept beside it in `ethers.LICENSE.md`. The add-on's MPL-2.0
license applies to project-authored code.

The Classic 95 theme bundles Wine Tahoma regular and bold font files under
`client/src/assets/fonts/classic-95/`. These are the Wine project's
Tahoma-compatible fonts, copyright Larry Snyder and based on Bitstream Vera
Sans. They are licensed under `LGPL-2.1-or-later`, independently of the root
`MPL-2.0` license. The matching license, source files, checksums, and upstream
provenance are kept in that directory.

The product film under `media/product-film/fonts/` bundles Latin subsets of
Poppins (copyright 2020 The Poppins Project Authors) and JetBrains Mono
(copyright 2020 The JetBrains Mono Project Authors), taken from the Fontsource
npm packages. They are licensed under the SIL Open Font License 1.1,
independently of the root `MPL-2.0` license. The license texts are kept in that
directory.

## Third-Party Images And Logos

The repository includes logos and brand images from third-party organizations under `client/src/assets/img/`. These images remain the copyright and/or trademarks of their respective owners and are not covered by the `MPL-2.0`, MIT, or CC0 notices in this repository. They are used here for nominative reference and attribution purposes only and do not imply endorsement or affiliation. If a rights holder requests removal, the relevant assets will be taken down promptly.

Current third-party images:

- `metamask_icon_white.png` - MetaMask (ConsenSys). Used to identify the MetaMask wallet connection option.
- Font Awesome Free icons (`@fortawesome/*` packages) - icons under CC-BY-4.0, code under MIT, fonts under SIL OFL 1.1. See https://fontawesome.com/license/free.
- `polis_logo.png` - Pol.is / The Computational Democracy Project. Used in the About page recognition section.
- `rxc_logo.png` - RadicalxChange Foundation. Used in the About page recognition section.

## Dependency license check

After installing root, client, MCP and Session Worker dependencies, run
`npm run -s license:check`. This builds the client, MCP, Session Worker, Agent Bridge
and deploy helper to capture their exact inputs. Released Worker bundles must
end with their complete generated notices. The check reads installed production packages plus
packages in the esbuild metafiles and Vite's emitted module IDs, including
bundled development dependencies, attributed to the tree that installed them.
It uses their installed license metadata,
accepts the reviewed permissive/MPL allowlist, and fails on missing or
unrecognized licenses. Version-specific exceptions and their
source evidence live in `scripts/license-overrides.json`; upgrades require
another review when metadata or versions change; an override for a version no
longer installed fails the gate. CI runs this check after
installing all four trees. Dependencies retain their own licenses and notices.

The client license inventory is written to `dist/client.bundled-module-ids.json`
for local analysis. It is not part of the published `client/build` directory;
resolved module paths can include local symlink or hoisted dependency locations.
