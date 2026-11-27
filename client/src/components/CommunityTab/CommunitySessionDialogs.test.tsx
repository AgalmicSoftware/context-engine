import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  CommunityGroupsSession,
  CommunityQuestionsSession,
  CommunitySessionDialog,
  countOf,
  dialogSessionList,
  questionKind,
  questionKindSummary,
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

describe('question kinds', () => {
  it('names each stored type as the dialog does', () => {
    expect(
      [
        'binary',
        'multichoice',
        'multiple-choice',
        'poll',
        'rating',
        'freeform',
        'text',
        'quadratic',
        'ranking',
        '',
      ].map(questionKind),
    ).toEqual([
      'agree/disagree',
      'choice',
      'choice',
      'choice',
      'rating',
      'written',
      'written',
      'quadratic',
      'other',
      'other',
    ]);
  });

  it('sums the kinds present in a fixed order', () => {
    const question = (type: string, key: string) => ({ key, prompt: key, type });
    expect(
      questionKindSummary([
        question('freeform', 'a'),
        question('binary', 'b'),
        question('mystery', 'c'),
        question('binary', 'd'),
        question('multichoice', 'e'),
      ]),
    ).toBe('2 agree/disagree, 1 choice, 1 written, 1 other');
  });
});

describe('CommunityQuestionsSession', () => {
  const props = {
    session: session('alpha', 2),
    questions: [
      { key: 'q1', prompt: 'First', type: 'binary' },
      { key: 'q2', prompt: 'Second', type: 'rating' },
    ],
    points: [],
    href: '/session/alpha#report',
    state: 'ready' as const,
    onOpenResults: jest.fn(),
  };
  const point = (questionId: string) => ({
    questionId,
    label: questionId,
    total: 2,
    agrees: 1,
    disagrees: 1,
    value: 1,
  });

  it('asks for what it lacks once it is shown, not on every render', () => {
    const onOpen = jest.fn();
    const view = render(<CommunityQuestionsSession {...props} state="loading" onOpen={onOpen} />);
    view.rerender(<CommunityQuestionsSession {...props} state="loading" onOpen={jest.fn()} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Reading questions…');
  });

  it('starts a read when one becomes needed while the session is shown', () => {
    // Drawn from a complete cache, which then starts reading again: the dialog reads too, with its limit.
    const view = render(<CommunityQuestionsSession {...props} />);
    const onOpen = jest.fn();
    view.rerender(<CommunityQuestionsSession {...props} state="loading" onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const again = jest.fn();
    view.rerender(<CommunityQuestionsSession {...props} state="loading" onOpen={again} />);
    expect(again).not.toHaveBeenCalled();
  });

  it('counts the questions it lists once they are in hand, and the tile’s count until then', () => {
    const listed = { ...props, session: session('alpha', 40) };
    const view = render(<CommunityQuestionsSession {...listed} />);
    expect(screen.getByRole('heading', { name: 'ALPHA: 2 questions' })).toBeInTheDocument();
    view.rerender(<CommunityQuestionsSession {...listed} state="failed" />);
    expect(screen.getByRole('heading', { name: 'ALPHA: 40 questions' })).toBeInTheDocument();
  });

  it('gives the chart one real link to the results, for a keyboard or a screen reader', () => {
    render(<CommunityQuestionsSession {...props} points={[point('q1'), point('q2'), point('q3')]} />);
    expect(screen.getByRole('link', { name: /Open this session’s results/ })).toHaveAttribute(
      'href',
      '/session/alpha#report',
    );
  });

  it('offers Try again where the read is slow or failed', () => {
    const onRetry = jest.fn();
    const view = render(<CommunityQuestionsSession {...props} state="slow" onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('This is taking too long.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    view.rerender(<CommunityQuestionsSession {...props} state="failed" onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('This session’s questions can’t be read here.');
  });

  it('keeps the view picked as more answers arrive', () => {
    const view = render(<CommunityQuestionsSession {...props} points={[point('q1')]} />);
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Chart' }));
    view.rerender(<CommunityQuestionsSession {...props} points={[point('q1'), point('q2'), point('q3')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    view.rerender(
      <CommunityQuestionsSession {...props} points={[point('q1'), point('q2'), point('q3'), point('q4')]} />,
    );
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws the chart at the width its box is given, so a phone needs no sideways scroll', () => {
    let report: (entries: { contentRect: { width: number } }[]) => void = () => {};
    const disconnect = jest.fn();
    class MeasuringObserver {
      constructor(callback: typeof report) {
        report = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
    const scope = window as unknown as { ResizeObserver?: unknown };
    const original = scope.ResizeObserver;
    scope.ResizeObserver = MeasuringObserver;
    try {
      render(<CommunityQuestionsSession {...props} points={[point('q1'), point('q2'), point('q3')]} />);
      act(() => report([{ contentRect: { width: 305.6 } }]));
      expect(screen.getByRole('img', { name: 'Question beeswarm plot' })).toHaveAttribute('viewBox', '0 0 305 200');
      fireEvent.click(screen.getByRole('button', { name: 'List' }));
      expect(disconnect).toHaveBeenCalled();
    } finally {
      scope.ResizeObserver = original;
    }
  });
});
