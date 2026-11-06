# Visual Identity / Component Style Guide

Source patterns:
- `client/src/components/UserPage/UserPage.module.scss`
- Shared token values from `client/src/assets/css/contextEngine.scss`

Use `UserPage` as the default for new page-level UI, with shared token values for cross-surface consistency.

Scope: the colors and fonts below are the values of the Context Engine (dark)
theme. The default theme is Minimal, and the `--ce-color-*` names are aliases
that resolve through the active theme. Component styles read `--ce-*` tokens, not
hex values; `npm run theme:literals:check` rejects new hard-coded colors. See
[design-system.md](design-system.md).

## 1. Color System

### Core surfaces

| Token / variable | Value | Use |
| --- | --- | --- |
| `--ce-color-bg` | `#20204e` | full-page app background |
| `--ce-color-surface` | `#1f2251` | default dark panel / card surface |
| `--ce-color-surface-alt` | `#272b65` | light-side neumorphic shadow / raised edge |
| `$user-page-background` | `#171941` | UserPage-local page backdrop |
| `$card-bg` | `rgba(255, 255, 255, 0.06)` | default overlay card fill |
| `$input-background-color` | `rgba(255, 255, 255, 0.08)` | form controls |
| `$stat-item-background` | `rgba(255, 255, 255, 0.12)` | badges, stat pills, active chips |

### Text and accents

| Token / variable | Value | Use |
| --- | --- | --- |
| `--ce-color-white` / `$user-page-text-color` | `#ffffff` | primary text |
| `rgba(244, 247, 255, 0.65)` | `rgba(244, 247, 255, 0.65)` | muted metadata |
| `$clickable-color` / `--ce-color-accent` | `#4dffa4` | hover, links, active emphasis |
| `--ce-color-info` | `#1d8cf8` | info state |
| `--ce-color-indigo` / `$light-blue` | `#5e72e4` | avatars, indigo labels |
| `--ce-color-yellow` | `#ffd600` | vote counts, high-attention accents |

### Recommended usage

```scss
.surfaceCard {
  background: var(--ce-color-surface); /* #1f2251 */
  color: var(--ce-color-white); /* #ffffff */
}

.overlayCard {
  background: var(--ce-card-bg); /* rgba(255, 255, 255, 0.06) */
  border: 1px solid var(--ce-card-border); /* rgba(255, 255, 255, 0.14) */
}
```

## 2. Elevation & Depth (Neuomorphic Shadows)

### Primary shadow recipes

| Pattern | Shadow |
| --- | --- |
| UserPage standard card | `0 6px 22px rgba(0, 0, 0, 0.25)` (`--ce-card-shadow`) |
| Neumorphic edges | `--ce-shadow-neumorphic-dark` and `--ce-shadow-neumorphic-light` |

### Snippet

```scss
.pageCard {
  background: var(--ce-card-bg);
  border: 1px solid var(--ce-card-border);
  box-shadow: var(--ce-card-shadow);
}
```

## 3. Typography

### Font usage

| Role | Font |
| --- | --- |
| stats, IDs, addresses, compact metadata | `var(--ce-font-mono)` = `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace` |
| regular body copy | inherit parent/body font; global token is `var(--ce-font-body)` = `'Poppins', sans-serif` |

### Weight patterns

- `600`: prompts, section headers, key labels
- `700`: card titles, badge labels, icons paired with text
- `800`: compact summary headings only

## 4. Spacing & Breakpoints

### Breakpoint system

| Range | Intent |
| --- | --- |
| `0-319px` | ultra-compact |
| `320-465px` | small phone |
| `466-768px` | tablet / large phone |
| `769-1366px` | desktop |
| `1367px+` | wide desktop |

### Spacing rules

- Outer page padding: `20px` by default, `10px` on mobile (`UserPage`).
- Section/list padding: `10px` on small screens, `20-25px` once space opens up.

## 5. Card Patterns

### A. Standard page card (`UserPage` default)

```scss
.pageCard {
  background: var(--ce-card-bg);
  border: 1px solid var(--ce-card-border);
  border-radius: var(--ce-radius-12);
  box-shadow: var(--ce-card-shadow);
  padding: 20px;
}
```

### B. Inputs

```scss
.input {
  background: var(--ce-input-bg);
  border: 1px solid var(--ce-input-border);
  border-radius: var(--ce-radius-6);
  color: var(--ce-panel-text);
}
```

