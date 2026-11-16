import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import SessionContextSources from './SessionContextSources';
import {
  addContextLink,
  readContextSourceBlob,
  readContextSourceText,
  removeContextSource,
  uploadContextFile,
  type ContextSource,
} from '../../utilities/docLibrary/contextSources';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth.js';

jest.mock('../../utilities/docLibrary/useContextGroups', () => ({
  useContextGroups: () => [
    { groupId: 'salon', label: 'Salon' },
    { groupId: 'hosts', label: 'Hosts' },
  ],
}));
jest.mock('../../utilities/worker/workerAuth.js', () => ({ getWorkerSessionToken: jest.fn(async () => 'token') }));
jest.mock('../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../utilities/docLibrary/contextSources')>(
    '../../utilities/docLibrary/contextSources',
  ),
  addContextLink: jest.fn(async () => ({ id: 'link' })),
  readContextSourceBlob: jest.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  readContextSourceText: jest.fn(async () => '# Reading list\n\nSortition'),
  removeContextSource: jest.fn(async () => undefined),
  uploadContextFile: jest.fn(async () => 'stored'),
}));

const ME = '0xaaaa000000000000000000000000000000000001';
const THEM = '0xbbbb000000000000000000000000000000000002';
const file = (overrides: Partial<ContextSource>): ContextSource => ({
  id: 'id',
  kind: 'file',
  title: 'notes.txt',
  url: '',
  mime: 'text/plain',
  size: 1,
  createdAt: '',
  adminsOnly: false,
  lockedGroupIds: [],
  addedBy: '',
  addedByAgent: false,
  adderName: '',
  fetchedAt: '',
  reading: null,
  ...overrides,
});
const state = (overrides: Partial<SessionContextSourcesState> = {}): SessionContextSourcesState => ({
  sources: [],
  loading: false,
  error: '',
  supported: true,
  isAdmin: false,
  participantsCanAdd: true,
  participantsCanAddLinks: false,
  groupFilesHidden: false,
  signInToAdd: false,
  reload: jest.fn(),
  ...overrides,
});
// The list item a file's or link's name sits in.
const itemOf = (name: string) =>
  screen
    .getAllByTestId('ce-session-context-item')
    .find((item) => item.querySelector('button, a')?.parentElement?.textContent?.endsWith(name)) as HTMLElement;
const renderList = (list: SessionContextSourcesState, account = ME) =>
  render(
    <SessionContextSources
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account={account}
      list={list}
      pageLinks={[]}
    />,
  );

