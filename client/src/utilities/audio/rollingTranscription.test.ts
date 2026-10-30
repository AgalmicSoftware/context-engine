import {
  buildListeningModeSearch,
  isListeningModeQueryEnabled,
  mergeRollingTranscriptText,
  stitchRollingTranscriptSegments,
} from './rollingTranscription';

describe('rollingTranscription helpers', () => {
  it('deduplicates overlap while stitching transcript chunks in segment order', () => {
    const segments = [
      {
        id: 'later',
        index: 2,
        status: 'complete' as const,
        text: 'that the group should review before voting.',
        startedAt: 3,
      },
      {
        id: 'first',
        index: 0,
        status: 'complete' as const,
        text: 'We talked about budget timing and risk thresholds',
        startedAt: 1,
      },
      {
        id: 'pending',
        index: 1,
        status: 'transcribing' as const,
        text: 'ignored until done',
        startedAt: 2,
      },
      {
        id: 'middle',
        index: 1,
        status: 'complete' as const,
        text: 'risk thresholds that the group should review',
        startedAt: 2,
      },
    ];

    expect(stitchRollingTranscriptSegments(segments)).toBe(
      'We talked about budget timing and risk thresholds that the group should review before voting.',
    );
    expect(mergeRollingTranscriptText('alpha beta gamma', 'beta gamma delta')).toBe('alpha beta gamma delta');
  });

  it('round-trips listening mode query state without dropping other params', () => {
    expect(isListeningModeQueryEnabled('?mode=listening&session=demo')).toBe(true);
    expect(isListeningModeQueryEnabled('?mode=results')).toBe(false);
    expect(buildListeningModeSearch('?session=demo', true)).toBe('?session=demo&mode=listening');
    expect(buildListeningModeSearch('?session=demo&mode=listening', false)).toBe('?session=demo');
  });
});

it('marks a permanently failed chunk as a gap between successful transcript parts', () => {
  const segments = [
    { id: 'first', index: 0, status: 'complete' as const, text: 'Before.', startedAt: 1 },
    { id: 'lost', index: 1, status: 'failed' as const, text: '', startedAt: 2 },
    { id: 'last', index: 2, status: 'complete' as const, text: 'After.', startedAt: 3 },
  ];
  expect(stitchRollingTranscriptSegments(segments)).toBe(
    'Before. [Recording gap: chunk 2 could not be transcribed.] After.',
  );
});
