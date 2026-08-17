import React from 'react';
import styles from './BeeswarmPlot.module.scss';

export const TOOLTIP_OFFSET = 14;
export const TOOLTIP_MARGIN = 12;

export type BeeswarmTooltipPoint = {
  label?: string;
  agrees?: number;
  disagrees?: number;
  unsure?: number;
  total?: number;
  [key: string]: unknown;
};

export type TooltipVoteBreakdown = {
  agrees: number;
  disagrees: number;
  unsure: number;
  total: number;
};

export type TooltipLayout = {
  left: number;
  top: number;
  horizontal: 'right' | 'left';
  vertical: 'bottom' | 'top';
};

type TooltipVoteGroup = {
  key: string;
  label: string;
  valueKey: keyof TooltipVoteBreakdown;
  statClassName: string;
  segmentClassName: string;
};

type BeeswarmTooltipProps<T extends BeeswarmTooltipPoint> = {
  point: T;
  pinned: boolean;
  layout: TooltipLayout;
  testIdPrefix: string;
  tooltipRef: React.Ref<HTMLDivElement>;
  renderTooltip?: (point: T) => React.ReactNode;
  onClose: () => void;
};

const TOOLTIP_VOTE_GROUPS: TooltipVoteGroup[] = [
  {
    key: 'agree',
    label: 'Agree',
    valueKey: 'agrees',
    statClassName: 'tooltipStatAgree',
    segmentClassName: 'tooltipResponseSegmentAgree',
  },
  {
    key: 'unsure',
    label: 'Unsure',
    valueKey: 'unsure',
    statClassName: 'tooltipStatUnsure',
    segmentClassName: 'tooltipResponseSegmentUnsure',
  },
  {
    key: 'disagree',
    label: 'Disagree',
    valueKey: 'disagrees',
    statClassName: 'tooltipStatDisagree',
    segmentClassName: 'tooltipResponseSegmentDisagree',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeBinaryVoteCount = (value: unknown) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const normalizeTooltipVoteBreakdown = (point: BeeswarmTooltipPoint = {}): TooltipVoteBreakdown => {
  const agrees = Math.max(0, normalizeBinaryVoteCount(point.agrees));
  const disagrees = Math.max(0, normalizeBinaryVoteCount(point.disagrees));
  const reportedUnsure = Math.max(0, normalizeBinaryVoteCount(point.unsure));
  const reportedTotal = Math.max(0, normalizeBinaryVoteCount(point.total));
  const total = Math.max(reportedTotal, agrees + disagrees + reportedUnsure);
  return {
    agrees,
    disagrees,
    unsure: Math.max(reportedUnsure, total - agrees - disagrees),
    total,
  };
};

export const resolveTooltipLayout = ({
  anchorX = 0,
  anchorY = 0,
  wrapperWidth = 0,
  wrapperHeight = 0,
  tooltipWidth = 0,
  tooltipHeight = 0,
  offset = TOOLTIP_OFFSET,
  margin = TOOLTIP_MARGIN,
}: {
  anchorX?: number;
  anchorY?: number;
  wrapperWidth?: number;
  wrapperHeight?: number;
  tooltipWidth?: number;
  tooltipHeight?: number;
  offset?: number;
  margin?: number;
} = {}): TooltipLayout => {
  const usableWidth = Math.max(wrapperWidth, tooltipWidth + margin * 2);
  const usableHeight = Math.max(wrapperHeight, tooltipHeight + margin * 2);
  const maxLeft = Math.max(margin, usableWidth - tooltipWidth - margin);
  const rightStart = anchorX + offset;
  const leftStart = anchorX - tooltipWidth - offset;
  const rightOverflow = Math.max(0, rightStart + tooltipWidth - (usableWidth - margin));
  const leftOverflow = Math.max(0, margin - leftStart);
  const placeRight = rightOverflow === 0 || (leftOverflow > 0 && rightOverflow <= leftOverflow);
  const left = clamp(placeRight ? rightStart : leftStart, margin, maxLeft);

  const belowStart = anchorY + offset;
  const aboveStart = anchorY - tooltipHeight - offset;
  const belowOverflow = Math.max(0, belowStart + tooltipHeight - (usableHeight - margin));
  const aboveOverflow = Math.max(0, margin - aboveStart);
  const placeBelow = belowOverflow === 0 || (aboveOverflow > 0 && belowOverflow <= aboveOverflow);
  // When neither vertical side can contain the card, allow it to extend outside
  // the plot wrapper (which is overflow-visible). Clamping it back into the plot
  // would cover the point the user is trying to inspect.
  const top = placeBelow ? belowStart : aboveStart;
  return {
    left,
    top,
    horizontal: placeRight ? 'right' : 'left',
    vertical: placeBelow ? 'bottom' : 'top',
  };
};

export const resolveTooltipPositionStyle = (layout: Pick<TooltipLayout, 'left' | 'top'>): React.CSSProperties => ({
  left: layout.left,
  top: layout.top,
});

export const buildBeeswarmTooltipStatClassName = (styleMap: Record<string, string>, statClassName: string) =>
  [styleMap.tooltipStat, styleMap[statClassName]].filter(Boolean).join(' ');

export const buildBeeswarmTooltipSegmentClassName = (styleMap: Record<string, string>, segmentClassName: string) =>
  [styleMap.tooltipResponseSegment, styleMap[segmentClassName]].filter(Boolean).join(' ');

export const resolveTooltipResponseSegmentStyle = (value: unknown, total: unknown): React.CSSProperties => ({
  width: `${((Math.max(0, Number(value || 0)) / Math.max(1, Number(total || 0), Number(value || 0))) * 100).toFixed(2)}%`,
});

export default function BeeswarmTooltip<T extends BeeswarmTooltipPoint>({
  point,
  pinned,
  layout,
  testIdPrefix,
  tooltipRef,
  renderTooltip,
  onClose,
}: BeeswarmTooltipProps<T>) {
  const breakdown = normalizeTooltipVoteBreakdown(point);
  const voteGroups = TOOLTIP_VOTE_GROUPS.map((group) => ({
    ...group,
    value: breakdown[group.valueKey] || 0,
  }));
  const segments = voteGroups.filter((segment) => segment.value > 0);

  return (
    <div
      ref={tooltipRef}
      className={[styles.hoverTooltip, pinned ? styles.hoverTooltipPinned : ''].filter(Boolean).join(' ')}
      data-testid={`${testIdPrefix}-tooltip`}
      data-placement={`${layout.horizontal}-${layout.vertical}`}
      style={resolveTooltipPositionStyle(layout)}
    >
      {pinned ? (
        <button type="button" className={styles.tooltipClose} aria-label="Close details" onClick={onClose}>
          ×
        </button>
      ) : null}
      {renderTooltip ? (
        renderTooltip(point)
      ) : (
        <>
          <p className={styles.tooltipPrompt}>{point.label || '(No prompt)'}</p>
          <div className={styles.tooltipStats}>
            {voteGroups.map((group) => (
              <span
                key={group.key}
                className={buildBeeswarmTooltipStatClassName(styles, group.statClassName)}
                data-testid={`${testIdPrefix}-tooltip-${group.key}`}
              >
                {group.label} {group.value}
              </span>
            ))}
          </div>
          <div className={styles.tooltipResponseWrap}>
            <div className={styles.tooltipResponseBar} data-testid={`${testIdPrefix}-tooltip-bar`}>
              {segments.map((segment) => (
                <span
                  key={segment.key}
                  className={buildBeeswarmTooltipSegmentClassName(styles, segment.segmentClassName)}
                  data-testid={`${testIdPrefix}-tooltip-segment-${segment.key}`}
                  style={resolveTooltipResponseSegmentStyle(segment.value, breakdown.total)}
                />
              ))}
            </div>
            <div className={styles.tooltipResponseFooter} data-testid={`${testIdPrefix}-tooltip-total`}>
              Counted {breakdown.total}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
