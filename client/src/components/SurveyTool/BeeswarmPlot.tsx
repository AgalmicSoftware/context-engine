import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './BeeswarmPlot.module.scss';
import { beeswarmByExtremity } from '../../utilities/survey/consensusMath.js';

const AXIS_BOTTOM_PADDING = 28;
const POINT_RADIUS = 8;
const TOOLTIP_OFFSET = 14;
const TOOLTIP_MARGIN = 12;

type BeeswarmPoint = {
  questionId?: string;
  index?: string | number;
  key?: string | number;
  label?: string;
  x?: number;
  y?: number;
  agrees?: number;
  disagrees?: number;
  unsure?: number;
  total?: number;
  extremity?: number;
  [key: string]: unknown;
};

type TooltipVoteBreakdown = {
  agrees: number;
  disagrees: number;
  unsure: number;
  total: number;
};

type TooltipLayout = {
  left: number;
  top: number;
  horizontal: 'right' | 'left';
  vertical: 'bottom' | 'top';
};

type BeeswarmTooltipEvent = {
  clientX?: number;
  clientY?: number;
  currentTarget?: {
    getBoundingClientRect?: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  };
} | null;

type BeeswarmPlotProps = {
  points?: BeeswarmPoint[];
  width?: number;
  height?: number;
  onHover?: (point: BeeswarmPoint | null) => void;
  onClick?: (point: BeeswarmPoint) => void;
  showIdleSummary?: boolean;
};

