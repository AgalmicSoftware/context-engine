import fs from 'fs';
import path from 'path';

import { normalizeRatingSignedValue } from './compareUsers';
import { computeCommentStats, propTest, twoPropTest } from './consensusReportMath';

const ARTIFACT_DIR = path.resolve(__dirname, '../../../../artifacts/commonground/parity');
const EPSILON = 1e-12;

function buildPropTestFixture() {
  const cases = [];
  for (let trials = 0; trials <= 6; trials += 1) {
    for (let successes = 0; successes <= trials; successes += 1) {
      cases.push({ args: [successes, trials], expected: propTest(successes, trials) });
    }
  }
  cases.push({ args: [2, 4], expected: propTest(2, 4) });
  return { function: 'prop_test', cases };
}

function buildTwoPropTestFixture() {
  const argsGrid = [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 4, 4],
    [2, 2, 4, 4],
    [4, 4, 4, 4],
    [4, 0, 4, 4],
    [0, 4, 4, 4],
    [1, 3, 5, 6],
    [3, 1, 6, 5],
    [2, 5, 6, 6],
    [6, 2, 6, 6],
    [0, 3, 0, 6],
    [3, 0, 6, 0],
  ];
  return {
    function: 'two_prop_test',
    cases: argsGrid.map((args) => ({ args, expected: twoPropTest(...args) })),
  };
}

function buildCommentStatsFixture() {
  const argsGrid = [
    [1, -1, 0, null, 1, -1, 0],
    [],
    [null, null],
    [1, 1, 1, 1],
    [-1, -1, -1],
    [0, 0, 0],
    [1, null, 1, 0, -1, null],
  ];
  return {
    function: 'comment_stats',
    cases: argsGrid.map((votes) => ({ args: [votes], expected: computeCommentStats(votes) })),
  };
}

function buildRatingToVoteFixture() {
  const values = [-1, ...Array.from({ length: 11 }, (_, index) => index), 11, 0.5, NaN];
  return {
    function: 'rating_to_vote',
    cases: values.map((value) => ({ args: [value], expected: normalizeRatingSignedValue(value) })),
  };
}

function buildFixtures() {
  return [buildPropTestFixture(), buildTwoPropTestFixture(), buildCommentStatsFixture(), buildRatingToVoteFixture()];
}

function callFixtureFunction(name, args) {
  if (name === 'prop_test') return propTest(...args);
  if (name === 'two_prop_test') return twoPropTest(...args);
  if (name === 'comment_stats') return computeCommentStats(...args);
  if (name === 'rating_to_vote') return normalizeRatingSignedValue(...args);
  throw new Error(`Unknown parity fixture function: ${name}`);
}

function encodeParityArg(value) {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  if (Array.isArray(value)) return value.map(encodeParityArg);
  return value;
}

function decodeParityArg(value) {
  if (value === 'NaN') return NaN;
  if (Array.isArray(value)) return value.map(decodeParityArg);
  return value;
}

function toStoredFixture(fixture) {
  return {
    ...fixture,
    cases: fixture.cases.map((testCase) => ({
      ...testCase,
      args: testCase.args.map(encodeParityArg),
    })),
  };
}

function assertClose(actual, expected, label) {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(EPSILON);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect(actual).toHaveLength(expected.length);
    expected.forEach((expectedValue, index) => assertClose(actual[index], expectedValue, `${label}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    expect(actual && typeof actual === 'object' && !Array.isArray(actual)).toBe(true);
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    Object.keys(expected).forEach((key) => assertClose(actual[key], expected[key], `${label}.${key}`));
    return;
  }
  expect(actual).toEqual(expected);
}

function assertFixtureReplays(fixture) {
  fixture.cases.forEach((testCase, index) => {
    const actual = callFixtureFunction(fixture.function, testCase.args.map(decodeParityArg));
    assertClose(actual, testCase.expected, `${fixture.function}[${index}]`);
  });
}

describe('commonground parity fixtures', () => {
  it('exports and replays canonical consensus math fixtures', () => {
    const fixtures = buildFixtures();

    fixtures.forEach(assertFixtureReplays);

    if (process.env.GENERATE_PARITY_FIXTURES === '1') {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      fixtures.forEach((fixture) => {
        fs.writeFileSync(
          path.join(ARTIFACT_DIR, `parity_${fixture.function}.json`),
          `${JSON.stringify(toStoredFixture(fixture), null, 2)}\n`,
          'utf8',
        );
      });
    }

    if (fs.existsSync(ARTIFACT_DIR)) {
      const storedFiles = fs
        .readdirSync(ARTIFACT_DIR)
        .filter((fileName) => /^parity_.*\.json$/.test(fileName))
        .sort();
      storedFiles.forEach((fileName) => {
        const storedFixture = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, fileName), 'utf8'));
        assertFixtureReplays(storedFixture);
      });
    }
  });
});
