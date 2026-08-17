import { layoutBeeswarmPoints, resolveBeeswarmDomain } from './beeswarmLayout';

describe('beeswarmLayout', () => {
  it('resolves extent and fixed domains without collapsing single-value data', () => {
    const [extentStart, extentEnd] = resolveBeeswarmDomain([{ value: 0.4 }]);
    expect(extentStart).toBeCloseTo(-0.1);
    expect(extentEnd).toBeCloseTo(0.9);
    expect(resolveBeeswarmDomain([{ value: 0.4 }], [0, 1])).toEqual([0, 1]);
    expect(resolveBeeswarmDomain([], [2, 2])).toEqual([1.5, 2.5]);
  });

  it('uses a fixed-domain stacked layout without mutating the source points', () => {
    const points = [
      { id: 'right', value: 1 },
      { id: 'left-a', value: 0 },
      { id: 'left-b', value: 0 },
    ];
    const positioned = layoutBeeswarmPoints(points, {
      width: 200,
      height: 100,
      strategy: 'stacked',
      domain: [0, 1],
      xPadding: 20,
      centerY: 40,
      minY: 10,
      maxY: 70,
      collisionRadius: 6,
    });

    expect(points).toEqual([
      { id: 'right', value: 1 },
      { id: 'left-a', value: 0 },
      { id: 'left-b', value: 0 },
    ]);
    expect(positioned.map(({ id, x }) => ({ id, x }))).toEqual([
      { id: 'left-a', x: 20 },
      { id: 'left-b', x: 20 },
      { id: 'right', x: 180 },
    ]);
    expect(positioned[0].y).not.toBe(positioned[1].y);
  });
});