type TooltipVoteGroup = {
  key: string;
  label: string;
  valueKey: keyof TooltipVoteBreakdown;
  statClassName: string;
  statTestId: string;
  segmentClassName: string;
  segmentTestId: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const TOOLTIP_VOTE_GROUPS: TooltipVoteGroup[] = [
  {
    key: 'agree',
    label: 'Agree',
    valueKey: 'agrees',
    statClassName: 'tooltipStatAgree',
    statTestId: 'ce-beeswarm-tooltip-agree',
    segmentClassName: 'tooltipResponseSegmentAgree',
    segmentTestId: 'ce-beeswarm-tooltip-segment-agree',
  },
  {
    key: 'unsure',
    label: 'Unsure',
    valueKey: 'unsure',
    statClassName: 'tooltipStatUnsure',
    statTestId: 'ce-beeswarm-tooltip-unsure',
    segmentClassName: 'tooltipResponseSegmentUnsure',
    segmentTestId: 'ce-beeswarm-tooltip-segment-unsure',
  },
  {
    key: 'disagree',
    label: 'Disagree',
    valueKey: 'disagrees',
    statClassName: 'tooltipStatDisagree',
    statTestId: 'ce-beeswarm-tooltip-disagree',
    segmentClassName: 'tooltipResponseSegmentDisagree',
    segmentTestId: 'ce-beeswarm-tooltip-segment-disagree',
  },
];

const normalizePointPosition = (
  point: BeeswarmPoint = {},
  index: number,
  width: number,
  height: number,
): BeeswarmPoint => {
  const axisY = height - AXIS_BOTTOM_PADDING;
  const fallbackX = width / 2;
  const fallbackY = height / 2;
  const pointX = Number.isFinite(point?.x) ? Number(point.x) : fallbackX;
  const pointY = Number.isFinite(point?.y)
    ? clamp(Number(point.y), POINT_RADIUS + 4, axisY - POINT_RADIUS - 4)
    : fallbackY;
  return {
    ...point,
    x: pointX,
    y: pointY,
    key: point?.questionId || point?.index || index,
  };
};

const normalizeBinaryVoteCount = (value: unknown) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const normalizeTooltipVoteBreakdown = (point: BeeswarmPoint = {}): TooltipVoteBreakdown => {
  const agrees = Math.max(0, normalizeBinaryVoteCount(point?.agrees));
  const disagrees = Math.max(0, normalizeBinaryVoteCount(point?.disagrees));
  const reportedUnsure = Math.max(0, normalizeBinaryVoteCount(point?.unsure));
  const reportedTotal = Math.max(0, normalizeBinaryVoteCount(point?.total));
  const total = Math.max(reportedTotal, agrees + disagrees + reportedUnsure);
  const unsure = Math.max(reportedUnsure, total - agrees - disagrees);
  return {
    agrees,
    disagrees,
    unsure,
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
  const maxTop = Math.max(margin, usableHeight - tooltipHeight - margin);

  let left = anchorX + offset;
  if (left + tooltipWidth > usableWidth - margin) {
    left = anchorX - tooltipWidth - offset;
  }
  left = clamp(left, margin, maxLeft);

  let top = anchorY + offset;
  if (top + tooltipHeight > usableHeight - margin) {
    top = anchorY - tooltipHeight - offset;
  }
  top = clamp(top, margin, maxTop);

  return {
    left,
    top,
    horizontal: left >= anchorX ? 'right' : 'left',
    vertical: top >= anchorY ? 'bottom' : 'top',
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
  width: `${((Number(value || 0) / Math.max(1, Number(total || 0))) * 100).toFixed(2)}%`,
});

export default function BeeswarmPlot({
  points = [],
  width = 700,
  height = 200,
  onHover,
  onClick,
  showIdleSummary = true,
}: BeeswarmPlotProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [singlePointDeselected, setSinglePointDeselected] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState({ x: 0, y: 0 });
  const [tooltipLayout, setTooltipLayout] = useState<TooltipLayout>({
    left: TOOLTIP_MARGIN,
    top: TOOLTIP_MARGIN,
    horizontal: 'right',
    vertical: 'bottom',
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const hasQuestions = Array.isArray(points) && points.length > 0;
  const hasResponses = hasQuestions && points.some((point) => normalizeBinaryVoteCount(point?.total) > 0);
  const axisY = height - AXIS_BOTTOM_PADDING;

  const positionedPoints = useMemo(() => {
    if (!hasQuestions) return [];
    if (points.length === 1) {
      return [
        normalizePointPosition({ ...points[0], x: width / 2, y: (height - AXIS_BOTTOM_PADDING) / 2 }, 0, width, height),
      ];
    }

    return (beeswarmByExtremity(points, width, height) as BeeswarmPoint[]).map((point, index) =>
      normalizePointPosition(point, index, width, height),
    );
  }, [hasQuestions, height, points, width]);

  const allowSinglePointAutoPreview = !!showIdleSummary;
  const activePoint =
    hoveredIndex == null
      ? positionedPoints.length === 1 && !singlePointDeselected && allowSinglePointAutoPreview
        ? positionedPoints[0]
        : null
      : positionedPoints[hoveredIndex] || null;
  const tooltipBreakdown = activePoint ? normalizeTooltipVoteBreakdown(activePoint) : null;
  const tooltipVoteGroups = tooltipBreakdown
    ? TOOLTIP_VOTE_GROUPS.map((group) => ({
        ...group,
        value: tooltipBreakdown[group.valueKey] || 0,
      }))
    : [];
  const tooltipSegments = tooltipVoteGroups.filter((segment) => segment.value > 0);

  const updateTooltipPosition = (event: BeeswarmTooltipEvent, point: BeeswarmPoint | null = null) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    const eventX = event?.clientX;
    const eventY = event?.clientY;
    if (Number.isFinite(eventX) && Number.isFinite(eventY)) {
      setTooltipAnchor({
        x: Number(eventX) - wrapperRect.left,
        y: Number(eventY) - wrapperRect.top,
      });
      return;
    }

    const targetRect =
      typeof event?.currentTarget?.getBoundingClientRect === 'function'
        ? event.currentTarget.getBoundingClientRect()
        : null;
    if (targetRect) {
      setTooltipAnchor({
        x: targetRect.left - wrapperRect.left + targetRect.width / 2,
        y: targetRect.top - wrapperRect.top + targetRect.height,
      });
      return;
    }

    if (point) {
      setTooltipAnchor({ x: point.x || 0, y: point.y || 0 });
    }
  };

  useLayoutEffect(() => {
    if (!activePoint) return;
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const nextLayout = resolveTooltipLayout({
      anchorX: tooltipAnchor.x,
      anchorY: tooltipAnchor.y,
      wrapperWidth: wrapper.clientWidth || width,
      wrapperHeight: wrapper.clientHeight || height,
      tooltipWidth: tooltip.offsetWidth || 0,
      tooltipHeight: tooltip.offsetHeight || 0,
    });

    setTooltipLayout((prev) =>
      prev.left === nextLayout.left &&
      prev.top === nextLayout.top &&
      prev.horizontal === nextLayout.horizontal &&
      prev.vertical === nextLayout.vertical
        ? prev
        : nextLayout,
    );
  }, [activePoint, height, tooltipAnchor.x, tooltipAnchor.y, width]);

  const handleHover = (point: BeeswarmPoint, index: number, event: BeeswarmTooltipEvent = null) => {
    setSinglePointDeselected(false);
    setHoveredIndex(index);
    updateTooltipPosition(event, point);
    if (typeof onHover === 'function') onHover(point);
  };

  const clearHover = () => {
    setHoveredIndex(null);
    setSinglePointDeselected(false);
    if (typeof onHover === 'function') onHover(null);
  };

  const handlePointClick = (point: BeeswarmPoint, index: number) => {
    if (typeof onClick === 'function') {
      onClick(point);
      return;
    }

    const isDeselecting = hoveredIndex === index;
    const nextHoveredIndex = isDeselecting ? null : index;
    setSinglePointDeselected(positionedPoints.length === 1 && isDeselecting);
    setHoveredIndex(nextHoveredIndex);
    if (typeof onHover === 'function') {
      onHover(isDeselecting ? null : point);
    }
  };

  if (!hasQuestions) {
    return (
      <div className={styles.emptyState} data-testid="ce-beeswarm-empty">
        No questions yet
      </div>
    );
  }

  if (!hasResponses) {
    return (
      <div className={styles.emptyState} data-testid="ce-beeswarm-no-responses">
        No responses yet
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper} data-testid="ce-beeswarm-plot" onMouseLeave={clearHover}>
      {activePoint ? (
        <div
          ref={tooltipRef}
          className={styles.hoverTooltip}
          data-testid="ce-beeswarm-tooltip"
          data-placement={`${tooltipLayout.horizontal}-${tooltipLayout.vertical}`}
          style={resolveTooltipPositionStyle(tooltipLayout)}
        >
          <p className={styles.tooltipPrompt}>{activePoint.label || '(No prompt)'}</p>
          <div className={styles.tooltipStats}>
            {tooltipVoteGroups.map((group) => (
              <span
                key={group.key}
                className={buildBeeswarmTooltipStatClassName(styles, group.statClassName)}
                data-testid={group.statTestId}
              >
                {group.label} {group.value}
              </span>
            ))}
          </div>
          <div className={styles.tooltipResponseWrap}>
            <div className={styles.tooltipResponseBar} data-testid="ce-beeswarm-tooltip-bar">
              {tooltipSegments.map((segment) => (
                <span
                  key={segment.key}
                  className={buildBeeswarmTooltipSegmentClassName(styles, segment.segmentClassName)}
                  data-testid={segment.segmentTestId}
                  style={resolveTooltipResponseSegmentStyle(segment.value, tooltipBreakdown?.total)}
                />
              ))}
            </div>
            <div className={styles.tooltipResponseFooter} data-testid="ce-beeswarm-tooltip-total">
              Counted {tooltipBreakdown?.total || 0}
            </div>
          </div>
        </div>
      ) : showIdleSummary ? (
        <div className={styles.hoverPanel} data-testid="ce-beeswarm-hover">
          <p className={styles.hoverLabel}>Hover a question to inspect the split.</p>
          <p className={styles.hoverMeta}>Consensus sits on the left. Difference grows to the right.</p>
        </div>
      ) : null}

      <div className={styles.svgShell}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.beeswarmSvg}
          role="img"
          aria-label="Community question beeswarm plot"
        >
          <line x1="24" y1={axisY} x2={width - 24} y2={axisY} className={styles.axisLine} />
          <text x="24" y={height - 6} className={styles.axisLabel}>
            Consensus
          </text>
          <text x={width - 24} y={height - 6} textAnchor="end" className={styles.axisLabel}>
            Difference
          </text>

          {positionedPoints.map((point, index) => {
            const isActive =
              hoveredIndex === index ||
              (hoveredIndex == null && positionedPoints.length === 1 && !singlePointDeselected);
            const isInteractive = true;
            return (
              <circle
                key={point.key}
                cx={point.x}
                cy={point.y}
                r={POINT_RADIUS}
                className={[
                  styles.point,
                  isActive ? styles.pointActive : '',
                  isInteractive ? styles.pointInteractive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`ce-beeswarm-point-${index}`}
                role="button"
                aria-label={point.label || `Question ${index + 1}`}
                onMouseEnter={(event) => handleHover(point, index, event)}
                onMouseMove={(event) => updateTooltipPosition(event, point)}
                onFocus={(event) => handleHover(point, index, event)}
                onBlur={clearHover}
                onClick={() => handlePointClick(point, index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePointClick(point, index);
                  }
                }}
                tabIndex={0}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
