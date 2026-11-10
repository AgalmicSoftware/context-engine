import { ethers } from 'ethers';
import { createContractScriptsSurveyWriteMethods } from './contractScripts.surveyWriteMethods';
import { createContractScriptsSurveyPayloadReadMethods } from './contractScripts.surveyPayloadReadMethods';
import { createContractScriptsSurveyEventReadMethods } from './contractScripts.surveyEventReadMethods';
import { hasNonZeroHashValue } from './deterministicFactoryHelpers';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';
import { normalizeSubmitReceipt } from '../../components/SurveyTool/surveyToolSubmitTransactionController';
import { createSurveyQuestionsDataRuntime } from '../../components/SurveyTool/surveyQuestionsDataRuntime';
import {
  buildViewedSurveyResponseState,
  buildSurveyResponseFetchLoadingState,
  buildResponseHydrationInvalidatedState,
} from '../../components/SurveyTool/surveyQuestionsTypes';

const SID = ethers.utils.id('snapshot-survey');
const Q1 = ethers.utils.id('snapshot-question-1');
const Q2 = ethers.utils.id('snapshot-question-2');
const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const clone = (value) => JSON.parse(JSON.stringify(value));
const row = (id, value) => ({ questionID: id, answer: { value }, conviction: 0 });

const setup = () => {
  const cfg = {
    slug: 'snapshot',
    networkChainId: 11155420,
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  };
  const pointers = new Map();
  const payloads = new Map();
  const inflight = new Map();
  const logs = [];
  const readPointer = jest.fn(async (_account, id) => pointers.get(id) || ethers.constants.HashZero);
  class Contract {
    getResponse = readPointer;
    filters = { ResponsesSubmitted: () => ({}) };
  }
  class Web3Provider {
    getSigner() {
      return { getAddress: async () => ACCOUNT };
    }
  }
  const upload = jest.fn(async ({ payload }) => {
    const pointerBytes = ethers.utils.id(JSON.stringify(payload));
    payloads.set(pointerBytes, JSON.stringify(payload));
    return { pointerBytes };
  });
  const send = jest.fn(async ({ args: [ids, hashes, sid, hash] }) => {
    ids.forEach((id, i) => pointers.set(id, hashes[i]));
    pointers.set(sid, hash);
    logs.push({ args: { responder: ACCOUNT, surveyId: sid, questionIds: ids }, blockNumber: logs.length + 1 });
    return { receipt: { status: 1, transactionHash: ethers.utils.id(`tx-${logs.length}`) } };
  });
  const readPayload = jest.fn(async ({ pointerId }) => ({ text: payloads.get(pointerId) }));
  const deps = {
    ethers: { ...ethers, Contract, providers: { Web3Provider } },
    utils: ethers.utils,
    SURVEYS: [],
    SURVEYS_INTERFACE: { parseLog: (log) => log },
    ARWEAVE_ACTIVE: true,
    STORAGE_RESOURCE_KEYS: { RESPONSES: 'responses' },
    STORAGE_BACKENDS: { ARWEAVE: 'arweave' },
    GAS_FALLBACKS: { submitResponses: () => 100000 },
    getSessionAddresses: () => ({ surveys: { address: ACCOUNT, chainId: 11155420 } }),
    getSurveysReadProviderForSession: () => ({}),
    resolveSession: () => cfg,
    resolveArweaveUploadOpts: async () => ({}),
    resolveTxGasOverrides: async () => ({}),
    hasNonZeroHashValue,
    isCloudflareStorageResource: () => false,
    uploadJsonPayloadForContractPointer: upload,
    sendContractWriteViaProvider: send,
    validateNoLockedPlaintextInPayload: jest.fn(),
    clearReadCachesForGroup: jest.fn(),
    contractsLog: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    rpcLog: jest.fn(),
    normalizeSessionNameFields: (value) => {
      value.readerNormalized = true;
    },
    normalizeConvictionImportance: (value) => value,
    attachPayloadPointerFields: (value, pointer) => ({ ...value, readerPointer: pointer }),
    cloneJsonSafe: clone,
    resolveReadContext: () => ({ baseKey: 'snapshot' }),
    READ_INFLIGHT: { response: inflight },
    runInFlightCoalesced: async (map, key, fn) => {
      if (!map.has(key))
        map.set(
          key,
          fn().finally(() => map.delete(key)),
        );
      return map.get(key);
    },
    arweaveClient: { hexToBase64url: (value) => value },
    callWithRetry: (fn) => fn(),
    readPayloadPointerTextForGroup: readPayload,
    buildArweaveDebugContext: () => ({}),
    buildHashUnavailableMetadataError: (message) => new Error(message),
    recordTerminalArweaveInvalidFailure: async ({ message }) => new Error(message),
    logArweaveMetadataFetchFailure: jest.fn(),
    notifyUserFacingTransactionError: jest.fn(),
    fetchLogsSmartWithProvider: async () => logs,
    isRetryableSurveyResponseReadError: () => true,
  };
  const methods = {
    ...createContractScriptsSurveyPayloadReadMethods(deps),
    ...createContractScriptsSurveyWriteMethods(deps),
    ...createContractScriptsSurveyEventReadMethods(deps),
    getProviderLocation: () => ({}),
    getRelevantBlockWindowForFilter: async () => ({ fromBlock: 0, toBlock: 100 }),
    getBlockWithCaching: async () => ({ timestamp: 1 }),
  };
  const submit = (responses, containerRows = responses) =>
    methods.submitResponses(
      'wagmi',
      responses.map((r) => r.questionID),
      responses,
      SID,
      { surveyId: SID, responses: containerRows },
      cfg,
    );
  const latest = (opts = {}) => methods.getSurveyResponse('none', ACCOUNT, SID, cfg, opts);
  const stored = () => JSON.parse(payloads.get(pointers.get(SID)));
  return { methods, cfg, pointers, payloads, upload, send, readPointer, readPayload, submit, latest, stored };
};

