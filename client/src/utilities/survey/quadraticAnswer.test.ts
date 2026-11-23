import { isBlankQuadraticAllocation } from './quadraticAnswer';

it('reads only an allocation that casts no votes as blank', () => {
  expect(isBlankQuadraticAllocation([0, 0, 0])).toBe(true);
  expect(isBlankQuadraticAllocation([])).toBe(true);
  [[0, 1], [-2, 0], ['0', 0], [0, null], '0', 0, '', null, undefined, { value: [0, 0] }].forEach((value) =>
    expect(isBlankQuadraticAllocation(value)).toBe(false),
  );
});
