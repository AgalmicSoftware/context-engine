# Design System

This file documents the named runtime theme contract used by component SCSS,
global compatibility styles, and browser-rendered visualizations.

## Sources Of Truth

- The exact required-token contract lives in `client/src/scss/themes/_contract.scss`.
- Named values live in `client/src/scss/themes/_context-engine.scss` and
  `client/src/scss/themes/_classic-95.scss`.
- Theme metadata and the closed runtime allowlist live in
  `client/src/scss/themes/registry.json`.
- Shared theme-aware control recipes live in `client/src/scss/themes/_recipes.scss`.
- `client/src/assets/css/contextEngine.scss` emits the theme package and keeps
  legacy `--ce-color-*` aliases during migration.
- `client/src/scss/_variables.scss` remains for structural/build-time Sass
  values. Do not add theme-dependent component values there.

## Runtime Resolution

The document root carries `data-ce-theme` and `data-ce-theme-source`. Resolution
order is:

1. explicit accessibility/user preference (`ce:theme` in local storage);
2. deployment default `REACT_APP_CE_DEFAULT_THEME`;
3. built-in `context-engine`.

`client/public/theme-bootstrap.js` applies user/deployment state before the app
bundle runs. `client/src/utilities/ui/themeRuntime.ts` validates and persists
only a bundled app-theme ID and emits `ce:theme-change` for SVG, canvas, and
chart consumers. Session metadata is not an app-theme resolution layer. Those
consumers must call `readThemeToken()` and subscribe with
`subscribeThemeChanges()` instead of maintaining a JavaScript palette.

The Settings selector is enabled by default. Set
`REACT_APP_CE_THEME_SELECTOR_ENABLED=false` only when a deployment intentionally
hides user theme selection. The preference remains restricted to the bundled
registry and cannot load CSS, URLs, or arbitrary token maps.

## Adding A Bundled Theme

1. Add a values-only SCSS definition beside the existing theme files.
2. Add one metadata entry to `registry.json`.
3. Include the definition once in `themes/_index.scss`.
4. Run the SCSS contract and contrast tests, the literal gate, the client build,
   and the route/viewports Playwright matrix documented below.

Every definition must supply exactly the keys in `_contract.scss`. Theme files
must not target component selectors. If several components need new behavior,
add a semantic token and a shared recipe. Optional textures, icons, and fonts
must be local, size-bounded, and appropriately licensed; proprietary
operating-system assets and fonts must not be copied.

The `--ce-layout-profile` contract token is the structural counterpart to the
palette and control tokens. The document root is the named `ce-theme` style
container, so components that genuinely change layout use
`@container ce-theme style(--ce-layout-profile: …)` instead of naming an app
theme ID. The `standard-app` profile keeps the existing application layout;
the `desktop-window` profile provides the compact window grammar used by the home
window, Control Panel applets, Statistics split pane, question dialog, login
control, and bottom taskbar. Keep ordinary color, spacing, and control changes
on their narrower semantic tokens rather than adding structural queries.

`classic-95` follows the owner's personal-site visual grammar—teal canvas,
gray raised/inset surfaces, navy title bars, square controls, and Tahoma-style
typography—without copying page markup or proprietary assets. Its leading font
is the locally bundled, LGPL-licensed Wine Tahoma face; native Tahoma, MS Sans
Serif, Arial, and generic sans-serif remain ordered fallbacks. Code and JSON
continue to use the separate monospace token.

The About hero follows the same profile without affecting the default theme:
page copy and actions use bundled Tahoma, the Demo action uses a navy raised
primary control, and New Session, the resource links, and the icon-only GitHub
action use standard gray raised controls with pressed and keyboard-focus
states.

Tool Explorer cards consume `--ce-tool-card-*` chrome tokens. Context Engine
keeps its layered blue depth treatment; `classic-95` uses a conventional
raised bevel, compact black shadow, and gray hover face without a colored halo.

