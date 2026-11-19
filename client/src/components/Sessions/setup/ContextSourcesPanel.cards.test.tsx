import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import ContextSourcesPanel, { describeCardCost } from './ContextSourcesPanel';
import { makeContextCard, setContextCard, type ContextSource } from '../../../utilities/docLibrary/contextSources';
import type { SessionContextSourcesState } from '../../../utilities/docLibrary/useSessionContextSources';

jest.mock('../../../utilities/docLibrary/useContextGroups', () => ({ useContextGroups: () => [] }));
jest.mock('../../../utilities/docLibrary/contextSources', () => ({
  ...jest.requireActual<typeof import('../../../utilities/docLibrary/contextSources')>(
    '../../../utilities/docLibrary/contextSources',
  ),
  makeContextCard: jest.fn(async () => undefined),
  setContextCard: jest.fn(async () => undefined),
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
  addedByAgent: false,
  adderName: '',
  fetchedAt: '',
  reading: null,
  ...overrides,
});
const card = { summary: 'How institutions adapt.', tags: ['institutions'], names: [], by: 'ai' as const };
const essay = source({ id: 'essay', title: 'essay.md', card });
const notes = source({ id: 'notes', title: 'notes.md' });
const minutes = source({ id: 'minutes', title: 'minutes.md' });
const unreadPdf = source({ id: 'pdf', title: 'deck.pdf', mime: 'application/pdf' });
const list = (overrides: Partial<SessionContextSourcesState> = {}): SessionContextSourcesState => ({
  sources: [essay, notes, minutes, unreadPdf],
  loading: false,
  error: '',
  supported: true,
  isAdmin: true,
  participantsCanAdd: false,
  signInToAdd: false,
  participantsCanAddLinks: false,
  groupFilesHidden: false,
  cardsSupported: true,
  reload: jest.fn(),
  ...overrides,
});
const renderPanel = (state = list()) =>
  render(<ContextSourcesPanel sessionSlug="salon" sessionConfig={{ slug: 'salon' }} account="0xadmin" list={state} />);
const options = expect.objectContaining({ sessionSlug: 'salon', asAdmin: true });

describe('context cards for admins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows each source’s tags and lets an admin write any source’s card', async () => {
    const state = list();
    renderPanel(state);
    const rows = await screen.findAllByTestId('ce-context-source');
    expect(within(rows[0]).getByRole('list', { name: 'Topics of essay.md' })).toHaveTextContent('institutions');
    expect(within(rows[1]).queryByTestId('ce-context-card')).toBeNull();
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Edit the card of notes.md' }));
    fireEvent.change(within(rows[1]).getByLabelText('Summary'), { target: { value: 'Notes from the first meeting.' } });
    await act(async () => fireEvent.click(within(rows[1]).getByRole('button', { name: 'Save card' })));
    expect(setContextCard).toHaveBeenCalledWith(
      'notes',
      { summary: 'Notes from the first meeting.', tags: [], names: [] },
      options,
    );
    expect(state.reload).toHaveBeenCalled();
  });

  it('makes the missing cards only after showing how many and what they cost', async () => {
    const state = list();
    renderPanel(state);
    const button = await screen.findByTestId('ce-context-make-cards');
    // The essay has a card and the unread PDF has no text: two are missing.
    expect(button).toHaveTextContent('Make missing cards (2)');
    expect(button).toHaveAccessibleDescription(/A card says what a file or link is about/);
    jest.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(button);
    expect(window.confirm).toHaveBeenCalledWith(
      '2 items have no card. Each card is one short call to the session’s AI on the session’s key, ' +
        'about $0.004 on the default model: under $0.01 in all. Make them now?',
    );
    expect(makeContextCard).not.toHaveBeenCalled();

    jest.mocked(makeContextCard).mockRejectedValueOnce(new Error('The session’s AI could not write this card.'));
    await act(async () => fireEvent.click(button));
    expect(jest.mocked(makeContextCard).mock.calls.map(([id]) => id)).toEqual(['notes', 'minutes']);
    await waitFor(() =>
      expect(screen.getByTestId('ce-context-sources-status')).toHaveTextContent(
        'Wrote 1 card. 1 could not be written: The session’s AI could not write this card.',
      ),
    );
    expect(state.reload).toHaveBeenCalled();
  });

  it('offers no card for a source the Worker stores encrypted', async () => {
    const sealed = source({ id: 'sealed', title: 'sealed.md', encrypted: true });
    renderPanel(list({ sources: [notes, sealed] }));
    const rows = await screen.findAllByTestId('ce-context-source');
    expect(screen.getByTestId('ce-context-make-cards')).toHaveTextContent('Make missing cards (1)');
    expect(within(rows[0]).getByRole('button', { name: 'Edit the card of notes.md' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: /Edit the card/ })).toBeNull();
  });

  it('states the cost of many cards, and offers nothing where every source has one or the Worker keeps none', async () => {
    expect(describeCardCost(1)).toMatch(/^1 item has no card\..*under \$0\.01 in all\.$/);
    expect(describeCardCost(300)).toMatch(/^300 items have no card\..*about \$1\.20 in all\.$/);
    const { unmount } = renderPanel(list({ sources: [essay, unreadPdf] }));
    await screen.findAllByTestId('ce-context-source');
    expect(screen.queryByTestId('ce-context-make-cards')).toBeNull();
    unmount();
    renderPanel(list({ cardsSupported: false }));
    await screen.findAllByTestId('ce-context-source');
    expect(screen.queryByTestId('ce-context-make-cards')).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit the card/ })).toBeNull();
  });
});
