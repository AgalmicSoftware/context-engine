# Client Build Asset Inventory

Last checked: 2026-07-10 with `npm --prefix client run build`.

This page tracks current Vite outputs above 500 KiB and their stable source
owners. Output filenames are content-hashed, so this inventory records stable
source/module names rather than hashes that change after unrelated builds.

## Large Build Outputs

| Build output family | Current size | Source / owner | Safe next action |
| --- | ---: | --- | --- |
| `AppShell-*.js` | 1,106.77 KiB | Main app shell and shared route runtime | Continue route/vendor boundary work; do not raise the bundle budget to hide growth. |
| `ce_circuit_logo-*.png` | 1,838.90 KiB | `client/src/assets/img/ce_circuit_logo.png` | Keep; replacement or compression needs visual review. |
| `magnifying_glass-*.png` | 1,363.57 KiB | `client/src/assets/img/magnifying_glass.png` | Keep; candidate for future lazy media loading or lossless optimization. |
| `explainer_first-*.png` | 1,331.07 KiB | `client/src/assets/img/explainer_first.png` | Keep; candidate for welcome-slide media optimization. |
| `cip_photo-*.png` | 976.05 KiB | `client/src/assets/img/cip_photo.png` | Keep; replacement or compression needs visual review. |
| `art_header-*.png` | 848.55 KiB | `client/src/assets/img/art_header.png` | Keep; candidate for future lazy media loading. |
| `explainer_final-*.png` | 829.66 KiB | `client/src/assets/img/explainer_final.png` | Keep; candidate for welcome-slide media optimization. |
| `beta_tab_robot-*.png` | 694.94 KiB | `client/src/assets/img/beta_tab_robot.png` | Keep; candidate for welcome-slide media optimization. |
| `context_engine_logo_animation-*.gif` | 2,433.21 KiB | Navbar / SBT loading animation | Keep within the checked dimensions, timing, and byte budget. |
| `context_engine_logo_animation_pingpong-*.gif` | 4,865.64 KiB | Navbar ping-pong animation | Keep within the checked dimensions, timing, and byte budget. |

The `SurveyTool-*.js` route bundle is currently about 160.69 KiB, below the
warning threshold. The old opaque `jump.png` is no longer referenced or emitted;
the goals slide uses `jump_transparent.png` (about 232.73 KiB source/output).

## Large Source Assets Not Emitted By Vite

| Source asset | Current use | Action |
| --- | --- | --- |
| `client/src/assets/img/readme-header.png` | Root `README.md` hero | Keep; GitHub renders it directly. |
| `client/src/assets/img/readme-architecture-deployment-modes.png` | Root `README.md` architecture diagram | Keep; GitHub renders it directly. |

## Reference Checks

Current owners for emitted media:

- `client/src/components/About/AboutPage.tsx`: `cip_photo.png`
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
