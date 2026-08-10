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

The Settings selector is implemented behind
`REACT_APP_CE_THEME_SELECTOR_ENABLED=false`. Enable it only after that
deployment's required route, responsive, and accessibility matrix passes.

## Adding A Bundled Theme

1. Add a values-only SCSS definition beside the existing theme files.
2. Add one metadata entry to `registry.json`.
3. Include the definition once in `themes/_index.scss`.
4. Run the SCSS contract test, client build, route matrix, and contrast checks.

Every definition must supply exactly the keys in `_contract.scss`. Theme files
must not target component selectors. If several components need new behavior,
add a semantic token and a shared recipe. Optional textures and icons must be
local, size-bounded, and appropriately licensed; operating-system assets and
fonts must not be copied.

`classic-95` follows the owner's personal-site visual grammar—teal canvas,
gray raised/inset surfaces, navy title bars, square controls, and system-safe
Tahoma/MS Sans Serif fallbacks—without copying page markup or proprietary
assets.

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

## Color Palette

| Token | Value | Notes |
| --- | --- | --- |
| `--ce-color-primary` / `$ce-primary` | `#e14eca` | primary brand accent |
| `--ce-color-accent` / `$ce-clickable` | `#4dffa4` | interactive accent, active state, highlight |
| `--ce-color-info` / `$ce-info` | `#1d8cf8` | info / utility blue |
| `--ce-color-success` / `$ce-success` | `#2dce89` | positive status |
| `--ce-color-warning` / `$ce-warning` | `#ff8d72` | warning accent |
| `--ce-color-error` / `$ce-error` | `#ff4757` | error accent |
| `--ce-color-dark` / `$ce-dark` | `#212529` | dark text on light surfaces |
| `--ce-color-white` / `$ce-white` | `#ffffff` | high-contrast text and white surfaces |
| `--ce-color-panel-bg` / `$ce-panel-bg` | `#171941` | deep panel / page background |
| `--ce-color-panel-text` / `$ce-panel-text` | `#f4f7ff` | elevated panel copy |
| `--ce-color-panel-text-muted` / `$ce-muted-text` | `rgba(244, 247, 255, 0.65)` | secondary panel copy |
| `--ce-color-card-bg` / `$ce-card-bg` | `rgba(255, 255, 255, 0.06)` | glass card surface |
| `--ce-color-card-border` / `$ce-card-border` | `rgba(255, 255, 255, 0.14)` | glass card border |
| `--ce-color-input-bg` / `$ce-input-bg` | `rgba(255, 255, 255, 0.08)` | default input fill |
| `--ce-color-input-border` / `$ce-input-border` | `rgba(255, 255, 255, 0.16)` | default input border |
| `--ce-color-input-border-strong` / `$ce-input-border-strong` | `rgba(255, 255, 255, 0.18)` | stronger input border |

Shared shadow:

| Token | Value | Notes |
| --- | --- | --- |
| `--ce-shadow-card` / `$ce-card-shadow` | `0 6px 22px rgba(0, 0, 0, 0.25)` | default elevated card shadow |

## Typography

| Token | Value | Usage |
| --- | --- | --- |
| `--ce-font-body` / `$ce-font-body` | `'Poppins', sans-serif` | general body copy |
| `--ce-font-mono` / `$ce-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace` | ids, metadata, code-like UI |
| `--ce-font-button` / `$ce-font-button` | `'Poppins', sans-serif` | interactive controls |
| `$ce-font-button-weight` | `600` | default button emphasis |

Guideline:

- Use `var(--ce-font-body)` or `var(--ce-font-mono)` directly in component rules.
- Use the Sass font tokens when a file already depends on `@use "scss/variables"`.

## Spacing And Radius

Spacing tokens in `client/src/scss/_variables.scss`:

| Token | Value |
| --- | --- |
| `$ce-space-1` | `4px` |
| `$ce-space-2` | `8px` |
| `$ce-space-3` | `12px` |
| `$ce-space-4` | `16px` |
| `$ce-space-5` | `24px` |

Radius tokens:

| Token | Value | Runtime Token |
| --- | --- | --- |
| `$ce-radius-sm` | `4px` | `--ce-radius-4` |
| `$ce-radius-md` | `8px` | `--ce-radius-8` |
| `$ce-radius-lg` | `12px` | `--ce-radius-12` |
| n/a | `6px` | `--ce-radius-6` |
| n/a | `10px` | `--ce-radius-10` |
| n/a | `999px` | `--ce-radius-pill` |

Guideline:

- Prefer the existing runtime radius tokens (`var(--ce-radius-*)`) in component rules.
- Use the Sass aliases for documentation or when a shared literal is needed before runtime.

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

## Usage Rules

- Do not introduce new hardcoded theme-semantic colors. Run
  `npm run theme:literals:check`; its per-file baseline can only stay level or
  move down. App-theme definitions and the session-color-scheme SCSS owner are
  excluded because they are the approved raw value sources.
- Do not replace one-off contextual colors unless they recur and map cleanly to an existing token.
- Keep fixed QR, export, chain/network, and categorical data colors only when
  their semantics require stability, and document the reason near the value.
- JSX/SVG/canvas/chart presentation colors use the runtime adapter. Do not add
  a second TypeScript palette.
