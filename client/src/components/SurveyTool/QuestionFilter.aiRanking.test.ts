import {
  QuestionFilter as QuestionFilterComponent,
} from './QuestionFilter';
import * as aiScripts from '../../utilities/ai/aiScripts.js';
import * as aiSettings from '../../utilities/ai/aiSettings.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);

const QuestionFilter: any = QuestionFilterComponent;
const sponsoredAccessAny: any = sponsoredAccess;

describe('QuestionFilter AI ranking lifecycle', () => {
  it('enables AI filter when sponsored gate is available or local key exists', () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource');
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings');
    const instance = new QuestionFilter({ activeSessionSlug: 'edge' });

    gateSpy.mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.UNAVAILABLE });
    localSpy.mockReturnValue({ providers: {} });
    expect(instance.getAiAccessState()).toMatchObject({
      enabled: false,
      sponsoredAvailable: false,
      localKeyAvailable: false,
    });

    gateSpy.mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.UNAVAILABLE });
    localSpy.mockReturnValue({ providers: { openai: { apiKey: 'sk-local' } } });
    expect(instance.getAiAccessState()).toMatchObject({
      enabled: true,
      localKeyAvailable: true,
    });

    gateSpy.mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.RESTRICTED });
    localSpy.mockReturnValue({ providers: {} });
    expect(instance.getAiAccessState()).toMatchObject({
      enabled: true,
      sponsoredAvailable: true,
    });

    gateSpy.mockRestore();
    localSpy.mockRestore();
  });

  it('applies AI ranking against full available pool and keeps ranked order', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI').mockResolvedValue(['q3', 'q1']);

    const questions = [
      { id: 'q1', type: 'binary', tags: ['alpha'], prompt: 'Q1' },
      { id: 'q2', type: 'rating', tags: ['alpha'], prompt: 'Q2' },
      { id: 'q3', type: 'binary', tags: ['alpha'], prompt: 'Q3' },
      { id: 'q4', type: 'binary', tags: ['beta'], prompt: 'Q4' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
      account: '0xabc',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      selectedTags: ['alpha'],
      pendingSelectedTypes: ['binary'],
      pendingSbtFilteredQuestions: [{ id: 'q1' }, { id: 'q3' }],
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      aiDraftQuery: 'climate',
      aiRankingCount: 2,
    };

    await instance.handleApplyAIFilter({ auto: false, source: 'test' });

    expect(rankSpy).toHaveBeenCalledTimes(1);
    expect(rankSpy).toHaveBeenCalledWith(
      'climate',
      expect.arrayContaining([
        expect.objectContaining({ id: 'q1' }),
        expect.objectContaining({ id: 'q2' }),
        expect.objectContaining({ id: 'q3' }),
        expect.objectContaining({ id: 'q4' }),
      ]),
      4,
      expect.objectContaining({
        sessionSlug: 'edge',
      })
    );
    expect(instance.state.aiRankedQuestionIds).toEqual(['q3', 'q1']);
    expect(instance.state.aiFilterApplied).toBe(true);

    instance.state = {
      ...instance.state,
      aiSearchQuery: 'climate',
      aiAppliedTopN: 2,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q3', 'q1'],
    };
    const result = instance.buildFilterPipelineResult(true);
    expect(result.finalQuestions.map((q: any) => q.id)).toEqual(['q3', 'q1']);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('uses AI override by default and intersects when combine is enabled', () => {
    const questions = [
      { id: 'q1', type: 'binary', tags: ['alpha'], prompt: 'Q1' },
      { id: 'q2', type: 'rating', tags: ['alpha'], prompt: 'Q2' },
      { id: 'q3', type: 'binary', tags: ['alpha'], prompt: 'Q3' },
      { id: 'q4', type: 'binary', tags: ['beta'], prompt: 'Q4' },
    ];
    const instance = new QuestionFilter({
      questions,
      questionResponses: {},
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingSelectedTypes: ['binary'],
      pendingSbtFilteredQuestions: [{ id: 'q1' }, { id: 'q3' }],
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: ['alpha'],
      aiSearchQuery: 'climate',
      aiAppliedTopN: 2,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q4', 'q3', 'q1', 'q2'],
      aiCombineWithOtherFilters: false,
    };

    const overrideResult = instance.buildFilterPipelineResult(true);
    expect(overrideResult.finalQuestions.map((q: any) => q.id)).toEqual(['q4', 'q3']);

    instance.state = {
      ...instance.state,
      aiCombineWithOtherFilters: true,
    };
    const combinedResult = instance.buildFilterPipelineResult(true);
    expect(combinedResult.finalQuestions.map((q: any) => q.id)).toEqual(['q3', 'q1']);
  });

  it('auto-reapplies AI when external filter state carries aiFilter + aiTopN', async () => {
    jest.useFakeTimers();
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI').mockResolvedValue(['q1']);

    const questions = [{ id: 'q1', type: 'binary', tags: [], prompt: 'Q1' }];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.handleApplyFilters = jest.fn();

    instance.syncExternalFilterState({
      aiFilter: 'water',
      aiTopN: 3,
      questionTypes: [],
      selectedTags: [],
      sbtFilter: null,
      topQuestions: null,
    });

    jest.runAllTimers();
    await Promise.resolve();

    expect(rankSpy).toHaveBeenCalledTimes(1);
    expect(rankSpy).toHaveBeenCalledWith(
      'water',
      expect.any(Array),
      3,
      expect.objectContaining({ sessionSlug: 'edge' })
    );

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
    jest.useRealTimers();
  });

  it('re-applies AI ranking when candidate questions change under same query/topN', async () => {
    jest.useFakeTimers();
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI')
      .mockResolvedValueOnce(['q1'])
      .mockResolvedValueOnce(['q2', 'q1']);

    const initialQuestions = [{ id: 'q1', type: 'binary', tags: [], prompt: 'Q1' }];
    const nextQuestions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions: initialQuestions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.handleApplyFilters = jest.fn();
    instance.state = {
      ...instance.state,
      mergedQuestions: initialQuestions,
      pendingSelectedTypes: [],
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    await instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'water',
      topNOverride: 2,
      source: 'initial-apply',
    });
    expect(rankSpy).toHaveBeenCalledTimes(1);

    const prevProps = { ...instance.props };
    const prevState = { ...instance.state };
    instance.props = {
      ...instance.props,
      questions: nextQuestions,
    };

    instance.componentDidUpdate(prevProps, prevState);
    jest.runAllTimers();
    await Promise.resolve();

    expect(rankSpy).toHaveBeenCalledTimes(2);
    expect(rankSpy.mock.calls[1][0]).toBe('water');
    expect(rankSpy.mock.calls[1][2]).toBe(2);
    expect(rankSpy.mock.calls[1][1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'q2' })])
    );

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
    jest.useRealTimers();
  });

  it('preserves applied AI subset on equivalent external filter sync', async () => {
    jest.useFakeTimers();
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI').mockResolvedValue(['q2']);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.handleApplyFilters = jest.fn();
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingSelectedTypes: [],
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: 'water',
      aiDraftQuery: 'water',
      aiRankingCount: 2,
      aiAppliedTopN: 2,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q2'],
    };
    instance.state.aiLastAppliedSignature = instance.buildAiApplySignature({
      queryOverride: 'water',
      topNOverride: 2,
      candidateQuestions: questions,
    });

    instance.syncExternalFilterState({
      aiFilter: 'water',
      aiTopN: 2,
      questionTypes: [],
      selectedTags: [],
      sbtFilter: null,
      topQuestions: null,
    });

    jest.runAllTimers();
    await Promise.resolve();

    expect(instance.state.aiFilterApplied).toBe(true);
    expect(instance.state.aiRankedQuestionIds).toEqual(['q2']);
    expect(rankSpy).toHaveBeenCalledTimes(0);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
    jest.useRealTimers();
  });

  it('defers AI apply on empty candidates and auto-reapplies after question sync', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI').mockResolvedValue(['q1']);

    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions: [],
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.handleApplyFilters = jest.fn();
    instance.state = {
      ...instance.state,
      mergedQuestions: [],
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      aiDraftQuery: 'water',
      aiRankingCount: 2,
      aiSearchQuery: '',
      aiAppliedTopN: null,
      aiFilterApplied: false,
      aiRankedQuestionIds: [],
    };

    await instance.handleApplyAIFilter({ auto: false, source: 'test-empty' });
    expect(rankSpy).toHaveBeenCalledTimes(0);
    expect(instance.state.aiSearchQuery).toBe('water');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);

    let queuedAutoApplyPromise = null;
    instance.queueAutoApplyAiFilter = jest.fn(() => {
      queuedAutoApplyPromise = instance.handleApplyAIFilter({
        auto: true,
        queryOverride: instance.state.aiSearchQuery,
        topNOverride: instance.state.aiAppliedTopN,
        source: 'test-sync',
      });
    });

    const prevProps = { ...instance.props };
    const prevState = { ...instance.state };
    const nextQuestions = [{ id: 'q1', type: 'binary', tags: [], prompt: 'Q1' }];
    instance.props = {
      ...instance.props,
      questions: nextQuestions,
    };

    instance.componentDidUpdate(prevProps, prevState);
    expect(instance.queueAutoApplyAiFilter).toHaveBeenCalledWith('update:questions-or-responses');
    await queuedAutoApplyPromise;

    expect(rankSpy).toHaveBeenCalledTimes(1);
    expect(rankSpy).toHaveBeenCalledWith(
      'water',
      expect.arrayContaining([expect.objectContaining({ id: 'q1' })]),
      2,
      expect.objectContaining({ sessionSlug: 'edge' })
    );
    expect(instance.state.aiFilterApplied).toBe(true);
    expect(instance.state.aiRankedQuestionIds).toEqual(['q1']);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('ignores in-flight AI responses after empty-candidate apply', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });

    let resolveRank: ((value: any) => void) | null = null;
    const rankPromise = new Promise((resolve) => { resolveRank = resolve as (value: any) => void; });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI')
      .mockImplementationOnce(() => rankPromise);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
    };

    const firstRun = instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'first query',
      topNOverride: 1,
      source: 'first',
    });
    expect(instance.state.aiApplying).toBe(true);

    instance.state = {
      ...instance.state,
      mergedQuestions: [],
    };
    await instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'second query',
      topNOverride: 2,
      source: 'empty-subset',
    });

    expect(instance.state.aiSearchQuery).toBe('second query');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);

    (resolveRank as any)?.(['q1']);
    await firstRun;

    expect(instance.state.aiSearchQuery).toBe('second query');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);
    expect(rankSpy).toHaveBeenCalledTimes(1);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('ignores stale AI responses from superseded apply requests', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });

    let resolveFirst: ((value: any) => void) | null = null;
    let resolveSecond: ((value: any) => void) | null = null;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve as (value: any) => void; });
    const secondPromise = new Promise((resolve) => { resolveSecond = resolve as (value: any) => void; });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI')
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
    };

    const firstRun = instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'first query',
      topNOverride: 1,
      source: 'first',
    });
    const secondRun = instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'second query',
      topNOverride: 1,
      source: 'second',
    });

    (resolveSecond as any)?.(['q2']);
    await secondRun;
    expect(instance.state.aiSearchQuery).toBe('second query');
    expect(instance.state.aiRankedQuestionIds).toEqual(['q2']);

    (resolveFirst as any)?.(['q1']);
    await firstRun;
    expect(instance.state.aiSearchQuery).toBe('second query');
    expect(instance.state.aiRankedQuestionIds).toEqual(['q2']);
    expect(instance.state.aiFilterApplied).toBe(true);
    expect(rankSpy).toHaveBeenCalledTimes(2);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('ignores in-flight AI responses after external sync clears AI filter', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });

    let resolveRank: ((value: any) => void) | null = null;
    const rankPromise = new Promise((resolve) => { resolveRank = resolve as (value: any) => void; });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI')
      .mockImplementationOnce(() => rankPromise);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      aiDraftQuery: 'water',
      aiRankingCount: 1,
    };

    const applyRun = instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'water',
      topNOverride: 1,
      source: 'pre-sync',
    });
    expect(instance.state.aiApplying).toBe(true);

    instance.syncExternalFilterState({
      aiFilter: '',
      aiTopN: null,
      questionTypes: [],
      selectedTags: [],
      sbtFilter: null,
      topQuestions: null,
    });

    expect(instance.state.aiSearchQuery).toBe('');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);

    (resolveRank as any)?.(['q1']);
    await applyRun;

    expect(instance.state.aiSearchQuery).toBe('');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);
    expect(rankSpy).toHaveBeenCalledTimes(1);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('keeps filters cleared when an in-flight AI apply resolves later', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });

    let resolveRank: ((value: any) => void) | null = null;
    const rankPromise = new Promise((resolve) => { resolveRank = resolve as (value: any) => void; });
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI')
      .mockImplementationOnce(() => rankPromise);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      aiDraftQuery: 'water',
      aiRankingCount: 1,
    };

    const applyRun = instance.handleApplyAIFilter({
      auto: false,
      queryOverride: 'water',
      topNOverride: 1,
      source: 'pre-clear',
    });
    expect(instance.state.aiApplying).toBe(true);

    instance.handleClearFilters();
    expect(instance.state.aiSearchQuery).toBe('');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);

    (resolveRank as any)?.(['q1']);
    await applyRun;

    expect(instance.state.aiSearchQuery).toBe('');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.state.aiApplying).toBe(false);
    expect(rankSpy).toHaveBeenCalledTimes(1);

    gateSpy.mockRestore();
    localSpy.mockRestore();
    rankSpy.mockRestore();
  });

  it('keeps previous AI subset when AI apply fails', async () => {
    const gateSpy = jest.spyOn(sponsoredAccessAny, 'resolveSponsoredGateStateForResource')
      .mockReturnValue({ status: sponsoredAccess.SPONSORED_GATE_STATES.OPEN });
    const localSpy = jest.spyOn(aiSettings, 'getLocalAiSettings').mockReturnValue({ providers: {} });
    const rankingError = new Error('boom');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const rankSpy = jest.spyOn(aiScripts, 'rankQuestionsAI').mockRejectedValue(rankingError);

    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      questions,
      questionResponses: {},
      network: { id: 84532 },
      provider: 'wagmi',
    });
    instance._isMounted = true;
    instance.handleApplyFilters = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      aiSearchQuery: 'existing',
      aiDraftQuery: 'new query',
      aiAppliedTopN: 2,
      aiRankingCount: 1,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q2'],
    };

    try {
      await instance.handleApplyAIFilter({ auto: false, source: 'test' });

      expect(instance.state.aiSearchQuery).toBe('existing');
      expect(instance.state.aiFilterApplied).toBe(true);
      expect(instance.state.aiRankedQuestionIds).toEqual(['q2']);
      expect(instance.state.aiApplyError).toMatch(/boom/i);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[questionFilter]',
        'Failed applying AI filter',
        expect.objectContaining({
          error: rankingError,
          source: 'test',
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
      gateSpy.mockRestore();
      localSpy.mockRestore();
      rankSpy.mockRestore();
    }
  });

  it('invalidates memoized AI pipeline when ranked ids change under the same query', () => {
    const questions = [
      { id: 'q1', type: 'binary', tags: [], prompt: 'Q1' },
      { id: 'q2', type: 'binary', tags: [], prompt: 'Q2' },
    ];
    const instance = new QuestionFilter({
      questions,
      questionResponses: {},
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: questions,
      pendingSelectedTypes: [],
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: 'climate',
      aiAppliedTopN: 2,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q1'],
    };

    const first = instance.buildFilterPipelineResult(true);
    expect(first.finalQuestions.map((q: any) => q.id)).toEqual(['q1']);

    instance.state = {
      ...instance.state,
      aiRankedQuestionIds: ['q2'],
    };
    const second = instance.buildFilterPipelineResult(true);
    expect(second).not.toBe(first);
    expect(second.finalQuestions.map((q: any) => q.id)).toEqual(['q2']);
  });

  it('includes aiTopN in built filter state when AI filter is active', () => {
    const instance = new QuestionFilter({});
    instance.state = {
      ...instance.state,
      aiSearchQuery: 'healthcare',
      aiAppliedTopN: 4,
      aiFilterApplied: true,
      aiCombineWithOtherFilters: true,
    };

    expect(instance.buildFilterState()).toMatchObject({
      aiFilter: 'healthcare',
      aiTopN: 4,
      aiCombine: true,
    });
  });

  it('tracks AI apply elapsed seconds and resets when applying stops', () => {
    const instance = new QuestionFilter({});
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    let intervalCallback: (() => void) | null = null;
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((fn) => {
      intervalCallback = fn;
      return 1234 as any;
    });
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    const nowSpy = jest.spyOn(Date, 'now');

    instance.state = {
      ...instance.state,
      aiApplying: true,
      aiApplyingElapsedSec: 0,
    };

    nowSpy.mockReturnValue(1000);
    instance.syncAiApplyingElapsedTimer();
    expect(intervalSpy).toHaveBeenCalledTimes(1);
    expect(typeof intervalCallback).toBe('function');

    nowSpy.mockReturnValue(3900);
    (intervalCallback as any)?.();
    expect(instance.state.aiApplyingElapsedSec).toBe(2);

    instance.state = {
      ...instance.state,
      aiApplying: false,
      aiApplyingElapsedSec: 2,
    };
    instance.syncAiApplyingElapsedTimer();

    expect(clearIntervalSpy).toHaveBeenCalledWith(1234);
    expect(instance.state.aiApplyingElapsedSec).toBe(0);
    expect(instance._aiApplyingElapsedTimer).toBeNull();

    intervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    nowSpy.mockRestore();
  });
});
