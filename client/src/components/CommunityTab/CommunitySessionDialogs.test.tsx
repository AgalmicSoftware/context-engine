import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  CommunityGroupsSession,
  CommunitySessionDialog,
  countOf,
  dialogSessionList,
  type CommunityDialogSession,
} from './CommunitySessionDialogs';

const session = (slug: string, count: number, state: CommunityDialogSession['state'] = 'ready') => ({
  slug,
  name: slug.toUpperCase(),
  count,
  state,
});

const renderDialog = (sessions: CommunityDialogSession[], total = 0, totalHelp = '') =>
  render(
    <CommunitySessionDialog
      noun="group"
      sessions={sessions}
      total={total}
      totalHelp={totalHelp}
      emptyText="No sessions with groups yet."
      testId="dialog"
      renderSession={(opened) => <p>Inside {opened.name}</p>}
    />,
  );

describe('dialogSessionList', () => {
  it('sorts by count, then name, and leaves out sessions counted at zero', () => {
    const listed = dialogSessionList([
      session('b', 2),
      session('empty', 0),
      session('a', 2),
      session('big', 9),
      session('hidden', 0, 'private'),
    ]);
    expect(listed.map(({ slug }) => slug)).toEqual(['big', 'a', 'b', 'hidden']);
  });

  it('keeps a lone session counted at zero, which opens to its empty state', () => {
    expect(dialogSessionList([session('only', 0)]).map(({ slug }) => slug)).toEqual(['only']);
  });
});

describe('CommunitySessionDialog', () => {
  it('lists sessions with their counts and says why some have none', () => {
    renderDialog(
      [session('alpha', 3), session('beta', 1), session('gamma', 0, 'private'), session('delta', 0, 'loading')],
      4,
    );
    expect(screen.getByText('4 sessions, 4 groups')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ALPHA\s*3 groups/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BETA\s*1 group$/ })).toBeInTheDocument();
    expect(screen.getByText(/groups not public/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About groups not public' })).toBeInTheDocument();
    expect(screen.getByText(/counting/)).toBeInTheDocument();
    // Only a session with a number opens.
    expect(screen.queryByRole('button', { name: /GAMMA/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /DELTA/ })).not.toBeInTheDocument();
  });

  it('opens a session and goes back to the list, moving focus each way', () => {
    renderDialog([session('alpha', 3), session('beta', 1)], 4);
    fireEvent.click(screen.getByRole('button', { name: /BETA/ }));

    expect(screen.getByTestId('dialog-session')).toHaveTextContent('Inside BETA');
    const back = screen.getByRole('button', { name: 'All sessions' });
    expect(back).toHaveFocus();

    fireEvent.click(back);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BETA/ })).toHaveFocus();
  });

  it('opens straight to a lone session, with no way back', () => {
    renderDialog([session('alpha', 0)], 0);
    expect(screen.getByTestId('dialog-session')).toHaveTextContent('Inside ALPHA');
    expect(screen.queryByRole('button', { name: 'All sessions' })).not.toBeInTheDocument();
  });

  it('lists a lone session it cannot open', () => {
    renderDialog([session('alpha', 0, 'unread')], 0);
    expect(screen.getByTestId('dialog')).toHaveTextContent('can’t be read here');
    expect(screen.queryByTestId('dialog-session')).not.toBeInTheDocument();
  });

  it('says so where there are no sessions', () => {
    renderDialog([], 0);
    expect(screen.getByTestId('dialog')).toHaveTextContent('No sessions with groups yet.');
  });

  it('explains a total smaller than its rows', () => {
    renderDialog([session('alpha', 2), session('beta', 2)], 3, 'Counted once here.');
    expect(screen.getByText(/2 sessions, 3 groups/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About the group total' })).toBeInTheDocument();
  });
});

describe('CommunityGroupsSession', () => {
  it('lists each group with its own link, whether it is open, and the session page', () => {
    render(
      <CommunityGroupsSession
        session={session('alpha', 2)}
        groups={[
          { key: 'g1', name: 'Breakout 1', open: true, href: '/group/g1' },
          { key: 'g2', name: 'Organisers', open: false, href: '/group/g2' },
        ]}
        href="/groups/alpha"
        noun="group"
      />,
    );
    expect(screen.getByRole('heading', { name: 'ALPHA: 2 groups' })).toBeInTheDocument();
    const [first, second] = within(screen.getByRole('list')).getAllByRole('link');
    expect(first).toHaveAttribute('href', '/group/g1');
    expect(first).toHaveTextContent(/Breakout 1\s*Open to join/);
    expect(second).toHaveAttribute('href', '/group/g2');
    expect(second).toHaveTextContent(/Organisers\s*Closed/);
    expect(screen.getByRole('link', { name: /See all of this session’s groups/ })).toHaveAttribute(
      'href',
      '/groups/alpha',
    );
  });

  it('says so where a session has no groups', () => {
    render(<CommunityGroupsSession session={session('alpha', 0)} groups={[]} href="/groups/alpha" noun="group" />);
    expect(screen.getByText('No groups in this session yet.')).toBeInTheDocument();
  });
});

it('counts in the singular and plural', () => {
  expect(countOf(1, 'group')).toBe('1 group');
  expect(countOf(0, 'group')).toBe('0 groups');
});
