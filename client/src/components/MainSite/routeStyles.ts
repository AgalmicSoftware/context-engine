/**
 * @module components/MainSite/routeStyles
 */

export const ROUTE_STATUS_SHELL_STYLE = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '58vh',
  padding: '2rem 1.25rem',
  color: 'var(--ce-panel-text)',
});

export const ROUTE_STATUS_CARD_STYLE = Object.freeze({
  width: 'min(100%, 42rem)',
  padding: '1.75rem',
  borderRadius: '1.25rem',
  border: '1px solid color-mix(in srgb, var(--ce-action-accent) 24%, transparent)',
  background: 'linear-gradient(180deg, var(--ce-overlay-surface) 0%, var(--ce-overlay-base) 100%)',
  boxShadow: 'var(--ce-shadow-raised)',
});

export const ROUTE_STATUS_EYEBROW_STYLE = Object.freeze({
  marginBottom: '0.75rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ce-action-accent)',
});

export const ROUTE_STATUS_TITLE_STYLE = Object.freeze({
  margin: 0,
  fontSize: '1.9rem',
  fontWeight: 700,
  color: 'var(--ce-panel-text)',
});

export const ROUTE_STATUS_BODY_STYLE = Object.freeze({
  marginTop: '0.85rem',
  marginBottom: 0,
  fontSize: '1rem',
  lineHeight: 1.6,
  color: 'var(--ce-panel-text-muted)',
});

export const ROUTE_STATUS_PATH_STYLE = Object.freeze({
  marginTop: '0.9rem',
  marginBottom: 0,
  fontSize: '0.94rem',
  color: 'var(--ce-control-disabled-text)',
});

export const ROUTE_STATUS_LINK_STYLE = Object.freeze({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '1.25rem',
  padding: '0.8rem 1.05rem',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--ce-action-accent) 32%, transparent)',
  color: 'var(--ce-action-accent)',
  textDecoration: 'none',
  fontWeight: 700,
});
