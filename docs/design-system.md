# Design System

This file documents the named runtime theme contract used by component SCSS,
global compatibility styles, and browser-rendered visualizations.

## Sources Of Truth

- The exact required-token contract lives in `client/src/scss/themes/_contract.scss`.
- Named values live in `client/src/scss/themes/_context-engine.scss`,
  `client/src/scss/themes/_classic-95.scss`, and `client/src/scss/themes/_civic.scss`.
- Theme metadata and the closed runtime allowlist live in
  `client/src/scss/themes/registry.json`.
- Shared theme-aware control recipes live in `client/src/scss/themes/_recipes.scss`.
- `client/src/assets/css/contextEngine.scss` emits the theme package and keeps
  legacy `--ce-color-*` aliases during migration.
- `client/src/scss/_variables.scss` remains for structural/build-time Sass
  values. Do not add theme-dependent component values there.

## Runtime Resolution

Session section headers show their action subtitles only while collapsed:
Groups uses “Join or Create”, and Context and Results use “View”. Expanding
a section removes its subtitle; collapsing it restores the subtitle. This
behavior is shared across all themes.

Below 768px, the session shell uses compact shared gutters and section gaps.
Expanded content avoids an extra padded wrapper, and the embedded report uses
smaller toolbar and content insets. Results controls retain 44px touch targets
and use the available width; desktop and standalone report spacing is unchanged.

Minimal question previews and response cards use panel text on light surfaces for
choice labels, freeform answers, rating values, comments, encrypted placeholders,
and aggregate summaries. Response stance pills keep their semantic background
and foreground colors.

The document root carries `data-ce-theme` and `data-ce-theme-source`. Resolution
order is:

1. explicit accessibility/user preference (`ce:theme` in local storage);
2. deployment default `REACT_APP_CE_DEFAULT_THEME`;
3. built-in Minimal (`civic`).

`client/public/theme-bootstrap.js` applies user/deployment state before the app
bundle runs. The October 2026 Minimal rollout clears a previously saved app
theme once on default/Minimal deployments, recording `ce:theme-default-version`
before paint. Later user choices are preserved, including across routine data
cache refreshes. Explicit non-Minimal deployment defaults retain their existing
preferences. The migration leaves color-vision, authentication, wallet, and
authored content storage untouched; blocked storage falls back to the retained
preference without interrupting startup.
`client/src/utilities/ui/themeRuntime.ts` validates and persists
only a bundled app-theme ID and emits `ce:theme-change` for SVG, canvas, and
chart consumers. Both set `<meta name="theme-color">` to the theme's
`themeColor` from `registry.json`, so the browser bar matches the page. Session metadata is not an app-theme resolution layer. Those
consumers must call `readThemeToken()` and subscribe with
`subscribeThemeChanges()` instead of maintaining a JavaScript palette.

The Settings selector is enabled by default. Set
`REACT_APP_CE_THEME_SELECTOR_ENABLED=false` only when a deployment intentionally
hides user theme selection. The preference remains restricted to the bundled
registry and cannot load CSS, URLs, or arbitrary token maps.

**Color-blind mode** is available in Settings → Theme, independently of the
theme selector. It persists locally as `ce:color-vision`, restores before paint,
and synchronizes across tabs. The shared palette uses blue for support/agree,
orange for oppose/disagree, and gray for unsure. Response labels and signed
values remain present. Semantic response, status, and chart-series tokens update
across all bundled themes; report text uses darker shades on white paper. Polis binary
bars use the same `--ce-binary-choice-*` tokens as the pile inputs. Report SVG
colors are resolved on the PDF capture clone so exports retain the preference.
The palette overlay lives in `scss/themes/_color-vision.scss`; categorical SVG
charts use `chartColors.ts` token references instead of fixed JavaScript colors.

Quadratic option scrolling uses `--ce-option-scroll-*` tokens for its yellow
navigation cues, including hover and disabled states. These controls retain the
same colors in Context Engine and Classic 95; Minimal uses a quiet blue-gray treatment.
They remain independent of response stance colors.
Their foreground/background pairs are contrast-tested at 4.5:1.

## Adding A Bundled Theme

1. Add a values-only SCSS definition beside the existing theme files.
2. Add one metadata entry to `registry.json`; its `themeColor` must equal the
   theme's `canvas` token.
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
theme ID. The `standard-app` profile keeps the existing application layout.
The `minimal-app` profile adds the restrained session and control layout used by Minimal.
The `desktop-window` profile provides the compact window grammar used by the home
window, Control Panel applets, Statistics split pane, question dialog, login
control, and bottom taskbar. Keep ordinary color, spacing, and control changes
on their narrower semantic tokens rather than adding structural queries.

