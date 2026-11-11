import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import ContextSourcesPanel, { describeContextSource } from './ContextSourcesPanel';
import {
  addContextLink,
  readContextPdf,
  removeContextSource,
  uploadContextFile,
  workerSupportsContextSources,
  type ContextSource,
} from '../../../utilities/docLibrary/contextSources';
import type { SessionContextSourcesState } from '../../../utilities/docLibrary/useSessionContextSources';

let mockGroups: Array<{ groupId: string; label: string }> = [];
jest.mock('../../../utilities/docLibrary/useContextGroups', () => ({ useContextGroups: () => mockGroups }));
jest.mock('../../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../../utilities/docLibrary/contextSources')>(
    '../../../utilities/docLibrary/contextSources',
  ),
  addContextLink: jest.fn(async () => ({})),
  readContextPdf: jest.fn(async () => ({})),
  removeContextSource: jest.fn(async () => undefined),
  uploadContextFile: jest.fn(async () => 'new-pdf'),
  workerSupportsContextSources: jest.fn(async () => true),
}));

const source = (overrides: Partial<ContextSource>): ContextSource => ({
  id: 'id',
  kind: 'file',
  title: 'Untitled',
  url: '',
  mime: 'text/plain',
  size: 1,
  createdAt: '2026-10-31T10:00:00.000Z',
  adminsOnly: false,
  lockedGroupIds: [],
  addedBy: '',
  fetchedAt: '',
  reading: null,
  ...overrides,
});
const essay = source({
  id: 'link-1',
  kind: 'link',
  title: 'Essay',
  url: 'https://example.org/essay',
  mime: 'application/json',
  fetchedAt: '2026-10-30T09:00:00.000Z',
});
const deck = source({
  id: 'pdf-1',
  title: 'deck.pdf',
  mime: 'application/pdf',
  adminsOnly: true,
  reading: { id: 't', model: 'claude-sonnet-5-5', at: '2026-10-31T11:00:00.000Z' },
});
const unread = source({ id: 'pdf-2', title: 'unread.pdf', mime: 'application/pdf' });

const list = (overrides: Partial<SessionContextSourcesState> = {}): SessionContextSourcesState => ({
  sources: [essay, deck, unread],
  loading: false,
  error: '',
  supported: true,
  isAdmin: true,
  participantsCanAdd: false,
  participantsCanAddLinks: false,
  groupFilesHidden: false,
  reload: jest.fn(),
  ...overrides,
});
const renderPanel = (state = list(), pageLinks: Array<{ label: string; url: string }> = []) =>
  render(
    <ContextSourcesPanel
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account="0xadmin"
      list={state}
      pageLinks={pageLinks}
    />,
  );
