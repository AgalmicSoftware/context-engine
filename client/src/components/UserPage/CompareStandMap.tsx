import type { CSSProperties } from 'react';
import { ParticipantDot, joinNames, participantName } from './CompareParticipantDot';
import { describePlace, type Dimension } from './compareStandDimensions';
import styles from './CompareResult.module.scss';

/** Dots closer than this on both axes, in percent of the plot, would cover each other. */
const MAP_GAP = 8;

type MapDot = { index: number; xValue: number; yValue: number; left: number; top: number };

/**
 * People who would cover each other are drawn as one cluster at their spot: discs side by side, one line of
 * names. Moving them apart would place people where they are not, and on a small plot across an axis.
 */
export const clusterDots = (dots: MapDot[]): MapDot[][] => {
  const clusters: MapDot[][] = [];
  dots.forEach((dot) => {
    const home = clusters.find(
      ([first]) => Math.abs(first.left - dot.left) < MAP_GAP && Math.abs(first.top - dot.top) < MAP_GAP,
    );
    if (home) home.push(dot);
    else clusters.push([dot]);
  });
  return clusters;
};

/**
 * Both dimensions at once: each end named at its own end, each axis named beside it, and each person
 * named beside their dot, on the side with room so no name runs off the plot.
 */
export default function CompareStandMap({ x, y, labels }: { x: Dimension; y: Dimension; labels: string[] }) {
  const dots = [...x.values].flatMap(([index, xValue]): MapDot[] => {
    const yValue = y.values.get(index);
    return yValue === undefined ? [] : [{ index, xValue, yValue, left: (xValue + 1) * 50, top: (1 - yValue) * 50 }];
  });
  const clusters = clusterDots(dots);
  const end = (name: string, className: string) => (
    <span className={className} title={name}>
      {name}
    </span>
  );
  return (
    <div className={styles.map}>
      <div className={styles.mapGrid} aria-hidden="true">
        {end(y.positive, styles.mapTop)}
        {end(x.negative, styles.mapLeft)}
        <div className={styles.plot}>
          <span className={styles.axisX} />
          <span className={styles.axisY} />
          <span className={styles.axisNameX}>{x.label}</span>
          <span className={styles.axisNameY}>{y.label}</span>
          <div className={styles.plotArea}>
            {clusters.map((members) => {
              const [{ index, left, top }] = members;
              // Names go on whichever side of the spot has room, anchored at the spot.
              const side = left > 55 ? 'left' : 'right';
              const anchor: CSSProperties = side === 'right' ? { left: `${left}%` } : { right: `${100 - left}%` };
              return (
                <span
                  key={index}
                  className={styles.mapDot}
                  data-side={side}
                  style={{ ...anchor, top: `${top}%`, '--members': members.length } as CSSProperties}
                >
                  <span className={styles.mapCluster}>
                    {members.map((member) => (
                      <ParticipantDot key={member.index} index={member.index} />
                    ))}
                  </span>
                  <span className={styles.mapName}>
                    {joinNames(members.map((member) => participantName(labels, member.index)))}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        {end(x.positive, styles.mapRight)}
        {end(y.negative, styles.mapBottom)}
      </div>
      <ul className={styles.legend} aria-hidden="true">
        {dots.map(({ index }) => (
          <li key={index}>
            <ParticipantDot index={index} />
            {participantName(labels, index)}
          </li>
        ))}
      </ul>
      <ul
        className={styles.srOnly}
        aria-label={`Map: ${x.label}, from ${x.negative} to ${x.positive}; ${y.label}, from ${y.negative} to ${y.positive}`}
      >
        {dots.map(({ index, xValue, yValue }) => (
          <li key={index}>
            {participantName(labels, index)}: {describePlace(xValue, x)}, {describePlace(yValue, y)}
          </li>
        ))}
      </ul>
    </div>
  );
}
