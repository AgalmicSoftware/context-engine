# Visual Identity / Component Style Guide

Source patterns:
- `client/src/components/UserPage/UserPage.module.scss`
- Shared token values from `client/src/assets/css/contextEngine.scss`

Use `UserPage` as the default for new page-level UI, with shared token values for cross-surface consistency.

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
| `#ffffff24` | `rgba(255, 255, 255, 0.14)` | empty / inactive text |
| `$clickable-color` / `--ce-color-accent` | `#4dffa4` | hover, links, active emphasis |
| `--ce-color-info` | `#1d8cf8` | winner glow, info state |
| `--ce-color-indigo` / `$light-blue` | `#5e72e4` | avatars, indigo labels |
| `--ce-color-yellow` | `#ffd600` | vote counts, high-attention accents |
| raw cyan | `#69c9d0` | address / handle highlight treatment |
| raw magenta | `#ee1d52` | shadow pair for cyan highlight text |

### Shadow colors

| Pair | Value | Use |
| --- | --- | --- |
| MemeMatch dark / light | `#131532` / `#2b2f70` | duel cards and hard neumorphic gameplay tiles |
| UserPage dark / light | `#121433` / `#1c1e4f` | softer dashboard-style neumorphic reference pair |
| Upcoming feature dark / light | `#10122a` / `#2e3278` | gradient proposal and up-next cards |

### Recommended usage

```scss
.surfaceCard {
  background: var(--ce-color-surface); /* #1f2251 */
  color: var(--ce-color-white); /* #ffffff */
}

.overlayCard {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
```

## 2. Elevation & Depth (Neuomorphic Shadows)

### Primary shadow recipes

| Pattern | Shadow |
| --- | --- |
| MemeMatch card | `7px 7px 14px #131532, -7px -7px 14px #2b2f70` |
| MemeMatch asymmetric left | `7px 7px 14px #131532, -7px -7px 14px #2b2f70` |
| MemeMatch asymmetric right | `-7px 7px 14px #131532, 7px -7px 14px #2b2f70` |
| Pending duel card variant | dark edge `#171a3d` + light edge `var(--ce-color-surface-alt)` |
| UpcomingMatches feature card | `6px 6px 12px #10122a, -6px -6px 12px #2e3278` |
| UserPage neumorphic reference pair | `#121433 / #1c1e4f` |
| UserPage standard card | `0 6px 22px rgba(0, 0, 0, 0.25)` |
| Winner / active glow | `0px 0px 30px 5px var(--ce-color-info) !important` |

### Snippets

```scss
.duelCardLeft {
  border-radius: var(--ce-radius-8);
  background: var(--ce-color-surface);
  box-shadow:
    7px 7px 14px #131532,
    -7px -7px 14px #2b2f70;
}

.duelCardRight {
  border-radius: var(--ce-radius-8);
  background: var(--ce-color-surface);
  box-shadow:
    -7px 7px 14px #131532,
    7px -7px 14px #2b2f70;
}

.winner {
  box-shadow: 0px 0px 30px 5px var(--ce-color-info) !important;
}
```

```scss
.pageCard {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.25);
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

### Responsive size cues

| Breakpoint | Typical sizes from these modules |
| --- | --- |
| `0-319` | stats `0.85em`, card headers `1em` |
| `320-465` | stats `0.9em`, card headers `1em` |
| `466-768` | stats `1em`, feature headers `1.25em` |
| `769-1366` | stats `1.1em`, feature headers `1.45em` |
| `1367+` | stats up to `1.5em`, feature headers `1.65em` |

```scss
.statsRow {
  font-family: var(--ce-font-mono);
  font-size: 1em;
}

