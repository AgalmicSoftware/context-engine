import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile.js';
import { loadWorkerResponses } from './workerResponseHydration.js';

const SESSION_ID = `0x${'5'.repeat(32)}`;
const sessionConfig = {
  slug: 'demo-sh',
  sessionId: SESSION_ID,
  corsWorkerUrl: 'https://demo-sh-worker.example.test/',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: { responses: 'active' },
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
};
const ANSWERS = 250;
const answer = (id: string) => ({
  sessionSlug: 'demo-sh',
  sessionId: SESSION_ID,
  questionId: `q-${id}`,
  answer: { value: 'Agree' },
});

const fakeWorker = (features: string[]) => {
  const calls = { list: 0, batch: 0, single: 0, batchSizes: [] as number[], batchIds: [] as string[] };
  const deps = {
    readWorkerCapabilities: async () => ({ legacy: false, features }),
    listSessionStorageRefsPage: async (options: Record<string, unknown>) => {
      calls.list += 1;
      const start = Number(options.cursor || 0);
      const end = Math.min(start + 100, ANSWERS);
      return {
        items: Array.from({ length: end - start }, (_, index) => ({
          storageRef: { id: `ref-${start + index}` },
          metadata: {
            responder: `0x${(start + index).toString(16).padStart(40, '0')}`,
            createdAt: '2026-11-12T00:00:00.000Z',
          },
        })),
        cursor: end < ANSWERS ? String(end) : null,
        listComplete: end >= ANSWERS,
      };
    },
    readSessionStorageBatch: async ({ ids }: { ids: string[] }) => {
      calls.batch += 1;
      calls.batchSizes.push(ids.length);
      calls.batchIds.push(...ids);
      return ids.map(answer);
    },
    readSessionStorageBlob: async (options: Record<string, unknown>) => {
      calls.single += 1;
      return new Response(JSON.stringify(answer((options.storageRef as { id: string }).id)));
    },
  };
  return { calls, deps };
};

describe('loading Worker answers in batches', () => {
  it('reads each list page in one request when the Worker offers batch reads', async () => {
    const { calls, deps } = fakeWorker(['storage_read_batch_v1']);
    const rows = await loadWorkerResponses({ sessionSlug: 'demo-sh', sessionConfig }, deps);
    expect(rows).toHaveLength(ANSWERS);
    expect(rows[0]).toEqual(expect.objectContaining({ questionId: 'q-ref-0', storageRefId: 'ref-0' }));
    expect(calls.single).toBe(0);
    expect(calls.batchSizes).toEqual([100, 100, 50]);
    expect(calls.list + calls.batch).toBeLessThanOrEqual(2 * Math.ceil(ANSWERS / 100));
  });

  it('asks only for answers it has not read before', async () => {
    const { calls, deps } = fakeWorker(['storage_read_batch_v1']);
    const cached = new Set(Array.from({ length: 200 }, (_, index) => `ref-${index}`));
    const rows = await loadWorkerResponses(
      { sessionSlug: 'demo-sh', sessionConfig, cachedStorageRefIds: cached },
      deps,
    );
    expect(rows).toHaveLength(50);
    expect(calls.batchIds.every((id) => !cached.has(id))).toBe(true);
    expect(calls.batch).toBe(1);
  });

  it('reads one answer at a time from a Worker without batch reads', async () => {
    const { calls, deps } = fakeWorker([]);
    const rows = await loadWorkerResponses({ sessionSlug: 'demo-sh', sessionConfig }, deps);
    expect(rows).toHaveLength(ANSWERS);
    expect(calls.batch).toBe(0);
    expect(calls.single).toBe(ANSWERS);
  });
});
