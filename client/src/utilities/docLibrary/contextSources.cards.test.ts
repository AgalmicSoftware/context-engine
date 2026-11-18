import {
  contextSourcesWithoutCards,
  listContextSources,
  makeContextCard,
  setContextCard,
  type ContextSource,
} from './contextSources';
import { listSessionStorageRefsPage } from '../storage/storageClient';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../storage/storageClient', () => ({
  isConfiguredAdmin: () => false,
  listSessionStorageRefsPage: jest.fn(),
  readSessionStorageBlob: jest.fn(),
  uploadDataToSessionStorage: jest.fn(),
}));
jest.mock('../worker/workerAuth.js', () => ({
  hasCachedWorkerSessionToken: jest.fn(async () => false),
  fetchWorkerWithAuth: jest.fn(),
}));
jest.mock('../worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example/') }));

const listPage = listSessionStorageRefsPage as jest.MockedFunction<typeof listSessionStorageRefsPage>;
const workerFetch = fetchWorkerWithAuth as jest.MockedFunction<typeof fetchWorkerWithAuth>;
const options = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, context: { account: '0xabc' } };
const item = (id: string, role: string, metadata: Record<string, unknown> = {}) => ({
  storageRef: { backend: 'cloudflare', id },
  metadata: {
    contextSource: true,
    contentType: 'text/markdown',
    createdAt: `2026-10-3${id.length % 2}T10:00:00.000Z`,
    size: 10,
    tags: [
      { name: 'CE-DocRole', value: role },
      { name: 'CE-DocKind', value: 'file' },
      { name: 'CE-DocName', value: `${id}.md` },
    ],
    ...metadata,
  },
});
const card = { summary: 'How institutions adapt.', tags: ['institutions'], names: ['Elinor Ostrom'], by: 'ai' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('context cards on the client', () => {
  it('reads each source’s card from its list entry, cut to the card’s limits, and none where there is none', async () => {
    listPage.mockResolvedValue({
      items: [
        item('carded', 'context', { card: { ...card, at: '2026-11-02T10:00:00Z', model: 'm', extra: 'dropped' } }),
        item('bare', 'context'),
        item('long', 'context', {
          card: { summary: 's'.repeat(900), tags: ['<b>Loud</b>', 'ok'], names: [], by: 'admin' },
        }),
        item('unsigned', 'context', { card: { summary: 'No writer.' } }),
        item('sealed', 'context', { encrypted: true }),
        // A PDF's reading carries no card of its own, whatever its entry says.
        item('reading', 'context-text', { card }),
      ],
      cursor: null,
      listComplete: true,
    });
    const sources = await listContextSources(options);
    const byId = Object.fromEntries(sources.map((source) => [source.id, source]));
    expect(byId.carded.card).toEqual({ ...card, at: '2026-11-02T10:00:00.000Z', model: 'm' });
    expect('card' in byId.bare).toBe(false);
    expect(byId.long.card).toEqual({ summary: 's'.repeat(300), tags: ['bloudb', 'ok'], names: [], by: 'admin' });
    expect('card' in byId.unsigned).toBe(false);
    expect(byId.reading).toBeUndefined();
    // An item the Worker stores encrypted is marked, as it takes no card.
    expect([byId.sealed.encrypted, 'encrypted' in byId.bare]).toEqual([true, false]);
  });

  it('writes, removes and asks for a card through the context route', async () => {
    workerFetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
    const content = { summary: 'Minutes.', tags: ['minutes'], names: [] };
    await setContextCard('file-1', content, options);
    await setContextCard('file-1', null, options);
    await makeContextCard('file-1', options);
    expect(workerFetch.mock.calls.map(([url, init]) => [url, JSON.parse(String(init?.body))])).toEqual([
      ['https://worker.example/storage/context', { action: 'set-card', id: 'file-1', card: content }],
      ['https://worker.example/storage/context', { action: 'set-card', id: 'file-1', card: null }],
      ['https://worker.example/storage/context', { action: 'make-card', id: 'file-1' }],
    ]);
    workerFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Only session admins can change context.' }), { status: 403 }),
    );
    await expect(makeContextCard('file-1', options)).rejects.toThrow('Only session admins can change context.');
  });

  it('counts as missing a card only the sources the AI could describe', () => {
    const source = (overrides: Partial<ContextSource>) =>
      ({ mime: 'text/markdown', reading: null, ...overrides }) as ContextSource;
    const missing = contextSourcesWithoutCards([
      source({ id: 'text' }),
      source({ id: 'has-card', card: { summary: 'x', tags: [], names: [], by: 'adder' } }),
      source({ id: 'unread-pdf', mime: 'application/pdf' }),
      source({ id: 'sealed', encrypted: true }),
      source({ id: 'read-pdf', mime: 'application/pdf', reading: { id: 'r', model: 'm', at: '' } }),
    ]);
    expect(missing.map((entry) => entry.id)).toEqual(['text', 'read-pdf']);
  });
});
