import {
  buildListeningModeSearch,
  isListeningModeQueryEnabled,
  stitchRollingTranscriptSegments,
  transcriptSpeech,
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
    'Before. [Recording gap: audio could not be transcribed.] After.',
  );
});

it('counts only speech, not gap markers or speaker labels, toward a transcript worth generating from', () => {
  const failed = (index: number) => ({
    id: `lost-${index}`,
    index,
    status: 'failed' as const,
    text: '',
    startedAt: index,
  });
  expect(transcriptSpeech(stitchRollingTranscriptSegments([failed(0), failed(1), failed(11)]))).toBe('');
  expect(
    transcriptSpeech(
      stitchRollingTranscriptSegments([
        failed(0),
        { id: 'said', index: 1, status: 'complete' as const, text: 'Spoken words.', startedAt: 1 },
      ]),
    ),
  ).toBe('Spoken words.');
  expect(transcriptSpeech('Person 1: Hello.\nPerson 12: Hi.')).toBe('Hello.\nHi.');
});

const turn = (speaker: string, text: string) => ({ speaker, start: 0, end: 1, text });
const chunk = (index: number, text: string, turns?: ReturnType<typeof turn>[]) => ({
  id: `chunk-${index}`,
  index,
  status: 'complete' as const,
  text,
  startedAt: index,
  speakerTurns: turns,
});

it('shows each voice as Person turns, and chunks without turns as plain text', () => {
  const segments = [
    chunk(0, 'Should we fund it? Yes, this year.', [
      turn('Person 1', 'Should we fund it?'),
      turn('Person 2', 'Yes,'),
      turn('Person 2', 'this year.'),
    ]),
    // A chunk transcribed without labels, then a lost one.
    chunk(1, 'The budget is due in May.'),
    { id: 'lost', index: 2, status: 'failed' as const, text: '', startedAt: 2 },
    chunk(3, 'Agreed. Then we vote.', [turn('Person 2', 'Agreed.'), turn('Person 1', 'Then we vote.')]),
  ];
  expect(stitchRollingTranscriptSegments(segments)).toBe(
    [
      'Person 1: Should we fund it?',
      'Person 2: Yes, this year.',
      'The budget is due in May. [Recording gap: audio could not be transcribed.]',
      'Person 2: Agreed.',
      'Person 1: Then we vote.',
    ].join('\n'),
  );
});

it('drops speech both chunks heard from one voice, and joins a voice that carries on across chunks', () => {
  const segments = [
    chunk(0, 'We talked about budget timing and risk thresholds', [
      turn('Person 1', 'We talked about budget timing and risk thresholds'),
    ]),
    chunk(1, 'risk thresholds that the group should review. I agree with that.', [
      turn('Person 1', 'risk thresholds that the group should review.'),
      turn('Person 2', 'I agree with that.'),
    ]),
    chunk(2, 'agree with that. Next item.', [turn('Person 2', 'agree with that. Next item.')]),
  ];
  expect(stitchRollingTranscriptSegments(segments)).toBe(
    [
      'Person 1: We talked about budget timing and risk thresholds that the group should review.',
      'Person 2: I agree with that. Next item.',
    ].join('\n'),
  );
});

it('keeps a second voice echoing the end of the first across a chunk boundary', () => {
  const segments = [
    chunk(0, 'So we should fund the garden.', [turn('Person 1', 'So we should fund the garden.')]),
    chunk(1, 'We should fund the garden. Yes.', [turn('Person 2', 'We should fund the garden. Yes.')]),
  ];
  expect(stitchRollingTranscriptSegments(segments)).toBe(
    ['Person 1: So we should fund the garden.', 'Person 2: We should fund the garden. Yes.'].join('\n'),
  );
});

it('notes time without audio before a chunk, without counting it as speech', () => {
  const after = (gapBefore: { startedAt: number; endedAt: number; cause: 'muted' | 'stalled' }) => ({
    ...chunk(1, 'After.'),
    gapBefore,
  });
  const muted = stitchRollingTranscriptSegments([
    chunk(0, 'Before.'),
    after({ startedAt: 1_000, endedAt: 21_400, cause: 'muted' }),
  ]);
  expect(muted).toBe('Before. [Microphone paused for 20 s.] After.');
  const stalled = stitchRollingTranscriptSegments([
    chunk(0, 'Before.', [turn('Person 1', 'Before.')]),
    { ...after({ startedAt: 0, endedAt: 220_000, cause: 'stalled' }), speakerTurns: [turn('Person 1', 'After.')] },
  ]);
  expect(stalled).toBe('Person 1: Before.\n[No audio for 3 min 40 s.]\nPerson 1: After.');
  expect(transcriptSpeech(muted)).toBe('Before.  After.');
  expect(transcriptSpeech(stalled)).toBe('Before.\n\nAfter.');
});
