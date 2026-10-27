import { ethers } from 'ethers';
import { buildQuestionRecord, buildResponseRecord, generateQuestionId as agentQuestionId } from '../../mcp/lib/records.mjs';
import { decodeInviteCode, normalizeGroupPasswordInput } from '../../mcp/lib/sbtClaims.mjs';
import { cryptoUtils } from '../../client/src/utilities/crypto/cryptography';
import { generateQuestionId } from '../../client/src/utilities/shared/questionUtils.mjs';
import { buildRatingMatrixFromRealData } from '../../client/src/components/PolisReport/polisReportRuntime';
import { buildReportAnswerQuestions, buildReportResponseStats } from '../../client/src/components/PolisReport/polisReportAnswers';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../client/src/utilities/session/sessionModeProfile';
import { loadWorkerResponses } from '../../client/src/utilities/survey/workerResponseHydration';
import { loadWorkerCanonicalQuestions } from '../../client/src/domains/surveys/workerCanonicalMetadataHydrationPort';
import { questionIdFixtures } from '../helpers/questionIdFixtures.mjs';

// Records written by the Context Engine MCP agent participant must load
// through the web client's own Worker hydration, like a passkey participant's.

const SESSION_ID = `0x${'7'.repeat(32)}`;
const SLUG = 'agent-town';
const AGENT = '0x00000000000000000000000000000000000000aa';
const sessionConfig = {
  slug: SLUG,
  sessionId: SESSION_ID,
  corsWorkerUrl: 'https://agent-town-worker.example.test/',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope', mode: 'worker_sbt_gate' },
  },
};
const session = { sessionSlug: SLUG, sessionId: SESSION_ID, sessionName: 'Agent Town' };
const profile = { displayName: 'civic-bot.delve.town', modelId: 'model-x', platform: 'at_mcp' };

const storageDeps = (resource, records) => ({
  listSessionStorageRefsPage: async () => ({
    items: records.map((record, index) => ({
      storageRef: { backend: 'cloudflare', id: `${resource}-ref-${index}`, resource },
      metadata: {
        resource,
        createdAt: `2026-10-16T12:00:0${index}.000Z`,
        ...(resource === 'responses' ? { responder: AGENT } : { resourceId: record.id, uploader: AGENT, uploaderIsAdmin: false }),
      },
    })),
    cursor: null,
    listComplete: true,
  }),
  readSessionStorageBlob: async ({ storageRef }) => new Response(JSON.stringify(records[Number(storageRef.id.split('-').pop())])),
});

