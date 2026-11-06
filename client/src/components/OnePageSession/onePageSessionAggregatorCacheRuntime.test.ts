import { buildOnePageSessionAggregatorCacheResult } from './onePageSessionAggregatorCacheRuntime';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { upsertWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerConfigCache';

const answer = (questionID: string) => ({ questionID, type: 'binary', answer: { value: 'Agree', encrypted: false } });
const node = {
  questions: {
    q1: { id: 'q1', prompt: 'Shown', type: 'binary' },
    q2: { id: 'q2', prompt: 'Hidden', type: 'binary' },
  },
  questionResponses: { q1: { '0xa': answer('q1') }, q2: { '0xa': answer('q2') } },
};
const storeSession = (hidden: string[]) =>
  upsertWorkerCanonicalSessionBootstrap({
    slug: 'pilot',
    sessionIdHex: `0x${'1'.repeat(32)}`,
    workerOrigin: 'https://report-worker.example.test',
    configRevision: 'r1',
    config: {
      slug: 'pilot',
      sessionId: `0x${'1'.repeat(32)}`,
      corsWorkerUrl: 'https://report-worker.example.test',
      BLOCKED_QUESTION_IDS: hidden,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    },
  });
const build = () =>
  buildOnePageSessionAggregatorCacheResult({
    cacheScope: '11155420',
    displaySlug: 'pilot',
    isQuestionCacheReady: true,
    questionSourceSlug: 'pilot',
    readQuestionsCache: () => ({ '11155420': node }),
    resolveQuestionPool: () => [],
    workerCacheIdentity: null,
    writeQuestionsCache: jest.fn(),
  });

describe('buildOnePageSessionAggregatorCacheResult', () => {
  beforeEach(() => window.localStorage.clear());

  it('leaves a question on the hidden list, and its answers, out of the report', () => {
    expect(storeSession([]).status).toBe('cached');
    const shown = build();
    expect(Object.keys(shown.map).sort()).toEqual(['q1', 'q2']);

    storeSession(['q2']);
    const hidden = build();
    expect(Object.keys(hidden.map)).toEqual(['q1']);
    // A report built before the list changed is not reused.
    expect(hidden.sourceSignature).not.toBe(shown.sourceSignature);
  });
});