Footer navigation consumes `--ce-footer-bar-*`, `--ce-footer-link-*`, and
`--ce-footer-copyright-*` tokens. Context Engine keeps its unframed spacing,
while `classic-95` presents a gray taskbar at the end of the document. Its
compact, icon-only **Start** button opens an upward Windows-style menu containing
the five route actions while retaining an accessible text label, and its larger
GitHub icon stays aligned at the taskbar's right edge. The taskbar is never fixed over page content: long pages reveal it only
after scrolling to the end, while short pages use the root flex layout to rest
it against the viewport bottom.

The embedded Welcome deck keeps navigation in a compact bottom strip at every
viewport size. Every slide uses the same viewport-capped frame height, so the
arrow targets do not move when headings, artwork, or copy change. The standard
app and desktop-window profiles retain their separately sized frames, while
slide headings stay horizontally centered in both. At standard full-screen
desktop widths, the opening artwork fills and centers within a taller shared
frame. Its navigation strip restores the larger pre-theme arrow scale, remains
visible in the initial viewport, and places the site footer below the fold.
The desktop-window profile retains its compact controls. Non-intro artwork consumes the
`--ce-welcome-artwork-detail-*` tokens: Context Engine retains the original
presentation while Classic 95 uses normal image blending, restrained partial
grayscale, and moderate opacity so the illustrations stay visible without
competing with the accessible HTML heading and bullet copy. The final Classic
95 action uses the theme's native control-face and control-text colors.

Account and Settings surfaces consume `--ce-settings-*` tokens for panel,
section, field, control, primary-text, muted-text, and placeholder pairings.
Classic 95 uses gray dialog surfaces, black primary copy, dark-gray secondary
copy, and white fields; visible Settings text is regression-tested at 4.5:1.

Question and survey creation surfaces consume `--ce-authoring-*` tokens for
their workspace, sections, controls, fields, primary copy, muted copy, and
placeholders. Keep these pairings together: Classic 95 uses standard gray
workspace surfaces, raised gray controls, white fields, and black/dark-gray
copy instead of placing Windows control text over the navy overlay palette.
The runtime theme smoke opens the complete question generator on desktop and
mobile and checks its visible control/text pairs at 4.5:1.

When the bundled-theme selector is enabled, Settings exposes it as the final
`Appearance & colors` section both before and after sign-in. This selector
changes the complete app theme; it is separate from a session's curated color
scheme and does not accept arbitrary color values. Its deployment option reads
`Deployment theme: <theme label>` for a valid embedded choice, or
`Deployment theme: default` when that choice cannot be named.

## Session Color Schemes

App themes and session color schemes are separate contracts. An app theme may
change the complete visual grammar. A session color scheme changes only
documented session accents and chrome and is stored as
`appearance.colorSchemeId`.

- The closed ID/label registry and fallback helper live in
  `client/src/utilities/ui/sessionColorSchemes.ts`.
- The only first-release IDs are `context-engine`, `ocean`, and `amber`.
- Bundled values live in
  `client/src/scss/session-color-schemes/_schemes.scss` and define exactly
  `--ce-session-accent`, `--ce-session-accent-hover`,
  `--ce-session-accent-contrast`, `--ce-session-chrome`,
  `--ce-session-chrome-contrast`, and `--ce-session-focus`.
- `AppShell` applies the ID on a declarative, `display: contents` scope only
  while a session route is active. Navigation replaces/removes that node
  attribute; no session scheme is written to `html` or `body`.
- An explicit user/accessibility app-theme preference suppresses the session
  scope. The active app theme's default session slots remain in effect.
- Current consumers are session header/title chrome, session-specific primary
  actions, and active/selected session chips. Status, risk, gate, validation,
  destructive-action, and data-series colors do not use these slots.
- To add a scheme, add one registry entry and one same-ID SCSS selector, then
  run the registry/SCSS/Worker parity and contrast tests. Do not add palette
  values to TypeScript or session metadata.

Standalone HTML/PDF result exports remain fixed-light and do not read app or
session appearance state.

## Semantic Token Families

