import {
  DEFAULT_REALTIME_INTERVIEW_MODEL,
  REALTIME_INTERVIEW_PROVIDER,
  normalizeRealtimeInterviewModel,
} from './realtimeInterviewConfig';

describe('realtimeInterviewConfig', () => {
  it('keeps supported OpenAI Realtime model IDs', () => {
    expect(REALTIME_INTERVIEW_PROVIDER).toBe('openai');
    expect(normalizeRealtimeInterviewModel(' gpt-realtime-2.1 ')).toBe('gpt-realtime-2.1');
  });

  it('falls back to the current default for empty or non-Realtime model IDs', () => {
    expect(DEFAULT_REALTIME_INTERVIEW_MODEL).toBe('gpt-live-1');
    expect(normalizeRealtimeInterviewModel('gpt-live-1')).toBe('gpt-live-1');
    expect(normalizeRealtimeInterviewModel('gpt-realtime-invented')).toBe('gpt-live-1');
    expect(normalizeRealtimeInterviewModel('gpt-realtime')).toBe('gpt-live-1');
    expect(normalizeRealtimeInterviewModel('')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
    expect(normalizeRealtimeInterviewModel('gpt-5')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
  });
});
