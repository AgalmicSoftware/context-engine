import { normalizeScssContract } from './scssContractAssertions';

describe('normalizeScssContract', () => {
  it('normalizes quote style while preserving string values', () => {
    expect(normalizeScssContract('content: "\\2713";')).toBe("content: '\\2713';");
    expect(normalizeScssContract(':global([class*="createSurveyContainer"])')).toBe(
      ":global([class*='createSurveyContainer'])",
    );
  });

  it('collapses wrap-sensitive whitespace without changing declaration values', () => {
    expect(
      normalizeScssContract(`
        background: linear-gradient(
          180deg,
          rgba(21, 31, 74, 0.98),
          rgba(8, 12, 28, 0.995)
        );
      `),
    ).toBe('background: linear-gradient(180deg, rgba(21, 31, 74, 0.98), rgba(8, 12, 28, 0.995));');
  });
});
