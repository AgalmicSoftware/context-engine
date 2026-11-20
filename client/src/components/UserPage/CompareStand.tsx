import { useId, useState, type CSSProperties } from 'react';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import type { ComparisonUser } from './compareAnswers';
import { ParticipantDot, participantName } from './CompareParticipantDot';
import CompareStandMap from './CompareStandMap';
import {
  assignRows,
  describePlace,
  readDimensions,
  type ComparisonCompass,
  type Dimension,
} from './compareStandDimensions';
import styles from './CompareResult.module.scss';

/** Dots closer than this, in percent of the track, would touch, so they go in separate rows. */
const SLIDER_GAP = 12;

function Slider({ dimension, labels }: { dimension: Dimension; labels: string[] }) {
  const { label, negative, positive } = dimension;
  const dots = [...dimension.values].map(([index, value]) => ({ index, value, left: (value + 1) * 50 }));
  const rows = assignRows(
    dots.map(({ left }) => [left]),
    SLIDER_GAP,
  );
  return (
    <div className={styles.slider}>
      <h4 className={styles.sliderTitle}>{label}</h4>
      <div className={styles.sliderEnds} aria-hidden="true">
        <span>← {negative}</span>
        <span>{positive} →</span>
      </div>
      <div className={styles.track} aria-hidden="true" style={{ '--lanes': Math.max(...rows) + 1 } as CSSProperties}>
        {dots.map(({ index, left }, dotIndex) => (
          <span
            key={index}
            className={styles.trackDot}
            style={{ left: `${left}%`, '--lane': rows[dotIndex] } as CSSProperties}
          >
            <ParticipantDot index={index} title={participantName(labels, index)} />
            <span className={styles.trackName}>{participantName(labels, index)}</span>
          </span>
        ))}
      </div>
      <ul className={styles.srOnly} aria-label={`${label}, from ${negative} to ${positive}`}>
        {dots.map(({ index, value }) => (
          <li key={index}>
            {participantName(labels, index)}: {describePlace(value, dimension)}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  users: ComparisonUser[];
  labels: string[];
  compass: ComparisonCompass | null;
  axesSource: 'ai' | 'fallback' | 'mock';
  loading?: boolean;
  opinionComparable?: boolean;
};

/** The AI-named dimensions as sliders, or both at once as a map, placed from the AI's reading. */
export default function CompareStand({ users, labels, compass, axesSource, loading, opinionComparable }: Props) {
  const headingId = useId();
  const [view, setView] = useState<'sliders' | 'map'>('sliders');
  // The local fallback names no dimensions ("Axis 1", "Lower" to "Higher"), so it draws nothing.
  const [x, y] = loading || !opinionComparable || axesSource === 'fallback' ? [] : readDimensions(compass, users);
  const dimensions = [x, y].filter((dimension): dimension is Dimension => !!dimension);
  // With no question in common there is nothing to place anyone on; say so, as the old map did.
  if (!loading && !opinionComparable) return <p>No positions to show: these people answered no questions in common.</p>;
  if (!loading && !dimensions.length) return null;
  return (
    <section className={styles.block} aria-labelledby={headingId} aria-busy={loading}>
      <div className={styles.blockHeading}>
        <h3 id={headingId}>Where they stand</h3>
        {!loading && (
          <span className={styles.badge}>
            {axesSource === 'mock' ? 'Preview dimensions' : 'AI-generated dimensions'}
          </span>
        )}
        {x && y && (
          <div className={styles.viewSwitch} role="group" aria-label="Show as">
            {(['sliders', 'map'] as const).map((option) => (
              <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>
                {option === 'map' ? 'Map' : 'Sliders'}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? (
        <p role="status">
          <ElapsedLoadingLabel label="Loading dimensions…" />
        </p>
      ) : (
        <>
          {x && y && view === 'map' ? (
            <CompareStandMap x={x} y={y} labels={labels} />
          ) : (
            dimensions.map((dimension, index) => <Slider key={index} dimension={dimension} labels={labels} />)
          )}
          <details className={styles.why}>
            <summary>Why these dimensions?</summary>
            {dimensions.map((dimension, index) => (
              <div key={index}>
                <strong>{dimension.label}</strong>
                <p>{dimension.description || 'No explanation recorded.'}</p>
                {dimension.evidence.length > 0 && (
                  <ul>
                    {dimension.evidence.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p>
              {axesSource === 'mock'
                ? 'Illustrative placement for preview.'
                : 'AI interpretation of visible answers; positions are not agreement scores.'}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
