import contractScripts from './chainGateway.js';
import { __test__contractScriptsReadCaches } from './chainGateway.js';
import { ethers } from 'ethers';
import { arweaveScripts } from '../arweave/arweaveScripts.js';

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
  const surveysSpy = jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
  const questionsSpy = jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
  const surveyResponsesSpy = jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
  const questionResponsesSpy = jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

  try {
    await contractScripts.getUserActivity(TEST_PROFILE_ADDRESS, slug, 1, { returnMeta: true });
  } finally {
    surveysSpy.mockRestore();
    questionsSpy.mockRestore();
    surveyResponsesSpy.mockRestore();
    questionResponsesSpy.mockRestore();
  }
};

describe('contractScripts user profile metadata wrappers', () => {
  afterEach(() => {
    try {
      delete contractScripts.getAllSbtAddressesCached._memo;
    } catch (_) {}
    try {
      delete contractScripts.getAllSbtAddressesCached._inflight;
    } catch (_) {}
    try {
      delete contractScripts.getAllSbtAddressesCached._runVersion;
    } catch (_) {}
    try {
      delete contractScripts.getUserSbtNetHoldings._memo;
    } catch (_) {}
    try {
      delete contractScripts.getUserSbtNetHoldings._inflight;
    } catch (_) {}
    try {
      delete contractScripts.getSbtMintBurnCountsByAddress._sharedAddressMemo;
    } catch (_) {}
    try {
      delete contractScripts.getSbtMintBurnCountsByAddress._sharedAddressInflight;
    } catch (_) {}
    try {
      delete contractScripts.getUserSBTsMinimal._memo;
    } catch (_) {}
    try {
      delete contractScripts.getUserSBTsMinimal._inflight;
    } catch (_) {}
    try {
      __test__contractScriptsReadCaches.clearLatestBlockCache();
    } catch (_) {}
    try {
      delete globalThis.CE_E2E_LIT_MOCK;
    } catch (_) {}
    try {
      delete window.__CE_E2E_MOCKED_VIEWED_RESPONSES__;
    } catch (_) {}
    try {
      window.sessionStorage.removeItem('ce:e2e:mockedViewedResponses:v1');
    } catch (_) {}
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('returns { data, hadError } from getSBTsForUser when returnMeta is enabled', async () => {
    const sbtPayload = [{ sbtAddress: '0x1111111111111111111111111111111111111111' }];
    const minimalSpy = jest
      .spyOn(contractScripts, 'getUserSBTsMinimal')
      .mockResolvedValueOnce(sbtPayload)
      .mockRejectedValueOnce(new Error('rpc unavailable'));

    const success = await contractScripts.getSBTsForUser('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'edge', 1, {
      returnMeta: true,
    });
    const failure = await contractScripts.getSBTsForUser('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'edge', 1, {
      returnMeta: true,
    });

    expect(success).toEqual({ data: sbtPayload, hadError: false });
    expect(failure.hadError).toBe(true);
    expect(failure.data).toEqual([]);
    expect(typeof failure.error).toBe('string');
    expect(minimalSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards ignoreScope in getSBTsForUser profile scans', async () => {
    const minimalSpy = jest.spyOn(contractScripts, 'getUserSBTsMinimal').mockResolvedValueOnce([]);

    await contractScripts.getSBTsForUser('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'edge', 1, {
      returnMeta: true,
      ignoreScope: true,
    });

    const forwardedGroupRef = minimalSpy.mock.calls[0][3];
    const forwardedOptions = minimalSpy.mock.calls[0][4];
    expect(forwardedGroupRef && typeof forwardedGroupRef === 'object').toBe(true);
    expect(forwardedGroupRef.__ignoreSessionScanScope).toBe(true);
    expect(forwardedOptions).toEqual(
      expect.objectContaining({
        fromBlock: 1,
        ignoreScope: true,
      }),
    );
  });

  it('forwards ignoreScope in getUserActivity profile scans', async () => {
    const surveysSpy = jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    const questionsSpy = jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    const surveyResponsesSpy = jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    const questionResponsesSpy = jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    await contractScripts.getUserActivity('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'edge', 1, {
      returnMeta: true,
      ignoreScope: true,
    });

    [surveysSpy, questionsSpy, surveyResponsesSpy, questionResponsesSpy].forEach((spy) => {
      const forwardedGroupRef = spy.mock.calls[0][4];
      expect(forwardedGroupRef && typeof forwardedGroupRef === 'object').toBe(true);
      expect(forwardedGroupRef.__ignoreSessionScanScope).toBe(true);
    });
  });

  it('can skip survey activity reads in getUserActivity profile scans', async () => {
    const surveysSpy = jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    const surveyResponsesSpy = jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    const questionsSpy = jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    const questionResponsesSpy = jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(TEST_PROFILE_ADDRESS, 'edge', 1, {
      returnMeta: true,
      includeSurveyActivity: false,
    });

    expect(result.hadError).toBe(false);
    expect(result.data.createdSurveys).toEqual([]);
    expect(result.data.surveyResponses).toEqual([]);
    expect(surveysSpy).not.toHaveBeenCalled();
    expect(surveyResponsesSpy).not.toHaveBeenCalled();
    expect(questionsSpy).toHaveBeenCalledTimes(1);
    expect(questionResponsesSpy).toHaveBeenCalledTimes(1);
  });

  it('can skip question activity reads in getUserActivity profile scans', async () => {
    const surveysSpy = jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    const surveyResponsesSpy = jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    const questionsSpy = jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    const questionResponsesSpy = jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    const result = await contractScripts.getUserActivity(TEST_PROFILE_ADDRESS, 'edge', 1, {
      returnMeta: true,
      includeQuestionActivity: false,
    });

    expect(result.hadError).toBe(false);
    expect(result.data.createdQuestions).toEqual([]);
    expect(result.data.questionResponses).toEqual([]);
    expect(surveysSpy).toHaveBeenCalledTimes(1);
    expect(surveyResponsesSpy).toHaveBeenCalledTimes(1);
    expect(questionsSpy).not.toHaveBeenCalled();
    expect(questionResponsesSpy).not.toHaveBeenCalled();
  });

  it('does not clear latest-block cache when getUserActivity performs a profile scan', async () => {
    const slug = 'edge-refresh-profile';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);
    __test__contractScriptsReadCaches.clearLatestBlockCache();

    const blockSpy = jest
      .spyOn(ethers.providers.FallbackProvider.prototype, 'getBlockNumber')
      .mockResolvedValueOnce(7101)
      .mockResolvedValue(7102);

    const firstLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);
    const cachedLatest = await contractScripts.getLatestBlockNumber('none', groupCfg);

    expect(firstLatest).toBe(7101);
    expect(cachedLatest).toBe(7101);
    expect(blockSpy).toHaveBeenCalledTimes(1);

    const surveysSpy = jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    const questionsSpy = jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    const surveyResponsesSpy = jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    const questionResponsesSpy = jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    await contractScripts.getUserActivity(TEST_PROFILE_ADDRESS, slug, 1, { returnMeta: true });

    surveysSpy.mockRestore();
    questionsSpy.mockRestore();
    surveyResponsesSpy.mockRestore();
    questionResponsesSpy.mockRestore();

    const cachedAfterProfileScan = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(cachedAfterProfileScan).toBe(7101);
    expect(blockSpy).toHaveBeenCalledTimes(1);
  });

  it('does not clear latest-block cache in getSurveyResponsesByAddress', async () => {
    const slug = 'edge-refresh-survey-responses';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);
    __test__contractScriptsReadCaches.clearLatestBlockCache();

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
      groupCfg,
    );
    expect(surveyIds).toEqual([]);

    const cachedAfterProfileScan = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(cachedAfterProfileScan).toBe(7201);
    expect(blockSpy).toHaveBeenCalledTimes(1);
  });

  it('does not clear latest-block cache in getQuestionResponsesByAddress', async () => {
    const slug = 'edge-refresh-question-responses';
    const groupCfg = makeProfileGroupCfg(slug, 1000);

    await runEmptyProfileScanToResetLatestBlockCache(slug);
    __test__contractScriptsReadCaches.clearLatestBlockCache();

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
      groupCfg,
    );
    expect(questionIds).toEqual([]);

    const cachedAfterProfileScan = await contractScripts.getLatestBlockNumber('none', groupCfg);
    expect(cachedAfterProfileScan).toBe(7301);
    expect(blockSpy).toHaveBeenCalledTimes(1);
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
    jest
      .spyOn(contractScripts, 'getSbtMetadata')
      .mockResolvedValueOnce({ name: 'First', sessionName: 'Onchain Session' })
      .mockResolvedValueOnce({ name: 'Second' });

    const result = await contractScripts.getUserSBTsMinimal('none', user, true, groupCfg, {
      fromBlock: 1,
      ignoreScope: true,
    });

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

    const result = await contractScripts.getUserSBTsMinimal('none', user, true, groupCfg, {
      fromBlock: 1,
      ignoreScope: true,
    });

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
    const universeSpy = jest.spyOn(contractScripts, 'getAllSbtAddressesCached').mockResolvedValue([]);

    const first = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 1, ignoreScope: true },
      groupA,
    );
    const second = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 1, ignoreScope: true },
      groupB,
    );

    expect(first).toEqual({ addresses: [] });
    expect(second).toEqual({ addresses: [] });
    expect(universeSpy).toHaveBeenCalledTimes(2);
  });

  it('reuses getUserSbtNetHoldings memo entries across equivalent block-window inputs', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupCfg = makeProfileGroupCfg('edge-current-holdings', 1000);
    const universeSpy = jest.spyOn(contractScripts, 'getAllSbtAddressesCached').mockResolvedValue([]);

    const first = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 1, toBlock: 10, ignoreScope: true },
      groupCfg,
    );
    const second = await contractScripts.getUserSbtNetHoldings(
      'none',
      user,
      { fromBlock: 100, toBlock: 200, ignoreScope: true },
      groupCfg,
    );

    expect(first).toEqual({ addresses: [] });
    expect(second).toBe(first);
    expect(universeSpy).toHaveBeenCalledTimes(1);
  });

  it('shares mint/burn count scans between minted and burned address helpers', async () => {
    const sbtAddress = '0x5555555555555555555555555555555555555555';
    const groupCfg = makeProfileGroupCfg('edge-sbt-history-share', 1000);
    const countSpy = jest.spyOn(contractScripts, 'getSbtMintBurnCountsByAddress').mockResolvedValue({
      mintedCountByAddress: {
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': 1,
      },
      burnedCountByAddress: {
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 1,
      },
      mintedEventCount: 1,
      burnedEventCount: 1,
      scannedToBlock: 200,
      ok: true,
    });

    await expect(contractScripts.getAddressesWhoMintedSBT('none', sbtAddress, 1, 200, groupCfg)).resolves.toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
    await expect(contractScripts.getAddressesWhoBurnedSBT('none', sbtAddress, 1, 200, groupCfg)).resolves.toEqual([
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]);

    expect(countSpy).toHaveBeenCalledTimes(1);
  });

  it('uses net holdings for getSBTsByUserAddress before falling back to per-SBT history scans', async () => {
    const user = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const heldAddress = '0x6666666666666666666666666666666666666666';
    const missedAddress = '0x7777777777777777777777777777777777777777777';
    const groupCfg = makeProfileGroupCfg('edge-user-sbts-holdings', 1000);
    jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({
      fromBlock: 1000,
      toBlock: 2000,
    });
    jest.spyOn(contractScripts, 'getSbtsCreated').mockResolvedValue([
      { sbtAddress: missedAddress, name: 'Missed' },
      { sbtAddress: heldAddress, name: 'Held' },
    ]);
    jest.spyOn(contractScripts, 'getUserSbtNetHoldings').mockResolvedValue({
      addresses: [heldAddress],
    });
    const userHasSpy = jest.spyOn(contractScripts, 'userHasSBT').mockResolvedValue(true);
    const mintedSpy = jest.spyOn(contractScripts, 'getAddressesWhoMintedSBT').mockResolvedValue([user]);
    const burnedSpy = jest.spyOn(contractScripts, 'getAddressesWhoBurnedSBT').mockResolvedValue([]);

    await expect(contractScripts.getSBTsByUserAddress('none', user, 1000, groupCfg)).resolves.toEqual([
      { sbtAddress: heldAddress, name: 'Held' },
    ]);

    expect(userHasSpy).not.toHaveBeenCalled();
    expect(mintedSpy).not.toHaveBeenCalled();
    expect(burnedSpy).not.toHaveBeenCalled();
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

    const first = await contractScripts.getUserSBTsMinimal('none', user, false, groupA, {
      fromBlock: 1,
      ignoreScope: true,
    });
    const second = await contractScripts.getUserSBTsMinimal('none', user, false, groupB, {
      fromBlock: 1,
      ignoreScope: true,
    });

    expect(holdingsSpy).toHaveBeenCalledTimes(2);
    expect(first).toEqual([{ sbtAddress: firstAddress }]);
    expect(second).toEqual([{ sbtAddress: secondAddress }]);
  });

  it('forwards strict failure options through getSurveyResponse wrapper', async () => {
    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValueOnce(null);

    await contractScripts.getSurveyResponse('none', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xsurvey', 'edge', {
      throwOnError: true,
    });

    expect(getResponseSpy).toHaveBeenCalledWith(
      'none',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xsurvey',
      'edge',
      expect.objectContaining({
        throwOnError: true,
        responseCategory: 'survey_response_payload',
      }),
    );
  });

  it('keeps getUserActivity hadError=false when all underlying reads succeed', async () => {
    jest.spyOn(contractScripts, 'getSurveysCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionsCreatedByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getSurveyResponsesByAddress').mockResolvedValue([]);
    jest.spyOn(contractScripts, 'getQuestionResponsesByAddress').mockResolvedValue([]);

    const result = await contractScripts.getUserActivity('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'edge', 1, {
      returnMeta: true,
    });

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

    const result = await contractScripts.getUserActivity('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'edge', 1, {
      returnMeta: true,
    });

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

    const responseSpy = jest
      .spyOn(contractScripts, 'getResponse')
      .mockImplementation(async (_providerName, _userAddress, _questionId, _groupRef, opts = {}) => {
        if (opts.throwOnError) {
          throw new Error('response payload unavailable');
        }
        return null;
      });

    const result = await contractScripts.getUserActivity(address, 'edge', 1, { returnMeta: true });

    expect(result.hadError).toBe(true);
    expect(result.data.questionResponses).toEqual([]);
    expect(responseSpy).toHaveBeenCalledWith(
      'none',
      address,
      '0xquestion',
      'edge',
      expect.objectContaining({ throwOnError: true }),
    );
  });

  it('keeps strict and soft getResponse calls isolated in in-flight coalescing', async () => {
    const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const groupCfg = makeProfileGroupCfg('edge', 1000);
    const strictError = new Error('strict call failed');
    const softError = new Error('soft call failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let rejectSoft = null;
    const softRpcCall = new Promise((_, reject) => {
      rejectSoft = reject;
    });
    const contractGetResponse = jest
      .fn()
      .mockImplementationOnce(() => softRpcCall)
      .mockRejectedValueOnce(strictError);

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));

    const softPromise = contractScripts.getResponse('none', address, '0xquestion', groupCfg, { throwOnError: false });
    await Promise.resolve();
    const strictPromise = contractScripts.getResponse('none', address, '0xquestion', groupCfg, { throwOnError: true });

    rejectSoft(softError);

    try {
      await expect(softPromise).resolves.toBeNull();
      await expect(strictPromise).rejects.toThrow('strict call failed');
      expect(contractGetResponse).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[contracts]', 'Error fetching or parsing response:', strictError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[contracts]', 'Error fetching or parsing response:', softError);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('uses _resolvedCfg when getResponse is called with an unresolved group reference', async () => {
    const groupCfg = makeProfileGroupCfg('edge', 1000);
    const contractGetResponse = jest.fn().mockResolvedValue(ethers.constants.HashZero);

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));

    const result = await contractScripts.getResponse(
      'none',
      TEST_PROFILE_ADDRESS,
      `0x${'11'.repeat(32)}`,
      'missing-session',
      { _resolvedCfg: groupCfg },
    );

    expect(result).toBeNull();
    expect(contractGetResponse).toHaveBeenCalledTimes(1);
  });

  it('returns a seeded E2E mocked viewed response when arweave downloads are disabled in-browser', async () => {
    const groupCfg = makeProfileGroupCfg('edge', 1000);
    const responderAddress = TEST_PROFILE_ADDRESS;
    const questionId = `0x${'11'.repeat(32)}`;
    const contractGetResponse = jest.fn().mockResolvedValue(`0x${'22'.repeat(32)}`);
    const mockedPayload = {
      responder: responderAddress,
      questionID: questionId,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      additional: { value: '', encrypted: false },
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));
    const downloadSpy = jest.spyOn(arweaveScripts, 'downloadDataFromArweave').mockResolvedValue('{}');

    globalThis.CE_E2E_LIT_MOCK = true;
    window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ = {
      [`${responderAddress.toLowerCase()}|${questionId.toLowerCase()}`]: mockedPayload,
    };

    const result = await contractScripts.getResponse('none', responderAddress, questionId, groupCfg);

    expect(result).toEqual(
      expect.objectContaining({
        responder: responderAddress,
        answer: expect.objectContaining({
          encryptedPortion: 'cipher-answer',
        }),
        arweaveTxId: expect.any(String),
      }),
    );
    expect(contractGetResponse).toHaveBeenCalledTimes(1);
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('ignores seeded E2E mocked viewed responses unless the explicit E2E Lit mock flag is enabled', async () => {
    const groupCfg = makeProfileGroupCfg('edge-no-e2e-flag', 1000);
    const responderAddress = TEST_PROFILE_ADDRESS;
    const questionId = `0x${'33'.repeat(32)}`;
    const contractGetResponse = jest.fn().mockResolvedValue(`0x${'44'.repeat(32)}`);
    const downloadedPayload = {
      responder: responderAddress,
      questionID: questionId,
      answer: { value: 'from-arweave', encrypted: false },
      additional: { value: '', encrypted: false },
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));
    const downloadSpy = jest
      .spyOn(arweaveScripts, 'downloadDataFromArweave')
      .mockResolvedValue(JSON.stringify(downloadedPayload));

    window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ = {
      [`${responderAddress.toLowerCase()}|${questionId.toLowerCase()}`]: {
        responder: responderAddress,
        questionID: questionId,
        answer: { value: 'from-e2e-mock', encrypted: false },
        additional: { value: '', encrypted: false },
      },
    };

    const result = await contractScripts.getResponse('none', responderAddress, questionId, groupCfg);

    expect(result).toEqual(
      expect.objectContaining({
        responder: responderAddress,
        answer: expect.objectContaining({
          value: 'from-arweave',
        }),
      }),
    );
    expect(contractGetResponse).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        directToArIo: false,
        gatewayTimeoutMs: 4500,
        debugContext: expect.objectContaining({
          category: 'question_response_payload',
          fn: 'getResponse',
        }),
      }),
    );
  });

  it('honors a custom response payload gateway timeout while keeping gateway fanout enabled', async () => {
    const groupCfg = makeProfileGroupCfg('edge-custom-response-timeout', 1000);
    const responderAddress = TEST_PROFILE_ADDRESS;
    const questionId = `0x${'55'.repeat(32)}`;
    const contractGetResponse = jest.fn().mockResolvedValue(`0x${'66'.repeat(32)}`);
    const downloadedPayload = {
      responder: responderAddress,
      questionID: questionId,
      type: 'binary',
      answer: { value: 'Agree', encrypted: false },
      additional: { value: '', encrypted: false },
    };

    jest.spyOn(ethers, 'Contract').mockImplementation(() => ({
      getResponse: contractGetResponse,
    }));
    const downloadSpy = jest
      .spyOn(arweaveScripts, 'downloadDataFromArweave')
      .mockResolvedValue(JSON.stringify(downloadedPayload));

    const result = await contractScripts.getResponse('none', responderAddress, questionId, groupCfg, {
      arweaveGatewayTimeoutMs: 1200,
    });

    expect(result).toEqual(
      expect.objectContaining({
        answer: expect.objectContaining({ value: 'Agree' }),
      }),
    );
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        directToArIo: false,
        gatewayTimeoutMs: 1200,
      }),
    );
  });

  it('passes resolved cfg through block-window lookups during question-response scans', async () => {
    const groupCfg = makeProfileGroupCfg('edge-pass-through', 1000);
    const blockWindowSpy = jest
      .spyOn(contractScripts, 'getRelevantBlockWindowForFilter')
      .mockResolvedValue({ fromBlock: 200, toBlock: 100 });

    const questionIds = await contractScripts.getQuestionResponsesByAddress(
      'none',
      TEST_PROFILE_ADDRESS,
      200,
      100,
      groupCfg,
    );

    expect(questionIds).toEqual([]);
    expect(blockWindowSpy).toHaveBeenCalledWith(groupCfg, expect.objectContaining({ _resolvedCfg: groupCfg }));
  });
});