.promptText {
  font-weight: 600;
  font-size: 1.35em;
}
```

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
- Card body padding: `10px` on mobile, `15px` on tablet and up (`UpcomingMatches`).
- Section/list padding: `10px` on small screens, `20-25px` once space opens up.
- Tiny match layouts use `0-5px` gutters first, then scale content instead of adding large padding.

### Scale transforms

| Pattern | `0-319` | `320-465` | `466-768` | `769-1366` | `1367+` |
| --- | --- | --- | --- | --- | --- |
| duel cards | `0.8` | `0.85` | `0.85` | `0.85` | `0.85` |
| featured proposal / up-next cards | `0.8` | `0.9` | `0.95` | `0.95` | `0.95` |

```scss
@media (min-width: 466px) and (max-width: 768px) {
  .featureCard {
    padding: 15px;
    transform: scale(0.95);
  }
}
```

## 5. Card Patterns

### A. Standard page card (`UserPage` default)

```scss
.pageCard {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--ce-radius-12);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.25);
  padding: 20px;
}
```

### B. Standard gameplay card (`MemeMatch` / `UpcomingMatches`)

```scss
.gameCard {
  background: var(--ce-color-surface);
  border-radius: var(--ce-radius-8);
}
```

### C. Duel / versus card

```scss
.duelCardLeft {
  background: var(--ce-color-surface);
  border-radius: var(--ce-radius-8);
  transform: scale(0.85);
  box-shadow:
    7px 7px 14px #131532,
    -7px -7px 14px #2b2f70;
}

.duelCardRight {
  background: var(--ce-color-surface);
  border-radius: var(--ce-radius-8);
  transform: scale(0.85);
  box-shadow:
    -7px 7px 14px #131532,
    7px -7px 14px #2b2f70;
}
```

### D. Active / winner state

```scss
.activeCard {
  box-shadow: 0px 0px 30px 5px var(--ce-color-info) !important;
}
```

### E. Inputs

```scss
.input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--ce-radius-6);
  color: var(--ce-color-white);
}
```

Prefer:
- `var(--ce-radius-7)` or `var(--ce-radius-8)` for game cards and match tiles
- `var(--ce-radius-10)` to `var(--ce-radius-14)` for page sections, compare panels, and modal-like blocks

## 6. Layout Patterns

### Flexbox first

Use flex for headers, duel rows, action bars, and card footers. `flex-wrap: wrap` is common and should be added early.

```scss
.headerRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.duelRow {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
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

- Hover/focus on links and icons: switch to `#4dffa4`
- Hover on buttons/cards: slight lift with `translateY(-1px)` or `translateY(-2px)`
- Final submit/create CTAs use the shared `#2a63ca` surface, indigo hover, uppercase body-font labels, and the same lift-on-hover motion.
- Focus: visible outline, usually `2px solid rgba(99, 102, 241, 0.45)`
- Disabled: `opacity: 0.7` and `cursor: not-allowed`

```scss
.iconButton {
  transition:
    color 0.3s ease,
    transform 0.1s ease;

  &:hover,
  &:focus {
    color: #4dffa4;
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
    outline: 2px solid rgba(99, 102, 241, 0.45);
    outline-offset: 2px;
  }
}
```

## 8. Gradient Backgrounds

### Featured match / proposal gradient

Use this only for featured cards, not for every panel.

```scss
.featuredCard {
  background: linear-gradient(145deg, #1c1f49, #212457);
  box-shadow:
    6px 6px 12px #10122a,
    -6px -6px 12px #2e3278;
}
```

### CTA gradient already in use

```scss
.ctaButton {
  background: linear-gradient(180deg, #00d0a9 0%, #00b48e 100%);
  color: #0b1736;
}
```

Current state:
- Flat/shared surfaces already use tokens such as `--ce-color-surface` and `--ce-color-surface-alt`.
- There is no shared `--ce-gradient-*` token yet, so copy exact gradients when matching existing featured-card UI.
- Final submit/create CTAs are a separate shared pattern: `var(--ce-font-body)`, uppercase inner content, blue `#2a63ca` surface, indigo hover, and a subtle lift-on-hover treatment.

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

If a new component is not explicitly game-like, start here:

```scss
.newComponent {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--ce-radius-12);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.25);
  color: var(--ce-color-white);
}

.newComponent a,
.newComponent button:hover {
  color: #4dffa4;
}
```
