import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ComparePresentation from './ComparePresentation';
import { buildAnswerStrips } from './CompareAnswerStrips';
import { assignRows } from './compareStandDimensions';
const users = [
  {
    address: '0x01',
    questions: [
      { id: 'b', type: 'binary', prompt: 'Draft compromises?', answer: 'Agree' },
      {
        id: 'm',
        type: 'multichoice',
        prompt: 'Civic tools?',
        options: ['Assemblies', 'Voting'],
        answer: ['Assemblies'],
      },
      { id: 'r', type: 'rating', prompt: 'Trust?', answer: 4 },
      { id: 'f', type: 'freeform', prompt: 'Protect what?', answer: 'Private participation.' },
      { id: 'q', type: 'quadratic', prompt: 'AI roles?', options: ['Summarize', 'Decide'], answer: [4, -1] },
    ],
  },
  {
    address: '0x02',
    questions: [
      { id: 'b', type: 'binary', prompt: 'Draft compromises?', answer: 'Agree' },
      { id: 'q', type: 'quadratic', prompt: 'AI roles?', options: ['Summarize', 'Decide'], answer: [2, -3] },
    ],
  },
];
const compass = {
  axes: [
    {
      id: 'x',
      label: 'AI role',
      negativeLabel: 'Assist people',
      positiveLabel: 'Delegate decisions',
      description: 'Assistance versus delegation.',
    },
    {
      id: 'y',
      label: 'Participation',
      negativeLabel: 'Privacy first',
      positiveLabel: 'Transparency first',
      description: 'Visibility preferences.',
    },
  ],
  points: [
    { address: '0x01', x: -1, y: -1 },
    { address: '0x02', x: 1, y: 0.1 },
  ],
};
const props = {
  users,
  labels: ['First participant', 'Second participant'],
  result: { agreements: [{ text: 'Both support drafting.' }], disagreements: [{ text: 'They differ on deciding.' }] },
  compass,
  axesSource: 'ai' as const,
  generation: { model: 'example-model', provider: 'example', source: 'reported' as const },
};
const openDetails = () => {
  const button = screen.getByRole('button', { name: /Explore answers/ });
  fireEvent.click(button);
  return within(document.getElementById(String(button.getAttribute('aria-controls'))) as HTMLElement);
};
const binaryUsers = (answers: unknown[][]) =>
  answers[0].map((_, person) => ({
    address: `0x0${person}`,
    questions: answers.map((row, index) => ({
      id: `s${index}`,
      type: 'binary',
      prompt: `Statement ${index}`,
      answer: row[person],
    })),
  }));

test('shows summary, dimensions, and strips by default with details collapsed', () => {
  render(<ComparePresentation {...props} />);
  expect(screen.getByText('Both support drafting.')).toBeVisible();
  expect(screen.getByText('Model: example-model')).toBeVisible();
  expect(screen.getByText('Based on visible answers and available activity.', { exact: false })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'AI role' })).toBeVisible();
  expect(screen.getByText('← Assist people')).toBeVisible();
  expect(screen.getByText('Transparency first →')).toBeVisible();
  expect(screen.getByText('AI-generated dimensions')).toBeVisible();
  expect(screen.queryByText('Civic tools?')).not.toBeInTheDocument();
  const details = openDetails();
  expect(details.getByText('Draft compromises?')).toBeVisible();
  for (const name of ['Binary', 'Multi-choice', 'Rating', 'Freeform', 'Quadratic']) {
    expect(details.getByRole('button', { name })).toBeVisible();
  }
  fireEvent.click(details.getByRole('button', { name: 'Quadratic' }));
  expect(details.queryByText('Draft compromises?')).not.toBeInTheDocument();
  expect(details.getByText('AI roles?')).toBeVisible();
  expect(details.getByText('+4')).toBeVisible();
  expect(details.getByText('−3')).toBeVisible();
  fireEvent.click(details.getByRole('button', { name: 'Freeform' }));
  expect(details.getByText('Private participation.')).toBeVisible();
  expect(details.getByText('No visible answer')).toBeVisible();
});

