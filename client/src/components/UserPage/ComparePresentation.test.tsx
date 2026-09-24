import { fireEvent, render, screen } from '@testing-library/react';
import ComparePresentation from './ComparePresentation';
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
    { address: '0x02', x: 1, y: 1 },
  ],
};
const props = {
  users,
  labels: ['First participant', 'Second participant'],
  result: { agreements: ['Both support drafting.'], disagreements: ['They differ on decision-making.'] },
  compass,
  axesSource: 'ai' as const,
  generation: { model: 'example-model', provider: 'example', source: 'reported' as const },
};
test('shows summary and labelled graph by default with details collapsed', () => {
  render(<ComparePresentation {...props} />);
  expect(screen.getByText('Both support drafting.')).toBeVisible();
  expect(screen.getByText('Model: example-model')).toBeVisible();
  expect(screen.getByRole('img', { name: '2D opinion compass plot' })).toBeVisible();
  expect(screen.getByText('Assist people')).toBeVisible();
  expect(screen.getByText('Transparency first')).toBeVisible();
  expect(screen.queryByText('AI summary')).not.toBeInTheDocument();
  expect(screen.queryByText('Compare perspectives')).not.toBeInTheDocument();
  expect(screen.queryByText('First participant')).not.toBeInTheDocument();
  expect(screen.queryByText('Draft compromises?')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Explore answers/ }));
  expect(screen.getByText('Draft compromises?')).toBeVisible();
  for (const name of ['Binary', 'Multi-choice', 'Rating', 'Freeform', 'Quadratic']) {
    expect(screen.getByRole('button', { name })).toBeVisible();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Quadratic' }));
  expect(screen.queryByText('Draft compromises?')).not.toBeInTheDocument();
  expect(screen.getByText('AI roles?')).toBeVisible();
  expect(screen.getByText('+4')).toBeVisible();
  expect(screen.getByText('−3')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Freeform' }));
  expect(screen.getByText('Private participation.')).toBeVisible();
  expect(screen.getByText('No visible answer')).toBeVisible();
});
test('does not claim fallback axes or summaries came from AI', () => {
  render(<ComparePresentation {...props} axesSource="fallback" generation={null} />);
  expect(screen.getByText('Statistical axes')).toBeVisible();
  expect(screen.queryByText('AI-generated axes')).not.toBeInTheDocument();
  expect(screen.getByText('Local comparison · AI summary unavailable')).toBeVisible();
});
test('keeps loading timers and explains axis provenance on demand', () => {
  const { rerender } = render(<ComparePresentation {...props} bulletsLoading compassLoading />);
  expect(screen.getByText(/Loading summary/)).toBeVisible();
  expect(screen.getByText(/Loading chart/)).toBeVisible();
  rerender(<ComparePresentation {...props} />);
  fireEvent.click(screen.getByText('Why these axes?'));
  expect(screen.getByText('Assistance versus delegation.')).toBeVisible();
});

test('compares selections and ratings without inventing missing responses', () => {
  render(<ComparePresentation {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Explore answers/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Multi-choice' }));
  expect(screen.getByRole('table')).toBeVisible();
  expect(screen.getByLabelText('Selected')).toBeVisible();
  expect(screen.getByLabelText('Not selected')).toBeVisible();
  expect(screen.getAllByText('No visible answer')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Rating' }));
  expect(screen.getByText('4')).toBeVisible();
  expect(screen.getByText('10 (10)')).toBeVisible();
  expect(screen.getByText('No visible answer')).toBeVisible();
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
  fireEvent.click(screen.getByRole('button', { name: /Explore answers/ }));
  expect(screen.getAllByText('Invalid allocation')).toHaveLength(2);
  expect(screen.getAllByText('No visible answer')).toHaveLength(2);
  expect(screen.queryByText('+20')).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('button', { name: /Explore answers/ }));
  expect(screen.getByText('Agree')).toHaveAttribute('data-answer', 'agree');
  expect(screen.getByText('Disagree')).toHaveAttribute('data-answer', 'disagree');
  expect(screen.getByText('Unsure')).toHaveAttribute('data-answer', 'unsure');
  expect(screen.getByText('unrecognized')).not.toHaveAttribute('data-answer');
  expect(screen.getByText('No visible answer')).not.toHaveAttribute('data-answer');
});
