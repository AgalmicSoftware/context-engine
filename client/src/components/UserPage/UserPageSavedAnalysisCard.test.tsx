import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { SavedAnalysisCard } from '@ce-shared/analysisCardSaved.mjs';
import { fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import {
  publishSavedAnalysisCard,
  readSavedAnalysisCard,
  subscribeSavedAnalysisCards,
} from 'utilities/analysisCard/analysisCardSaved';

import UserPageSavedAnalysisCard from './UserPageSavedAnalysisCard';

jest.mock('utilities/ai/aiClient.js', () => ({ fetchAnalysisCardPicture: jest.fn() }));
jest.mock('utilities/analysisCard/analysisCardSaved', () => ({
  readSavedAnalysisCard: jest.fn(),
  publishSavedAnalysisCard: jest.fn(),
  subscribeSavedAnalysisCards: jest.fn(),
  formatSavedAnalysisCardDate: (savedAt: number) => `day ${savedAt}`,
}));
jest.mock('./UserPageAnalysisCard', () => ({
  __esModule: true,
  default: ({ card, picture }: { card: { title: string; own: boolean }; picture: { status: string } | null }) => (
    <div data-testid="analysis-card">
      {card.title} / {card.own ? 'mine' : 'theirs'} / {picture?.status || 'no picture'}
    </div>
  ),
}));

const mockedRead = jest.mocked(readSavedAnalysisCard);
const mockedPicture = jest.mocked(fetchAnalysisCardPicture);
const mockedSubscribe = jest.mocked(subscribeSavedAnalysisCards);
const mockedPublish = jest.mocked(publishSavedAnalysisCard);
const PERSON = '0x00000000000000000000000000000000000000aa';
const VISITOR = '0x00000000000000000000000000000000000000bb';
const CARD: SavedAnalysisCard = {
  title: 'Keeps the commons in common hands',
  matchNote: '',
  figure: 'Elinor Ostrom (1933–2012)',
  tastes: { book: null, game: null, film: null, song: null },
  answers: { yesNo: null, ownWords: null, vote: null },
};
const OPTIONS = { sessionSlug: 'salon' };
// One loader for every render, as the page gives: only the props a test changes can make the card load again.
const LOAD = async () => OPTIONS;
let changed: () => void = () => {};

const show = (props: Partial<React.ComponentProps<typeof UserPageSavedAnalysisCard>> = {}) =>
  render(
    <UserPageSavedAnalysisCard
      viewAddress={PERSON}
      account={VISITOR}
      pageSlug="salon"
      profileKey="one"
      loadOptions={LOAD}
      {...props}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedPicture.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,AAAA', accentHex: '' });
  mockedSubscribe.mockImplementation((listener: () => void) => {
    changed = listener;
    return () => {};
  });
});

it('shows the card a person saved, with its picture and the day it was saved', async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  show();
  await waitFor(() => expect(screen.getByTestId('analysis-card').textContent).toContain('ready'));
  expect(screen.getByTestId('analysis-card').textContent).toBe('Keeps the commons in common hands / theirs / ready');
  expect(screen.getByText('Their card, saved day 9')).toBeTruthy();
  expect(mockedRead).toHaveBeenCalledWith(PERSON, OPTIONS);
  expect(mockedPicture).toHaveBeenCalledWith('Elinor Ostrom (1933–2012)', OPTIONS);
});

it('on my own page says the card is mine and shown', async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  show({ account: PERSON.toUpperCase().replace('0X', '0x') });
  await waitFor(() => expect(screen.getByText('Your card, shown on your page, saved day 9')).toBeTruthy());
  expect(screen.getByTestId('analysis-card').textContent).toContain('mine');
});

it.each([[{ status: 'none' as const }], [{ status: 'withdrawn' as const }], [null]])(
  'shows nothing for %p',
  async (state) => {
    mockedRead.mockResolvedValue(state);
    const { container } = show();
    await waitFor(() => expect(mockedRead).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
    expect(mockedPicture).not.toHaveBeenCalled();
  },
);

it('asks nothing when the page has no session to ask', async () => {
  const { container } = show({ loadOptions: async () => null });
  await act(async () => {});
  expect(container.innerHTML).toBe('');
  expect(mockedRead).not.toHaveBeenCalled();
});

it('takes the card away at once when it is withdrawn on this page', async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  const { container } = show({ account: PERSON });
  await waitFor(() => expect(screen.getByTestId('analysis-card')).toBeTruthy());
  mockedRead.mockResolvedValue({ status: 'withdrawn' });
  await act(async () => changed());
  await waitFor(() => expect(container.innerHTML).toBe(''));
});

it('on my own page takes the card off without a new one, and says when it could not', async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  mockedPublish.mockRejectedValueOnce(new Error('card_store_unavailable'));
  const { container } = show({ account: PERSON });
  fireEvent.click(await screen.findByRole('button', { name: 'Take it off my page' }));
  expect(mockedPublish).toHaveBeenCalledWith(PERSON, false, null, OPTIONS);
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/could not be taken off/));

  mockedPublish.mockImplementationOnce(async () => {
    mockedRead.mockResolvedValue({ status: 'withdrawn' });
    changed();
    return { status: 'withdrawn' };
  });
  fireEvent.click(screen.getByRole('button', { name: 'Take it off my page' }));
  await waitFor(() => expect(container.innerHTML).toBe(''));
});

it("offers no way to take someone else's card off", async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  show();
  await screen.findByTestId('analysis-card');
  expect(screen.queryByRole('button', { name: 'Take it off my page' })).toBeNull();
});

it('shows nothing of the last person or sign-in while the next one loads', async () => {
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  const view = show();
  await screen.findByTestId('analysis-card');

  mockedRead.mockReturnValue(new Promise(() => {}));
  view.rerender(
    <UserPageSavedAnalysisCard
      viewAddress={PERSON}
      account="0x00000000000000000000000000000000000000cc"
      pageSlug="salon"
      profileKey="one"
      loadOptions={LOAD}
    />,
  );
  expect(view.container.innerHTML).toBe('');
  await waitFor(() => expect(mockedRead).toHaveBeenCalledTimes(2));
});

it("keeps the picture of the card on screen, not an earlier figure's that comes back late", async () => {
  let finishFirst: (value: { dataUrl: string; accentHex: string }) => void = () => {};
  mockedPicture.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
  mockedRead.mockResolvedValue({ status: 'ready', card: CARD, savedAt: 9 });
  show({ account: PERSON });
  await waitFor(() => expect(mockedPicture).toHaveBeenCalledTimes(1));

  mockedPicture.mockReturnValueOnce(new Promise(() => {}));
  mockedRead.mockResolvedValue({ status: 'ready', card: { ...CARD, figure: 'Hypatia (c. 350–415)' }, savedAt: 10 });
  await act(async () => changed());
  await waitFor(() => expect(mockedPicture).toHaveBeenCalledTimes(2));
  await act(async () => finishFirst({ dataUrl: 'data:image/jpeg;base64,AAAA', accentHex: '' }));
  expect(screen.getByTestId('analysis-card').textContent).toContain('loading');
});
