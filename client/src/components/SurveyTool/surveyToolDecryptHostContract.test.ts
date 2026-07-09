import {
  applyQuestionDecryptBusyTokenRegistration,
  canUpdateStateForAsyncSnapshot,
  canUpdateSurveyDecryptAttemptOnHost,
  finishSurveyDecryptAttemptOnHost,
  isDecryptContextCurrentForHost,
  replaceQuestionDecryptBusyTokens,
  startSurveyDecryptAttemptOnHost,
} from './surveyToolDecryptHostContract';

describe('surveyToolDecryptHostContract', () => {
  it('tracks question decrypt busy token ownership on the host', () => {
    const host = {
      _questionDecryptBusyTokenSeq: 0,
      _questionDecryptBusyTokens: {},
    };

    const token = applyQuestionDecryptBusyTokenRegistration(host, {
      token: 1,
      busyTokens: { 'q1:answer': 1 },
    });

    expect(token).toBe(1);
    expect(host._questionDecryptBusyTokenSeq).toBe(1);
    expect(host._questionDecryptBusyTokens).toEqual({ 'q1:answer': 1 });

    replaceQuestionDecryptBusyTokens(host, {});
    expect(host._questionDecryptBusyTokens).toEqual({});
  });

  it('pins mounted snapshot freshness to the current context key', () => {
    const host = { _isMounted: true };
    const buildDecryptContextKey = (snapshot: { account?: unknown; sessionSlug?: unknown } | null) =>
      `${snapshot?.account || ''}|${snapshot?.sessionSlug || ''}`;
    const snapshot = { account: '0xabc', mounted: true, sessionSlug: 'edge' };

    expect(canUpdateStateForAsyncSnapshot(host, snapshot)).toBe(true);
    expect(
      isDecryptContextCurrentForHost({
        host,
        snapshot,
        currentSnapshot: { account: '0xabc', mounted: true, sessionSlug: 'edge' },
        buildDecryptContextKey,
      }),
    ).toBe(true);
    expect(
      isDecryptContextCurrentForHost({
        host,
        snapshot,
        currentSnapshot: { account: '0xdef', mounted: true, sessionSlug: 'edge' },
        buildDecryptContextKey,
      }),
    ).toBe(false);

    host._isMounted = false;
    expect(canUpdateStateForAsyncSnapshot(host, snapshot)).toBe(false);
  });

  it('owns survey decrypt attempt sequencing and finish semantics', () => {
    const host = {
      _activeSurveyDecryptAttemptSeq: 0,
      _isMounted: true,
      _surveyDecryptAttemptSeq: 0,
    };
    const snapshot = { mounted: true };

    const attemptId = startSurveyDecryptAttemptOnHost(host);

    expect(attemptId).toBe(1);
    expect(host._surveyDecryptAttemptSeq).toBe(1);
    expect(host._activeSurveyDecryptAttemptSeq).toBe(1);
    expect(canUpdateSurveyDecryptAttemptOnHost(host, snapshot, attemptId)).toBe(true);

    finishSurveyDecryptAttemptOnHost(host, attemptId + 1);
    expect(host._activeSurveyDecryptAttemptSeq).toBe(1);

    finishSurveyDecryptAttemptOnHost(host, attemptId);
    expect(host._activeSurveyDecryptAttemptSeq).toBe(0);
    expect(canUpdateSurveyDecryptAttemptOnHost(host, snapshot, attemptId)).toBe(false);
  });
});
