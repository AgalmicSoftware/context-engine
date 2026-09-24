import { buildResultsAnalysisBrowserSnapshotFromCacheNode } from './sessionResultsAnalysisBrowserSnapshot';
import { loadAdminSnapshotResultsAnalysisSource } from '../../../../workers/sessionCorsWorker/resultsAnalysisGeneration';

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

  it('preserves canonical scale, selection and allocation semantics through the Worker snapshot reader', async () => {
    const scale = { min: 0, max: 100, minLabel: 'Impossible', maxLabel: 'Certain' };
    const questions = {
      rating: { id: 'rating', type: 'rating', prompt: 'Probability?', ratingScale: scale },
      single: { id: 'single', type: 'multichoice', prompt: 'Choose one', options: ['A', 'B'], singleSelect: true },
      multi: {
        id: 'multi',
        type: 'multichoice',
        prompt: 'Choose up to two',
        options: ['A', 'B', 'C'],
        singleSelect: false,
        maxSelections: 2,
      },
      quadratic: { id: 'quadratic', type: 'quadratic', prompt: 'Allocate', options: ['A', 'B'], voiceCredits: 25 },
    };
    const values = { rating: 0, single: ['A'], multi: ['A', 'B'], quadratic: [3, -4] };
    const result = buildResultsAnalysisBrowserSnapshotFromCacheNode({
      sessionSlug: 'edge',
      networkNode: {
        questions,
        questionResponses: Object.fromEntries(
          Object.entries(values).map(([id, value]) => [
            id,
            { participant: { answer: { value }, sessionSlug: 'edge' } },
          ]),
        ),
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rating', scale }),
        expect.objectContaining({ id: 'single', singleSelect: true }),
        expect.objectContaining({ id: 'multi', singleSelect: false, maxSelections: 2 }),
        expect.objectContaining({ id: 'quadratic', voiceCredits: 25 }),
      ]),
    );
    expect(result.snapshot.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'quadratic', answer: [3, -4] }),
        expect.objectContaining({ questionId: 'multi', answer: ['A', 'B'] }),
        expect.objectContaining({ questionId: 'rating', answer: 0 }),
      ]),
    );
    const source = await loadAdminSnapshotResultsAnalysisSource({
      slug: 'edge',
      config: { slug: 'edge' },
      body: { source: { kind: 'admin-snapshot', snapshot: result.snapshot } },
    });
    expect(source.ok).toBe(true);
    if (!source.ok || !('aiSnapshot' in source)) throw new Error('Worker did not return an AI snapshot.');
    expect(source.aiSnapshot.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'single', singleSelect: true }),
        expect.objectContaining({ id: 'multi', singleSelect: false, maxSelections: 2 }),
      ]),
    );
    expect(source.aiSnapshot.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rating', scale }),
        expect.objectContaining({ id: 'quadratic', voiceCredits: 25 }),
      ]),
    );
  });

  it('keeps neutral allocations and excludes unrelated cached metadata', () => {
    const result = buildResultsAnalysisBrowserSnapshotFromCacheNode({
      sessionSlug: 'edge',
      networkNode: {
        questions: {
          q: { id: 'q', type: 'quadratic', options: ['A', 'B'], privateNotes: 'Never export', secret: 'Never export' },
        },
        questionResponses: {
          q: { participant: { sessionSlug: 'edge', answer: { value: [0, 0] }, additional: { value: ['one', 'two'] } } },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.responses[0]).toEqual(
      expect.objectContaining({ answer: [0, 0], additionalComments: 'one; two' }),
    );
    expect(result.snapshot.questions[0]).toEqual({
      id: 'q',
      prompt: '',
      type: 'quadratic',
      options: ['A', 'B'],
      tags: [],
      voiceCredits: 99,
    });
  });

  it('reports unsupported when cache is not hydrated', () => {
    const result = buildResultsAnalysisBrowserSnapshotFromCacheNode({ networkNode: {}, sessionSlug: 'edge' });
    expect(result.ok).toBe(false);
  });
});
