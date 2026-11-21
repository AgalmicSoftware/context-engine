/** @file CompassNarrowLabels.tsx: the two-axis chart's axis labels and point names, wrapped so none is cut. */
import React from 'react';

import { fitCompassLabel, type CompassGeometry, type CompassLabelBox } from './compassNarrowLayout';

type AxisEnds = { left?: string; right?: string; top?: string; bottom?: string };

/**
 * The four axis labels, each wrapped within its own room and set smaller before it would be cut. Top and bottom
 * sit on lines within the chart's width. Narrow, the side labels run along their sides, reading upward on the left
 * and downward on the right, so the square keeps the width; wide, they sit beside the square on short lines.
 */
export const CompassEdgeLabels = ({
  xAxis,
  yAxis,
  geometry,
  narrow,
  style,
}: {
  xAxis: AxisEnds;
  yAxis: AxisEnds;
  geometry: CompassGeometry;
  narrow: boolean;
  style: React.CSSProperties;
}) => {
  const { svgW, svgH, padX, padY, edgeFontPx } = geometry;
  const cW = svgW - 2 * padX;
  const cH = svgH - 2 * padY;
  const cx = padX + cW / 2;
  const cy = padY + cH / 2;
  const sized = (fontPx: number): React.CSSProperties => ({ ...style, fontSize: `${fontPx}px` });
  // `y` is the last line's baseline above the square and the first line's below it.
  const endLabel = (label: string, y: number, grows: 'up' | 'down') => {
    const { lines, fontPx } = fitCompassLabel(label, svgW - 12, edgeFontPx, narrow ? 3 : 2);
    const lineHeight = fontPx + 3;
    return (
      <text x={cx} textAnchor="middle" style={sized(fontPx)}>
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
  const turnedSideLabel = (label: string, side: 'left' | 'right') => {
    const { lines, fontPx } = fitCompassLabel(label, cH - 12, edgeFontPx, 2);
    const lineHeight = fontPx + 3;
    // The lines stack away from the square: the last sits against it.
    const x = side === 'left' ? padX - 8 : padX + cW + 8;
    return (
      <text textAnchor="middle" transform={`rotate(${side === 'left' ? -90 : 90} ${x} ${cy})`} style={sized(fontPx)}>
        <title>{label}</title>
        {lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={x} y={cy - (lines.length - 1 - index) * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  const levelSideLabel = (label: string, side: 'left' | 'right') => {
    const { lines, fontPx } = fitCompassLabel(label, padX - 20, edgeFontPx, 6);
    const lineHeight = fontPx + 4;
    const x = side === 'left' ? padX - 12 : padX + cW + 12;
    const first = cy + fontPx * 0.35 - ((lines.length - 1) * lineHeight) / 2;
    return (
      <text x={x} textAnchor={side === 'left' ? 'end' : 'start'} style={sized(fontPx)}>
        <title>{label}</title>
        {lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={x} y={first + index * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
  const sideLabel = narrow ? turnedSideLabel : levelSideLabel;
  return (
    <>
      {endLabel(yAxis.top || '', padY - (narrow ? 10 : 16), 'up')}
      {endLabel(yAxis.bottom || '', padY + cH + (narrow ? edgeFontPx + 6 : 28), 'down')}
      {sideLabel(xAxis.left || '', 'left')}
      {sideLabel(xAxis.right || '', 'right')}
    </>
  );
};

/** A point's name in the box laid out for it: wrapped, inside the square, off the points and the other names. */
export const CompassPointLabel = ({
  box,
  color,
  bold,
  fontPx,
}: {
  box: CompassLabelBox;
  color?: string;
  bold: boolean;
  fontPx: number;
}) => (
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
