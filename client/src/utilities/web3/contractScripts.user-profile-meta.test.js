import contractScripts from './contractScripts.js';
import { ethers } from 'ethers';

const TEST_PROFILE_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const makeProfileGroupCfg = (slug, startBlock = 1) => ({
  slug,
  networkChainId: 84532,
  blockLimits: {
    start: startBlock,
    end: null,
  },
  contracts: {
    surveys: {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 84532,
    },
    sbtFactory: {
      address: '0x2222222222222222222222222222222222222222',
      chainId: 84532,
    },
  },
});

const runEmptyProfileScanToResetLatestBlockCache = async (slug = 'edge') => {
  const surveysSpy = jest
    .spyOn(contractScripts, 'getSurveysCreatedByAddress')
    .mockResolvedValue([]);
  const questionsSpy = jest
    .spyOn(contractScripts, 'getQuestionsCreatedByAddress')
    .mockResolvedValue([]);
  const surveyResponsesSpy = jest
    .spyOn(contractScripts, 'getSurveyResponsesByAddress')
    .mockResolvedValue([]);
  const questionResponsesSpy = jest
    .spyOn(contractScripts, 'getQuestionResponsesByAddress')
    .mockResolvedValue([]);

  try {
    await contractScripts.getUserActivity(
      TEST_PROFILE_ADDRESS,
      slug,
      1,
      { returnMeta: true }
    );
  } finally {
    surveysSpy.mockRestore();
    questionsSpy.mockRestore();
    surveyResponsesSpy.mockRestore();
    questionResponsesSpy.mockRestore();
  }
};