test('a partial edit keeps all answers in fresh reads, another respondent view, and the scan', async () => {
  const h = setup();
  await h.submit([row(Q1, 'A1'), row(Q2, 'B1')]);
  await h.submit([row(Q1, 'A2')]);
  const expected = [row(Q1, 'A2'), row(Q2, 'B1')];
  expect((await h.latest()).responses).toEqual(expected);
  expect(h.send.mock.calls[1][0].args[0]).toEqual([Q1]);
  expect(h.stored()).not.toHaveProperty('readerPointer');
  expect(h.stored()).not.toHaveProperty('readerNormalized');
  let viewed = {};
  const runtime = createSurveyQuestionsDataRuntime({
    inst: { _isMounted: true },
    propsRef: { current: { displayAnswerMode: true, viewAddress: ACCOUNT, surveyId: SID } },
    getSurveyResponse: (account, id) => h.methods.getSurveyResponse('none', account, id, h.cfg),
    setResponseHydrationState: (update) => {
      viewed = { ...viewed, ...(typeof update === 'function' ? update(viewed) : update) };
    },
    buildViewedSurveyResponseState,
    buildSurveyResponseFetchLoadingState,
    buildResponseHydrationInvalidatedState,
    mergeDecryptedViewedResponse: (_previous, next) => next,
    surveyLog: { error: jest.fn() },
  });
  await runtime.fetchSurveyResponse();
  expect(viewed.parsedViewAddressAnswers.responses).toEqual(expected);
  const scan = await h.methods.fetchAllSurveyResponses('none', SID, 0, 'latest', h.cfg);
  expect(scan.hadPartialFailure).toBe(false);
  expect(scan.responses[0].response.responses).toEqual(expected);
});

test('three edits copy unchanged encrypted rows byte for byte and ignore held-back form rows', async () => {
  const h = setup();
  const encrypted = {
    questionID: Q2,
    answer: { encryptedPortion: 'ciphertext==', value: '' },
    envelope: { ciphertext: 'opaque', accessControlConditions: [{ key: 'fixed' }] },
    conviction: null,
  };
  await h.submit([row(Q1, 'A1'), encrypted]);
  for (const value of ['A2', 'A3', 'A4']) {
    await h.submit([row(Q1, value)], [row(Q1, value), row(Q2, 'locked unsaved change')]);
    expect(JSON.stringify(h.stored().responses[1])).toBe(JSON.stringify(encrypted));
    expect(h.stored().responses[0]).toEqual(row(Q1, value));
  }
});

test.each(['rpc', 'payload', 'json', 'shape', 'null payload', 'invalid row', 'missing pointer'])(
  'an unreadable stored container (%s) stops before uploading or sending',
  async (failure) => {
    const h = setup();
    await h.submit([row(Q1, 'A1'), row(Q2, 'B1')]);
    h.upload.mockClear();
    h.send.mockClear();
    if (failure === 'rpc') h.readPointer.mockRejectedValue(new Error('RPC down'));
    if (failure === 'missing pointer') h.readPointer.mockResolvedValue(undefined);
    if (failure === 'payload') h.readPayload.mockRejectedValue(new Error('gateway down'));
    if (failure === 'json') h.payloads.set(h.pointers.get(SID), '{');
    if (failure === 'shape') h.payloads.set(h.pointers.get(SID), '{"unexpected":true}');
    if (failure === 'null payload') h.payloads.set(h.pointers.get(SID), 'null');
    if (failure === 'invalid row') h.payloads.set(h.pointers.get(SID), '{"responses":[{}]}');
    await expect(h.submit([row(Q1, 'A2')])).rejects.toThrow(/retry/i);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  },
);

test('a zero current pointer permits the first complete submission', async () => {
  const h = setup();
  await h.submit([row(Q1, 'A1')]);
  expect(h.readPointer).toHaveBeenCalledWith(ACCOUNT, SID, { blockTag: 'latest' });
  expect(h.stored().responses).toEqual([row(Q1, 'A1')]);
});

test('raw stored reads stay separate from normalized reads and bypass payload caches', async () => {
  const h = setup();
  await h.submit([row(Q1, 'A1')]);
  const [normal, raw] = await Promise.all([
    h.latest({ throwOnError: true, forceArweaveFetch: true, blockTag: 'latest' }),
    h.latest({ throwOnError: true, forceArweaveFetch: true, blockTag: 'latest', rawPayload: true }),
  ]);
  expect(normal.readerNormalized).toBe(true);
  expect(raw).toEqual(h.stored());
  expect(h.readPayload).toHaveBeenLastCalledWith(
    expect.objectContaining({ arweaveOpts: expect.objectContaining({ cacheBypass: true }) }),
  );
});

test('the submission receipt retains the complete snapshot for cache updates', async () => {
  const h = setup();
  await h.submit([row(Q1, 'A1'), row(Q2, 'B1')]);
  const changes = [row(Q1, 'A2')];
  const tx = await h.submit(changes);
  const receipt = await normalizeSubmitReceipt(tx, {
    questionResponses: changes,
    surveyResponse: { responses: changes },
    surveyId: SID,
    submissionGroupKey: 'snapshot',
    deepClone: clone,
  });
  expect(receipt.__ceQuestionResponses).toEqual(changes);
  expect(receipt.__ceSurveyResponse.responses).toEqual([row(Q1, 'A2'), row(Q2, 'B1')]);
});