Components consume meanings, not palette values. The two bundled theme maps
may therefore change color, typography, geometry, borders, elevation, and
control states without component selectors in a theme file.

| Family                 | Representative tokens                                                         | Intended use                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Canvas and surfaces    | `--ce-canvas`, `--ce-surface-*`, `--ce-card-*`                                | page, raised, sunken, and card chrome                                          |
| Documents              | `--ce-document-*`                                                             | readable light/document-style content                                          |
| Panel and overlay copy | `--ce-panel-text*`, `--ce-overlay-text*`                                      | foregrounds paired with panel or overlay surfaces                              |
| Controls               | `--ce-control-*`, `--ce-input-*`, `--ce-titlebar-*`, `--ce-nav-tab-inactive`  | inputs, buttons, disabled states, title bars, and inactive title-bar tab icons |
| Authoring               | `--ce-authoring-*`                                                           | paired question/survey workspace, section, control, input, and copy colors     |
| Actions and status     | `--ce-action-*`, `--ce-status-*`, `--ce-link`                                 | interactive, validation, risk, and state semantics                             |
| Data series            | `--ce-data-series-1` through `--ce-data-series-8`                             | categorical charts and visualizations                                          |
| Response states        | `--ce-response-agree-*`, `--ce-response-unsure-*`, `--ce-response-disagree-*` | readable vote-state badges on the active tooltip surface                       |
| Data visualization     | `--ce-data-viz-*`                                                             | plot surfaces, axes, labels, points, active points, and point strokes          |
| Brand media            | `--ce-brand-logo-*`, `--ce-recognition-logo-*`, `--ce-welcome-artwork-*` | theme-specific logo treatment plus a stable branded Welcome backdrop/blending  |
| Edges and elevation    | `--ce-border-*`, `--ce-edge-*`, `--ce-shadow-*`, `--ce-tool-card-*`           | flat, raised, inset, pressed, submit, and Tool Explorer card states            |
| Geometry               | `--ce-radius-*`, `--ce-border-control-width`, `--ce-control-padding-*`        | theme-selectable shape and control density                                     |
| Typography             | `--ce-font-*`, `--ce-font-button-weight`                                      | body, UI, mono, and control typography                                         |

The legacy `--ce-color-*` aliases remain only for source compatibility and
resolve through the active semantic contract. New code uses `--ce-*` semantic
tokens directly.

Component styles must not branch on `data-ce-theme`. If a visual needs to vary,
extend the exact semantic contract and consume the new token generically. The
SCSS contract test recursively enforces that rule. Semantic buttons which act
as full-frame presentation surfaces use
`data-ce-control-appearance="frameless"`; the shared recipe removes only raised
chrome and preserves normal focus-visible treatment.

The Docs route follows the same pairings end to end: page and section headers
use `--ce-titlebar-*`, prose cards use `--ce-document-*`, controls use
`--ce-control-*`, and source/prompt readers use `--ce-overlay-*`. Keep those
foreground/background pairs together so every bundled theme remains readable;
the app-theme Playwright smoke checks the rendered Docs pairs at 4.5:1.

## Typography

| Token                     | `context-engine`                | `classic-95`                        |
| ------------------------- | ------------------------------- | ----------------------------------- |
| `--ce-font-body`          | Poppins fallback stack          | bundled Wine Tahoma + system fallbacks |
| `--ce-font-ui`            | Open Sans fallback stack        | bundled Wine Tahoma + system fallbacks |
| `--ce-font-mono`          | system monospace fallback stack | Courier New fallback stack          |
| `--ce-font-button-weight` | `600`                           | `400`                               |

Guideline:

- Use `var(--ce-font-body)` or `var(--ce-font-mono)` directly in component rules.
- Sass font values in `_variables.scss` seed the default theme only. Component
  rules use runtime variables so changing `data-ce-theme` repaints without a
  reload.

## Spacing And Radius

Spacing tokens in `client/src/scss/_variables.scss`:

| Token         | Value  |
| ------------- | ------ |
| `$ce-space-1` | `4px`  |
| `$ce-space-2` | `8px`  |
| `$ce-space-3` | `12px` |
| `$ce-space-4` | `16px` |
| `$ce-space-5` | `24px` |

