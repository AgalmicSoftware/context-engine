import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './BeeswarmPlot.module.scss';
import {
  layoutBeeswarmPoints,
  type BeeswarmLayoutDomain,
  type BeeswarmLayoutStrategy,
} from './beeswarmLayout';
import BeeswarmTooltip, { resolveTooltipLayout, TOOLTIP_MARGIN, type TooltipLayout } from './BeeswarmTooltip';
export {
  buildBeeswarmTooltipSegmentClassName,
  buildBeeswarmTooltipStatClassName,
  normalizeTooltipVoteBreakdown,
  resolveTooltipLayout,
  resolveTooltipPositionStyle,
  resolveTooltipResponseSegmentStyle,
} from './BeeswarmTooltip';

const AXIS_BOTTOM_PADDING = 28;
const POINT_RADIUS = 8;

export type BeeswarmPoint = {
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
  value?: number;
  [key: string]: unknown;
};

type BeeswarmTooltipEvent = {
  clientX?: number;
  clientY?: number;
  currentTarget?: {
    getBoundingClientRect?: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  };
} | null;

type BeeswarmPointKey = string | number;

export type BeeswarmPlotProps = {
  points?: BeeswarmPoint[];
  className?: string;
  width?: number;
  height?: number;
  minPlotWidth?: number;
  layoutStrategy?: BeeswarmLayoutStrategy;
  domain?: BeeswarmLayoutDomain;
  xPadding?: number;
  axisXPadding?: number;
  axisBottomPadding?: number;
  centerY?: number;
  layoutYRange?: readonly [number, number];
  collisionRadius?: number;
  pointRadius?: number;
  axisLabels?: readonly [string, string];
  ariaLabel?: string;
  testIdPrefix?: string;
  emptyStateText?: string;
  noResponsesText?: string;
  responsesAvailable?: boolean;
  tooltipsEnabled?: boolean;
  renderTooltip?: (point: BeeswarmPoint) => React.ReactNode;
  renderPointLabel?: (point: BeeswarmPoint, index: number) => React.ReactNode;
  getPointStyle?: (point: BeeswarmPoint, index: number) => React.CSSProperties | undefined;
  pointClassName?: string;
  activePointClassName?: string;
  scrollContainerRef?: React.Ref<HTMLDivElement>;
  onHover?: (point: BeeswarmPoint | null) => void;
  onClick?: (point: BeeswarmPoint) => void;
  showIdleSummary?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveBeeswarmPointKey = (point: BeeswarmPoint, fallback: number): BeeswarmPointKey => {
  const candidate = [point.key, point.questionId, point.index].find(
    (value) => value !== null && value !== undefined && String(value).trim() !== '',
  );
  return (candidate ?? fallback) as BeeswarmPointKey;
};

const normalizePointPosition = (
  point: BeeswarmPoint = {},
  index: number,
  width: number,
  height: number,
  pointRadius: number,
  axisY: number,
): BeeswarmPoint => {
  const fallbackX = width / 2;
  const fallbackY = height / 2;
  const pointX = Number.isFinite(point?.x) ? Number(point.x) : fallbackX;
  const pointY = Number.isFinite(point?.y)
    ? clamp(Number(point.y), pointRadius + 4, axisY - pointRadius - 4)
    : fallbackY;
  return {
    ...point,
    x: pointX,
    y: pointY,
    key: resolveBeeswarmPointKey(point, index),
  };
};

const normalizeBinaryVoteCount = (value: unknown) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export default function BeeswarmPlot({
  points = [],
  className = '',
  width = 700,
  height = 200,
  minPlotWidth,
  layoutStrategy = 'force',
  domain = 'extent',
  xPadding = 40,
  axisXPadding = 24,
  axisBottomPadding = AXIS_BOTTOM_PADDING,
  centerY,
  layoutYRange,
  collisionRadius = 7,
  pointRadius = POINT_RADIUS,
  axisLabels = ['Consensus', 'Difference'],
  ariaLabel = 'Question beeswarm plot',
  testIdPrefix = 'ce-beeswarm',
  emptyStateText = 'No questions yet',
  noResponsesText = 'No responses yet',
  responsesAvailable,
  tooltipsEnabled = true,
  renderTooltip,
  renderPointLabel,
  getPointStyle,
  pointClassName = '',
  activePointClassName = '',
  scrollContainerRef,
  onHover,
  onClick,
  showIdleSummary = true,
}: BeeswarmPlotProps) {
  const [hoveredKey, setHoveredKey] = useState<BeeswarmPointKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<BeeswarmPointKey | null>(null);
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
  const hasResponses =
    hasQuestions &&
    (typeof responsesAvailable === 'boolean'
      ? responsesAvailable
      : points.some((point) => normalizeBinaryVoteCount(point?.total) > 0));
  const axisY = height - axisBottomPadding;
  const resolvedCenterY = centerY ?? height / 2;
  const minLayoutY = layoutYRange?.[0] ?? pointRadius + 4;
  const maxLayoutY = layoutYRange?.[1] ?? axisY - pointRadius - 4;

  const positionedPoints = useMemo(() => {
    if (!hasQuestions) return [];
    if (points.length === 1) {
      return [
        normalizePointPosition({ ...points[0], x: width / 2, y: resolvedCenterY }, 0, width, height, pointRadius, axisY),
      ];
    }

    return layoutBeeswarmPoints(points, {
      width,
      height,
      strategy: layoutStrategy,
      domain,
      xPadding,
      centerY: resolvedCenterY,
      minY: minLayoutY,
      maxY: maxLayoutY,
      collisionRadius,
    }).map((point, index) =>
      normalizePointPosition(point, index, width, height, pointRadius, axisY),
    );
  }, [
    axisY,
    collisionRadius,
    domain,
    hasQuestions,
    height,
    layoutStrategy,
    maxLayoutY,
    minLayoutY,
    pointRadius,
    points,
    resolvedCenterY,
    width,
    xPadding,
  ]);

  const allowSinglePointAutoPreview = !!showIdleSummary;
  const activeKey = hoveredKey ?? pinnedKey;
  const activeIndex = activeKey == null ? -1 : positionedPoints.findIndex((point) => point.key === activeKey);
  const activePoint =
    activeIndex >= 0
      ? positionedPoints[activeIndex] || null
      : activeKey == null && positionedPoints.length === 1 && !singlePointDeselected && allowSinglePointAutoPreview
        ? positionedPoints[0]
        : null;
  const activePointIsPinned = pinnedKey != null && activePoint?.key === pinnedKey;

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
    setHoveredKey((point.key ?? index) as BeeswarmPointKey);
    updateTooltipPosition(event, point);
    if (typeof onHover === 'function') onHover(point);
  };

  const clearHover = () => {
    setHoveredKey(null);
    setSinglePointDeselected(false);
    if (typeof onHover === 'function') {
      onHover(pinnedKey == null ? null : positionedPoints.find((point) => point.key === pinnedKey) || null);
    }
  };

  const clearPinnedPoint = () => {
    setPinnedKey(null);
    setHoveredKey(null);
    setSinglePointDeselected(positionedPoints.length === 1);
    if (typeof onHover === 'function') onHover(null);
  };

  const handlePointClick = (point: BeeswarmPoint, index: number, event: BeeswarmTooltipEvent = null) => {
    if (typeof onClick === 'function') {
      onClick(point);
      return;
    }

    const pointKey = (point.key ?? index) as BeeswarmPointKey;
    const isDeselecting = pinnedKey === pointKey;
    setPinnedKey(isDeselecting ? null : pointKey);
    setSinglePointDeselected(positionedPoints.length === 1 && isDeselecting);
    if (!isDeselecting) updateTooltipPosition(event, point);
    if (typeof onHover === 'function') {
      onHover(isDeselecting ? null : point);
    }
  };

  if (!hasQuestions) {
    return (
      <div className={styles.emptyState} data-testid={`${testIdPrefix}-empty`}>
        {emptyStateText}
      </div>
    );
  }

  if (!hasResponses) {
    return (
      <div className={styles.emptyState} data-testid={`${testIdPrefix}-no-responses`}>
        {noResponsesText}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={[styles.wrapper, className].filter(Boolean).join(' ')}
      data-testid={`${testIdPrefix}-plot`}
      onMouseLeave={clearHover}
    >
      {activePoint && tooltipsEnabled ? (
        <BeeswarmTooltip
          point={activePoint}
          pinned={activePointIsPinned}
          layout={tooltipLayout}
          testIdPrefix={testIdPrefix}
          tooltipRef={tooltipRef}
          renderTooltip={renderTooltip}
          onClose={clearPinnedPoint}
        />
      ) : showIdleSummary ? (
        <div className={styles.hoverPanel} data-testid={`${testIdPrefix}-hover`}>
          <p className={styles.hoverLabel}>Hover a question to inspect the split.</p>
          <p className={styles.hoverMeta}>Consensus sits on the left. Difference grows to the right.</p>
        </div>
      ) : null}

      <div className={styles.svgShell} ref={scrollContainerRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.beeswarmSvg}
          style={minPlotWidth ? { minWidth: minPlotWidth } : undefined}
          role="img"
          aria-label={ariaLabel}
        >
          <line x1={axisXPadding} y1={axisY} x2={width - axisXPadding} y2={axisY} className={styles.axisLine} />
          <text x={axisXPadding} y={height - 6} className={styles.axisLabel}>
            {axisLabels[0]}
          </text>
          <text x={width - axisXPadding} y={height - 6} textAnchor="end" className={styles.axisLabel}>
            {axisLabels[1]}
          </text>

          {positionedPoints.map((point, index) => {
            const isActive =
              activePoint?.key === point.key ||
              (activeKey == null && positionedPoints.length === 1 && !singlePointDeselected);
            const isInteractive = true;
            return (
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={pointRadius}
                  className={[
                    styles.point,
                    pointClassName,
                    isActive ? styles.pointActive : '',
                    isActive ? activePointClassName : '',
                    isInteractive ? styles.pointInteractive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={getPointStyle?.(point, index)}
                  data-testid={`${testIdPrefix}-point-${index}`}
                  role="button"
                  aria-label={point.label || `Point ${index + 1}`}
                  aria-pressed={pinnedKey === point.key}
                  onMouseEnter={(event) => handleHover(point, index, event)}
                  onMouseMove={(event) => updateTooltipPosition(event, point)}
                  onFocus={(event) => handleHover(point, index, event)}
                  onBlur={clearHover}
                  onClick={(event) => handlePointClick(point, index, event)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      clearPinnedPoint();
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handlePointClick(point, index, event);
                    }
                  }}
                  tabIndex={0}
                />
                {renderPointLabel?.(point, index)}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