describe('agent participant records in web client hydration', () => {
  it('derives the same question ids as the web client', () => {
    questionIdFixtures.forEach(({ args, preimage }) => {
      expect(agentQuestionId(...args)).toBe(ethers.utils.id(preimage));
      expect(generateQuestionId(...args)).toBe(ethers.utils.id(preimage));
    });
  });

  it('reads SBT invite codes and group passwords like the web client', () => {
    ['  open sesame ', ethers.utils.hexlify(ethers.utils.toUtf8Bytes('hex pass')), 'pässwörd', ''].forEach((raw) =>
      expect(normalizeGroupPasswordInput(raw)).toBe(cryptoUtils.normalizeGroupPasswordInput(raw)),
    );
    const signature = ethers.utils.joinSignature({ r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}`, v: 28 });
    const code = Buffer.from(JSON.stringify({ c: '11155420', a: AGENT, n: '2', s: signature })).toString('base64url');
    const client = cryptoUtils.decodeInvite(code);
    expect(decodeInviteCode(code)).toEqual({
      chainId: Number(client.chainId),
      sbtAddress: client.sbtAddress,
      slot: client.nonce,
      signature: client.signature,
    });
    expect(decodeInviteCode('bm90IGpzb24')).toBeNull();
    expect(cryptoUtils.decodeInvite('bm90IGpzb24')).toBeNull();
  });

  it('loads an agent-authored statement as a session question', async () => {
    const built = buildQuestionRecord({ prompt: 'Posting limits should match for humans and agents.', creator: AGENT, session, profile });
    expect(built.ok).toBe(true);
    // Hydration fills sessionId in, so check the stored record carries it itself.
    expect(built.record).toEqual(expect.objectContaining({ sessionSlug: SLUG, sessionId: SESSION_ID }));

    const rows = await loadWorkerCanonicalQuestions({ sessionSlug: SLUG, sessionConfig }, storageDeps('questions', [built.record]));
    const row = rows.find((entry) => !entry.hidden);
    expect(row).toEqual(expect.objectContaining({ id: built.id }));
    expect(row.payload).toEqual(
      expect.objectContaining({
        id: built.id,
        type: 'binary',
        prompt: 'Posting limits should match for humans and agents.',
        sessionSlug: SLUG,
        sessionId: SESSION_ID,
        participant: expect.objectContaining({ kind: 'agent' }),
      }),
    );
  });

  it('loads agent answers for every question type with the responder and display name', async () => {
    const questions = [
      { id: agentQuestionId('binary', 'B'), type: 'binary', prompt: 'B', value: 'Agree' },
      { id: agentQuestionId('rating', 'R'), type: 'rating', prompt: 'R', value: 6 },
      { id: agentQuestionId('multichoice', 'M', ['x', 'y']), type: 'multichoice', prompt: 'M', options: ['x', 'y'], value: ['y'] },
      { id: agentQuestionId('quadratic', 'Q', ['x', 'y'], false, 99), type: 'quadratic', prompt: 'Q', options: ['x', 'y'], value: [2, -1] },
      { id: agentQuestionId('freeform', 'F'), type: 'freeform', prompt: 'F', value: 'Because.' },
    ];
    const records = questions.map(({ value, ...question }) => {
      const built = buildResponseRecord({ question, value, comment: 'Reasoning.', responder: AGENT, session, profile });
      expect(built.ok).toBe(true);
      return built.record;
    });

    const rows = await loadWorkerResponses({ sessionSlug: SLUG, sessionConfig }, storageDeps('responses', records));
    expect(rows.map((row) => row.questionId)).toEqual(questions.map((question) => question.id));
    rows.forEach((row) => {
      expect(row.responder).toBe(AGENT);
      expect(row.response).toEqual(
        expect.objectContaining({ responderName: 'civic-bot.delve.town', participant: expect.objectContaining({ kind: 'agent' }) }),
      );
    });
  });

  it('drives the web opinion report like web-written answers', () => {
    const agents = ['0x00000000000000000000000000000000000000a1', '0x00000000000000000000000000000000000000a2'];
    const questions = {
      binary: { id: agentQuestionId('binary', 'B'), type: 'binary', prompt: 'B' },
      rating: { id: agentQuestionId('rating', 'R'), type: 'rating', prompt: 'R' },
      multichoice: { id: agentQuestionId('multichoice', 'M', ['x', 'y']), type: 'multichoice', prompt: 'M', options: ['x', 'y'] },
      freeform: { id: agentQuestionId('freeform', 'F'), type: 'freeform', prompt: 'F' },
    };
    const rows = (question, values) =>
      values.map((value, index) => ({
        responder: agents[index],
        response: JSON.stringify(
          buildResponseRecord({ question, value, responder: agents[index], session, profile: { displayName: `bot-${index}` } }).record,
        ),
      }));
    const aggregator = {
      [questions.binary.id]: rows(questions.binary, ['Agree', 'Disagree']),
      [questions.rating.id]: rows(questions.rating, [3, 7]),
      [questions.multichoice.id]: rows(questions.multichoice, [['x'], ['x', 'y']]),
      [questions.freeform.id]: rows(questions.freeform, ['one', 'two']),
    };
    const metadata = Object.fromEntries(Object.values(questions).map((question) => [question.id, question]));

    const matrix = buildRatingMatrixFromRealData({ [questions.binary.id]: aggregator[questions.binary.id] }, { sessionSlug: SLUG, metadata });
    expect(matrix.matrix).toEqual([[1, -1]]);
    expect(matrix.displayNamesMap).toEqual({ [agents[0]]: 'bot-0', [agents[1]]: 'bot-1' });
    const byType = Object.fromEntries(buildReportAnswerQuestions(aggregator, metadata, { sessionSlug: SLUG }).map((question) => [question.type, question]));
    expect(byType.rating.average).toBe(5);
    expect(byType.multichoice.options.map((option) => option.count)).toEqual([2, 1]);
    expect(byType.freeform.texts.sort()).toEqual(['one', 'two']);
    expect(buildReportResponseStats(aggregator, metadata, { sessionSlug: SLUG }).all.participants).toBe(2);
  });
});