describe('contractScripts user profile metadata wrappers', () => {
  afterEach(() => {
    try { delete contractScripts.getAllSbtAddressesCached._memo; } catch (_) {}
    try { delete contractScripts.getAllSbtAddressesCached._inflight; } catch (_) {}
    try { delete contractScripts.getAllSbtAddressesCached._runVersion; } catch (_) {}
    try { delete contractScripts.getUserSbtNetHoldings._memo; } catch (_) {}
    try { delete contractScripts.getUserSbtNetHoldings._inflight; } catch (_) {}
    try { delete contractScripts.getUserSBTsMinimal._memo; } catch (_) {}
    try { delete contractScripts.getUserSBTsMinimal._inflight; } catch (_) {}
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('returns { data, hadError } from getSBTsForUser when returnMeta is enabled', async () => {
    const sbtPayload = [{ sbtAddress: '0x1111111111111111111111111111111111111111' }];
    const minimalSpy = jest
      .spyOn(contractScripts, 'getUserSBTsMinimal')
      .mockResolvedValueOnce(sbtPayload)
      .mockRejectedValueOnce(new Error('rpc unavailable'));

    const success = await contractScripts.getSBTsForUser(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'edge',
      1,
      { returnMeta: true }
    );
    const failure = await contractScripts.getSBTsForUser(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'edge',
      1,
      { returnMeta: true }
    );

    expect(success).toEqual({ data: sbtPayload, hadError: false });
    expect(failure.hadError).toBe(true);
    expect(failure.data).toEqual([]);
    expect(typeof failure.error).toBe('string');
    expect(minimalSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards ignoreScope in getSBTsForUser profile scans', async () => {
    const minimalSpy = jest
      .spyOn(contractScripts, 'getUserSBTsMinimal')
      .mockResolvedValueOnce([]);

    await contractScripts.getSBTsForUser(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'edge',
      1,
      { returnMeta: true, ignoreScope: true }
    );

    const forwardedGroupRef = minimalSpy.mock.calls[0][3];
    const forwardedOptions = minimalSpy.mock.calls[0][4];
    expect(forwardedGroupRef && typeof forwardedGroupRef === 'object').toBe(true);
    expect(forwardedGroupRef.__ignoreSessionScanScope).toBe(true);
    expect(forwardedOptions).toEqual(expect.objectContaining({
      fromBlock: 1,
      ignoreScope: true,
    }));
  });

  it('forwards ignoreScope in getUserActivity profile scans', async () => {
    const surveysSpy = jest
      .spyOn(contractScripts, 'getSurveysCreatedByAddress')
      .mockResolvedValue([]);
    const questionsSpy = jest
      .spyOn(contractScripts, 'getQuestionsCreatedByAddress')
      .mockResolvedValue([]);
    const surveyResponsesSpy = jest
      .spyOn(contractScripts, 'getSurveyResponsesByAddress')
      .mockResolvedValue([]);
    const questionResponsesSpy = jest
      .spyOn(contractScripts, 'getQuestionResponsesByAddress')
      .mockResolvedValue([]);

    await contractScripts.getUserActivity(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'edge',
      1,
      { returnMeta: true, ignoreScope: true }
    );

    [surveysSpy, questionsSpy, surveyResponsesSpy, questionResponsesSpy].forEach((spy) => {
      const forwardedGroupRef = spy.mock.calls[0][4];
      expect(forwardedGroupRef && typeof forwardedGroupRef === 'object').toBe(true);
      expect(forwardedGroupRef.__ignoreSessionScanScope).toBe(true);
    });
  });

  it('can skip survey activity reads in getUserActivity profile scans', async () => {
    const surveysSpy = jest
      .spyOn(contractScripts, 'getSurveysCreatedByAddress')
      .mockResolvedValue([]);
    const surveyResponsesSpy = jest
      .spyOn(contractScripts, 'getSurveyResponsesByAddress')
      .mockResolvedValue([]);
    const questionsSpy = jest
      .spyOn(contractScripts, 'getQuestionsCreatedByAddress')
      .mockResolvedValue([]);
    const questionResponsesSpy = jest
      .spyOn(contractScripts, 'getQuestionResponsesByAddress')
      .mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(
      TEST_PROFILE_ADDRESS,
      'edge',
      1,
      { returnMeta: true, includeSurveyActivity: false }
    );

    expect(result.hadError).toBe(false);
    expect(result.data.createdSurveys).toEqual([]);
    expect(result.data.surveyResponses).toEqual([]);
    expect(surveysSpy).not.toHaveBeenCalled();
    expect(surveyResponsesSpy).not.toHaveBeenCalled();
    expect(questionsSpy).toHaveBeenCalledTimes(1);
    expect(questionResponsesSpy).toHaveBeenCalledTimes(1);
  });

  it('can skip question activity reads in getUserActivity profile scans', async () => {
    const surveysSpy = jest
      .spyOn(contractScripts, 'getSurveysCreatedByAddress')
      .mockResolvedValue([]);
    const surveyResponsesSpy = jest
      .spyOn(contractScripts, 'getSurveyResponsesByAddress')
      .mockResolvedValue([]);
    const questionsSpy = jest
      .spyOn(contractScripts, 'getQuestionsCreatedByAddress')
      .mockResolvedValue([]);
    const questionResponsesSpy = jest
      .spyOn(contractScripts, 'getQuestionResponsesByAddress')
      .mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(
      TEST_PROFILE_ADDRESS,
      'edge',
      1,
      { returnMeta: true, includeQuestionActivity: false }
    );

    expect(result.hadError).toBe(false);
    expect(result.data.createdQuestions).toEqual([]);
    expect(result.data.questionResponses).toEqual([]);
    expect(surveysSpy).toHaveBeenCalledTimes(1);
    expect(surveyResponsesSpy).toHaveBeenCalledTimes(1);
    expect(questionsSpy).not.toHaveBeenCalled();
    expect(questionResponsesSpy).not.toHaveBeenCalled();
  });

  it('refreshes latest block after getUserActivity resets profile scan cache', async () => {
    const slug = 'edge-refresh-profile';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);

    const blockSpy = jest
      .spyOn(ethers.providers.FallbackProvider.prototype, 'getBlockNumber')
      .mockResolvedValueOnce(7101)
      .mockResolvedValue(7102);

    const firstLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    const cachedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);

    expect(firstLatest).toBe(7101);
    expect(cachedLatest).toBe(7101);
    expect(blockSpy).toHaveBeenCalledTimes(1);

    const surveysSpy = jest
      .spyOn(contractScripts, 'getSurveysCreatedByAddress')
      .mockResolvedValue([]);
    const questionsSpy = jest
      .spyOn(contractScripts, 'getQuestionsCreatedByAddress')
      .mockResolvedValue([]);
    const surveyResponsesSpy = jest
      .spyOn(contractScripts, 'getSurveyResponsesByAddress')
      .mockResolvedValue([]);
    const questionResponsesSpy = jest
      .spyOn(contractScripts, 'getQuestionResponsesByAddress')
      .mockResolvedValue([]);

    await contractScripts.getUserActivity(TEST_PROFILE_ADDRESS, slug, 1, { returnMeta: true });

    surveysSpy.mockRestore();
    questionsSpy.mockRestore();
    surveyResponsesSpy.mockRestore();
    questionResponsesSpy.mockRestore();

    const refreshedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(refreshedLatest).toBe(7102);
    expect(blockSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('forces a fresh latest block lookup in getSurveyResponsesByAddress', async () => {
    const slug = 'edge-refresh-survey-responses';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);

    const blockSpy = jest
      .spyOn(ethers.providers.FallbackProvider.prototype, 'getBlockNumber')
      .mockResolvedValueOnce(7201)
      .mockResolvedValue(7202);

    const firstLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    const cachedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(firstLatest).toBe(7201);
    expect(cachedLatest).toBe(7201);
    expect(blockSpy).toHaveBeenCalledTimes(1);

    const surveyIds = await contractScripts.getSurveyResponsesByAddress(
      'none',
      TEST_PROFILE_ADDRESS,
      200,
      100,
      groupCfg
    );
    expect(surveyIds).toEqual([]);

    const refreshedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(refreshedLatest).toBe(7202);
    expect(blockSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('forces a fresh latest block lookup in getQuestionResponsesByAddress', async () => {
    const slug = 'edge-refresh-question-responses';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);

    const blockSpy = jest
      .spyOn(ethers.providers.FallbackProvider.prototype, 'getBlockNumber')
      .mockResolvedValueOnce(7301)
      .mockResolvedValue(7302);

    const firstLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    const cachedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(firstLatest).toBe(7301);
    expect(cachedLatest).toBe(7301);
    expect(blockSpy).toHaveBeenCalledTimes(1);

    const questionIds = await contractScripts.getQuestionResponsesByAddress(
      'none',
      TEST_PROFILE_ADDRESS,
      200,
      100,
      groupCfg
    );
    expect(questionIds).toEqual([]);

    const refreshedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(refreshedLatest).toBe(7302);
    expect(blockSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ensures SBT metadata carries sessionName for profile scans', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupCfg = {
      ...makeProfileGroupCfg('edge-a', 1000),
      sessionName: 'Edge Alpha',
    };
    const firstAddress = '0x3333333333333333333333333333333333333333';
    const secondAddress = '0x4444444444444444444444444444444444444444';

    jest.spyOn(contractScripts, 'getUserSbtNetHoldings').mockResolvedValue({
      addresses: [firstAddress, secondAddress],
    });
    jest.spyOn(contractScripts, 'getSbtMetadata')
      .mockResolvedValueOnce({ name: 'First', sessionName: 'Onchain Session' })
      .mockResolvedValueOnce({ name: 'Second' });

    const result = await contractScripts.getUserSBTsMinimal(
      'none',
      user,
      true,
      groupCfg,
      { fromBlock: 1, ignoreScope: true }
    );

    expect(result).toEqual([
      expect.objectContaining({
        sbtAddress: firstAddress,
        sbtInfo: expect.objectContaining({
          sessionName: 'Onchain Session',
        }),
      }),
      expect.objectContaining({
        sbtAddress: secondAddress,
        sbtInfo: expect.objectContaining({
          sessionName: 'Edge Alpha',
        }),
      }),
    ]);
    expect(result[0].sbtInfo).not.toHaveProperty('groupName');
    expect(result[1].sbtInfo).not.toHaveProperty('groupName');
  });

  it('preserves inferred sessionSlugExplicit=false in getUserSBTsMinimal normalization', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupCfg = {
      ...makeProfileGroupCfg('edge-a', 1000),
      sessionName: 'Edge Alpha',
    };
    const firstAddress = '0x5555555555555555555555555555555555555555';

    jest.spyOn(contractScripts, 'getUserSbtNetHoldings').mockResolvedValue({
      addresses: [firstAddress],
    });
    jest.spyOn(contractScripts, 'getSbtMetadata').mockResolvedValue({
      name: 'First',
      sessionSlug: 'edge-a',
      sessionSlugExplicit: false,
      sessionName: 'Edge Alpha',
    });

    const result = await contractScripts.getUserSBTsMinimal(
      'none',
      user,
      true,
      groupCfg,
      { fromBlock: 1, ignoreScope: true }
    );

    expect(result).toEqual([
      expect.objectContaining({
        sbtAddress: firstAddress,
        sbtInfo: expect.objectContaining({
          sessionSlug: 'edge-a',
          sessionSlugExplicit: false,
        }),
      }),
    ]);
  });

  it('partitions SBT-universe memo entries by session slug/window even with shared factory+chain', async () => {
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    const groupB = makeProfileGroupCfg('edge-b', 2000);
    const windowSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockResolvedValue({ fromBlock: 10, toBlock: 9 });

    const first = await contractScripts.getAllSbtAddressesCached('none', groupA);
    const second = await contractScripts.getAllSbtAddressesCached('none', groupB);

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(windowSpy).toHaveBeenCalledTimes(2);
    expect(Object.keys(contractScripts.getAllSbtAddressesCached._memo || {})).toHaveLength(2);
  });

  it('partitions SBT-universe memo entries by explicit block window and skips base window lookup when fully specified', async () => {
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    const windowSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockResolvedValue({ fromBlock: 10, toBlock: 9 });

    const first = await contractScripts.getAllSbtAddressesCached('none', groupA, {
      fromBlock: 12,
      toBlock: 11,
    });
    const second = await contractScripts.getAllSbtAddressesCached('none', groupA, {
      fromBlock: 14,
      toBlock: 13,
    });

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(windowSpy).not.toHaveBeenCalled();
    expect(Object.keys(contractScripts.getAllSbtAddressesCached._memo || {})).toHaveLength(2);
  });

  it('bypasses SBT-universe memo cache when force refresh is requested', async () => {
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    const windowSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockResolvedValue({ fromBlock: 10, toBlock: 9 });

    await contractScripts.getAllSbtAddressesCached('none', groupA);
    await contractScripts.getAllSbtAddressesCached('none', groupA);
    await contractScripts.getAllSbtAddressesCached('none', groupA, { force: true });

    expect(windowSpy).toHaveBeenCalledTimes(2);
  });

  it('prevents stale non-force runs from overwriting newer force-refresh memo state', async () => {
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    let resolveFirstWindow;
    const firstWindow = new Promise((resolve) => {
      resolveFirstWindow = resolve;
    });

    const windowSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockImplementationOnce(() => firstWindow)
      .mockResolvedValueOnce({ fromBlock: 10, toBlock: 9 });

    const staleRun = contractScripts.getAllSbtAddressesCached('none', groupA);
    await Promise.resolve();

    await contractScripts.getAllSbtAddressesCached('none', groupA, { force: true });
    const memoKey = Object.keys(contractScripts.getAllSbtAddressesCached._memo || {})[0];
    contractScripts.getAllSbtAddressesCached._memo[memoKey] = {
      ts: Date.now(),
      value: ['fresh-result'],
    };

    resolveFirstWindow({ fromBlock: 10, toBlock: 9 });
    await staleRun;

    expect(windowSpy).toHaveBeenCalledTimes(2);
    expect(contractScripts.getAllSbtAddressesCached._memo[memoKey].value).toEqual(['fresh-result']);
  });

  it('partitions getUserSbtNetHoldings memo entries by session in ignoreScope profile scans', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    const groupB = makeProfileGroupCfg('edge-b', 2000);
    const universeSpy = jest
      .spyOn(contractScripts, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    const first = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 1, ignoreScope: true },
      groupA
    );
    const second = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 1, ignoreScope: true },
      groupB
    );

    expect(first).toEqual({ addresses: [] });
    expect(second).toEqual({ addresses: [] });
    expect(universeSpy).toHaveBeenCalledTimes(2);
  });

  it('partitions getUserSBTsMinimal memo entries by session in ignoreScope profile scans', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupA = makeProfileGroupCfg('edge-a', 1000);
    const groupB = makeProfileGroupCfg('edge-b', 2000);
    const firstAddress = '0x3333333333333333333333333333333333333333';
    const secondAddress = '0x4444444444444444444444444444444444444444';
    const holdingsSpy = jest
      .spyOn(contractScripts, 'getUserSbtNetHoldings')
      .mockResolvedValueOnce({ addresses: [firstAddress] })
      .mockResolvedValueOnce({ addresses: [secondAddress] });

    const first = await contractScripts.getUserSBTsMinimal(
      'none',
      user,
      false,
      groupA,
      { fromBlock: 1, ignoreScope: true }
    );
    const second = await contractScripts.getUserSBTsMinimal(
      'none',
      user,
      false,
      groupB,
      { fromBlock: 1, ignoreScope: true }
    );

    expect(holdingsSpy).toHaveBeenCalledTimes(2);
    expect(first).toEqual([{ sbtAddress: firstAddress }]);
    expect(second).toEqual([{ sbtAddress: secondAddress }]);
  });

  it('forwards strict failure options through getSurveyResponse wrapper', async () => {
    const getResponseSpy = jest
      .spyOn(contractScripts, 'getResponse')
      .mockResolvedValueOnce(null);

    await contractScripts.getSurveyResponse(
      'none',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xsurvey',
      'edge',
      { throwOnError: true }
    );

    expect(getResponseSpy).toHaveBeenCalledWith(
      'none',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xsurvey',
      'edge',
      expect.objectContaining({
        throwOnError: true,
        responseCategory: 'survey_response_payload',
      })
    );
  });

  it('keeps getUserActivity hadError=false when all underlying reads succeed', async () => {
    jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'edge',
      1,
      { returnMeta: true }
    );

    expect(result.hadError).toBe(false);
    expect(result.data).toEqual({
      sbts: [],
      createdSurveys: [],
      createdQuestions: [],
      surveyResponses: [],
      questionResponses: [],
    });
  });

  it('flags getUserActivity hadError=true on partial failures while returning normalized data', async () => {
    jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue(['0xsurvey']);
    jest.spyOn(contractScripts, 'getSurveyDataById').mockRejectedValue(new Error('survey read failed'));
    jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'edge',
      1,
      { returnMeta: true }
    );

    expect(result.hadError).toBe(true);
    expect(result.data).toEqual({
      sbts: [],
      createdSurveys: [],
      createdQuestions: [],
      surveyResponses: [],
      questionResponses: [],
    });
  });

  it('treats response payload read failures as activity errors in strict mode', async () => {
    const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue(['0xquestion']);

    const responseSpy = jest.spyOn(contractScripts, 'getResponse').mockImplementation(async (
      _providerName,
      _userAddress,
      _questionId,
      _groupRef,
      opts = {}
    ) => {
      if (opts.throwOnError) {
        throw new Error('response payload unavailable');
      }
      return null;
    });

    const result = await contractScripts.getUserActivity(
      address,
      'edge',
      1,
      { returnMeta: true }
    );

    expect(result.hadError).toBe(true);
    expect(result.data.questionResponses).toEqual([]);
    expect(responseSpy).toHaveBeenCalledWith(
      'none',
      address,
      '0xquestion',
      'edge',
      expect.objectContaining({ throwOnError: true })
    );
  });

  it('keeps strict and soft getResponse calls isolated in in-flight coalescing', async () => {
    const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupCfg = makeProfileGroupCfg('edge', 1000);
    let rejectSoft = null;
    const softRpcCall = new Promise((_, reject) => {
      rejectSoft = reject;
    });
    const contractGetResponse = jest.fn()
      .mockImplementationOnce(() => softRpcCall)
      .mockRejectedValueOnce(new Error('strict call failed'));

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));

    const softPromise = contractScripts.getResponse(
      'none',
      address,
      '0xquestion',
      groupCfg,
      { throwOnError: false }
    );
    await Promise.resolve();
    const strictPromise = contractScripts.getResponse(
      'none',
      address,
      '0xquestion',
      groupCfg,
      { throwOnError: true }
    );

    rejectSoft(new Error('soft call failed'));

    await expect(softPromise).resolves.toBeNull();
    await expect(strictPromise).rejects.toThrow('strict call failed');
    expect(contractGetResponse).toHaveBeenCalledTimes(2);
  });
});
