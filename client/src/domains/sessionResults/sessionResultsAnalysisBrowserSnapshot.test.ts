import { buildResultsAnalysisBrowserSnapshotFromCacheNode } from './sessionResultsAnalysisBrowserSnapshot';

describe('sessionResultsAnalysisBrowserSnapshot', () => {
  it('builds sanitized same-session snapshots and skips locked/demo rows', () => {
    const result = buildResultsAnalysisBrowserSnapshotFromCacheNode({
      sessionSlug: 'edge',
      networkNode: {
        questions: {
          q1: { id: 'q1', prompt: 'What should improve?', type: 'text', sessionSlug: 'edge' },
        },
        questionResponses: {
          q1: {
            '0xaaa': {
              answer: { value: 'Use clearer reports' },
              additional: { value: 'Add source counts' },
              sessionSlug: 'edge',
            },
            '0xbbb': { answer: { value: '*', encrypted: true }, sessionSlug: 'edge' },
            '0xbbc': {
              answer: { value: 'Visible answer' },
              additionalComments: { encryptedPortion: 'ciphertext' },
              sessionSlug: 'edge',
            },
            '0xccc': { source: 'demo-polis-data', answer: { value: 'seeded' }, sessionSlug: 'edge' },
            '0xddd': { answer: { value: 'foreign' }, sessionSlug: 'other' },
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.questions).toHaveLength(1);
      expect(result.snapshot.responses).toEqual([
        expect.objectContaining({ questionId: 'q1', participantId: '0xaaa', answer: 'Use clearer reports' }),
      ]);
      expect(result.snapshot.responses[0]).toEqual(
        expect.objectContaining({ additionalComments: 'Add source counts' }),
      );
      expect(result.counts.lockedCount).toBe(2);
    }
  });

  it('reports unsupported when cache is not hydrated', () => {
    const result = buildResultsAnalysisBrowserSnapshotFromCacheNode({ networkNode: {}, sessionSlug: 'edge' });
    expect(result.ok).toBe(false);
  });
});
