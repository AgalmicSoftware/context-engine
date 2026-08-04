import * as d3 from 'd3';

export type BeeswarmLayoutStrategy = 'force' | 'stacked';
export type BeeswarmLayoutDomain = 'extent' | readonly [number, number];

export type BeeswarmLayoutPoint = {
  value?: number;
  x?: number;
  y?: number;
  [key: string]: unknown;
};

export type PositionedBeeswarmPoint<T extends BeeswarmLayoutPoint = BeeswarmLayoutPoint> = T & {
  x: number;
  y: number;
};

export type BeeswarmLayoutOptions = {
  width: number;
  height: number;
  strategy?: BeeswarmLayoutStrategy;
  domain?: BeeswarmLayoutDomain;
  xPadding?: number;
  centerY?: number;
  minY?: number;
  maxY?: number;
  collisionRadius?: number;
};

type D3Simulation<T> = {
  force(name: string, force: unknown): D3Simulation<T>;
  stop(): D3Simulation<T>;
  tick(): D3Simulation<T>;
};

type D3Facade = {
  forceSimulation<T>(data: T[]): D3Simulation<T>;
  forceX<T>(accessor: (value: T) => number): { strength(value: number): unknown };
  forceY(value: number): { strength(value: number): unknown };
  forceCollide(radius: number): unknown;
};

const d3Runtime = Object(d3) as D3Facade;
const finiteNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const resolveBeeswarmDomain = <T extends BeeswarmLayoutPoint>(
  points: T[] = [],
  domain: BeeswarmLayoutDomain = 'extent',
): [number, number] => {
  if (domain !== 'extent') {
    const start = finiteNumber(domain[0]);
    const end = finiteNumber(domain[1], 1);
    return start === end ? [start - 0.5, end + 0.5] : [start, end];
  }
  const values = points.map((point) => finiteNumber(point.value));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return min === max ? [min - 0.5, max + 0.5] : [min, max];
};

const buildValueProjector = <T extends BeeswarmLayoutPoint>(
  points: T[],
  width: number,
  domain: BeeswarmLayoutDomain,
  xPadding: number,
) => {
  const [domainStart, domainEnd] = resolveBeeswarmDomain(points, domain);
  const left = Math.max(0, xPadding);
  const right = Math.max(left, width - xPadding);
  return (point: T): number => {
    const ratio = Math.min(1, Math.max(0, (finiteNumber(point.value) - domainStart) / (domainEnd - domainStart)));
    return left + ratio * (right - left);
  };
};

const layoutForceBeeswarm = <T extends BeeswarmLayoutPoint>(
  points: T[],
  projectValue: (point: T) => number,
  centerY: number,
  collisionRadius: number,
): Array<PositionedBeeswarmPoint<T>> => {
  const positioned = points.map((point) => ({ ...point }));
  const simulation = d3Runtime
    .forceSimulation(positioned)
    .force('x', d3Runtime.forceX<T>(projectValue).strength(2))
    .force('y', d3Runtime.forceY(centerY).strength(0.2))
    .force('collide', d3Runtime.forceCollide(collisionRadius))
    .stop();
  for (let index = 0; index < 120; index += 1) simulation.tick();
  return positioned.map((point) => ({
    ...point,
    x: finiteNumber(point.x),
    y: finiteNumber(point.y, centerY),
  }));
};

const layoutStackedBeeswarm = <T extends BeeswarmLayoutPoint>(
  points: T[],
  projectValue: (point: T) => number,
  centerY: number,
  minY: number,
  maxY: number,
  collisionRadius: number,
): Array<PositionedBeeswarmPoint<T>> => {
  const placed: Array<PositionedBeeswarmPoint<T>> = [];
  return points
    .map((point) => ({ ...point, x: projectValue(point), y: centerY }))
    .sort((left, right) => left.x - right.x)
    .map((point) => {
      let candidateY = centerY;
      let layer = 0;
      const collides = (y: number) =>
        placed.some((existing) => Math.hypot(existing.x - point.x, existing.y - y) < collisionRadius * 2);
      while (collides(candidateY) && layer <= 40) {
        layer += 1;
        const direction = layer % 2 === 0 ? -1 : 1;
        const offset = Math.ceil(layer / 2) * collisionRadius * 1.7;
        candidateY = Math.max(minY, Math.min(maxY, centerY + direction * offset));
      }
      const positioned = { ...point, y: candidateY };
      placed.push(positioned);
      return positioned;
    });
};

export const layoutBeeswarmPoints = <T extends BeeswarmLayoutPoint>(
  points: T[] = [],
  {
    width,
    height,
    strategy = 'force',
    domain = 'extent',
    xPadding = 40,
    centerY = height / 2,
    minY = 10,
    maxY = height - 36,
    collisionRadius = 7,
  }: BeeswarmLayoutOptions,
): Array<PositionedBeeswarmPoint<T>> => {
  if (!Array.isArray(points) || points.length === 0) return [];
  const projectValue = buildValueProjector(points, width, domain, xPadding);
  return strategy === 'stacked'
    ? layoutStackedBeeswarm(points, projectValue, centerY, minY, maxY, collisionRadius)
    : layoutForceBeeswarm(points, projectValue, centerY, collisionRadius);
};
