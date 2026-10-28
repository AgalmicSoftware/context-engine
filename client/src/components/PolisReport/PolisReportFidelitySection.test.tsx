import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import PolisReportFidelitySection from './PolisReportFidelitySection';
import { computeFidelityOverview, type FidelityOverviewInput } from './fidelityOverview';
import { createFidelityOverviewWorker } from './fidelityOverviewWorkerFactory';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

// jsdom has no Worker, so scoring runs on the main thread unless a test provides one.
jest.mock('./fidelityOverviewWorkerFactory', () => ({ createFidelityOverviewWorker: jest.fn() }));

const questions = {
  qb1: { id: 'qb1', type: 'binary', prompt: 'One' },
  qb2: { id: 'qb2', type: 'binary', prompt: 'Two' },
  qb3: { id: 'qb3', type: 'binary', prompt: 'Three' },
};
const sessionConfig = { interviewMode: { showFidelityResults: true } };
// The session's smallest group shown, turned off.
const minimumOff = { interviewMode: { showFidelityResults: true, fidelityMinimumPeople: 1 } };
const address = (index: number) => `0x${String(index + 1).padStart(40, '0')}`;

// A stored answer whose AI-prefill draft said "Agree", by default with 80% confidence.
const row = (
  responder: string,
  questionId: string,
  answer: string,
  { platform = 'claude', condition = 'shown', origin = 'external_prefill', confidence = 0.8, claimed = '' } = {},
) => ({
  responder,
  questionId,
  timestamp: 1,
  response: {
    questionID: questionId,
    ...(claimed ? { responder: claimed } : {}),
    answer: { value: answer, encrypted: false },
    interviewProvenance: {
      draftOrigin: origin,
      source: { platform, modelId: 'test-model' },
      originalPrediction: { answer: 'Agree', confidence },
      predictionCondition: condition,
      confidenceMeaning: 'keep',
    },
  },
});

