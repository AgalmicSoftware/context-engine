import { ethers } from 'ethers';
import { buildQuestionRecord, buildResponseRecord } from '../../mcp/lib/records.mjs';
import { buildSiweMessage as agentSiwe } from '../../mcp/lib/workerClient.mjs';
import { latestAnswersByQuestion, summarizeQuestion } from '../../mcp/lib/results.mjs';
import { buildSiweMessage as clientSiwe } from '../../client/src/utilities/worker/workerAuth';
import { createSessionResponseHydrationController } from '../../client/src/utilities/survey/sessionResponseHydrationController';
import contractScripts from '../../client/src/utilities/web3/chainGateway';
import { buildAggregatorFromLocalCache } from '../../client/src/components/OnePageSession/onePageSessionAggregator';
import { buildReportResponseStats } from '../../client/src/components/PolisReport/polisReportAnswers';
import { buildRatingMatrixFromRealData } from '../../client/src/components/PolisReport/polisReportRuntime';

jest.mock('../../client/src/utilities/web3/chainGateway', () => ({
  __esModule: true,
  default: { getSessionConfigBySlug: jest.fn(), getDemoSessionConfigBySlug: jest.fn(),
    getRelevantBlockWindowForFilter: jest.fn(), getQuestionResponsesChunkedWithCallback: jest.fn() },
}));

const slug = 'registry-agent-fixture';
const agent = '0x00000000000000000000000000000000000000a1';
const human = '0x00000000000000000000000000000000000000a2';
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

it('registry SIWE bytes match the client builder, including the empty general slug', () => {
  for (const sessionSlug of [slug, 'general']) {
    const input = { address: agent, nonce: 'nonce123456', sessionSlug, issuedAt: '2026-10-16T12:00:00.000Z', expirationTime: '2026-10-16T12:10:00.000Z', chainId: 1 };
    expect(agentSiwe({ ...input, appOrigin: 'https://contextengine.sh', workerOrigin: 'https://worker.example.test' })).toBe(
      clientSiwe({ ...input, domain: 'contextengine.sh', uri: 'https://contextengine.sh', workerUrl: 'https://worker.example.test' }),
    );
  }
});

it('agent registry records hydrate through the client and produce the same public report', async () => {
  const config = { slug, sessionName: 'Registry fixture', networkChainId: 11155420, blockLimits: { start: 1 },
    sessionModeProfile: { authority: { mode: 'evm_registry_canonical' }, encryption: { mode: 'none' } } };
  const session = { sessionSlug: slug, sessionName: config.sessionName };
  const question = buildQuestionRecord({ prompt: 'Participants should disclose automated authorship.', creator: agent, session }).record;
  expect(question.associatedSurveyId).toBe(ethers.constants.HashZero);
  const response = buildResponseRecord({ question, value: 'Agree', responder: agent, session, profile: { displayName: 'fixture-agent' } }).record;
  const webResponse = { ...response, responder: human, answer: { value: 'Disagree', encrypted: false } };
  delete webResponse.sessionSlug;
  delete webResponse.sessionId;
  delete webResponse.participant;
  const rows = [
    { responder: agent, response, blockNumber: 2, transactionIndex: 0, logIndex: 0 },
    { responder: human, response: webResponse, blockNumber: 2, transactionIndex: 1, logIndex: 0 },
    { responder: '0x00000000000000000000000000000000000000a3', response: { ...response, sessionSlug: 'another-session' }, blockNumber: 3, transactionIndex: 0, logIndex: 0 },
  ];
  const cache = {
    questionsCache: { '11155420': { questions: { [question.id]: question }, questionResponses: {}, questionResponsesMeta: {}, questionResponsesLatestBlock: 0 } },
    userCache: {},
  };
  contractScripts.getSessionConfigBySlug.mockReturnValue(config);
  contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 1, toBlock: 3 });
  contractScripts.getQuestionResponsesChunkedWithCallback.mockImplementation(async (_mode, _from, _to, _progress, onData) => {
    onData({ [question.id]: rows }, 3);
  });
  const update = (key) => async (_slug, updater) => { cache[key] = await updater(clone(cache[key])); return true; };
  const controller = createSessionResponseHydrationController({
    isMounted: () => true, dgRead: (key) => clone(cache[key]), getActiveSessionSlug: () => slug,
    getSessionCfg: () => config, getSessionChainId: () => 11155420, getAccount: () => agent,
    updateQuestionsCacheAtomic: update('questionsCache'), updateUserCacheAtomic: update('userCache'),
    setState: (_update, callback) => callback?.(),
  });
  try {
    await controller.fetchQuestionResponsesChunkedForGroup(slug);
    const network = cache.questionsCache['11155420'];
    expect(Object.keys(network.questionResponses[question.id]).sort()).toEqual([agent, human]);
    const aggregator = buildAggregatorFromLocalCache(network, { sessionSlug: slug }).map;
    const questions = { [question.id]: question };
    const matrix = buildRatingMatrixFromRealData(aggregator, { sessionSlug: slug, metadata: questions });
    expect(matrix.matrix).toEqual([[1, -1]]);
    expect(buildReportResponseStats(aggregator, questions, { sessionSlug: slug }).all.participants).toBe(2);
    const latest = latestAnswersByQuestion(rows.map((row) => ({ ...row, payload: row.response })), { registryConfig: config, questionIds: new Set([question.id]) });
    const summary = summarizeQuestion(question, latest.get(question.id));
    expect(summary.counts).toEqual({ Agree: 1, Unsure: 0, Disagree: 1 });
    expect(summary.responses).toBe(2);
    expect(summary.selfDeclaredAgents).toBe(1);
  } finally { controller.destroy(); }
});
