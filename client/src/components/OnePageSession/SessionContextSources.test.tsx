import { act, fireEvent, render, screen, within } from '@testing-library/react';

import SessionContextSources from './SessionContextSources';
import { removeContextSource, uploadContextFile, type ContextSource } from '../../utilities/docLibrary/contextSources';
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
  groupFilesHidden: false,
  reload: jest.fn(),
  ...overrides,
});
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
    const mine = screen.getByRole('link', { name: /mine\.txt/ }).parentElement as HTMLElement;
    expect(within(mine).getByText('Salon, Hosts')).toBeInTheDocument();
    expect(within(mine).getByText('Added by you')).toBeInTheDocument();
    const theirs = screen.getByRole('link', { name: /theirs\.txt/ }).parentElement as HTMLElement;
    expect(within(theirs).getByText('Added by 0xbbbb…0002')).toBeInTheDocument();
    expect(within(theirs).queryByRole('button')).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove mine.txt' })));
    expect(removeContextSource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mine' }),
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
    expect(list.reload).toHaveBeenCalled();
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
    fireEvent.click(screen.getByLabelText('Visible to'));
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
});
