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
});
