import {
  DEFAULT_REALTIME_INTERVIEW_MODEL,
  REALTIME_INTERVIEW_MODELS,
  REALTIME_INTERVIEW_PROVIDER,
  normalizeRealtimeInterviewModel,
} from './realtimeInterviewConfig';

describe('realtimeInterviewConfig', () => {
  it('keeps supported OpenAI Realtime model IDs', () => {
    expect(REALTIME_INTERVIEW_PROVIDER).toBe('openai');
    expect(normalizeRealtimeInterviewModel(' gpt-realtime-2.1 ')).toBe('gpt-realtime-2.1');
  });

  it('falls back to the current default for empty or non-Realtime model IDs', () => {
    expect(DEFAULT_REALTIME_INTERVIEW_MODEL).toBe('gpt-live-1.1');
    expect(normalizeRealtimeInterviewModel('gpt-live-1')).toBe('gpt-live-1');
    expect(normalizeRealtimeInterviewModel('gpt-realtime-invented')).toBe('gpt-live-1.1');
    expect(normalizeRealtimeInterviewModel('gpt-realtime')).toBe('gpt-live-1.1');
    expect(normalizeRealtimeInterviewModel('')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
    expect(normalizeRealtimeInterviewModel('gpt-5')).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
  });

  it('keeps gpt-live-1.1 and no near miss of it', () => {
    expect(normalizeRealtimeInterviewModel('gpt-live-1.1')).toBe('gpt-live-1.1');
    for (const model of ['gpt-live-1.10', 'gpt-live-1.1-mini', 'GPT-LIVE-1.1', 'gpt-live-2']) {
      expect(normalizeRealtimeInterviewModel(model)).toBe(DEFAULT_REALTIME_INTERVIEW_MODEL);
    }
    expect(REALTIME_INTERVIEW_MODELS.slice(0, 2)).toEqual(['gpt-live-1.1', 'gpt-live-1']);
  });
});
