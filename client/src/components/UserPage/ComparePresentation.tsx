import { useId, useRef, useState } from 'react';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { resolveCompareCompassSeriesColor } from './compareAddressStyles';
import CompareAnswerDetails, { type ComparisonUser } from './CompareAnswerDetails';
import styles from './ComparePresentation.module.scss';
import { COMPARE_GRAPHIC_FILENAME } from './compareSessionRuntime';

export type ComparisonGeneration = { model: string; provider: string; source: 'reported' | 'requested' | 'mock' };
export type ComparisonCompass = {
  axes?: Array<{ label?: string; description?: string; negativeLabel?: string; positiveLabel?: string }>;
  points?: Array<{ address?: string; x: number; y: number }>;
  evidence?: { x?: unknown; y?: unknown };
};
export const participantLetter = (index: number) => String.fromCharCode(65 + index);
export function ParticipantMarker({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className={styles.marker} style={{ color: resolveCompareCompassSeriesColor(index) }}>
      {index % 2 ? '◆' : '●'}
    </span>
  );
}

export function OpinionCompass2D({
  users = [],
  labels = [],
  precomputed = null,
}: {
  users?: ComparisonUser[];
  labels?: string[];
  precomputed?: ComparisonCompass | null;
}) {
  const chartId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    const originals = [svg, ...Array.from(svg.querySelectorAll('*'))];
    const clones = [copy, ...Array.from(copy.querySelectorAll('*'))];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of [
        'fill',
        'stroke',
        'stroke-width',
        'stroke-opacity',
        'font-size',
        'font-family',
        'font-weight',
      ]) {
        (clones[index] as SVGElement).style.setProperty(property, computed.getPropertyValue(property));
      }
    });
    const xml = new XMLSerializer().serializeToString(copy);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    const vb =
      svg.viewBox && svg.viewBox.baseVal
        ? svg.viewBox.baseVal
        : { width: svg.clientWidth, height: svg.clientHeight, x: 0, y: 0 };
    const W = Math.max(1, vb.width);
    const H = Math.max(1, vb.height);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // retina-ish export
      canvas.width = W * scale;
      canvas.height = (H + 40 + users.length * 14) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W * scale, H * scale);
      ctx.fillStyle = getComputedStyle(svg).color;
      ctx.font = `${11 * scale}px sans-serif`;
      const captions = [
        `${xLabel}: ${xAxis?.negativeLabel || 'Lower'} → ${xAxis?.positiveLabel || 'Higher'}`,
        `${yLabel}: ${yAxis?.negativeLabel || 'Lower'} → ${yAxis?.positiveLabel || 'Higher'}`,
        ...users.map((_, index) => `${participantLetter(index)}: ${labels[index] || `Participant ${index + 1}`}`),
      ];
      captions.forEach((caption, index) =>
        ctx.fillText(caption, 8 * scale, (H + 14 + index * 14) * scale, (W - 16) * scale),
      );
      const a = document.createElement('a');
      a.download = COMPARE_GRAPHIC_FILENAME;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + svg64;
  };

  if (users.length < 2) return <p>Need at least 2 participants for the compass.</p>;
  if (!precomputed?.points?.length) return <p>No placement available.</p>;
  const [xAxis, yAxis] = precomputed.axes || [];
  const xLabel = xAxis?.label || 'Opinion dimension 1';
  const yLabel = yAxis?.label || 'Opinion dimension 2';
  // Labels live outside the scalable SVG: long generated phrases wrap on phones.
  // Inset the plot so endpoint placements and point letters cannot be clipped.
  return (
    <div className={styles.map}>
      <div className={styles.mapTop}>{yAxis?.positiveLabel || 'Higher'}</div>
      <div className={styles.mapMiddle}>
        <span className={styles.yAxis}>{yLabel}</span>
        <svg
          ref={svgRef}
          viewBox="0 0 360 360"
          role="img"
          aria-label="2D opinion compass plot"
          aria-describedby={chartId}
        >
          <desc id={chartId}>
            {xLabel}: {xAxis?.negativeLabel || 'Lower'} to {xAxis?.positiveLabel || 'Higher'}. {yLabel}:{' '}
            {yAxis?.negativeLabel || 'Lower'} to {yAxis?.positiveLabel || 'Higher'}.
          </desc>
          {[-1, -0.5, 0, 0.5, 1].map((t) => (
            <g key={t} className={t === 0 ? styles.axisLine : styles.gridLine}>
              <line x1={36 + (t + 1) * 144} x2={36 + (t + 1) * 144} y1="36" y2="324" />
              <line x1="36" x2="324" y1={36 + (t + 1) * 144} y2={36 + (t + 1) * 144} />
            </g>
          ))}
          {precomputed.points.map((point) => {
            const index = users.findIndex(
              (user) => String(user.address).toLowerCase() === String(point.address).toLowerCase(),
            );
            if (index < 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
            const x = 180 + Math.max(-1, Math.min(1, point.x)) * 144;
            const y = 180 - Math.max(-1, Math.min(1, point.y)) * 144;
            const letter = participantLetter(index);
            return (
              <g key={point.address} transform={`translate(${x},${y})`}>
                <title>{`${letter}: ${labels[index] || `Participant ${letter}`} — ${xLabel}: ${point.x.toFixed(2)}; ${yLabel}: ${point.y.toFixed(2)}`}</title>
                {index % 2 ? (
                  <path d="M 0 -13 L 13 0 L 0 13 L -13 0 Z" fill={resolveCompareCompassSeriesColor(index)} />
                ) : (
                  <circle r="12" fill={resolveCompareCompassSeriesColor(index)} />
                )}
                <text
                  x={point.x > 0.8 ? -17 : 17}
                  y="5"
                  textAnchor={point.x > 0.8 ? 'end' : 'start'}
                  className={styles.pointLabel}
                >
                  {letter}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className={styles.mapBottom}>{yAxis?.negativeLabel || 'Lower'}</div>
      <div className={styles.xAxis}>
        <span>{xAxis?.negativeLabel || 'Lower'}</span>
        <strong>{xLabel}</strong>
        <span>{xAxis?.positiveLabel || 'Higher'}</span>
      </div>
      <details className={styles.axisDetails}>
        <summary>Why these axes?</summary>
        {[xAxis, yAxis].map((axis, index) => (
          <div key={index}>
            <strong>{axis?.label || `Opinion dimension ${index + 1}`}</strong>
            <p>{axis?.description || 'No explanation recorded.'}</p>
            {Array.isArray(precomputed.evidence?.[index ? 'y' : 'x']) && (
              <ul>
                {(precomputed.evidence?.[index ? 'y' : 'x'] as unknown[])
                  .filter((item) => typeof item === 'string')
                  .map((item, i) => (
                    <li key={i}>{String(item)}</li>
                  ))}
              </ul>
            )}
          </div>
        ))}
        <button type="button" onClick={exportPNG}>
          Export PNG
        </button>
      </details>
    </div>
  );
}

type Props = {
  users: ComparisonUser[];
  labels: string[];
  result: { agreements: string[]; disagreements: string[] } | null;
  compass: ComparisonCompass | null;
  axesSource: 'ai' | 'fallback' | 'mock';
  generation: ComparisonGeneration | null;
  bulletsLoading?: boolean;
  compassLoading?: boolean;
  opinionComparable?: boolean;
};
export default function ComparePresentation({
  users,
  labels,
  result,
  compass,
  axesSource,
  generation,
  bulletsLoading = false,
  compassLoading = false,
  opinionComparable = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <div className={styles.presentation}>
      <div className={styles.overview}>
        <section className={styles.narrative} aria-label="Comparison summary" aria-busy={bulletsLoading}>
          {!bulletsLoading && (
            <p className={styles.provenance}>
              {generation?.source === 'mock'
                ? 'Preview · simulated summary'
                : generation
                  ? `${generation.source === 'requested' ? 'Requested model' : 'Model'}: ${generation.model}`
                  : 'Local comparison · AI summary unavailable'}
            </p>
          )}
          {bulletsLoading ? (
            <p role="status">
              <ElapsedLoadingLabel label="Loading summary…" />
            </p>
          ) : (
            <>
              <section data-testid={E2E_TESTIDS.COMPARE_AGREEMENTS}>
                <h3>Shared ground</h3>
                {result?.agreements.length ? (
                  result.agreements.map((text, i) => <p key={i}>{text}</p>)
                ) : (
                  <p>No clear similarities in the visible answers.</p>
                )}
              </section>
              <section data-testid={E2E_TESTIDS.COMPARE_DISAGREEMENTS}>
                <h3>Key differences</h3>
                {result?.disagreements.length ? (
                  result.disagreements.map((text, i) => <p key={i}>{text}</p>)
                ) : (
                  <p>No clear differences in the visible answers.</p>
                )}
              </section>
              <p className={styles.provenance}>
                {generation?.source === 'mock'
                  ? 'Illustrative summary for preview'
                  : 'Based on visible answers and available activity.'}
              </p>
            </>
          )}
        </section>
        <section className={styles.graphSection} aria-label="Perspective map" aria-busy={compassLoading}>
          <div className={styles.graphHeading}>
            <h3>Perspective map</h3>
            {!compassLoading && compass && (
              <span className={styles.axisBadge}>
                {axesSource === 'ai'
                  ? 'AI-generated axes'
                  : axesSource === 'mock'
                    ? 'Preview axes'
                    : 'Statistical axes'}
              </span>
            )}
          </div>
          {compassLoading ? (
            <p role="status">
              <ElapsedLoadingLabel label="Loading chart…" />
            </p>
          ) : opinionComparable ? (
            <OpinionCompass2D users={users} labels={labels} precomputed={compass} />
          ) : (
            <p>Opinion compass unavailable: these subjects have no shared canonical question IDs.</p>
          )}
          {!compassLoading && compass && (
            <p className={styles.provenance}>
              {axesSource === 'ai'
                ? 'AI interpretation of visible answers'
                : axesSource === 'mock'
                  ? 'Illustrative placement for preview'
                  : 'Statistical projection; distances are not agreement scores.'}
            </p>
          )}
        </section>
      </div>
      <button
        type="button"
        className={styles.explore}
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        data-testid="ce-compare-explore"
      >
        <span>
          <strong>Explore answers</strong>
          <span className={styles.exploreHint}>Binary · Multi-choice · Rating · Freeform · Quadratic</span>
        </span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div id={detailsId}>
          <CompareAnswerDetails users={users} />
        </div>
      )}
    </div>
  );
}