test('does not draw fallback axes or claim summaries came from AI', () => {
  render(<ComparePresentation {...props} axesSource="fallback" generation={null} />);
  expect(screen.queryByText('Where they stand')).not.toBeInTheDocument();
  expect(screen.queryByText('AI role')).not.toBeInTheDocument();
  expect(screen.getByText('Local comparison · AI summary unavailable')).toBeVisible();
  expect(screen.queryByText(/Model:/)).not.toBeInTheDocument();
  // The strips need no AI, so they stay.
  expect(screen.getByText('Where they agree, where they split')).toBeVisible();
});

test('says why the AI summary is unavailable when it is told', () => {
  render(
    <ComparePresentation
      {...props}
      axesSource="fallback"
      generation={null}
      aiUnavailableReason="This page has no AI service for this session."
    />,
  );
  expect(
    screen.getByText('Local comparison · AI summary unavailable: This page has no AI service for this session.'),
  ).toBeVisible();
});

test('keeps loading timers and explains the dimensions on demand', () => {
  const { rerender } = render(<ComparePresentation {...props} bulletsLoading compassLoading />);
  expect(screen.getByText(/Loading summary/)).toBeVisible();
  expect(screen.getByText(/Loading dimensions/)).toBeVisible();
  rerender(<ComparePresentation {...props} />);
  fireEvent.click(screen.getByText('Why these dimensions?'));
  expect(screen.getByText('Assistance versus delegation.')).toBeVisible();
});

describe('headline', () => {
  it('shows the AI headline above the cards', () => {
    render(
      <ComparePresentation {...props} result={{ ...props.result, headline: 'Both back drafts; they split on AI.' }} />,
    );
    expect(screen.getByText('Both back drafts; they split on AI.')).toBeVisible();
    expect(screen.queryByText(/shared question/)).not.toBeInTheDocument();
  });

  it('shows a plain count in place of a missing headline, and nothing without counts', () => {
    const { rerender } = render(<ComparePresentation {...props} sharedQuestionCount={2} />);
    expect(screen.getByText('2 people, 2 shared questions')).toBeVisible();
    rerender(<ComparePresentation {...props} sharedQuestionCount={1} />);
    expect(screen.getByText('2 people, 1 shared question')).toBeVisible();
    rerender(<ComparePresentation {...props} sharedQuestionCount={0} />);
    expect(screen.queryByText(/people,/)).not.toBeInTheDocument();
  });
});