Radius tokens:

| Token           | Value   | Runtime Token      |
| --------------- | ------- | ------------------ |
| `$ce-radius-sm` | `4px`   | `--ce-radius-4`    |
| `$ce-radius-md` | `8px`   | `--ce-radius-8`    |
| `$ce-radius-lg` | `12px`  | `--ce-radius-12`   |
| n/a             | `6px`   | `--ce-radius-6`    |
| n/a             | `10px`  | `--ce-radius-10`   |
| n/a             | `999px` | `--ce-radius-pill` |

Guideline: component rules use runtime radius tokens. In `classic-95`, every
non-round radius slot resolves to square geometry; `context-engine` retains its
rounded scale. Sass radius values seed the default map and are not a component
theme API.

## Button Patterns

Primary button:

```scss
button {
  font-family: var(--ce-font-button);
  font-weight: var(--ce-font-button-weight);
  border-radius: var(--ce-radius-10);
  background: var(--ce-action-accent);
  color: var(--ce-action-accent-text);
}
```

Secondary / outline button:

```scss
button {
  font-family: var(--ce-font-button);
  font-weight: 600;
  border-radius: var(--ce-radius-10);
  border: var(--ce-border-control-width) solid var(--ce-card-border);
  background: var(--ce-card-bg);
  color: var(--ce-panel-text);
}
```

Pill action / status chip:

```scss
.chip {
  border-radius: var(--ce-radius-pill);
  background: var(--ce-card-bg);
  color: var(--ce-panel-text);
  font-family: var(--ce-font-mono);
}
```

Final submit / create CTA:

```scss
.ctaButton {
  @include finalSubmitCta.final-submit-cta-shell();
}

.ctaButtonContent {
  @include finalSubmitCta.final-submit-cta-content();
}
```

Use this shared blue CTA family for actual end-of-flow create and submit actions such as survey submission, survey creation, and SBT creation. Keep launcher/open-panel buttons on their existing primary or secondary treatments instead of reusing this pattern.

## Literal Ownership And Usage Rules

- Do not introduce hardcoded theme-semantic colors. The baseline is zero.
- The exact raw-value owners are the two bundled app-theme maps, the bundled
  session-scheme map, the deterministic fixed-light standalone export, the
  fixed-media QR/bitmap constants, and the deterministic blockie generator.
  The checker has no directory-wide or ad hoc exception mechanism.
- Fixed QR/bitmap colors are intentionally independent of app appearance for
  scanning and copied-image determinism. Standalone HTML/PDF exports remain
  fixed-light. Blockie colors are deterministic generated identity data, not
  interface chrome.
- JSX, SVG, canvas, maps, and chart presentation colors read the same runtime
  tokens as SCSS and subscribe to `ce:theme-change` when they retain pixels. Do
  not add a second TypeScript palette.

## Verification

From the repository root:

```bash
npm run theme:literals:check
npm run ai:test-theme:runtime
npm run ai:test-session:color-schemes
```

From `client/`:

```bash
npm test -- --watchAll=false --runTestsByPath \
  src/scss/themes/themeScssContract.test.ts \
  src/scss/themes/themeContrast.test.ts
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The runtime Playwright smoke covers the home Welcome/Login and Community Stats
surfaces, `/about`, `/session/new`, `/session/demo`, a simulated-user profile,
session Groups, `/docs`, `/demos`, and a not-found route at desktop and mobile
widths. It boots `classic-95`, switches to `context-engine`
without reload, and verifies palette, typography, geometry, modal chrome,
Session Wizard preview scope, Community Stats/tooltip contrast and data spread,
the shared compact non-blocking beeswarm hover card, and horizontal overflow.
Welcome geometry and theme-specific artwork/action styling are also checked at
the 735×803 feedback viewport plus compact, wide, and ultra-wide/short desktop
sizes so content, artwork, and the bottom controls cannot overlap or escape the
frame.
