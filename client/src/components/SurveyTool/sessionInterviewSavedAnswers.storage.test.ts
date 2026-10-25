import { listSessionStorageRefsPage, readSessionStorageBlob } from '../../utilities/storage/storageClient';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { loadSessionInterviewSavedAnswers } from './sessionInterviewSavedAnswers';
import { filterChangedResponsesForSubmit } from './surveyToolSubmitTransactionController';

jest.mock('../../utilities/storage/storageClient', () => ({
  ...jest.requireActual<typeof import('../../utilities/storage/storageClient')>(
    '../../utilities/storage/storageClient',
  ),
  listSessionStorageRefsPage: jest.fn(),
  readSessionStorageBlob: jest.fn(),
}));

const SESSION_ID = `0x${'5'.repeat(32)}`;
const sessionConfig = {
  slug: 'demo-sh',
  sessionId: SESSION_ID,
  corsWorkerUrl: 'https://demo-sh-worker.example.test/',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active', responses: 'active' } },
};

// Serves payloads as the Worker's own-response listing would after a submission.
const storeOwnResponses = (payloads: Record<string, unknown>[]) => {
  jest.mocked(listSessionStorageRefsPage).mockResolvedValue({
    items: payloads.map((_, index) => ({
      storageRef: { id: `ref-${index}` },
      metadata: { responder: '0xabc', createdAt: `2026-10-01T00:00:0${index}Z` },
    })),
    cursor: null,
    listComplete: true,
  });
  jest
    .mocked(readSessionStorageBlob)
    .mockImplementation(
      async ({ storageRef }: any) =>
        new Response(JSON.stringify(payloads[Number(String(storageRef.id).replace('ref-', ''))])),
    );
};

const load = () =>
  loadSessionInterviewSavedAnswers({
    questionIds: ['q1', 'q2'],
    account: '0xabc',
    sessionSlug: 'demo-sh',
    sessionConfig,
    signal: new AbortController().signal,
  });

it('loads saved answers after a full survey submission stored its survey container too', async () => {
  const { questionResponses, surveyResponse } = filterChangedResponsesForSubmit({
    data: {
      surveyID: `0x${'a'.repeat(64)}`,
      surveyTitle: 'Survey',
      responses: [
        { questionID: 'q1', answer: { value: 'Agree' } },
        { questionID: 'q2', answer: { value: 'Disagree' } },
      ],
    },
    changedSet: new Set(['q1', 'q2']),
    singleQuestionMode: false,
    isStandalone: false,
    surveyId: `0x${'a'.repeat(64)}`,
    HashZero: `0x${'0'.repeat(64)}`,
  });
  const identity = { sessionId: SESSION_ID, sessionSlug: 'demo-sh' };
  // submitResponses uploads the survey container and then each answer, all as responses.
  storeOwnResponses([{ ...surveyResponse, ...identity }, ...questionResponses.map((r) => ({ ...r, ...identity }))]);

  const saved = await load();
  expect(saved?.map((answer) => [answer.questionID, (answer.answer as { value: string }).value])).toEqual([
    ['q1', 'Agree'],
    ['q2', 'Disagree'],
  ]);
});

it('still rejects an own answer that has neither a question identity nor a survey container shape', async () => {
  storeOwnResponses([{ sessionId: SESSION_ID, sessionSlug: 'demo-sh', answer: { value: 'Agree' } }]);
  await expect(load()).rejects.toThrow('A saved answer has no question identity.');
});