Prefer `var(--ce-radius-10)` to `var(--ce-radius-14)` for page sections, compare panels, and modal-like blocks.

## 6. Layout Patterns

### Flexbox first

Use flex for headers, action bars, and card footers. `flex-wrap: wrap` is common and should be added early.

```scss
.headerRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
```

### Grid for balanced comparison blocks

Use grid when two columns need equal visual weight, then collapse to one column below tablet.

```scss
.comparisonGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .comparisonGrid {
    grid-template-columns: 1fr;
  }
}
```

## 7. Interactive States

### Shared behavior

- Hover/focus on links and icons on dark panels: switch to `var(--ce-action-accent)` (`#4dffa4` in the Context Engine theme).
  On document cards, including Docs Quickstart, use `--ce-document-text` for
  readable links in every state; emphasize hover with a thicker underline and
  keyboard focus with a matching outline.
- Icon-only question-mark help buttons use `data-ce-control-appearance="frameless"`
  to remove theme borders and shadows. Use color for pointer hover feedback and
  retain a visible keyboard focus indicator.
- Hover on buttons/cards: slight lift with `translateY(-1px)` or `translateY(-2px)`
- Final submit/create CTAs use the shared `var(--ce-action-submit)` surface (`#2a63ca`), indigo hover, uppercase body-font labels, and the same lift-on-hover motion.
- Focus: visible outline, usually `2px solid var(--ce-focus-ring)`
- Disabled: `opacity: 0.7` and `cursor: not-allowed`

```scss
.iconButton {
  transition:
    color 0.3s ease,
    transform 0.1s ease;

  &:hover,
  &:focus {
    color: var(--ce-action-accent);
    transform: scale(1.05);
    outline: none;
  }
}

.actionButton {
  transition:
    transform 0.06s ease,
    box-shadow 0.2s ease,
    background 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &:focus {
    outline: 2px solid var(--ce-focus-ring);
    outline-offset: 2px;
  }
}
```

## 8. Gradient Backgrounds

- Flat/shared surfaces use tokens such as `--ce-color-surface` and `--ce-color-surface-alt`.
- There is no shared `--ce-gradient-*` token.
- Final submit/create CTAs are a separate shared pattern: `var(--ce-font-body)`, uppercase inner content, blue `--ce-action-submit` (`#2a63ca`) surface, indigo hover, and a subtle lift-on-hover treatment.

## 9. Existing CSS Custom Properties Used By These Files

### Fonts

| Property | Value |
| --- | --- |
| `--ce-font-body` | `'Poppins', sans-serif` |
| `--ce-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace` |

### Colors

| Property | Value |
| --- | --- |
| `--ce-color-black` | `#000000` |
| `--ce-color-dark` | `#212529` |
| `--ce-color-indigo` | `#5e72e4` |
| `--ce-color-info` | `#1d8cf8` |
| `--ce-color-success` | `#2dce89` |
| `--ce-color-surface` | `#1f2251` |
| `--ce-color-surface-alt` | `#272b65` |
| `--ce-color-tooltip-bg` | `rgba(15, 18, 34, 0.95)` |
| `--ce-color-tooltip-border` | `rgba(255, 255, 255, 0.16)` |
| `--ce-color-tooltip-text` | `#f4f7ff` |
| `--ce-color-white` | `#ffffff` |
| `--ce-color-yellow` | `#ffd600` |

### Radii

| Property | Value |
| --- | --- |
| `--ce-radius-0` | `0px` |
| `--ce-radius-3` | `3px` |
| `--ce-radius-5` | `5px` |
| `--ce-radius-6` | `6px` |
| `--ce-radius-7` | `7px` |
| `--ce-radius-8` | `8px` |
| `--ce-radius-10` | `10px` |
| `--ce-radius-12` | `12px` |
| `--ce-radius-14` | `14px` |
| `--ce-radius-pill` | `999px` |
| `--ce-radius-round` | `50%` |

## Quick Default Recipe

For a new card or panel, start here:

```scss
.newComponent {
  background: var(--ce-card-bg);
  border: 1px solid var(--ce-card-border);
  border-radius: var(--ce-radius-12);
  box-shadow: var(--ce-card-shadow);
  color: var(--ce-panel-text);
}

.newComponent a,
.newComponent button:hover {
  color: var(--ce-action-accent);
}
```
