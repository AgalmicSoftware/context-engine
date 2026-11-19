import {
  balanceLines,
  clampLines,
  fitLine,
  resolveAnalysisCardTheme,
  titleStep,
  wrapLines,
} from './analysisCardCanvas';
import { ANALYSIS_CARD_VIDEO_MS, slideProgressAt } from './analysisCardExport';

// Ten units a character, as a fixed-width face would measure.
const measure = (text: string): number => text.length * 10;

describe('card text layout', () => {
  it('wraps on spaces, and breaks only a word too wide for a line', () => {
    expect(wrapLines(measure, 'wants ai doing paperwork not governing', 160)).toEqual([
      'wants ai doing',
      'paperwork not',
      'governing',
    ]);
    expect(wrapLines(measure, 'see incomprehensibilities here', 100)).toEqual([
      'see',
      'incomprehe',
      'nsibilitie',
      's here',
    ]);
    // Text in a script written without spaces wraps by character.
    expect(wrapLines(measure, '賛成反対保留賛成反対', 40)).toEqual(['賛成反対', '保留賛成', '反対']);
    expect(wrapLines(measure, '   ', 100)).toEqual([]);
  });

  it('evens out the lines of a headline without adding one', () => {
    const text = 'accepts ai help rejects automated enforcement';
    expect(wrapLines(measure, text, 340)).toEqual(['accepts ai help rejects automated', 'enforcement']);
    expect(balanceLines(measure, text, 340)).toEqual(['accepts ai help rejects', 'automated enforcement']);
    expect(balanceLines(measure, 'short', 320)).toEqual(['short']);
    // Evening the lines out never breaks a word that fits on a line.
    expect(balanceLines(measure, 'trusts institutions more than markets', 190)).toEqual([
      'trusts institutions',
      'more than markets',
    ]);
    expect(balanceLines(measure, 'trusts institutions more than markets', 130)).toEqual([
      'trusts',
      'institutions',
      'more than',
      'markets',
    ]);
    expect(balanceLines(measure, 'decentralization first', 170)).toEqual(['decentralization', 'first']);
  });

  it('cuts text that runs past its space with an ellipsis', () => {
    expect(clampLines(measure, ['one two', 'three four', 'five'], 2, 100)).toEqual(['one two', 'three fou…']);
    expect(clampLines(measure, ['one', 'two'], 2, 100)).toEqual(['one', 'two']);
    expect(fitLine(measure, 'Francis Ford Coppola, 1974', 150)).toBe('Francis Ford C…');
    expect(fitLine(measure, 'Bill Forsyth, 1983', 400)).toBe('Bill Forsyth, 1983');
  });

  it('sets a longer description of the person in smaller type', () => {
    expect(titleStep('Tools Without Authority').size).toBe(168);
    expect(titleStep('Wants AI doing paperwork, not governing').size).toBe(112);
    expect(titleStep('Wants AI representatives with provable human permission').size).toBe(94);
  });
});

describe('card colours', () => {
  const contrastWith = (ground: string, colour: string): number => {
    const light = (value: string): number => {
      const [r, g, b] = [1, 3, 5].map((at) => {
        const unit = parseInt(value.slice(at, at + 2), 16) / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [high, low] = [light(ground), light(colour)].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
  };

  it.each([
    ['#ecdcb9', '#f15a2c'],
    ['#b7b4ad', '#f5821f'],
    ['#1f3d2b', '#f2d21b'],
    ['#f4f1ea', '#8a1c2b'],
  ])('keeps ink, accent and quiet text readable on %s', (ground, accentHex) => {
    const theme = resolveAnalysisCardTheme(ground, accentHex);
    expect(theme.ground).toBe(ground);
    expect(contrastWith(ground, theme.ink)).toBeGreaterThan(7);
    expect(contrastWith(ground, theme.accent)).toBeGreaterThanOrEqual(5.5);
    expect(contrastWith(ground, theme.soft)).toBeGreaterThanOrEqual(6);
  });

  it('falls back to the house colours without a picture', () => {
    expect(resolveAnalysisCardTheme(null, 'not a colour')).toMatchObject({ ground: '#173e4b', ink: '#f6ecd8' });
  });
});

describe('card animation', () => {
  it('holds page 1, slides once, then holds page 2', () => {
    expect(slideProgressAt(0)).toBe(0);
    expect(slideProgressAt(2200)).toBe(0);
    expect(slideProgressAt(2500)).toBeCloseTo(0.5);
    expect(slideProgressAt(2800)).toBe(1);
    expect(slideProgressAt(ANALYSIS_CARD_VIDEO_MS)).toBe(1);
    const steps = [2300, 2400, 2500, 2600, 2700].map(slideProgressAt);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