const options = expect.objectContaining({ sessionSlug: 'salon', asAdmin: true });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('context sources panel', () => {
  it('lists each source with who may read it and what the AI has of it', async () => {
    renderPanel();
    const rows = await screen.findAllByTestId('ce-context-source');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Essay');
    expect(rows[0]).toHaveTextContent('https://example.org/essay');
    expect(describeContextSource(deck)).toMatch(/^Admins only · Read by AI \(claude-sonnet-5-5, /);
    expect(describeContextSource(unread)).toBe('Everyone in the session · Not read by AI');
    expect(within(rows[0]).getByRole('button', { name: 'Refresh Essay' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: /Read again with the session’s AI/ })).toBeInTheDocument();
    expect(within(rows[2]).getByRole('button', { name: /^Read with the session’s AI/ })).toBeInTheDocument();
  });

  it('adds a link with its privacy, refreshes one, reads a PDF and removes after asking', async () => {
    const state = list();
    renderPanel(state);
    await screen.findAllByTestId('ce-context-source');
    fireEvent.change(screen.getByTestId('ce-context-link-url'), { target: { value: ' https://example.org/post ' } });
    fireEvent.change(screen.getByLabelText('Link title'), { target: { value: 'RxC post' } });
    fireEvent.click(screen.getAllByLabelText('Admins only')[0]);
    await act(async () => fireEvent.click(screen.getByTestId('ce-context-add-link')));
    expect(addContextLink).toHaveBeenCalledWith(
      { url: 'https://example.org/post', title: 'RxC post', adminsOnly: true },
      options,
    );
    expect(await screen.findByTestId('ce-context-sources-status')).toHaveTextContent('Link added.');
    expect(state.reload).toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Refresh Essay' })));
    expect(addContextLink).toHaveBeenLastCalledWith({ url: 'https://example.org/essay', replaces: 'link-1' }, options);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Read with the session’s AI/ })));
    expect(readContextPdf).toHaveBeenCalledWith('pdf-2', options);

    jest.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove deck.pdf' }));
    expect(removeContextSource).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove deck.pdf' })));
    expect(removeContextSource).toHaveBeenCalledWith(deck, options);
  });

  it('says who may read a file and who added it, and uploads with the chosen access', async () => {
    mockGroups = [
      { groupId: 'salon', label: 'Salon' },
      { groupId: 'hosts', label: 'Hosts' },
    ];
    expect(
      describeContextSource(source({ lockedGroupIds: ['salon', 'hosts'] }), { groups: mockGroups, adder: 'an admin' }),
    ).toBe('Salon, Hosts · Added by an admin · Text file');
    expect(describeContextSource(source({ lockedGroupIds: ['salon', 'gone'] }), { groups: mockGroups })).toBe(
      'Salon and one other group · Text file',
    );
    expect(describeContextSource(source({ lockedGroupIds: ['gone'] }))).toBe('One group · Text file');
    renderPanel(list({ sources: [] }));
    const input = await screen.findByTestId('ce-context-file');
    const notes = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [notes] } });
    fireEvent.click(screen.getByTestId('ce-context-file-access'));
    fireEvent.click(screen.getByRole('button', { name: 'Hosts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salon' }));
    await act(async () => fireEvent.click(screen.getByTestId('ce-context-add-file')));
    expect(uploadContextFile).toHaveBeenLastCalledWith({ file: notes, groupIds: ['hosts', 'salon'] }, options);
    fireEvent.change(screen.getByTestId('ce-context-file'), { target: { files: [notes] } });
    fireEvent.click(screen.getByRole('button', { name: 'Admins only' }));
    await act(async () => fireEvent.click(screen.getByTestId('ce-context-add-file')));
    expect(uploadContextFile).toHaveBeenLastCalledWith({ file: notes, adminsOnly: true }, options);
  });

  it('uploads a file and has the session’s AI read a PDF only when Analyze is ticked', async () => {
    renderPanel(list({ sources: [] }));
    const input = await screen.findByTestId('ce-context-file');
    const pdf = new File(['%PDF'], 'deck.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(screen.getByTestId('ce-context-file-analyze')).toBeChecked();
    await act(async () => fireEvent.click(screen.getByTestId('ce-context-add-file')));
    expect(uploadContextFile).toHaveBeenCalledWith({ file: pdf }, options);
    expect(readContextPdf).toHaveBeenCalledWith('new-pdf', options);
    expect(screen.getByTestId('ce-context-sources-status')).toHaveTextContent(
      'File added and read by the session’s AI.',
    );

    fireEvent.change(screen.getByTestId('ce-context-file'), { target: { files: [pdf] } });
    fireEvent.click(screen.getByTestId('ce-context-file-analyze'));
    await act(async () => fireEvent.click(screen.getByTestId('ce-context-add-file')));
    expect(readContextPdf).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('ce-context-file'), {
      target: { files: [new File(['x'], 'slides.pptx', { type: 'application/vnd.ms-powerpoint' })] },
    });
    expect(screen.getByText(/Add a PDF, Markdown, plain text, CSV or JSON file/)).toBeInTheDocument();
    expect(screen.getByTestId('ce-context-add-file')).toBeDisabled();
  });

  it('reads the session’s unread page links, and explains when sources cannot be added', async () => {
    const { unmount } = renderPanel(list({ sources: [essay] }), [
      { label: 'Essay', url: 'https://example.org/essay' },
      { label: 'Site', url: 'https://coalition.example.org/' },
    ]);
    const read = await screen.findByTestId('ce-context-read-page-links');
    expect(read).toHaveTextContent('Read the session’s link for the AI');
    await act(async () => fireEvent.click(read));
    expect(addContextLink).toHaveBeenCalledTimes(1);
    expect(addContextLink).toHaveBeenCalledWith({ url: 'https://coalition.example.org/', title: 'Site' }, options);
    unmount();

    renderPanel(list({ supported: false }));
    expect(screen.getByTestId('ce-context-sources-unsupported')).toBeInTheDocument();
    jest.mocked(workerSupportsContextSources).mockResolvedValueOnce(false);
    renderPanel(list());
    await waitFor(() => expect(screen.getByTestId('ce-context-sources-update-worker')).toBeInTheDocument());
  });
});
