import { fireEvent, render, screen, within } from '@testing-library/react';

import PolisReportFidelitySection from './PolisReportFidelitySection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const questions = {
  qb1: { id: 'qb1', type: 'binary', prompt: 'One' },
  qb2: { id: 'qb2', type: 'binary', prompt: 'Two' },
  qb3: { id: 'qb3', type: 'binary', prompt: 'Three' },
};
const sessionConfig = { interviewMode: { showFidelityScore: true } };
const address = (index: number) => `0x${String(index + 1).padStart(40, '0')}`;

// A stored answer whose AI-prefill draft said "Agree" with 80% confidence.
const row = (
  responder: string,
  questionId: string,
  answer: string,
  { platform = 'claude', condition = 'shown', origin = 'external_prefill' } = {},
) => ({
  responder,
  questionId,
  timestamp: 1,
  response: {
    questionID: questionId,
    answer: { value: answer, encrypted: false },
    interviewProvenance: {
      draftOrigin: origin,
      source: { platform, modelId: 'test-model' },
      originalPrediction: { answer: 'Agree', confidence: 0.8 },
      predictionCondition: condition,
      confidenceMeaning: 'keep',
    },
  },
});

// Six people: everyone agrees on qb1 and on the hidden qb3; the last three
// disagree on qb2. The sixth person's AI is ChatGPT, the rest Claude.
const sixPeople = () =>
  Array.from({ length: 6 }, (_, index) => {
    const platform = index === 5 ? 'chatgpt' : 'claude';
    return [
      row(address(index), 'qb1', 'Agree', { platform }),
      row(address(index), 'qb2', index < 3 ? 'Agree' : 'Disagree', { platform }),
      row(address(index), 'qb3', 'Agree', { platform, condition: 'blind' }),
    ];
  });

const byQuestion = (rows: ReturnType<typeof row>[]) =>
  rows.reduce<Record<string, ReturnType<typeof row>[]>>((map, entry) => {
    (map[entry.questionId] ||= []).push(entry);
    return map;
  }, {});

describe('PolisReportFidelitySection', () => {
  it('scores AI-prefill drafts from the loaded responses, withholding cells with fewer than 5 people', () => {
    render(
      <PolisReportFidelitySection
        sessionConfig={sessionConfig}
        questions={questions}
        questionResponses={byQuestion(sixPeople().flat())}
      />,
    );
    const panel = screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    expect(panel).toHaveTextContent('18 AI-drafted answers from 6 people');
    // Mirror Score: three people matched every draft, three matched two of three: 5/6.
    expect(screen.getByRole('group', { name: 'Mirror Score' })).toHaveTextContent(/^Mirror Score.*83%95% interval/);
    expect(screen.getByRole('group', { name: 'Hidden drafts' })).toHaveTextContent('100%');
    // Changed: half the shown choice drafts for three of six people.
    expect(screen.getByRole('group', { name: 'Changed' })).toHaveTextContent('25%');
    // Stated 80%; 9 of 12 shown drafts and all 6 hidden ones were kept.
    expect(panel).toHaveTextContent('Drafts shown: off by 5 points on average');
    expect(panel).toHaveTextContent('Drafts hidden: off by 20 points on average');
    expect(
      screen.getByRole('img', { name: /Stated confidence against the share of answers people kept/ }),
    ).toBeVisible();
    const platforms = within(screen.getByRole('heading', { name: 'By platform' }).closest('section') as HTMLElement);
    // Claude: three people at 3/3 and two at 2/3.
    expect(platforms.getByRole('row', { name: /^Claude/ })).toHaveTextContent(/^Claude87%.*5$/);
    expect(platforms.getByRole('row', { name: /^ChatGPT/ })).toHaveTextContent(/^ChatGPTFewer than 5 people1$/);
  });

  it('leaves out drafts that only restate what people said', () => {
    const voice = Array.from({ length: 5 }, (_, index) =>
      row(address(index + 10), 'qb1', 'Agree', { origin: 'voice_interview', platform: 'other' }),
    );
    render(
      <PolisReportFidelitySection
        sessionConfig={sessionConfig}
        questions={questions}
        questionResponses={byQuestion([...sixPeople().flat(), ...voice])}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY)).toHaveTextContent(
      '18 AI-drafted answers from 6 people',
    );
    expect(screen.queryByRole('row', { name: /^Other/ })).not.toBeInTheDocument();
  });

  it('folds away like the other report sections, and stays open for the PDF', () => {
    const props = { sessionConfig, questions, questionResponses: byQuestion(sixPeople().flat()) };
    const { rerender } = render(<PolisReportFidelitySection {...props} />);
    const toggle = screen.getByRole('button', { name: 'How well AIs predicted people' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Mirror Score' })).not.toBeInTheDocument();
    rerender(<PolisReportFidelitySection {...props} pdfMode />);
    expect(screen.getByRole('group', { name: 'Mirror Score' })).toBeVisible();
  });

  it('says when it will show, and stays hidden while the session has it off', () => {
    const three = byQuestion(sixPeople().slice(0, 3).flat());
    const { rerender, container } = render(
      <PolisReportFidelitySection sessionConfig={sessionConfig} questions={questions} questionResponses={three} />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY)).toHaveTextContent(
      'shows here once 5 people have shared their AI draft changes',
    );
    expect(screen.queryByText('Mirror Score')).not.toBeInTheDocument();

    rerender(
      <PolisReportFidelitySection
        sessionConfig={{ interviewMode: {} }}
        questions={questions}
        questionResponses={byQuestion(sixPeople().flat())}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<PolisReportFidelitySection sessionConfig={sessionConfig} questions={questions} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains each number behind a question mark that screen readers can reach', () => {
    render(
      <PolisReportFidelitySection
        sessionConfig={sessionConfig}
        questions={questions}
        questionResponses={byQuestion(sixPeople().flat())}
      />,
    );
    expect(screen.getByRole('button', { name: 'About Mirror Score' })).toHaveAccessibleDescription(
      /How closely the AI's drafts matched people's answers/,
    );
    expect(screen.getByRole('button', { name: 'About confidence' })).toHaveAccessibleDescription(
      /When the AI says it is 80% sure/,
    );
  });
});
