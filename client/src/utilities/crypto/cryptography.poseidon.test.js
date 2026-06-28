import { cryptoUtils } from './cryptography.js';

const SURVEY_ID = `0x${'34'.repeat(32)}`;
const EXPECTED_POSEIDON_HEX = `0x${'0'.repeat(63)}5`;

describe('cryptoUtils poseidon helpers', () => {
  beforeEach(() => {
    delete window.poseidon;
    delete window.poseidon1;
    delete window.Poseidon;
  });

  afterEach(() => {
    delete window.poseidon;
    delete window.poseidon1;
    delete window.Poseidon;
    jest.restoreAllMocks();
  });

  it('does not fabricate a poseidon hash when no hasher is available', async () => {
    const field = { value: 'hello world' };

    await cryptoUtils.addTopLevelPoseidonIfRequired(field, {
      kind: 'freeform',
      chainId: 84532,
      surveyId: SURVEY_ID,
      qId: 'q-poseidon-missing',
    });

    expect(field.poseidon).toBeUndefined();
  });

  it('awaits async poseidon hashers before populating the top-level field hash', async () => {
    const field = { value: 'hello world' };
    const hasher = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return 5n;
    });

    await cryptoUtils.addTopLevelPoseidonIfRequired(field, {
      kind: 'freeform',
      chainId: 84532,
      surveyId: SURVEY_ID,
      qId: 'q-poseidon-async',
      hasher,
    });

    expect(hasher).toHaveBeenCalledTimes(1);
    expect(field.poseidon).toBe(EXPECTED_POSEIDON_HEX);
  });

  it('omits rating poseidon for blank and null values', async () => {
    const emptyValues = ['', '   ', null, undefined];

    for (const value of emptyValues) {
      const field = { value };
      const hasher = jest.fn(() => 5n);

      await cryptoUtils.addTopLevelPoseidonIfRequired(field, {
        kind: 'rating',
        chainId: 84532,
        surveyId: SURVEY_ID,
        qId: 'q-rating-empty',
        hasher,
      });

      expect(hasher).not.toHaveBeenCalled();
      expect(field.poseidon).toBeUndefined();
    }
  });

  it('keeps explicit zero rating values eligible for poseidon', async () => {
    for (const value of [0, '0']) {
      const field = { value };
      const hasher = jest.fn(() => 5n);

      await cryptoUtils.addTopLevelPoseidonIfRequired(field, {
        kind: 'rating',
        chainId: 84532,
        surveyId: SURVEY_ID,
        qId: 'q-rating-zero',
        hasher,
      });

      expect(hasher).toHaveBeenCalledTimes(1);
      expect(field.poseidon).toBe(EXPECTED_POSEIDON_HEX);
    }
  });
});
