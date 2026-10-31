import {
  addContextLink,
  checkContextFile,
  listContextSources,
  loadContextSourcesForAi,
  readContextPdf,
  readContextSourceText,
  removeContextSource,
  uploadContextFile,
  type ContextSource,
} from './contextSources';
import {
  listSessionStorageRefsPage,
  readSessionStorageBlob,
  uploadDataToSessionStorage,
} from '../storage/storageClient';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../storage/storageClient', () => ({
  listSessionStorageRefsPage: jest.fn(),
  readSessionStorageBlob: jest.fn(),
  uploadDataToSessionStorage: jest.fn(),
}));
jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));
jest.mock('../worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example/') }));

const listPage = listSessionStorageRefsPage as jest.MockedFunction<typeof listSessionStorageRefsPage>;
const readBlob = readSessionStorageBlob as jest.MockedFunction<typeof readSessionStorageBlob>;
const upload = uploadDataToSessionStorage as jest.MockedFunction<typeof uploadDataToSessionStorage>;
const workerFetch = fetchWorkerWithAuth as jest.MockedFunction<typeof fetchWorkerWithAuth>;

const options = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, context: { account: '0xabc' } };
const tag = (name: string, value: string) => ({ name, value });
const item = (id: string, tags: Array<{ name: string; value: string }>, metadata: Record<string, unknown> = {}) => ({
  storageRef: { backend: 'cloudflare', id },
  metadata: {
    contextSource: true,
    adminsOnly: false,
    contentType: 'application/pdf',
    createdAt: '2026-10-31T10:00:00.000Z',
    size: 10,
    tags,
    ...metadata,
  },
});
const pdf = item('pdf-1', [tag('CE-DocRole', 'context'), tag('CE-DocKind', 'file'), tag('CE-DocName', 'deck.pdf')], {
  adminsOnly: true,
});
const reading = item(
  'text-1',
  [
    tag('CE-DocRole', 'context-text'),
    tag('CE-DocKind', 'file'),
    tag('CE-DocDerivedFromTx', 'pdf-1'),
    tag('CE-ReadModel', 'claude-sonnet-5-5'),
    tag('CE-ReadAt', '2026-10-31T11:00:00.000Z'),
  ],
  { contentType: 'text/plain', adminsOnly: true },
);
const link = item(
  'link-1',
  [
    tag('CE-DocRole', 'context'),
    tag('CE-DocKind', 'link'),
    tag('CE-DocName', 'Essay'),
    tag('CE-ContextUrl', 'https://example.org/essay'),
    tag('CE-ContextFetchedAt', '2026-10-30T09:00:00.000Z'),
  ],
  { contentType: 'application/json', createdAt: '2026-10-30T09:00:00.000Z' },
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('context sources on the client', () => {
  it('lists only server-marked context sources, oldest first, each PDF with its AI reading', async () => {
    const forged = item('forged', [tag('CE-DocRole', 'context'), tag('CE-DocKind', 'file')], {
      contextSource: undefined,
    });
    const plainDoc = item('doc', [tag('CE-DocLibrary', '1')]);
    listPage
      .mockResolvedValueOnce({ items: [pdf, forged, reading], cursor: 'next', listComplete: false })
      .mockResolvedValueOnce({ items: [link, plainDoc], cursor: null, listComplete: true });
    const sources = await listContextSources({ ...options, asAdmin: true });
    expect(sources.map((source) => source.id)).toEqual(['link-1', 'pdf-1']);
    expect(sources[1]).toMatchObject({
      kind: 'file',
      title: 'deck.pdf',
      mime: 'application/pdf',
      adminsOnly: true,
      reading: { id: 'text-1', model: 'claude-sonnet-5-5', at: '2026-10-31T11:00:00.000Z' },
    });
    expect(sources[0]).toMatchObject({
      kind: 'link',
      url: 'https://example.org/essay',
      fetchedAt: '2026-10-30T09:00:00.000Z',
    });
    expect(listPage).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'docsContext', role: 'context', preferAnonymous: false, cursor: null }),
    );
    expect(listPage.mock.calls[1][0]).toMatchObject({ cursor: 'next' });
  });

  it('reads a link’s snapshot, a PDF’s reading, and nothing for an unread PDF', async () => {
    listPage.mockResolvedValue({ items: [link, pdf, reading], cursor: null, listComplete: true });
    const [essay, deck] = await listContextSources(options);
    readBlob.mockImplementation(async (request?: Parameters<typeof readSessionStorageBlob>[0]) => {
      const id = (request?.storageRef as { id: string }).id;
      return new Response(id === 'link-1' ? JSON.stringify({ snapshot: { text: 'Institutions adapt.' } }) : 'Slide 1.');
    });
    expect(await readContextSourceText(essay, options)).toBe('Institutions adapt.');
    expect(await readContextSourceText(deck, options)).toBe('Slide 1.');
    expect(readBlob).toHaveBeenLastCalledWith(
      expect.objectContaining({ storageRef: { backend: 'cloudflare', id: 'text-1' }, preferAnonymous: true }),
    );
    expect(await readContextSourceText({ ...deck, reading: null } as ContextSource, options)).toBe('');
    readBlob.mockRejectedValueOnce(new Error('denied'));
    expect(await loadContextSourcesForAi([essay, deck], options)).toEqual([
      { title: 'deck.pdf', kind: 'file', url: '', text: 'Slide 1.', readByAi: true },
    ]);
  });

  it('uploads a file with its context tags, type and privacy, and refuses other files', async () => {
    upload.mockResolvedValue({ id: 'stored-1' });
    const file = new File(['# Notes'], 'notes.md', { type: '' });
    expect(await uploadContextFile({ file, adminsOnly: true }, options)).toBe('stored-1');
    const [sent, , settings] = upload.mock.calls[0] as [File, unknown, Record<string, unknown>];
    expect(sent.type).toBe('text/markdown');
    expect(settings).toMatchObject({
      resource: 'docsContext',
      contentType: 'text/markdown',
      accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
    });
    expect(settings.tags).toEqual(
      expect.arrayContaining([
        { name: 'CE-DocRole', value: 'context' },
        { name: 'CE-DocKind', value: 'file' },
        { name: 'CE-DocName', value: 'notes.md' },
      ]),
    );
    await uploadContextFile({ file: new File(['x'], 'deck.pdf', { type: 'application/pdf' }) }, options);
    expect(upload.mock.calls[1][2]).not.toHaveProperty('accessConditions');
    expect(checkContextFile({ name: 'slides.pptx', type: 'application/vnd.ms-powerpoint' })).toMatch(/PDF, Markdown/);
    expect(checkContextFile({ name: 'big.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    await expect(
      uploadContextFile({ file: new File(['x'], 'photo.png', { type: 'image/png' }) }, options),
    ).rejects.toThrow(/PDF, Markdown/);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('asks the Worker to read links and PDFs and to remove items, with the person’s sign-in', async () => {
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    workerFetch
      .mockResolvedValueOnce(respond({ ok: true, source: { id: 'link-2', title: 'Post' } }))
      .mockResolvedValueOnce(respond({ ok: true, text: { id: 'text-2', model: 'gpt-5.6-terra' } }))
      .mockResolvedValueOnce(respond({ ok: true, removed: ['pdf-1'] }))
      .mockResolvedValueOnce(respond({ error: 'Only session admins can change context.' }, 403));
    expect(
      await addContextLink({ url: 'https://example.org/post', adminsOnly: true, replaces: 'link-1' }, options),
    ).toEqual({
      id: 'link-2',
      title: 'Post',
    });
    expect(await readContextPdf('pdf-1', options)).toEqual({ id: 'text-2', model: 'gpt-5.6-terra' });
    await removeContextSource('pdf-1', options);
    await expect(removeContextSource('pdf-1', options)).rejects.toThrow('Only session admins can change context.');
    const [url, init] = workerFetch.mock.calls[0];
    expect(url).toBe('https://worker.example/storage/context');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      action: 'add-link',
      url: 'https://example.org/post',
      adminsOnly: true,
      replaces: 'link-1',
    });
    expect(JSON.parse(String((workerFetch.mock.calls[1][1] as RequestInit).body))).toEqual({
      action: 'read-pdf',
      id: 'pdf-1',
    });
  });
});
