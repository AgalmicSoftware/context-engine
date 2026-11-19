import { act, fireEvent, render, screen, within } from '@testing-library/react';

import SessionContextSources from './SessionContextSources';
import { describeContextCard } from './ContextCardChips';
import { setContextCard, type ContextSource } from '../../utilities/docLibrary/contextSources';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';

jest.mock('../../utilities/docLibrary/useContextGroups', () => ({ useContextGroups: () => [] }));
jest.mock('../../utilities/worker/workerAuth.js', () => ({ getWorkerSessionToken: jest.fn(async () => 'token') }));
jest.mock('../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../utilities/docLibrary/contextSources')>(
    '../../utilities/docLibrary/contextSources',
  ),
  setContextCard: jest.fn(async () => undefined),
}));

const ME = '0xaaaa000000000000000000000000000000000001';
const THEM = '0xbbbb000000000000000000000000000000000002';
const card = {
  summary: 'How institutions adapt to new technology.',
  tags: ['institutions', 'adaptation'],
  names: ['Elinor Ostrom'],
  by: 'ai' as const,
};
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
  participantsCanAdd: false,
  participantsCanAddLinks: false,
  groupFilesHidden: false,
  signInToAdd: false,
  cardsSupported: true,
  reload: jest.fn(),
  ...overrides,
});
const renderList = (list: SessionContextSourcesState) =>
  render(
    <SessionContextSources
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account={ME}
      list={list}
      pageLinks={[]}
    />,
  );
const items = () => screen.getAllByTestId('ce-session-context-item');

describe('context cards in the Context section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a source’s topic tags as chips, with its summary behind the “?”', () => {
    renderList(state({ sources: [file({ id: 'a', title: 'essay.txt', card }), file({ id: 'b', title: 'bare.txt' })] }));
    const [carded, bare] = items();
    const chips = within(carded).getByRole('list', { name: 'Topics of essay' });
    expect(within(chips).getByText('institutions')).toBeInTheDocument();
    expect(within(chips).getByText('adaptation')).toBeInTheDocument();
    // The summary is not on the page as text; it is what the "?" describes.
    const about = within(carded).getByRole('button', { name: 'About essay' });
    expect(about).toHaveAccessibleDescription(
      'How institutions adapt to new technology. Names: Elinor Ostrom. Written by the session’s AI.',
    );
    expect(within(carded).queryByText(/How institutions adapt/, { ignore: '[hidden]' })).toBeNull();
    // A source without a card shows as it did before cards.
    expect(within(bare).queryByTestId('ce-context-card')).toBeNull();
    expect(within(bare).queryByRole('button', { name: /About/ })).toBeNull();
  });

  it('says who wrote a card', () => {
    expect(describeContextCard({ ...card, by: 'adder', names: [] })).toBe(
      'How institutions adapt to new technology. Written by whoever added it.',
    );
    expect(describeContextCard({ ...card, summary: '', by: 'admin' })).toBe(
      'Names: Elinor Ostrom. Written by an admin.',
    );
  });

  it('lets someone write the card of a source they added, and no one else’s', async () => {
    const list = state({
      sources: [
        file({ id: 'mine', title: 'mine.txt', addedBy: ME, card }),
        file({ id: 'theirs', title: 'theirs.txt', addedBy: THEM, card }),
      ],
    });
    renderList(list);
    expect(screen.queryByRole('button', { name: 'Edit the card of theirs' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit the card of mine' }));
    const editor = screen.getByTestId('ce-context-card-editor');
    expect(within(editor).getByLabelText('Summary')).toHaveValue(card.summary);
    fireEvent.change(within(editor).getByLabelText('Summary'), { target: { value: '  What we agreed.  ' } });
    fireEvent.change(within(editor).getByLabelText('Topic tags (up to 6)'), {
      target: { value: 'Minutes, next steps, ' },
    });
    fireEvent.change(within(editor).getByLabelText('Key names (up to 6)'), { target: { value: '' } });
    await act(async () => fireEvent.click(within(editor).getByRole('button', { name: 'Save card' })));
    expect(setContextCard).toHaveBeenCalledWith(
      'mine',
      { summary: 'What we agreed.', tags: ['minutes', 'next steps'], names: [] },
      expect.objectContaining({ sessionSlug: 'salon', context: { account: ME } }),
    );
    expect(list.reload).toHaveBeenCalled();
    expect(screen.queryByTestId('ce-context-card-editor')).toBeNull();
    // Taking the card off sends none.
    fireEvent.click(screen.getByRole('button', { name: 'Edit the card of mine' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove card' })));
    expect(setContextCard).toHaveBeenLastCalledWith('mine', null, expect.anything());
  });

  it('offers no card editing on a Worker that keeps no cards, and shows a refused save', async () => {
    const { unmount } = renderList(
      state({ cardsSupported: false, sources: [file({ id: 'mine', title: 'mine.txt', addedBy: ME })] }),
    );
    expect(screen.queryByRole('button', { name: /Edit the card/ })).toBeNull();
    unmount();
    // Nor on a source the Worker stores encrypted, which takes no card.
    const sealed = renderList(
      state({ sources: [file({ id: 'mine', title: 'mine.txt', addedBy: ME, encrypted: true })] }),
    );
    expect(screen.queryByRole('button', { name: /Edit the card/ })).toBeNull();
    sealed.unmount();
    jest.mocked(setContextCard).mockRejectedValueOnce(new Error('An item stored encrypted has no card.'));
    const list = state({ sources: [file({ id: 'mine', title: 'mine.txt', addedBy: ME })] });
    renderList(list);
    fireEvent.click(screen.getByRole('button', { name: 'Edit the card of mine' }));
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Notes.' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save card' })));
    expect(screen.getByRole('alert')).toHaveTextContent('An item stored encrypted has no card.');
    expect(list.reload).not.toHaveBeenCalled();
  });
});
