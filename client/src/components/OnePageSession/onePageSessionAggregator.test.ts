import { computeAggregatorSourceSnapshotSignature } from './onePageSessionAggregator';

describe('computeAggregatorSourceSnapshotSignature', () => {
  const signature = (patch: Record<string, unknown>) =>
    computeAggregatorSourceSnapshotSignature({
      q1: { '0xa': { type: 'binary', answer: { value: 'Agree', encrypted: false }, ...patch } },
    });

  it.each([
    ['a comment edit', { additional: { value: 'First' } }, { additional: { value: 'Second' } }],
    ['a display-name edit', { responderName: 'Sam' }, { responderName: 'Sam P.' }],
    ['a conviction cleared from 0', { conviction: 0 }, { conviction: '' }],
    ['an answer changed from 0 to blank', { answer: { value: 0 } }, { answer: { value: '' } }],
    ['an answer changed from false to blank', { answer: { value: false } }, { answer: { value: '' } }],
  ])('changes for %s on an object-form response', (_label, before, after) => {
    expect(signature(after)).not.toBe(signature(before));
  });

  it('stays the same for identical responses', () => {
    expect(signature({ additional: { value: 'Same' } })).toBe(signature({ additional: { value: 'Same' } }));
  });
});