// Six people: everyone agrees on qb1 and on the hidden qb3; the last three
// disagree on qb2. The sixth person's AI is ChatGPT, the rest Claude.
const sixPeople = (sixthPlatform = 'chatgpt') =>
  Array.from({ length: 6 }, (_, index) => {
    const platform = index === 5 ? sixthPlatform : 'claude';
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

const renderSection = (rows: ReturnType<typeof row>[], props = {}) =>
  render(
    <PolisReportFidelitySection
      sessionConfig={sessionConfig}
      questions={questions}
      questionResponses={byQuestion(rows)}
      {...props}
    />,
  );

describe('PolisReportFidelitySection', () => {
  it('scores AI-prefill drafts from the loaded responses, withholding cells with fewer than 5 people', async () => {
    renderSection(sixPeople().flat());
    const panel = await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    expect(panel).toHaveTextContent('18 AI-drafted answers from 6 people');
    // Mirror Score: three people matched every draft, three matched two of three: 5/6.
    expect(screen.getByRole('group', { name: 'Mirror Score' })).toHaveTextContent(/^Mirror Score.*83%95% interval/);
    expect(screen.getByRole('group', { name: 'Hidden drafts' })).toHaveTextContent('100%6 drafts');
    // Changed: half the shown choice drafts for three of six people.
    expect(screen.getByRole('group', { name: 'Changed' })).toHaveTextContent('25%');
    // Stated 80%; 9 of 12 shown drafts and all 6 hidden ones were kept.
    expect(panel).toHaveTextContent('Drafts shown: off by 5 points on average');
    expect(panel).toHaveTextContent('Drafts hidden: off by 20 points on average');
    expect(screen.getByRole('img', { name: /the diagonal is where they are equal/ })).toBeVisible();
    const platforms = within(screen.getByRole('heading', { name: 'By platform' }).closest('section') as HTMLElement);
    // Claude's five are withheld too: the overall score minus theirs would be the ChatGPT user's.
    expect(platforms.getByRole('row', { name: /^Claude/ })).toHaveTextContent(/^ClaudeWithheld5$/);
    expect(platforms.getByRole('row', { name: /^ChatGPT/ })).toHaveTextContent(/^ChatGPTFewer than 5 people1$/);
  });

  it('shows a platform one person used when the session turns its minimum off, and withholds it by default', async () => {
    const chatGpt = () => screen.getByRole('row', { name: /^ChatGPT/ });
    const { unmount } = renderSection(sixPeople().flat(), { sessionConfig: minimumOff });
    await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    // The ChatGPT user matched two of three drafts; one person has no interval.
    expect(chatGpt()).toHaveTextContent(/^ChatGPT67%–1$/);
    expect(screen.getByRole('row', { name: /^Claude/ })).toHaveTextContent(/^Claude87%.*5$/);
    expect(screen.getByRole('button', { name: 'About platforms' })).toHaveAccessibleDescription(
      'Which AI drafted the answers, as each prefill reported it.',
    );
    unmount();

    renderSection(sixPeople().flat());
    await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    expect(chatGpt()).toHaveTextContent(/^ChatGPTFewer than 5 people1$/);
    expect(screen.getByRole('button', { name: 'About platforms' })).toHaveAccessibleDescription(
      /withheld when fewer than 5 people used it/,
    );
  });

  it("shows one person's results when the session turns its minimum off", async () => {
    renderSection(sixPeople().slice(5).flat(), { sessionConfig: minimumOff });
    const panel = await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    expect(panel).toHaveTextContent('3 AI-drafted answers from 1 person, compared with what they submitted.');
    expect(screen.getByRole('group', { name: 'Mirror Score' })).toHaveTextContent(/^Mirror Score.*67%/);
    expect(panel).toHaveTextContent(
      'Drafts shown: off by 30 points on average (95% interval –), 2 answers from 1 person',
    );
  });

  it('sends the session minimum to the background thread that scores', async () => {
    const worker = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: null as ((event: { data: unknown }) => void) | null,
      onerror: null,
    };
    jest.mocked(createFidelityOverviewWorker).mockReturnValue(worker as unknown as Worker);
    const browserWorker = (globalThis as { Worker?: unknown }).Worker;
    (globalThis as { Worker?: unknown }).Worker = function FakeWorker() {};
    try {
      renderSection(sixPeople().flat(), { sessionConfig: minimumOff });
      await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(1));
      const [input] = worker.postMessage.mock.calls[0] as [FidelityOverviewInput];
      expect(input.minParticipants).toBe(1);
      act(() => worker.onmessage?.({ data: computeFidelityOverview(input) }));
      expect(screen.getByRole('row', { name: /^ChatGPT/ })).toHaveTextContent(/^ChatGPT67%–1$/);
    } finally {
      (globalThis as { Worker?: unknown }).Worker = browserWorker;
    }
  });

  it('shows a platform once no one else could be worked out from it', async () => {
    renderSection(sixPeople('claude').flat());
    await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    expect(screen.getByRole('row', { name: /^Claude/ })).toHaveTextContent(/^Claude83%.*6$/);
  });

  it('keeps confidence bands from fewer than 5 people off the chart', async () => {
    const rows = sixPeople().flat();
    rows[0] = row(address(0), 'qb1', 'Agree', { confidence: 0.35 });
    renderSection(rows);
    await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY);
    const chart = screen.getByRole('img', { name: /Stated confidence/ });
    // Two bands for shown drafts (35% and 80%), one plotted; the hidden drafts' band is plotted too.
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    fireEvent.click(screen.getByText('Numbers'));
    expect(screen.getByRole('row', { name: /30–40%: fewer than 5 people/ })).toHaveTextContent(/1$/);
  });

  it('leaves out drafts that only restate what people said, and AIs named nothing the app knows count as other', async () => {
    const people = sixPeople().map((answers, index) =>
      index === 0
        ? answers.map((entry) => row(entry.responder, entry.questionId, 'Agree', { platform: '__proto__' }))
        : answers,
    );
    const voice = Array.from({ length: 5 }, (_, index) =>
      row(address(index + 10), 'qb1', 'Agree', { origin: 'voice_interview', platform: 'other' }),
    );
    renderSection([...people.flat(), ...voice]);
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY)).toHaveTextContent(
      '18 AI-drafted answers from 6 people',
    );
    expect(screen.getByRole('row', { name: /^Other/ })).toHaveTextContent(/^OtherFewer than 5 people1$/);
  });

  it("doesn't let one account pose as five people", async () => {
    // One account's answers, each claiming a different responder inside the payload.
    renderSection(
      ['qb1', 'qb2', 'qb3'].flatMap((questionId) =>
        Array.from({ length: 5 }, (_, index) => row(address(0), questionId, 'Agree', { claimed: address(index + 20) })),
      ),
    );
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY)).toHaveTextContent(
      'appears once these results include AI-prefill drafts from at least 5 people',
    );
  });

  it('says when it will show, and stays hidden while the session has it off', async () => {
    const three = byQuestion(sixPeople().slice(0, 3).flat());
    const { rerender, container } = render(
      <PolisReportFidelitySection sessionConfig={sessionConfig} questions={questions} questionResponses={three} />,
    );
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_RESULTS_FIDELITY)).toHaveTextContent(
      'How well AIs predicted people appears once these results include AI-prefill drafts from at least 5 people.',
    );
    expect(screen.queryByText('Mirror Score')).not.toBeInTheDocument();

    // With voice interviews off, no more AI-prefill drafts can come, so nothing is
    // promised. The same rows keep their score, so this checks the note itself.
    rerender(
      <PolisReportFidelitySection
        sessionConfig={{ ...sessionConfig, interviewModeEnabled: false }}
        questions={questions}
        questionResponses={three}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<PolisReportFidelitySection sessionConfig={sessionConfig} questions={questions} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays out of Results when only people’s own scores are on', async () => {
    const rows = byQuestion(sixPeople().flat());
    const { container, rerender } = render(
      <PolisReportFidelitySection sessionConfig={sessionConfig} questions={questions} questionResponses={rows} />,
    );
    // Scored first, so the next check isn't passing only because scoring hasn't finished.
    await screen.findByRole('group', { name: 'Mirror Score' });
    // Showing people their own score doesn't add the section; it has a switch of its own.
    rerender(
      <PolisReportFidelitySection
        sessionConfig={{ interviewMode: { showFidelityScore: true } }}
        questions={questions}
        questionResponses={rows}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the share of drafts changed only when people saw some', async () => {
    renderSection(
      sixPeople()
        .flat()
        .map((entry) => row(entry.responder, entry.questionId, 'Agree', { condition: 'blind' })),
    );
    await screen.findByRole('group', { name: 'Hidden drafts' });
    expect(screen.queryByRole('group', { name: 'Changed' })).not.toBeInTheDocument();
  });

  it('folds away like the other report sections, and prints its explanations for the PDF', async () => {
    const { rerender } = renderSection(sixPeople().flat());
    const toggle = await screen.findByRole('button', { name: 'How well AIs predicted people' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Mirror Score' })).not.toBeInTheDocument();

    rerender(
      <PolisReportFidelitySection
        sessionConfig={sessionConfig}
        questions={questions}
        questionResponses={byQuestion(sixPeople().flat())}
        pdfMode
      />,
    );
    const mirror = await screen.findByRole('group', { name: 'Mirror Score' });
    expect(mirror).toBeVisible();
    expect(within(mirror).getByText(/How closely the AI's drafts matched people's answers/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'About Mirror Score' })).not.toBeInTheDocument();
  });

  it('explains each number behind a question mark that screen readers can reach', async () => {
    renderSection(sixPeople().flat());
    expect(await screen.findByRole('button', { name: 'About Mirror Score' })).toHaveAccessibleDescription(
      /How closely the AI's drafts matched people's answers/,
    );
    expect(screen.getByRole('button', { name: 'About confidence' })).toHaveAccessibleDescription(
      /Points below the diagonal mean it was overconfident/,
    );
  });
});
