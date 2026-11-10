import fixture from '../../../../tests/fixtures/worker-compat/previous-minor.json';
import {
  loadWorkerCanonicalQuestions,
  mergeWorkerCanonicalQuestionMetadata,
} from './workerCanonicalMetadataHydrationPort';
import { resolveWorkerCanonicalCacheIdentity } from '../../utilities/survey/workerCanonicalCacheIdentity';
jest.mock('../../utilities/cache/cacheScripts', () => ({ peekCacheSync: jest.fn(() => null) }));

test.each([false, true])(
  'browser hydration selects the compatibility fixture versions (upgraded=%s)',
  async (upgraded) => {
    const { config } = fixture;
    const records = [...fixture.records, ...(upgraded ? fixture.upgradedRecords : [])].filter(
      (row) => row.metadata.resource === 'questions',
    );
    const { rows } = await loadWorkerCanonicalQuestions(
      { sessionConfig: config, sessionSlug: config.slug },
      {
        listSessionStorageRefsPage: async () => ({
          items: records.map(({ metadata }) => ({
            metadata,
            storageRef: { backend: 'cloudflare', resource: 'questions', id: metadata.id },
          })),
          cursor: null,
          listComplete: true,
        }),
        readSessionStorageBlob: async ({ storageRef }) => {
          const id = (storageRef as { id: string }).id;
          return new Response(JSON.stringify(records.find((row) => row.metadata.id === id)?.payload));
        },
      },
    );
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: config.slug });
    if (!identity) throw new Error('Fixture must have a Worker identity');
    const cache = mergeWorkerCanonicalQuestionMetadata(null, rows, identity);
    const network = cache.worker as { questions: Record<string, { id: string; prompt: string }> };
    expect(
      Object.values(network.questions)
        .map(({ id, prompt }) => [id, prompt])
        .sort(([a], [b]) => a.localeCompare(b)),
    ).toEqual(upgraded ? fixture.expectedUpgradedQuestions : fixture.expectedQuestions);
  },
);
