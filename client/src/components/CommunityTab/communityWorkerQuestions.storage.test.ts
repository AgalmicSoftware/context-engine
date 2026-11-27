import { loadCommunityWorkerQuestions } from './communityWorkerQuestions';
import {
  listSessionStorageRefsPage,
  readSessionStorageBatch,
  readSessionStorageBlob,
} from '../../utilities/storage/storageClient';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';
import demoSessions from '../../variables/demo/demo_sessions.json';

// The loaders run as they are; only the storage reads, where a signed-out refusal can become a sign-in, are watched.
jest.mock('../../utilities/storage/storageClient', () => ({
  ...jest.requireActual<object>('../../utilities/storage/storageClient'),
  listSessionStorageRefsPage: jest.fn(),
  readSessionStorageBlob: jest.fn(),
  readSessionStorageBatch: jest.fn(),
}));
jest.mock('../../utilities/worker/workerCapabilities', () => ({
  ...jest.requireActual<object>('../../utilities/worker/workerCapabilities'),
  readWorkerCapabilities: jest.fn(),
}));

const sessionSlug = 'demo-sh';
const sessionConfig = demoSessions['demo-sh'] as unknown as Record<string, unknown>;
const sessionId = String(sessionConfig.sessionId);
const listed = (resource: string, id: string, metadata: Record<string, unknown> = {}) => ({
  storageRef: { backend: 'cloudflare', id, resource },
  metadata: { createdAt: '2026-11-01T00:00:00.000Z', resource, ...metadata },
});
const question = { id: `0x${'1'.repeat(64)}`, prompt: 'One', type: 'binary', sessionSlug, sessionId };
const answer = { sessionSlug, sessionId, questionID: question.id, type: 'binary', answer: { value: 1 } };
const payloadOf = (id: string) => (id === 'cf_question_1' ? question : answer);

describe('loadCommunityWorkerQuestions at the storage layer', () => {
  beforeEach(() => {
    jest.mocked(listSessionStorageRefsPage).mockImplementation(async ({ resource } = {}) => ({
      items:
        resource === 'questions'
          ? [listed('questions', 'cf_question_1')]
          : resource === 'responses'
            ? [listed('responses', 'cf_answer_1', { responder: `0x${'a'.repeat(40)}` })]
            : [],
      cursor: null,
      listComplete: true,
    }));
    jest
      .mocked(readSessionStorageBlob)
      .mockImplementation(
        async ({ storageRef } = {}) =>
          new Response(JSON.stringify(payloadOf(String((storageRef as { id?: unknown })?.id)))),
      );
    jest.mocked(readSessionStorageBatch).mockImplementation(async ({ ids = [] } = { ids: [] }) => ids.map(payloadOf));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['one at a time', []],
    ['in batches', ['storage_read_batch_v1']],
  ])('lists and reads every question and answer signed out, %s', async (_how, features) => {
    jest
      .mocked(readWorkerCapabilities)
      .mockResolvedValue({ legacy: false, apiVersion: 1, bundle: null, release: null, features });

    await loadCommunityWorkerQuestions({ sessionSlug, sessionConfig });

    const lists = jest.mocked(listSessionStorageRefsPage).mock.calls.map(([options]) => options);
    const reads = [
      ...jest.mocked(readSessionStorageBlob).mock.calls,
      ...jest.mocked(readSessionStorageBatch).mock.calls,
    ].map(([options]) => options);
    expect(lists.map((options) => options?.resource)).toEqual(['questions', 'responses']);
    expect(reads.length).toBeGreaterThanOrEqual(2);
    // Signed out to the end: a refusal is kept, never turned into a wallet or passkey prompt.
    [...lists, ...reads].forEach((options) => expect(options).toMatchObject({ anonymousOnly: true }));
  });
});
