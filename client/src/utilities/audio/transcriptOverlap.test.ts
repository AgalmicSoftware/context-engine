import { mergeTranscriptText } from '../ai/aiClientAudioTranscription';
import { mergeRollingTranscriptText } from './rollingTranscription';

for (const [name, merge] of [
  ['uploaded audio', mergeTranscriptText],
  ['rolling audio', mergeRollingTranscriptText],
] as const) {
  describe(name, () => {
    it.each([
      ['Apollo mission', 'Apollo mission 予算は未承認です。', 'Apollo mission 予算は未承認です。'],
      ['Apollo mission', 'Apollo mission needs approval.', 'Apollo mission needs approval.'],
      ['Earlier speech', '予算は未承認です。', 'Earlier speech 予算は未承認です。'],
      ['Apollo mission', 'Apollo mission été prochain', 'Apollo mission été prochain'],
      ['Apollo mission', 'Apollo mission бюджет не одобрен', 'Apollo mission бюджет не одобрен'],
      ['Apollo mission', 'Apollo mission Apollo mission', 'Apollo mission Apollo mission'],
      ['Apollo mission.', 'Apollo mission. New speech.', 'Apollo mission. New speech.'],
      ['Très longue phrase', 'longue phrase suivante', 'Très longue phrase suivante'],
      ['Долгое обсуждение', 'Долгое обсуждение продолжается', 'Долгое обсуждение продолжается'],
    ])('preserves new speech in %s / %s', (previous, next, expected) => {
      expect(merge(previous, next)).toBe(expected);
    });
  });
}