describe('the Context section for participants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows who added each file and its groups, and removes only their own', async () => {
    const list = state({
      sources: [
        file({ id: 'mine', title: 'mine.txt', addedBy: ME, lockedGroupIds: ['salon', 'hosts'] }),
        file({ id: 'theirs', title: 'theirs.txt', addedBy: THEM }),
      ],
    });
    renderList(list);
    const mine = itemOf('mine');
    expect(within(mine).getByText('Salon, Hosts')).toBeInTheDocument();
    expect(within(mine).getByText('Added by you')).toBeInTheDocument();
    const theirs = itemOf('theirs');
    expect(within(theirs).getByText('Added by 0xbbbb…0002')).toBeInTheDocument();
    expect(within(theirs).queryByRole('button', { name: /Remove/ })).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove mine' })));
    expect(removeContextSource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mine' }),
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
    expect(list.reload).toHaveBeenCalled();
  });

  it('names what an agent added by the name it goes by, marked as an agent’s', () => {
    renderList(
      state({
        sources: [
          file({ id: 'kami', title: 'kami.md', addedBy: THEM, addedByAgent: true, adderName: 'Test Kami' }),
          file({ id: 'agent', title: 'agent.md', addedBy: THEM, addedByAgent: true }),
          file({
            id: 'says',
            title: 'says.md',
            addedBy: THEM,
            addedByAgent: true,
            adderName: 'Wren’s agent (AI agent, trial)',
          }),
        ],
      }),
    );
    expect(within(itemOf('kami')).getByText('Added by Test Kami')).toBeInTheDocument();
    expect(within(itemOf('agent')).getByText('Added by 0xbbbb…0002')).toBeInTheDocument();
    // A name that says it is an agent's is shown as given, not marked twice.
    expect(within(itemOf('says')).getByText('Added by Wren’s agent (AI agent, trial)')).toBeInTheDocument();
    // The mark is a label of its own, which a name cannot supply or remove.
    for (const name of ['kami', 'agent', 'says']) expect(within(itemOf(name)).getByText('Agent')).toBeInTheDocument();
    expect(screen.queryByText(/\(agent\)/)).toBeNull();
  });

  it('adds a link beside the file form where the Worker takes participants’ links', async () => {
    const list = state({ participantsCanAddLinks: true });
    renderList(list);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: ' https://example.org/essay ' } });
    fireEvent.change(screen.getByLabelText('Link title'), { target: { value: 'Essay' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add link' })));
    expect(addContextLink).toHaveBeenCalledWith(
      { url: 'https://example.org/essay', title: 'Essay' },
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
    expect(list.reload).toHaveBeenCalled();
    expect(within(screen.getByTestId('ce-session-context-add-link')).getByRole('status')).toHaveTextContent(
      'Link added.',
    );
  });

  it('offers files alone where the Worker takes no links from participants', () => {
    renderList(state());
    expect(screen.getByTestId('ce-session-context-add-file')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-context-add-link')).toBeNull();
  });

  it('adds a file, locked to the groups chosen, from a form that Add opens and closes', async () => {
    const list = state();
    renderList(list);
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('ce-session-context-participant')).not.toBeVisible();
    fireEvent.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ce-session-context-participant')).toBeVisible();
    const notes = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [notes] } });
    fireEvent.click(screen.getByLabelText('Visible to', { selector: '#ce-session-context-access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hosts' }));
    expect(screen.queryByRole('button', { name: 'Admins only' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add file' })));
    expect(uploadContextFile).toHaveBeenCalledWith(
      { file: notes, groupIds: ['salon', 'hosts'] },
      expect.objectContaining({ sessionSlug: 'salon' }),
    );
    expect(list.reload).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('File added.');
    // Closing keeps what the form says, as a closed disclosure did.
    fireEvent.click(add);
    expect(screen.getByTestId('ce-session-context-participant')).not.toBeVisible();
    fireEvent.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('File added.');
  });

  it('puts Add and View in the header the page gives it', () => {
    const header = document.createElement('div');
    document.body.appendChild(header);
    render(
      <SessionContextSources
        sessionSlug="salon"
        sessionConfig={{ slug: 'salon' }}
        account={ME}
        list={state({ groupFilesHidden: true })}
        pageLinks={[]}
        headerActionsSlot={header}
      />,
    );
    expect(header).toContainElement(screen.getByRole('button', { name: 'Add' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'View my groups’ files' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'About viewing your groups’ files' }));
    header.remove();
  });

  it('lets someone ask for their groups’ files, which signs them in, only when it would help', async () => {
    const { unmount } = renderList(state());
    expect(screen.queryByRole('button', { name: 'View my groups’ files' })).toBeNull();
    unmount();
    renderList(state({ groupFilesHidden: true }));
    const view = screen.getByRole('button', { name: 'View my groups’ files' });
    expect(view).toHaveTextContent('View');
    expect(view).toHaveAccessibleDescription(/files locked to your groups/);
    // Its explanation has a ? of its own, which explains without signing in.
    const help = screen.getByRole('button', { name: 'About viewing your groups’ files' });
    expect(help).toHaveAccessibleDescription(/files locked to your groups/);
    fireEvent.click(help);
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(view));
    expect(getWorkerSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
  });

  it('offers no form where the session limits adding to admins', () => {
    renderList(state({ participantsCanAdd: false }));
    expect(screen.queryByTestId('ce-session-context-add-file')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  it('names each file without its extension, gives its kind and size, and marks repeats', () => {
    renderList(
      state({
        sources: [
          file({ id: 'pdf', title: 'citizens-assemblies.pdf', mime: 'application/pdf', size: 750 }),
          file({ id: 'note', title: 'Typed note (test).md', mime: 'text/markdown', size: 2048 }),
          file({ id: 'first', title: 'Why lotteries.md', mime: 'text/markdown', size: 300 }),
          file({ id: 'again', title: 'Why lotteries.md', mime: 'text/markdown', size: 300 }),
          file({ id: 'longer', title: 'Why lotteries.md', mime: 'text/markdown', size: 301 }),
        ],
      }),
    );
    expect(within(itemOf('citizens-assemblies')).getByText('PDF, 750 bytes')).toBeInTheDocument();
    expect(within(itemOf('Typed note (test)')).getByText('Markdown, 2 KB')).toBeInTheDocument();
    expect(screen.queryByText(/\.md$/)).toBeNull();
    const [first, again, longer] = screen
      .getAllByTestId('ce-session-context-item')
      .filter((item) => item.textContent?.includes('Why lotteries'));
    expect(within(first).queryByText('Duplicate')).toBeNull();
    expect(within(again).getByText('Duplicate')).toBeInTheDocument();
    expect(within(longer).queryByText('Duplicate')).toBeNull();
  });

  it('shows the start of a text file under its caret, collapsed until asked', async () => {
    renderList(state({ sources: [file({ id: 'list', title: 'reading-list.md', mime: 'text/markdown' })] }));
    const caret = screen.getByRole('button', { name: 'Preview reading-list' });
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ce-session-context-preview-text')).toBeNull();
    expect(readContextSourceText).not.toHaveBeenCalled();

    fireEvent.click(caret);
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByTestId('ce-session-context-preview-text')).toHaveTextContent('# Reading list Sortition');
    expect(document.getElementById(caret.getAttribute('aria-controls') || '')).toContainElement(
      screen.getByTestId('ce-session-context-preview-text'),
    );
    expect(readContextSourceText).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'list' }),
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
    fireEvent.click(caret);
    expect(screen.queryByTestId('ce-session-context-preview-text')).toBeNull();
  });

  it('shortens a long text file in place and shows all of it in the viewer', async () => {
    const long = `${'a'.repeat(4000)}TAIL`;
    jest.mocked(readContextSourceText).mockResolvedValueOnce(long).mockResolvedValueOnce(long);
    renderList(state({ sources: [file({ id: 'long', title: 'long.txt' })] }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview long' }));
    const preview = await screen.findByTestId('ce-session-context-preview-text');
    expect(preview.textContent).not.toContain('TAIL');
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    const viewer = await screen.findByTestId('ce-session-context-viewer');
    expect(await within(viewer).findByText(/TAIL$/)).toBeInTheDocument();
  });

  describe('PDFs', () => {
    const createObjectURL = jest.fn(() => 'blob:pdf');
    const revokeObjectURL = jest.fn();
    beforeEach(() => {
      Object.assign(URL, { createObjectURL, revokeObjectURL });
    });
    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    it('show a small first page that opens the docs page’s viewer, keeping an unlisted session’s Worker', async () => {
      window.history.replaceState({}, '', '/session/salon?worker=https%3A%2F%2Fsalon.example.workers.dev');
      renderList(state({ sources: [file({ id: 'pdf-1', title: 'assemblies.pdf', mime: 'application/pdf' })] }));
      fireEvent.click(screen.getByRole('button', { name: 'Preview assemblies' }));
      const open = await screen.findByRole('button', { name: 'Open assemblies' });
      expect(document.querySelector('iframe[title="assemblies, first page"]')).toHaveAttribute(
        'src',
        'blob:pdf#page=1&toolbar=0&navpanes=0&view=FitH',
      );
      expect(readContextSourceBlob).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pdf-1' }),
        expect.objectContaining({ sessionSlug: 'salon' }),
      );

      fireEvent.click(open);
      const viewer = await screen.findByTestId('ce-session-context-viewer');
      expect(await within(viewer).findByTestId('ce-doc-viewer-pdf')).toHaveAttribute('src', 'blob:pdf');
      // The docs page's viewer, painted as a document.
      expect(viewer.closest('.modal-content')).toHaveClass('documentViewer');
      const page = new URL(
        within(viewer).getByRole('link', { name: 'Open in its own page' }).getAttribute('href') || '',
        'https://site.example',
      );
      expect(page.pathname).toMatch(/\/session\/salon\/docs$/);
      expect(page.searchParams.get('__ceDocTx')).toBe('pdf-1');
      expect(page.searchParams.get('worker')).toBe('https://salon.example.workers.dev');

      // Closing the viewer and folding the preview free both copies of the PDF.
      fireEvent.click(within(viewer.closest('.modal-content') as HTMLElement).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByTestId('ce-session-context-viewer')).toBeNull());
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Preview assemblies' }));
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
      expect(revokeObjectURL).toHaveBeenLastCalledWith('blob:pdf');
    });

    it('open from the name too, with no Worker on a listed session’s page', async () => {
      renderList(state({ sources: [file({ id: 'pdf-2', title: 'assemblies.pdf', mime: 'application/pdf' })] }));
      fireEvent.click(screen.getByRole('button', { name: 'assemblies' }));
      const viewer = await screen.findByTestId('ce-session-context-viewer');
      const href = within(viewer).getByRole('link', { name: 'Open in its own page' }).getAttribute('href') || '';
      expect(href).toContain('__ceDocTx=pdf-2');
      expect(href).not.toContain('worker=');
    });
  });

  it('adds a typed note as a Markdown file named by its title', async () => {
    const list = state();
    renderList(list);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const add = screen.getByRole('button', { name: 'Add note' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Evening sessions' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Residents asked for them.  ' } });
    fireEvent.click(screen.getByLabelText('Visible to', { selector: '#ce-session-context-note-access' }));
    fireEvent.click(within(screen.getByTestId('ce-session-context-add-note')).getByRole('button', { name: 'Salon' }));
    await act(async () => fireEvent.click(add));
    const [[{ file: note, groupIds }, options]] = jest.mocked(uploadContextFile).mock.calls;
    expect(note.name).toBe('Evening sessions.md');
    expect(note.type).toBe('text/markdown');
    const text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(note);
    });
    expect(text).toBe('Residents asked for them.');
    expect(groupIds).toEqual(['salon']);
    expect(options).toEqual(expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }));
    expect(list.reload).toHaveBeenCalled();
    expect(within(screen.getByTestId('ce-session-context-add-note')).getByRole('status')).toHaveTextContent(
      'Note added.',
    );
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('asks someone signed out to log in where they could add, and offers no form', () => {
    const onRequestLogin = jest.fn();
    render(
      <SessionContextSources
        sessionSlug="salon"
        sessionConfig={{ slug: 'salon' }}
        account=""
        list={state({ participantsCanAdd: false, signInToAdd: true })}
        pageLinks={[]}
        onRequestLogin={onRequestLogin}
      />,
    );
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toHaveAccessibleDescription('Log in to add a file, a link or a note to this session.');
    fireEvent.click(add);
    expect(onRequestLogin).toHaveBeenCalled();
    expect(screen.queryByTestId('ce-session-context-participant')).toBeNull();
  });

  it('offers no Add to someone signed out where the page cannot open the login', () => {
    renderList(state({ participantsCanAdd: false, signInToAdd: true }), '');
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});