Minimal is the default white theme. Its stable configuration and storage ID remains
`civic`, preserving existing saved selections. Select
**Minimal** in Settings → App theme, or use `REACT_APP_CE_DEFAULT_THEME=civic`
for a deployment default. It uses dark slate text, blue actions, subtle borders,
modest corner radii, sans-serif typography with system fallbacks, and flat surfaces.
Login and Submit share the brighter blue submit palette, including hover states.
Minimal Welcome slides use a white canvas, opaque artwork, dark copy, and blue navigation. White line-art illustrations are inverted only within this profile; color illustrations retain their original colors.
Article chart labels, totals, tooltips, code blocks, and expanded methodology use
explicit light-surface text pairs. Participant colors appear as swatches beside
readable quote labels.
Public profile section switchers use opaque muted text for their inactive labels
and dividers, retaining readable contrast on the white canvas.

The `minimal-app` layout profile centers session titles and their info controls in opaque dark-gray text,
using the same title margins, collapse height, and submit-rail offsets as Context
Engine, with the shared five-second fade and hover/focus reveal. Loading labels
use `--ce-loading-text`: black on the Minimal and Classic 95 light surfaces and
near-white in Context Engine. On mobile, Minimal uses a compact navigation header
with the visible logo artwork matched to the Login button's height while preserving
the account controls. The profile presents session
sections as a single column of compact rows, and removes decorative depth from
question cards and account controls. The home Explorer offers Stats, Tools, and
Welcome; Tools remains the default, including for a retained Latest-tab selection.
Session title tooltips share the Results description cleanup for retired RxC instructions.
Explorer tabs use blue selected/hover text
and dark inactive icons on the light header. Expanded Explorer controls, group
names, Context corpus cards, Risk Matrix details, and Debate Map labels use
explicit light-surface text pairs. Stats leaderboard addresses, detail dialogs,
and group filter controls also use these pairs. Debate details use light argument cards,
historical-case briefs, badges, and question previews. Existing answering, results, privacy, and
access workflows are preserved. Code and JSON retain a separate monospace font.
Question authoring uses readable type previews, form placeholders, option labels,
JSON/AI prompt panels, and disabled submit labels on light surfaces.
Native controls use a light color scheme before first paint; color-blind mode
uses the light-surface response palette. The contrast checks cover text,
controls, disabled actions, session chrome, and focus indicators; this is not a
claim of complete accessibility certification.

The Civic Account card uses a deep blue gradient with white account text and
actions. Inline account fields keep dark backgrounds and light text, validation
indicators, and focus outlines. This treatment is scoped to the Account card.

The Stats tab includes a Sessions count across the app's discovered registry
sessions, configured Worker sessions, and previously visited Worker sessions.
Opening it shows centralized and decentralized totals and a scrollable list of
session links. Classification follows canonical authority: Worker authority is
centralized and EVM registry authority is decentralized, even when a session also
uses the other backend for supporting services. Missing authority metadata is
shown as "Type unavailable." This directory is independent of the selected
session scope used by the other Stats counts. Its five summary buttons wrap to
three columns on narrow phones.
Stats, Users Details, and Settings share one Session dropdown with an adjacent
external-link icon. A concrete selection opens its session page in a new tab;
General opens the general session, while ALL and multi-session selections leave
the icon disabled. Worker links retain their validated discovery origin. Settings
shows this same control in its quick summary and keeps only advanced scope
editing behind Config.

Expanded tool headers place the primary Session chooser and session-page link
at the right edge, opposite Back and help. Groups and Context actions stay on a
separate row below; narrow phones give the chooser its own full-width row.
Selected and unselected options show `Name (slug)` to distinguish repeated
names. Context retains its local session override and explicit return to the
global default; its link follows the currently selected local session.
The Sessions dialog's header filter button opens type, creation-date range,
last-activity range, and admin-address filters. These combine immediately and
update the visible totals. Date ranges include both local calendar dates;
address matching ignores case and accepts partial addresses. Activity reflects
recorded session creation or updates, not when a local cache was refreshed.
Sessions with unavailable metadata are excluded only by the relevant active
filter. Clear filters restores the full directory.

The Consensus Difference chart and address leaderboard share one session section
with a name-and-slug caption above both. Combined views list selected sessions or
show "All sessions." Demo sessions use one shared demo caption; when only the chart
falls back to a different bundled demo, it retains a separate caption identifying
that source while the shared caption continues to identify the selected session.

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

When the bundled-theme selector is enabled, signed-in Settings exposes it
directly beneath the equal 2×2 Config, Session, Explainers, and Demo Mode quick
controls. At phone widths up to 480px, these controls stack into full-width rows
so the Session dropdown remains readable. Signed-out Settings keeps it in the final `Appearance & colors`
section. This selector changes the complete app theme; it is separate from a
session's curated color scheme and does not accept arbitrary color values. Its
default option reads `<theme label> (default)` for a valid embedded
choice, or `Default` when that choice cannot be named. Native dropdown options
use paired document text and surface colors for readability. The theme bar
uses the same border opacity as adjacent quick controls without dimming its
text. Opening Config scrolls its start into view only when clipped by the
screen or account dialog. Selected reasoning buttons retain the paired accent
text color even when session defaults disable editing.

