# Design System

This file documents the shared styling tokens used by component SCSS in `client/src/components/`.

## Sources Of Truth

- Runtime CSS custom properties live in `client/src/assets/css/contextEngine.scss`.
- Shared Sass literals live in `client/src/scss/_variables.scss`.
- Prefer `var(--ce-*)` in component styles when a runtime token already exists.
- Import `@use "scss/variables" as tokens;` when Sass color math or shared compile-time literals are needed.

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
| `--ce-font-mono` / `$ce-font-mono` | `'Share Tech Mono', 'Courier New', monospace` | ids, metadata, code-like UI |
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
  font-weight: 600;
  border-radius: var(--ce-radius-10);
  background: var(--ce-color-accent);
  color: #08111f;
}
```

Secondary / outline button:

```scss
button {
  font-family: var(--ce-font-button);
  font-weight: 600;
  border-radius: var(--ce-radius-10);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ce-color-white);
}
```

Pill action / status chip:

```scss
.chip {
  border-radius: var(--ce-radius-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ce-color-panel-text);
  font-family: var(--ce-font-mono);
}
```

## Usage Rules

- Do not introduce new hardcoded copies of the shared accent, panel text, card surface, card border, or card shadow values.
- Do not replace one-off contextual colors unless they recur and map cleanly to an existing token.
- Do not create JSX inline style tokens here; keep this system scoped to SCSS.
