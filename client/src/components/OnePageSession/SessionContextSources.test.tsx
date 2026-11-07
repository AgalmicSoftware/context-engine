import { act, fireEvent, render, screen, within } from '@testing-library/react';

import SessionContextSources from './SessionContextSources';
import { removeContextSource, uploadContextFile, type ContextSource } from '../../utilities/docLibrary/contextSources';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';

jest.mock('../../utilities/docLibrary/useContextGroups', () => ({
  useContextGroups: () => [{ groupId: 'salon', label: 'Salon' }],
}));
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
  lockedGroupId: '',
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
  beforeEach(() => jest.spyOn(window, 'confirm').mockReturnValue(true));
  afterEach(() => jest.restoreAllMocks());

  it('shows who added each file and its group, and removes only their own', async () => {
    const list = state({
      sources: [
        file({ id: 'mine', title: 'mine.txt', addedBy: ME, lockedGroupId: 'salon' }),
        file({ id: 'theirs', title: 'theirs.txt', addedBy: THEM }),
      ],
    });
    renderList(list);
    const mine = screen.getByRole('link', { name: /mine\.txt/ }).parentElement as HTMLElement;
    expect(within(mine).getByText('Salon')).toBeInTheDocument();
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

  it('adds a file, locked to the group chosen', async () => {
    const list = state();
    renderList(list);
    const notes = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [notes] } });
    fireEvent.change(screen.getByLabelText('Who can read it'), { target: { value: 'group:salon' } });
    expect(screen.queryByRole('option', { name: 'Admins only' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add file' })));
    expect(uploadContextFile).toHaveBeenCalledWith(
      { file: notes, groupId: 'salon' },
      expect.objectContaining({ sessionSlug: 'salon' }),
    );
    expect(list.reload).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('File added.');
  });

  it('offers no form where the session limits adding to admins', () => {
    renderList(state({ participantsCanAdd: false }));
    expect(screen.queryByTestId('ce-session-context-add-file')).toBeNull();
  });
});
