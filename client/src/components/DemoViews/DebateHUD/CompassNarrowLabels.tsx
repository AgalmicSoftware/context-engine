/** @file CompassNarrowLabels.tsx: the two-axis chart's axis labels and point names where it is drawn narrow. */
import React from 'react';

import { layoutNarrowPointLabel, wrapCompassLabel, type CompassGeometry } from './compassNarrowLayout';

type AxisEnds = { left?: string; right?: string; top?: string; bottom?: string };

/**
 * The four axis labels of the narrow chart. Top and bottom sit on one or two lines within the chart's width; the
 * side labels run along their sides, reading upward on the left and downward on the right, so the square keeps
 * the width.
 */
export const NarrowCompassEdgeLabels = ({
  xAxis,
  yAxis,
  geometry,
  style,
}: {
  xAxis: AxisEnds;
  yAxis: AxisEnds;
  geometry: CompassGeometry;
  style: React.CSSProperties;
}) => {
  const { svgW, svgH, padX, padY, edgeFontPx } = geometry;
  const cW = svgW - 2 * padX;
  const cH = svgH - 2 * padY;
  const cx = padX + cW / 2;
  const cy = padY + cH / 2;
  const lineHeight = edgeFontPx + 3;
  // `y` is the last line's baseline above the square and the first line's below it.
  const endLabel = (label: string, y: number, grows: 'up' | 'down') => {
    const lines = wrapCompassLabel(label, svgW - 12, edgeFontPx);
    return (
      <text x={cx} textAnchor="middle" style={style}>
        <title>{label}</title>
        {lines.map((line, index) => (
          <tspan
            key={`${index}-${line}`}
            x={cx}
            y={y + (grows === 'up' ? index - (lines.length - 1) : index) * lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  const sideLabel = (label: string, side: 'left' | 'right') => {
    const lines = wrapCompassLabel(label, cH - 12, edgeFontPx);
    // The lines stack away from the square: the last sits against it.
    const x = side === 'left' ? padX - 8 : padX + cW + 8;
    return (
      <text textAnchor="middle" transform={`rotate(${side === 'left' ? -90 : 90} ${x} ${cy})`} style={style}>
        <title>{label}</title>
        {lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={x} y={cy - (lines.length - 1 - index) * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  return (
    <>
      {endLabel(yAxis.top || '', padY - 10, 'up')}
      {endLabel(yAxis.bottom || '', padY + cH + edgeFontPx + 6, 'down')}
      {sideLabel(xAxis.left || '', 'left')}
      {sideLabel(xAxis.right || '', 'right')}
    </>
  );
};

/** A point's name on the narrow chart: wrapped, inside the square, and off the other points where it can be. */
export const NarrowCompassPointLabel = ({
  name,
  color,
  bold,
  px,
  py,
  size,
  bounds,
  others,
}: {
  name: string;
  color?: string;
  bold: boolean;
  px: number;
  py: number;
  size: number;
  bounds: { left: number; top: number; right: number; bottom: number };
  others: Array<{ px: number; py: number }>;
}) => {
  const fontPx = bold ? 11 : 10;
  const box = layoutNarrowPointLabel({ name, px, py, size, fontPx, bounds, others });
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={3}
        fill="color-mix(in srgb, var(--ce-document-canvas) 92%, transparent)"
        stroke={color}
        strokeWidth={0.8}
      />
      <text
        textAnchor="middle"
        style={{
          fontSize: `${fontPx}px`,
          fontWeight: bold ? 700 : 600,
          fill: 'var(--ce-document-text)',
          pointerEvents: 'none',
        }}
      >
        {box.lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={box.x + box.width / 2} y={box.y + 2 + fontPx + index * box.lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};
