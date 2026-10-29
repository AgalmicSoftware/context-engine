import {
  React,
  fireEvent,
  render,
  screen,
  waitFor,
  E2E_TESTIDS,
  mockListArweaveTransactionsByTags,
  mockResolveArweaveGraphqlUrls,
  DocumentLibraryPanel,
  TEST_SESSION_CONFIG,
  setupDocumentLibraryPanelTestLifecycle,
} from './DocumentLibraryPanel.testUtils';
import type * as Graphql from '../../utilities/docLibrary/arweaveGraphql';

const realList = jest.requireActual<typeof Graphql>(
  '../../utilities/docLibrary/arweaveGraphql',
).listArweaveTransactionsByTags;
const healthy = { data: { transactions: { edges: [{ cursor: 'cursor', node: { id: 'A'.repeat(43) } }] } } };
const renderPanel = () =>
  render(
    <DocumentLibraryPanel
      provider={{}}
      network={{ id: 84532 }}
      account="0x123"
      loginComplete
      toggleLoginModal={jest.fn()}
      sessionSlug="edge"
      sessionConfig={TEST_SESSION_CONFIG}
      mode="session"
      sessionIdHex={`0x${'1'.repeat(32)}`}
    />,
  );

describe('document listing recovery', () => {
  setupDocumentLibraryPanelTestLifecycle();
  beforeEach(() => {
    mockListArweaveTransactionsByTags.mockImplementation(realList);
    mockResolveArweaveGraphqlUrls.mockReturnValue([
      'https://primary.example/graphql',
      'https://secondary.example/graphql',
    ]);
  });
  it.each(['invalid JSON', 'missing edges'])('uses fallback documents after %s', async (kind) => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          if (kind === 'invalid JSON') throw new SyntaxError('Invalid JSON');
          return { data: null };
        },
      })
      .mockResolvedValue({ ok: true, json: async () => healthy });
    global.fetch = mockFetch;
    renderPanel();
    expect(await screen.findAllByTestId(E2E_TESTIDS.DOC_ROW)).toHaveLength(1);
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://secondary.example/graphql');
  });
  it('keeps the previous documents when every endpoint is malformed', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => healthy });
    global.fetch = mockFetch;
    renderPanel();
    expect(await screen.findAllByTestId(E2E_TESTIDS.DOC_ROW)).toHaveLength(1);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: null }) });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.DOC_REFRESH));
    await screen.findByText(/invalid.*GraphQL.*response/i);
    expect(screen.getAllByTestId(E2E_TESTIDS.DOC_ROW)).toHaveLength(1);
  });
  it('accepts a valid empty collection', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { transactions: { edges: [] } } }) });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId(E2E_TESTIDS.DOC_REFRESH)).not.toBeDisabled());
    expect(screen.getByText(/No documents found yet/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
