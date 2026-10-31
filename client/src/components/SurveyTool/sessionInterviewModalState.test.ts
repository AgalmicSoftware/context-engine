import type { InterviewPrefillPacket } from './sessionInterview';
import { displayResponderContext, omitConcealedInterviewFacts } from './sessionInterviewModalState';

type ImportedFacts = NonNullable<InterviewPrefillPacket['responderContext']['facts']>;

const packetWith = (facts: ImportedFacts, summary?: string): InterviewPrefillPacket => ({
  version: 1,
  sessionSlug: 'demo',
  source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
  responderContext: { facts, ...(summary ? { summary } : {}) },
});
const questions = [{ id: 'q-hidden' }, { id: 'q-shown' }];
const isConcealed = (questionId: string) => questionId === 'q-hidden';
const voiceContext = (packet: InterviewPrefillPacket, context = displayResponderContext(packet)) =>
  omitConcealedInterviewFacts(context, packet, isConcealed, questions);

describe('omitConcealedInterviewFacts', () => {
  it('removes a concealed fact whole, without cutting its text out of a shown fact', () => {
    const packet = packetWith([
      { fact: 'Rents in the city centre', relatedQuestionIds: ['q-hidden'] },
      { fact: 'Rents in the city centre and cycles to work', relatedQuestionIds: ['q-shown'] },
    ]);

    expect(voiceContext(packet)).toBe('Rents in the city centre and cycles to work');
  });

  it('counts only related questions in this interview, as the realtime prefill does', () => {
    const packet = packetWith([
      { fact: 'Backs the transit levy', relatedQuestionIds: ['q-hidden', 'q-elsewhere'] },
      { fact: 'Volunteers at the library', relatedQuestionIds: ['q-elsewhere'] },
      { fact: 'Has two children' },
    ]);

    expect(voiceContext(packet)).toBe('Volunteers at the library\nHas two children');
  });

  it('keeps a fact with a shown question, and a concealed text that a shown fact repeats', () => {
    const packet = packetWith([
      { fact: 'Works night shifts', relatedQuestionIds: ['q-hidden', 'q-shown'] },
      { fact: 'Owns a car', relatedQuestionIds: ['q-hidden'] },
      { fact: 'Owns a car', relatedQuestionIds: ['q-shown'] },
    ]);

    expect(voiceContext(packet)).toBe('Works night shifts\nOwns a car\nOwns a car');
  });

  it('removes a concealed fact copied onto its own lines of an edited context', () => {
    const packet = packetWith(
      [
        { fact: 'Prefers buses\nover trams', relatedQuestionIds: ['q-hidden'] },
        { fact: 'Walks to the market (twice a week?)', relatedQuestionIds: ['q-hidden'] },
      ],
      'Lives near the river.',
    );
    const edited =
      'Lives near the river.\n  Walks to the market (twice a week?)  \nPrefers buses\nover trams\nMy own note.';

    expect(voiceContext(packet, edited)).toBe('Lives near the river.\nMy own note.');
  });

  const levy = { fact: 'Backs the transit levy', relatedQuestionIds: ['q-hidden'] };

  it('removes a concealed fact quoted inside the summary, whatever its case', () => {
    const packet = packetWith([levy], 'Lena rents near the station. Backs the transit levy. Works nights.');

    expect(voiceContext(packet)).toBe('Lena rents near the station. Works nights.');
    expect(voiceContext(packet, 'Lena backs the transit levy, and works nights.')).toBe('Lena and works nights.');
  });

  it('removes a concealed fact from edited lines such as "- fact" and "fact."', () => {
    const packet = packetWith([levy, { fact: 'Has two children' }]);

    expect(voiceContext(packet, '- Backs the transit levy\nHas two children\nBacks the transit levy.')).toBe(
      'Has two children',
    );
  });

  it('keeps a shown fact that contains the concealed words, and words that only start the same', () => {
    const packet = packetWith(
      [levy, { fact: 'Backs the transit levy for night buses', relatedQuestionIds: ['q-shown'] }],
      'Backs the transit levy for night buses. Backs the transit levy.',
    );

    expect(voiceContext(packet)).toBe('Backs the transit levy for night buses.');
    expect(voiceContext(packet, 'Backs the transit levying plan.')).toBe('Backs the transit levying plan.');
  });
});
