# Client Build Asset Inventory

Last checked: 2026-07-21 with `npm --prefix client run build` and
`npm run client:bundle-budget:check`.

This page tracks current Vite outputs above 500 KiB and their stable source
owners. Output filenames are content-hashed, so this inventory records stable
source/module names rather than hashes that change after unrelated builds.

## Large Build Outputs

| Build output | Size | Source / owner | Current use | Safe next action |
| --- | ---: | --- | --- | --- |
| `build/assets/index-d2c14822.js` | 1,067.40 KB | app shell bundle | Main React entry and shared app shell code | Only remaining JS warning; further splits need bootstrap, wallet, contract, Arweave, or cache boundary review. |
| `build/assets/ce_circuit_logo-41136bba.png` | 1,883.03 KB | `client/src/assets/img/ce_circuit_logo.png` | SBT pages and tests | Keep; replacement/compression needs visual review. |
| `build/assets/magnifying_glass-faf43812.png` | 1,396.30 KB | `client/src/assets/img/magnifying_glass.png` | ToolExplorer visuals | Keep; candidate for future lazy media loading. |
| `build/assets/explainer_first-5c5b7870.png` | 1,363.02 KB | `client/src/assets/img/explainer_first.png` | Welcome/onboarding slides | Keep; candidate for future slide media optimization. |
| `build/assets/cip_photo-374b6724.png` | 999.48 KB | `client/src/assets/img/cip_photo.png` | About page | Keep; replacement/compression needs visual review. |
| `build/assets/art_header-db45a080.png` | 868.92 KB | `client/src/assets/img/art_header.png` | ToolExplorer visuals | Keep; candidate for future lazy media loading. |
| `build/assets/explainer_final-aa5bb4c6.png` | 849.57 KB | `client/src/assets/img/explainer_final.png` | Welcome/onboarding slides | Keep; candidate for future slide media optimization. |
| `build/assets/jump-ba6fd23f.png` | 810.90 KB | `client/src/assets/img/jump.png` | Welcome/onboarding slides | Keep; candidate for future slide media optimization. |
| `build/assets/beta_tab_robot-68a9427f.png` | 711.62 KB | `client/src/assets/img/beta_tab_robot.png` | Welcome/onboarding slides | Keep; candidate for future slide media optimization. |
| `build/assets/context_engine_logo_animation-138fda1b.gif` | 7,476.94 KB | `client/src/assets/img/context_engine_logo_animation.gif` | Navbar / SBT logo animation | Keep; replacement needs UX review because timing is part of current branding behavior. |
| `build/assets/context_engine_logo_animation_pingpong-443e0d17.gif` | 14,952.31 KB | `client/src/assets/img/context_engine_logo_animation_pingpong.gif` | Navbar / SBT logo animation variant | Keep; replacement needs UX review because timing is part of current branding behavior. |

Recent chunk split: the SurveyTool route bundle is now under the warning
threshold (`build/assets/SurveyTool-ca00a311.js`, 177.17 KB) after moving the
question-answering and pile surfaces behind lazy component boundaries.

## Source Assets Over 500 KB Not Emitted By The Client Build

| Source asset | Current use | Action |
| --- | --- | --- |
| `client/src/assets/img/readme-header.png` | Root `README.md` hero | Keep; GitHub renders it directly. |
| `client/src/assets/img/readme-architecture-deployment-modes.png` | Root `README.md` architecture diagram | Keep; GitHub renders it directly. |
| `client/public/about-demo.mp4` | About-page demo video on desktop and mobile | Keep; first-party playback avoids Google Drive iframe, cookie, and viewer-limit dependencies. |

## Reference Checks

Current owners for emitted media:

- `client/src/components/About/AboutPage.tsx`: `cip_photo.png`
- `client/src/components/About/AboutPage.tsx`: `client/public/about-demo.mp4`
- `client/src/components/MainContent/ToolExplorer.tsx`: `magnifying_glass.png`, `art_header.png`
- `client/src/components/MainContent/welcomeSlides.ts`: `explainer_first.png`, `beta_tab_robot.png`, `jump_transparent.png`, `seedsman_slim.jpg`, `explainer_final.png`
- `client/src/components/Navbar/Navbar.tsx`: both logo animation GIFs
- `client/src/components/SBTs/SbtPageFullView.tsx`: forward logo animation GIF
- `client/src/components/SBTs/SBTPage.tsx` and `client/src/components/SBTs/SBTsPage.tsx`: `ce_circuit_logo.png`

The logo GIFs remain 320×320 and keep their original 12.87-second and
25.75-second durations. They are encoded at 16 fps with a 16-color palette;
the navbar renders them at 40% opacity with `mix-blend-mode: luminosity`, so
exact source hues are not presented directly. Line detail and effective
luminance were compared at the 156 px maximum rendered size. The optimized pair
is about 7.13 MiB total, down from about 21.39 MiB. The timing, dimensions, loop
marker, frame counts, and byte ceilings are guarded by
`scripts/logo-gif-assets.test.js`.

Run `npm run verify:public-assets` to reject image files with no source, doc, or
data-manifest owner. Dynamic assets such as historical avatars must keep a
literal filename entry in their checked-in manifest.