At compact widths, Classic 95 uses the same question-action overflow trigger
as Context Engine when pending answers make room for Submit necessary. Its
menu opens above the toolbar on a raised surface.

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

Components consume meanings, not palette values. The bundled theme maps
may therefore change color, typography, geometry, borders, elevation, and
control states without component selectors in a theme file.

| Family                 | Representative tokens                                                         | Intended use                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Canvas and surfaces    | `--ce-canvas`, `--ce-surface-*`, `--ce-card-*`                                | page, raised, sunken, and card chrome                                          |
| Documents              | `--ce-document-*`                                                             | readable light/document-style content                                          |
| Panel and overlay copy | `--ce-panel-text*`, `--ce-overlay-text*`                                      | foregrounds paired with panel or overlay surfaces                              |
| Controls               | `--ce-control-*`, `--ce-input-*`, `--ce-titlebar-*`, `--ce-nav-tab-inactive`  | inputs, buttons, disabled states, title bars, and inactive title-bar tab icons |
| Authoring              | `--ce-authoring-*`                                                            | paired question/survey workspace, section, control, input, and copy colors     |
| Actions and status     | `--ce-action-*`, `--ce-status-*`, `--ce-link`                                 | interactive, validation, risk, and state semantics                             |
| Data series            | `--ce-data-series-1` through `--ce-data-series-8`                             | categorical charts and visualizations                                          |
| Response states        | `--ce-response-agree-*`, `--ce-response-unsure-*`, `--ce-response-disagree-*` | readable vote-state badges on the active tooltip surface                       |
| Data visualization     | `--ce-data-viz-*`                                                             | plot surfaces, axes, labels, points, active points, and point strokes          |
| Brand media            | `--ce-brand-logo-*`, `--ce-recognition-logo-*`, `--ce-welcome-artwork-*`      | theme-specific logo treatment plus a stable branded Welcome backdrop/blending  |
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

| Token                     | `context-engine`                | `classic-95`                           |
| ------------------------- | ------------------------------- | -------------------------------------- |
| `--ce-font-body`          | Poppins fallback stack          | bundled Wine Tahoma + system fallbacks |
| `--ce-font-ui`            | Open Sans fallback stack        | bundled Wine Tahoma + system fallbacks |
| `--ce-font-mono`          | system monospace fallback stack | Courier New fallback stack             |
| `--ce-font-button-weight` | `600`                           | `400`                                  |

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
- The exact raw-value owners are the bundled app-theme maps, the
  color-vision palette overlay, the bundled session-scheme map, the
  deterministic fixed-light standalone export, the fixed-media QR/bitmap
  constants, and the deterministic blockie generator.
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
surfaces, `/about`, `/session/new`, `/session/demo-sh`, a simulated-user profile,
session Groups, `/docs`, `/demos`, and a not-found route at desktop and mobile
widths. It boots `classic-95`, switches to `context-engine`
without reload, and verifies palette, typography, geometry, modal chrome,
Session Wizard preview scope, Community Stats/tooltip contrast and data spread,
the shared compact non-blocking beeswarm hover card, and horizontal overflow.
The Settings default-label check follows the deployment theme embedded in the
page, including Minimal. Session demos require working local demo data and RPC
access; a cache initialization failure prevents those route checks from running.
Welcome geometry and theme-specific artwork/action styling are also checked at
the 735×803 feedback viewport plus compact, wide, and ultra-wide/short desktop
sizes so content, artwork, and the bottom controls cannot overlap or escape the
frame.

For Minimal Explorer tab labels, session choice-state contrast, clear control, centered title with timed fade, report
readability, and login-size regression smoke, start a local server with demo surfaces
enabled and run `BASE_URL=http://127.0.0.1:3000 npm run ai:test-theme:civic`.
The smoke covers desktop and mobile Explorer cards and all five expanded tools,
including the eight Context corpus categories, Risk Matrix details, and Debate Map
circle/tree/list views and expanded historical-case briefs with question previews.
Stats checks cover the expanded participant list, detail dialogs, group filters,
session scope labels, session filters and clearing, and session totals, links, and keyboard scrolling through
the directory. About checks cover the hero title and copy against the rendered panel
and the page's 16px of top spacing below the navbar.
Wizard checks cover both hosting profiles, every setup
step, custom settings, local group drafts, group selectors, and contract previews.
Participation-channel checks open each question-mark tooltip and verify that
help preserves the checkbox states and explains agent access without Telegram.
The deployment summary uses evenly sized cards on wider screens and full-width
label-and-value rows at 720px and below. Smoke checks cover its contrast, wrapping,
and mobile row spacing for both hosting profiles.
Session checks include encryption audience menus, group
details, comments, conviction controls, question filters, tag menus, and the voice
mode chooser/setup. Manual authoring checks cover all five question types, survey
fields, and JSON/AI prompt panels. It checks rendered text contrast with ancestor opacity, translucent surfaces,
gradient stops, and text-field fill colors included. It never deploys a session,
submits responses, or starts recording.
