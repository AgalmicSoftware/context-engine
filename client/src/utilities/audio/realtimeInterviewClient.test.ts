import {
  buildRealtimeInterviewTranscript,
  readRealtimeResponderTurn,
  REALTIME_INTERVIEW_OPENING_INSTRUCTION,
} from './realtimeInterviewClient';

describe('realtime interview transcript collection', () => {
  it('collects only completed responder transcription events', () => {
    expect(
      readRealtimeResponderTurn({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item-1',
        transcript: 'Reversible decisions matter.',
      }),
    ).toEqual({ itemId: 'item-1', text: 'Reversible decisions matter.', role: 'responder' });
    expect(readRealtimeResponderTurn({ type: 'response.output_audio_transcript.done', transcript: 'Assistant' })).toBeNull();
  });

  it('builds a mapper transcript without assistant utterances', () => {
    expect(
      buildRealtimeInterviewTranscript([
        { itemId: 'one', text: 'First point.', role: 'responder' },
        { itemId: 'two', text: 'Second point.', role: 'responder' },
      ]),
    ).toBe('Responder: First point.\nResponder: Second point.');
  });

  it('opens with personal-or-topic insight and makes steering explicit', () => {
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain('either about themselves and their perspective or about the broader topic');
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain('steer the conversation');
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain('at any point');
  });
});
