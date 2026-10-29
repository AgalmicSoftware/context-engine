import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SurveyGenerator from './SurveyGenerator';
import CreateQuestionsAndSurveys from '../CreateQuestionsAndSurveys';
import { callAI } from '../../../utilities/ai/aiClient';

jest.mock('../../../utilities/ai/aiClient.js', () => ({ callAI: jest.fn() }));
jest.mock('../../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  getAllSessionSlugs: () => [],
  getSessionConfigBySlug: () => ({}),
}));
jest.mock('../../../utilities/session/sessionCatalog', () => ({ readKnownSessionCatalog: () => [] }));
jest.mock('../../Shared/AudioInput/AudioInput', () => ({ value, updateFunction }) => (
  <textarea aria-label="Source text" value={value || ''} onChange={(event) => updateFunction(event.target.value)} />
));
jest.mock('../../DocumentLibrary/DocumentLibraryPanel', () => () => null);

const batch = (prefix) =>
  JSON.stringify({
    questions: Array.from({ length: 10 }, (_, index) => ({
      prompt: `${prefix} question ${index + 1}?`,
      questionType: 'binary',
      tags: [],
    })),
  });
const generate = () => fireEvent.click(screen.getByRole('button', { name: /Generate Questions/ }));
const source = 'A synthetic source with enough detail to generate questions about community decisions.';

beforeEach(() => {
  callAI.mockReset();
  localStorage.clear();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  // Keep the real authoring constructor, edit handlers and update lifecycle,
  // while replacing its large presentation and network-loading mount hook.
  jest.spyOn(CreateQuestionsAndSurveys.prototype, 'componentDidMount').mockImplementation(function () {
    this._isMounted = true;
  });
  jest.spyOn(CreateQuestionsAndSurveys.prototype, 'render').mockImplementation(function () {
    return (
      <div data-testid="authoring-editor">
        {this.state.questions.map((question, index) => (
          <input
            key={question.uiKey}
            aria-label={`Draft question ${index + 1}`}
            value={question.prompt}
            onChange={(event) => this.handleQuestionChange(index, 'prompt', event.target.value)}
          />
        ))}
      </div>
    );
  });
});
afterEach(() => jest.restoreAllMocks());

const firstGeneration = async (edited = true) => {
  callAI.mockResolvedValueOnce(batch('Original'));
  render(<SurveyGenerator account="" loginComplete={false} demoSurfaceMode={false} />);
  fireEvent.change(screen.getByLabelText('Source text'), { target: { value: source } });
  generate();
  await screen.findByDisplayValue('Original question 1?');
  expect(screen.getAllByRole('textbox', { name: /Draft question/ })).toHaveLength(10);
  if (edited) fireEvent.change(screen.getByLabelText('Draft question 1'), { target: { value: 'My edited question?' } });
};

it('keeps the mounted edited questions and saved drafts throughout failed regeneration', async () => {
  await firstGeneration();
  localStorage.setItem('unfinishedSurvey', 'saved draft');
  localStorage.setItem('unfinishedSurvey:fixture', 'saved scoped draft');
  let rejectRequest;
  callAI.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  const editor = screen.getByTestId('authoring-editor');
  generate();
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('authoring-editor')).toBe(editor);
  expect(screen.getByDisplayValue('My edited question?')).toBeVisible();
  rejectRequest(new Error('Model request failed'));
  await screen.findByText(/Model request failed/);
  expect(screen.getByTestId('authoring-editor')).toBe(editor);
  expect(screen.getByDisplayValue('My edited question?')).toBeVisible();
  expect(localStorage.getItem('unfinishedSurvey')).toBe('saved draft');
  expect(localStorage.getItem('unfinishedSurvey:fixture')).toBe('saved scoped draft');
  expect(window.confirm).not.toHaveBeenCalled();
});