describe('similarity and difference cards', () => {
  it('draws titled cards and each side of a difference as letters and words', () => {
    render(
      <ComparePresentation
        {...props}
        users={[...users, { address: '0x03', questions: [] }]}
        labels={['Ada', 'Ben', 'Cleo']}
        result={{
          agreements: [{ title: 'Public hearings', text: 'Each would hold a hearing first.' }],
          disagreements: [
            {
              title: 'Who decides',
              text: 'A and C say councils; B says a national body.',
              sides: [
                { who: ['A', 'C'], view: 'say local councils' },
                { who: ['B'], view: 'says a national body' },
              ],
            },
            { title: 'Speed', text: 'B would pilot now; A would wait.' },
          ],
        }}
      />,
    );
    const differences = within(screen.getByTestId('ce-compare-disagreements'));
    expect(screen.getByRole('heading', { name: 'Public hearings' })).toBeVisible();
    expect(screen.getByText('Each would hold a hearing first.')).toBeVisible();
    expect(differences.getByRole('heading', { name: 'Who decides' })).toBeVisible();
    const [first, second] = screen.getByTestId('ce-compare-disagreements').querySelectorAll<HTMLElement>('.side');
    expect(first).toHaveTextContent('ACAda and Cleo: say local councils');
    expect(second).toHaveTextContent('BBen: says a national body');
    expect(within(first).getByTitle('Ada')).toHaveTextContent('A');
    // Sides replace the sentence; a difference without them keeps its sentence.
    expect(differences.queryByText('A and C say councils; B says a national body.')).not.toBeInTheDocument();
    expect(differences.getByText('B would pilot now; A would wait.')).toBeVisible();
  });

  it('draws plain paragraphs from an older reply as untitled cards', () => {
    render(<ComparePresentation {...props} />);
    const similarities = within(screen.getByTestId('ce-compare-agreements'));
    expect(similarities.getByRole('listitem')).toHaveTextContent('Both support drafting.');
    expect(similarities.queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
    expect(screen.getByText('They differ on deciding.')).toBeVisible();
  });
});

describe('where they stand', () => {
  it('places each dot from the position data and describes it in words', () => {
    const { container } = render(<ComparePresentation {...props} />);
    const [roleTrack] = container.querySelectorAll('.track');
    const dots = roleTrack.querySelectorAll<HTMLElement>('.trackDot');
    expect([...dots].map((dot) => dot.style.left)).toEqual(['0%', '100%']);
    expect(within(dots[0]).getByTitle('First participant')).toHaveTextContent('A');
    expect(screen.getByRole('list', { name: 'AI role, from Assist people to Delegate decisions' })).toHaveTextContent(
      'First participant: near Assist peopleSecond participant: near Delegate decisions',
    );
    expect(
      screen.getByRole('list', { name: 'Participation, from Privacy first to Transparency first' }),
    ).toHaveTextContent('Second participant: in the middle');
  });

  it('gives dots that would overlap their own rows', () => {
    expect(assignRows([[50], [52], [51], [90], [10]], 12)).toEqual([0, 1, 2, 0, 0]);
    expect(assignRows([[20], [20]], 12)).toEqual([0, 1]);
    // On the map, dots apart on either axis share a row.
    expect(
      assignRows(
        [
          [50, 50],
          [52, 90],
          [51, 51],
        ],
        8,
      ),
    ).toEqual([0, 0, 1]);
    const { container } = render(
      <ComparePresentation
        {...props}
        compass={{
          ...compass,
          points: [
            { address: '0x01', x: 0.1, y: 0 },
            { address: '0x02', x: 0.12, y: 0 },
          ],
        }}
      />,
    );
    const dots = container.querySelector('.track')?.querySelectorAll<HTMLElement>('.trackDot') || [];
    expect([...dots].map((dot) => dot.style.getPropertyValue('--lane'))).toEqual(['0', '1']);
  });

  it('leaves out a dimension the AI gave no name, and the map that needs both', () => {
    render(<ComparePresentation {...props} compass={{ ...compass, axes: [{ label: ' ' }, compass.axes[1]] }} />);
    expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).not.toContain('');
    expect(screen.getByRole('heading', { name: 'Participation' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
  });

  it('still draws a named dimension whose ends the AI left unnamed, as Lower to Higher', () => {
    const { container } = render(
      <ComparePresentation {...props} compass={{ ...compass, axes: [{ label: 'Trust in AI' }, compass.axes[1]] }} />,
    );
    expect(screen.getByRole('heading', { name: 'Trust in AI' })).toBeVisible();
    expect(container.querySelector('.track')?.parentElement).toHaveTextContent('Lower');
    expect(container.querySelector('.track')?.parentElement).toHaveTextContent('Higher');
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
  });

  it('says so when the people share no question, instead of leaving a gap', () => {
    render(<ComparePresentation {...props} opinionComparable={false} />);
    expect(screen.getByText('No positions to show: these people answered no questions in common.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Where they stand' })).not.toBeInTheDocument();
  });

  it('draws neither sliders nor map for failed axes', () => {
    const { container } = render(<ComparePresentation {...props} axesSource="fallback" />);
    expect(screen.queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
    expect(container.querySelector('.track')).toBeNull();
    expect(container.querySelector('.plot')).toBeNull();
  });
});

describe('map view', () => {
  const showMap = (overrides: Partial<ComponentProps<typeof ComparePresentation>> = {}) => {
    const view = render(<ComparePresentation {...props} labels={['Ada', 'Ben']} {...overrides} />);
    expect(screen.getByRole('button', { name: 'Sliders' })).toHaveAttribute('aria-pressed', 'true');
    expect(view.container.querySelector('.plot')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(view.container.querySelector('.track')).toBeNull();
    return view.container;
  };

  it('shows sliders first, then the map with every end at its own end and every person named', () => {
    const container = showMap();
    expect(container.querySelector('.mapLeft')).toHaveTextContent('Assist people');
    expect(container.querySelector('.mapRight')).toHaveTextContent('Delegate decisions');
    expect(container.querySelector('.mapTop')).toHaveTextContent('Transparency first');
    expect(container.querySelector('.mapBottom')).toHaveTextContent('Privacy first');
    expect(container.querySelector('.mapLeft')).toHaveAttribute('title', 'Assist people');
    expect(container.querySelector('.axisNameX')).toHaveTextContent('AI role');
    expect(container.querySelector('.axisNameY')).toHaveTextContent('Participation');
    const dots = [...container.querySelectorAll<HTMLElement>('.mapDot')];
    expect(dots.map((dot) => dot.textContent)).toEqual(['AAda', 'BBen']);
    // The dot at the right end names itself on its left, so the name stays on the plot.
    expect(dots.map((dot) => [dot.dataset.side, dot.style.left, dot.style.right, dot.style.top])).toEqual([
      ['right', '0%', '', '100%'],
      ['left', '', '0%', '45%'],
    ]);
    expect(container.querySelector('.legend')).toHaveTextContent('AAdaBBen');
    expect(
      screen.getByRole('list', {
        name: 'Map: AI role, from Assist people to Delegate decisions; Participation, from Privacy first to Transparency first',
      }),
    ).toHaveTextContent('Ada: near Assist people, near Privacy firstBen: near Delegate decisions, in the middle');
  });

  it('draws people at the same spot as one cluster there, never moved apart', () => {
    const container = showMap({
      compass: {
        ...compass,
        points: [
          { address: '0x01', x: 0.3, y: -0.5 },
          { address: '0x02', x: 0.3, y: -0.5 },
        ],
      },
    });
    const dots = [...container.querySelectorAll<HTMLElement>('.mapDot')];
    expect(dots).toHaveLength(1);
    expect(dots[0].textContent).toBe('ABAda and Ben');
    // At the spot itself (65% across, 75% down), with the names on the side that has room.
    expect([dots[0].style.right, dots[0].style.top, dots[0].style.getPropertyValue('--members')]).toEqual([
      '35%',
      '75%',
      '2',
    ]);
    expect(container.querySelector('.legend')).toHaveTextContent('AAdaBBen');
  });
});

describe('where they agree, where they split', () => {
  it('labels two people agree or split, splits first, from visible answers only', () => {
    const strips = buildAnswerStrips(
      binaryUsers([
        ['yes', 'yes'],
        ['yes', 'no'],
        ['*', 'no'],
        ['Unsure', null],
        ['agree', 'disagree'],
      ]),
    );
    expect(strips.map(({ prompt, split }) => [prompt, split])).toEqual([
      ['Statement 1', true],
      ['Statement 4', true],
      ['Statement 0', false],
    ]);
  });

  it('does not call it agreement when everyone is unsure, and says when only some answered', () => {
    const strips = buildAnswerStrips(
      binaryUsers([
        ['unsure', 'unsure', 'unsure'],
        ['yes', 'yes', '*'],
        ['yes', 'no', null],
      ]),
    );
    expect(strips.map(({ prompt, tag }) => [prompt, tag])).toEqual([
      ['Statement 2', 'split, 2 of 3 answered'],
      ['Statement 0', 'all unsure'],
      ['Statement 1', 'agree, 2 of 3 answered'],
    ]);
  });

  it('draws a dot per visible answer for three people, with the words agree and split', () => {
    render(
      <ComparePresentation
        {...props}
        labels={['Ada', 'Ben', 'Cleo']}
        users={binaryUsers([
          ['yes', 'yes', 'yes'],
          ['no', 'unsure', 'yes'],
          ['yes', '*', 'yes'],
        ])}
      />,
    );
    const items = within(screen.getByRole('region', { name: 'Where they agree, where they split' })).getAllByRole(
      'listitem',
    );
    // Where only some answered, the tag says how many, so "agree" never speaks for a person with no dot.
    expect(items.map((item) => item.querySelector('.stripTag')?.textContent)).toEqual([
      'split',
      'agree',
      'agree, 2 of 3 answered',
    ]);
    expect(items[0]).toHaveTextContent('Disagree: Ada. Unsure: Ben. Agree: Cleo.');
    expect(items[2]).toHaveTextContent('Agree: Ada and Cleo.');
    expect(within(items[2]).queryByTitle('Ben')).not.toBeInTheDocument();
  });

  it('says "you" when the viewer is compared and shows eight strips until asked for all', () => {
    render(
      <ComparePresentation
        {...props}
        viewerCompared
        users={binaryUsers(Array.from({ length: 10 }, (_, index) => (index % 2 ? ['yes', 'no'] : ['yes', 'yes'])))}
      />,
    );
    const region = within(screen.getByRole('region', { name: 'Where you agree, where you split' }));
    expect(region.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(region.getByRole('button', { name: 'Show all 10' }));
    expect(region.getAllByRole('listitem')).toHaveLength(10);
    expect(region.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('is left out when no yes/no statement has two visible answers', () => {
    render(
      <ComparePresentation
        {...props}
        users={binaryUsers([
          ['yes', '*'],
          ['maybe later', 'no'],
        ])}
      />,
    );
    expect(screen.queryByText(/agree, where/)).not.toBeInTheDocument();
  });
});

test('compares selections and ratings without inventing missing responses', () => {
  render(<ComparePresentation {...props} />);
  const details = openDetails();
  fireEvent.click(details.getByRole('button', { name: 'Multi-choice' }));
  expect(details.getByRole('table')).toBeVisible();
  expect(details.getByLabelText('Selected')).toBeVisible();
  expect(details.getByLabelText('Not selected')).toBeVisible();
  expect(details.getAllByText('No visible answer')).toHaveLength(2);
  fireEvent.click(details.getByRole('button', { name: 'Rating' }));
  expect(details.getByText('4')).toBeVisible();
  expect(details.getByText('10 (10)')).toBeVisible();
  expect(details.getByText('No visible answer')).toBeVisible();
});

test('marks invalid quadratic allocations and leaves absent votes absent', () => {
  render(
    <ComparePresentation
      {...props}
      users={[
        {
          address: '0x01',
          questions: [{ id: 'q', type: 'quadratic', prompt: 'Allocate', options: ['One', 'Two'], answer: [20, 0] }],
        },
        { address: '0x02', questions: [] },
      ]}
    />,
  );
  const details = openDetails();
  expect(details.getAllByText('Invalid allocation')).toHaveLength(2);
  expect(details.getAllByText('No visible answer')).toHaveLength(2);
  expect(details.queryByText('+20')).not.toBeInTheDocument();
});

test('assigns binary answer tones without coloring missing or unknown answers', () => {
  const answers = ['yes', 'no', 'neutral', 'unrecognized', null];
  render(
    <ComparePresentation
      {...props}
      users={answers.map((answer, index) => ({
        address: `subject-${index}`,
        questions: [{ id: 'b', type: 'binary', prompt: 'A shared question?', answer }],
      }))}
    />,
  );
  const details = openDetails();
  expect(details.getByText('Agree')).toHaveAttribute('data-answer', 'agree');
  expect(details.getByText('Disagree')).toHaveAttribute('data-answer', 'disagree');
  expect(details.getByText('Unsure')).toHaveAttribute('data-answer', 'unsure');
  expect(details.getByText('unrecognized')).not.toHaveAttribute('data-answer');
  expect(details.getByText('No visible answer')).not.toHaveAttribute('data-answer');
});
