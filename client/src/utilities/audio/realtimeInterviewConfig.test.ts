import {
  DEFAULT_REALTIME_INTERVIEW_MODEL,
  REALTIME_INTERVIEW_PROVIDER,
  normalizeRealtimeInterviewModel,
} from './realtimeInterviewConfig';

describe('realtimeInterviewConfig', () => {
  it('keeps supported OpenAI Realtime model IDs', () => {
    expect(REALTIME_INTERVIEW_PROVIDER).toBe('openai');
    expect(normalizeRealtimeInterviewModel(' gpt-realtime-custom.1 ')).toBe('gpt-realtime-custom.1');
  });

  it('falls back to the current default for empty or non-Realtime model IDs', () => {
    expect(normalizeRealtimeInterviewModel('')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
    expect(normalizeRealtimeInterviewModel('gpt-5')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
  });
});
