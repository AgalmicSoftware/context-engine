# Client Build Asset Inventory

Last checked: 2026-05-18 with `npm --prefix client run build`.

This page tracks build outputs above 500 KB after the Vite cutover. Do not remove,
compress, or replace these assets without checking the listed owners. Most of the
large image files are user-visible product or onboarding media, so the safe
near-term action is lazy-loading or intentional replacement, not deletion.

## Large Build Outputs

| Build output | Size | Source / owner | Current use | Safe next action |
| --- | ---: | --- | --- | --- |
| `build/assets/index-49a15236.js` | 1,068.43 KB | app shell bundle | Main React entry and shared app shell code | Continue route-boundary splitting; no single obvious mechanical split remains. |
| `build/assets/SurveyTool-6d7b63b5.js` | 751.66 KB | SurveyTool route bundle | Survey/question authoring and response runtime | Split only at established SurveyTool view/helper boundaries. |
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

## Source Assets Over 500 KB Not Emitted By The Client Build

| Source asset | Current use | Action |
| --- | --- | --- |
| `client/src/assets/img/readme-header.png` | Root `README.md` hero image | Keep; not emitted by Vite client build. |

## Reference Checks

Current source references proving the emitted image assets are used:
- `client/src/components/About/AboutPage.tsx`: `cip_photo.png`
- `client/src/components/MainContent/ToolExplorer.tsx`: `magnifying_glass.png`, `art_header.png`
- `client/src/components/MainContent/welcomeSlides.ts`: `explainer_first.png`, `beta_tab_robot.png`, `jump.png`, `explainer_final.png`
- `client/src/components/Navbar/Navbar.tsx`: `context_engine_logo_animation.gif`, `context_engine_logo_animation_pingpong.gif`
- `client/src/components/SBTs/SBTPage.tsx` and `client/src/components/SBTs/SBTsPage.tsx`: `ce_circuit_logo.png`, logo animation assets
- `client/src/variables/appConfig.ts`: animation timing comments for the logo GIFs
