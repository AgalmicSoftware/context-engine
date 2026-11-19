/** @file CompareSubjectNameSearch.test.tsx */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompareAddress from './CompareAddresses';
import CompareSubjectNameSearch, { resolveTypedCompareNames } from './CompareSubjectNameSearch';
import { useSessionNames } from '../../utilities/session/useSessionNames';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  subscribeCacheUpdates: jest.fn(() => () => {}),
}));
jest.mock('../../utilities/ai/aiClient.js', () => ({ runCompareToolkit: jest.fn(async () => null) }));
jest.mock('../../utilities/session/useSessionNames', () => ({ useSessionNames: jest.fn() }));

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const names = { [A]: 'Sam', [B]: 'sam', [C]: 'Ada Lovelace' };

describe('resolveTypedCompareNames', () => {
  it('swaps a name only one account has, or a part only one account matches, for that account', () => {
    expect(resolveTypedCompareNames([' ada  lovelace ', `wallet:${A}`, '', 'love'], names)).toEqual({
      values: [`wallet:${C}`, `wallet:${A}`, '', `wallet:${C}`],
      problem: '',
    });
  });

  it('leaves text that fits several accounts, or none, as typed and says so', () => {
    expect(resolveTypedCompareNames(['SAM', B], names)).toEqual({
      values: ['SAM', B],
      problem: 'More than one person here is named “SAM”. Pick one from the list under the box.',
    });
    expect(resolveTypedCompareNames(['a', 'nobody'], names).problem).toBe(
      'More than one person here is named “a”. Pick one from the list under the box.',
    );
    expect(resolveTypedCompareNames(['nobody'], names)).toEqual({
      values: ['nobody'],
      problem: '“nobody” isn’t an address, or a name you can see in this session.',
    });
  });
});

describe('CompareSubjectNameSearch', () => {
  const renderBox = (value: string, taken: string[] = [], onChange = jest.fn()) => {
    render(<CompareSubjectNameSearch index={1} names={names} onChange={onChange} taken={taken} value={value} />);
    return onChange;
  };

  it('lists each account whose name matches, with its short address, and picks the one pressed', () => {
    const onChange = renderBox('sam');
    expect(screen.getByRole('textbox', { name: 'Comparison subject 2' })).toHaveAttribute(
      'placeholder',
      'Username, wallet:0x…, worker:…, or sim:…',
    );
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Sam (0x000…00aa)',
      'sam (0x000…00bb)',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'sam (0x000…00bb)' }));
    expect(onChange).toHaveBeenCalledWith(`wallet:${B}`);
  });

  it('keeps spaces while typing and leaves out accounts already compared', () => {
    const onChange = renderBox('sam', [A]);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ada ' } });
    expect(onChange).toHaveBeenCalledWith('Ada ');
  });

  it('picks the only match on Enter, and offers nothing for an address or with no names', () => {
    const onChange = renderBox('love');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(`wallet:${C}`);

    render(<CompareSubjectNameSearch index={0} names={{}} onChange={jest.fn()} taken={[]} value="sam" />);
    expect(screen.getByRole('textbox', { name: 'Comparison subject 1' })).toHaveAttribute(
      'placeholder',
      'wallet:0x…, worker:…, or sim:…',
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('Compare by name', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(useSessionNames).mockReturnValue({ source: null, names, answerNamesShown: false, signIn: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const renderCompare = () =>
    render(
      <MemoryRouter initialEntries={['/']}>
        <CompareAddress activeSessionSlug="alpha" firstAddress="" sessionCachesReady />
      </MemoryRouter>,
    );

  it('shows the picked account as its name with the short address', () => {
    renderCompare();
    fireEvent.change(screen.getByRole('textbox', { name: 'Comparison subject 1' }), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace (0x000…00cc)' }));
    expect(screen.getByLabelText('Ada Lovelace (0x000…00cc)')).toBeInTheDocument();
    expect(screen.queryByText(/your private label/)).toBeNull();
    // The keyboard's place follows the pick to the new pill.
    act(() => jest.runOnlyPendingTimers());
    expect(screen.getAllByRole('button', { name: 'Clear this subject' })[0]).toHaveFocus();
  });

  it('asks which account is meant when a typed name belongs to two', () => {
    renderCompare();
    fireEvent.change(screen.getByRole('textbox', { name: 'Comparison subject 1' }), {
      target: { value: 'ada lovelace' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Comparison subject 2' }), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare Views & Activity' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'More than one person here is named “Sam”. Pick one from the list under the box.',
    );
    // The name only one account has was swapped for that account.
    expect(screen.getByLabelText('Ada Lovelace (0x000…00cc)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sam (0x000…00bb)' })).toBeInTheDocument();
    // No "Retry loading" under a name problem, and it goes once a box changes.
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'sam (0x000…00bb)' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