it.each([false, true])(
  'asks only when a usable replacement for edited questions arrives (accept=%s)',
  async (accept) => {
    await firstGeneration();
    window.confirm.mockReturnValue(accept);
    callAI.mockResolvedValueOnce(batch('Replacement'));
    generate();
    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    if (accept) expect(screen.getByDisplayValue('Replacement question 1?')).toBeVisible();
    else expect(screen.getByDisplayValue('My edited question?')).toBeVisible();
  },
);

it('replaces unedited questions without asking', async () => {
  await firstGeneration(false);
  callAI.mockResolvedValueOnce(batch('Replacement'));
  generate();
  await screen.findByDisplayValue('Replacement question 1?');
  expect(window.confirm).not.toHaveBeenCalled();
});

it('keeps edited questions when generation returns no usable replacement', async () => {
  await firstGeneration();
  callAI.mockResolvedValueOnce(JSON.stringify({ questions: [] }));
  generate();
  await screen.findByText(/no usable questions/i);
  expect(screen.getByDisplayValue('My edited question?')).toBeVisible();
  expect(window.confirm).not.toHaveBeenCalled();
});

it('checks edits made while a replacement request is pending', async () => {
  await firstGeneration(false);
  window.confirm.mockReturnValue(false);
  let resolveRequest;
  callAI.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
  );
  generate();
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByLabelText('Draft question 1'), { target: { value: 'Edited while waiting?' } });
  expect(window.confirm).not.toHaveBeenCalled();
  resolveRequest(batch('Replacement'));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByDisplayValue('Edited while waiting?')).toBeVisible();
});

it('requires a selected question type before a request can start', () => {
  render(<SurveyGenerator account="" loginComplete={false} demoSurfaceMode={false} />);
  fireEvent.change(screen.getByLabelText('Source text'), { target: { value: source } });
  fireEvent.click(screen.getByText('Binary', { exact: true }));
  fireEvent.click(screen.getByText('Multichoice', { exact: true }));
  const button = screen.getByRole('button', { name: 'Generate Questions' });
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription('Select at least one question type before generating.');
  fireEvent.click(button);
  fireEvent.submit(button.closest('form'));
  expect(callAI).not.toHaveBeenCalled();
});

it('uses the one selected type for both the prompt and the resulting questions', async () => {
  const onQuestionsGenerated = jest.fn();
  callAI.mockResolvedValueOnce(
    JSON.stringify({
      questions: [
        { prompt: 'Keep the binary question?', questionType: 'binary' },
        { prompt: 'Drop the other type?', questionType: 'multichoice', options: ['A', 'B'] },
      ],
    }),
  );
  render(
    <SurveyGenerator
      account=""
      loginComplete={false}
      demoSurfaceMode={false}
      onQuestionsGenerated={onQuestionsGenerated}
    />,
  );
  fireEvent.change(screen.getByLabelText('Source text'), { target: { value: source } });
  fireEvent.click(screen.getByText('Multichoice', { exact: true }));
  generate();
  await screen.findByDisplayValue('Keep the binary question?');
  expect(screen.queryByDisplayValue('Drop the other type?')).not.toBeInTheDocument();
  expect(onQuestionsGenerated.mock.calls[0][0].map((question) => question.type)).toEqual(['binary']);
  expect(callAI.mock.calls[0][0]).toContain('TypeOfQuestionsToInclude: binary');
});

it('explains when a model response has no usable questions', async () => {
  callAI.mockResolvedValueOnce(JSON.stringify({ questions: [{ prompt: ' ', questionType: 'binary' }] }));
  render(<SurveyGenerator account="" loginComplete={false} demoSurfaceMode={false} />);
  fireEvent.change(screen.getByLabelText('Source text'), { target: { value: source } });
  generate();
  expect(
    await screen.findByText(/no usable questions.*Try a different source or enable another question type/i),
  ).toBeVisible();
  expect(screen.queryByTestId('authoring-editor')).not.toBeInTheDocument();
});
