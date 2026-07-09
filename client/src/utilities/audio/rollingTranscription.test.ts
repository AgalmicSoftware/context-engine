import {
  buildListeningDraftStorageKey,
  buildListeningModeSearch,
  clearListeningDraft,
  isListeningModeQueryEnabled,
  mergeRollingTranscriptText,
  readListeningDraft,
  stitchRollingTranscriptSegments,
  writeListeningDraft,
} from './rollingTranscription';

describe('rollingTranscription helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it('persists only transcript and segment metadata for recovery', () => {
    const segment = {
      id: 'segment-1',
      index: 0,
      status: 'complete' as const,
      text: 'Recovered transcript',
      startedAt: 10,
      completedAt: 20,
    };

    expect(
      writeListeningDraft('demo', {
        transcript: 'Recovered transcript',
        segments: [segment],
      }),
    ).toBe(true);

    expect(window.localStorage.getItem(buildListeningDraftStorageKey('demo'))).not.toContain('Blob');
    expect(readListeningDraft('demo')).toEqual(
      expect.objectContaining({
        sessionSlug: 'demo',
        transcript: 'Recovered transcript',
        segments: [segment],
      }),
    );
    expect(clearListeningDraft('demo')).toBe(true);
    expect(readListeningDraft('demo')).toBeNull();
  });

  it('restores unfinished draft segments as interrupted errors', () => {
    const segment = {
      id: 'segment-queued',
      index: 1,
      status: 'transcribing' as const,
      text: '',
      startedAt: 30,
    };

    expect(
      writeListeningDraft('demo', {
        transcript: '',
        segments: [segment],
      }),
    ).toBe(true);

    expect(readListeningDraft('demo')?.segments[0]).toEqual(
      expect.objectContaining({
        id: 'segment-queued',
        index: 1,
        status: 'error',
        error: 'Recording interrupted before transcription completed.',
      }),
    );
  });
});
