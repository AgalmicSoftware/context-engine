import type { CSSProperties } from 'react';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

export const resolveCompareAddressPillContentStyle = (): CSSProperties => ({
  alignItems: 'center',
  display: 'inline-flex',
  gap: 8,
});

export const resolveCompareAddressBlockieStyle = (): CSSProperties => ({
  borderRadius: 3,
});

export const buildCompareProfileHref = (address: unknown, sessionSlug: unknown = ''): string => {
  const normalizedAddress = String(address || '').trim();
  if (!normalizedAddress) return '';
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  const query = normalizedSessionSlug ? `?session=${encodeURIComponent(normalizedSessionSlug)}` : '';
  return buildPublicRoute(`/u/${normalizedAddress}${query}`);
};

export const buildCompareClassName = (...classNames: unknown[]): string =>
  classNames
    .map((className) => String(className || ''))
    .filter(Boolean)
    .join(' ');

export const resolveCompareUnsurePanelStyle = (): CSSProperties => ({
  marginTop: 8,
});

export const resolveCompareUnsureHeaderStyle = (): CSSProperties => ({
  fontWeight: 700,
  marginBottom: 6,
});

export const resolveCompareUnsureMoreStyle = (): CSSProperties => ({
  fontSize: 12,
  marginTop: 6,
  opacity: 0.8,
});

export const resolveCompareBookmarksHeaderStyle = (): CSSProperties => ({
  color: 'var(--ce-panel-text)',
  fontWeight: '600',
  marginBottom: '10px',
});

export const resolveCompareBookmarksListStyle = (): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
});

export const resolveCompareErrorStyle = (): CSSProperties => ({
  marginTop: 8,
});

export const resolveCompareVisualSectionStyle = (): CSSProperties => ({
  padding: '6px 0',
});

export const resolveCompareLoadingTextStyle = (): CSSProperties => ({
  marginLeft: 6,
});

export const resolveCompareClickableResultItemStyle = (): CSSProperties => ({
  cursor: 'pointer',
});

export const resolveCompareDrillBodyStyle = (): CSSProperties => ({
  marginTop: 6,
});

export const resolveCompareVennWrapStyle = (): CSSProperties => ({
  overflowX: 'auto',
  position: 'relative',
});

export const resolveCompareVennTooltipStyle = ({
  clientWidth,
  x = 0,
  y = 0,
}: {
  clientWidth?: unknown;
  x?: unknown;
  y?: unknown;
} = {}): CSSProperties => {
  const width = Number(clientWidth || 420);
  const left = Math.max(8, Math.min(Number(x || 0) + 6, width - 420));
  return {
    left,
    top: Number(y || 0) + 8,
  };
};

export const resolveCompareVennTooltipListStyle = (): CSSProperties => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

export const resolveCompareVennSbtRowStyle = (): CSSProperties => ({
  alignItems: 'center',
  display: 'flex',
  gap: '8px',
});

export const resolveCompareVennSbtImageStyle = (): CSSProperties => ({
  borderRadius: '4px',
  flexShrink: 0,
});

export const resolveCompareVennNoteStyle = (): CSSProperties => ({
  fontSize: 12,
  marginTop: 4,
  opacity: 0.75,
});

export const resolveCompareCompassLegendStyle = (): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 8,
});

export const resolveCompareCompassLegendSwatchStyle = (background: unknown): CSSProperties => ({
  background: String(background || ''),
  borderRadius: 5,
  display: 'inline-block',
  height: 10,
  marginRight: 6,
  width: 10,
});

export const resolveCompareCompassScrollStyle = (): CSSProperties => ({
  overflowX: 'auto',
});

const COMPARE_COMPASS_SERIES_COLORS = Object.freeze([
  'var(--ce-data-series-1)',
  'var(--ce-data-series-2)',
  'var(--ce-data-series-3)',
  'var(--ce-data-series-4)',
  'var(--ce-data-series-5)',
  'var(--ce-data-series-6)',
  'var(--ce-data-series-7)',
  'var(--ce-data-series-8)',
]);

export const resolveCompareCompassSeriesColor = (index: number): string =>
  COMPARE_COMPASS_SERIES_COLORS[index % COMPARE_COMPASS_SERIES_COLORS.length];

export const buildCompareCompassQuadrants = ({
  cx,
  cy,
  height,
  width,
}: {
  cx: number;
  cy: number;
  height: number;
  width: number;
}) => [
  { x: cx, y: cy, width: width - cx, height: height - cy, intensity: 4 },
  { x: 0, y: cy, width: cx, height: height - cy, intensity: 4 },
  { x: 0, y: 0, width: cx, height: cy, intensity: 5 },
  { x: cx, y: 0, width: width - cx, height: cy, intensity: 5 },
];
