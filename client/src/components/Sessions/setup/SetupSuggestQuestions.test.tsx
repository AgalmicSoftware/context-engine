import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { PendingContextFiles } from './SetupContextSources';
import { SetupSuggestQuestions } from './SetupSuggestQuestions';
import type { SetupDraft } from './setupSectionTypes';

const NO_FILES = { files: {}, set: jest.fn() } as unknown as PendingContextFiles;
const DRAFT: SetupDraft = {
  sessionName: 'Town hall',
  sessionContext: { title: '', paragraphs: ['The library has a new budget.'], links: [] },
  questions: [],
};

const answer = (status: number, body: unknown) =>
  jest.fn(async () => ({ ok: status < 400, status, json: async () => body }));

const draftsReply = {
  output_text: JSON.stringify({
    surveyTitle: 'Library budget',
    questions: [{ prompt: 'Open on Sundays.', questionType: 'binary', options: [], voiceCredits: null, tags: [] }],
  }),
};

describe('Suggest questions on /new', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('says what it needs before it can draft', () => {
    const { rerender } = render(
      <SetupSuggestQuestions draft={DRAFT} pending={NO_FILES} apiKey=" " onAdd={jest.fn()} />,
    );
    const button = screen.getByRole('button', { name: 'Suggest questions' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/^Drafts 5 questions from this page’s context with your OpenAI key/);
    expect(screen.getByRole('button', { name: 'About Suggest questions' })).toBeInTheDocument();
    expect(screen.getByTestId('ce-setup-suggest-status')).toHaveTextContent(
      'Add an OpenAI key under AI to get suggestions.',
    );

    const empty = { ...DRAFT, sessionContext: { title: '', paragraphs: [], links: [] } };
    rerender(<SetupSuggestQuestions draft={empty} pending={NO_FILES} apiKey="sk-test" onAdd={jest.fn()} />);
    expect(button).toBeDisabled();
    expect(screen.getByTestId('ce-setup-suggest-status')).toHaveTextContent(
      'Add some context first: text, links or a file.',
    );

    rerender(<SetupSuggestQuestions draft={DRAFT} pending={NO_FILES} apiKey="sk-test" onAdd={jest.fn()} />);
    expect(button).toBeEnabled();
    expect(screen.queryByTestId('ce-setup-suggest-status')).not.toBeInTheDocument();
  });

  it('adds the drafts and says they can still be edited', async () => {
    globalThis.fetch = answer(200, draftsReply) as unknown as typeof fetch;
    const onAdd = jest.fn();
    render(<SetupSuggestQuestions draft={DRAFT} pending={NO_FILES} apiKey="sk-test" onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    expect(screen.getByRole('button', { name: 'Suggesting…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Drafting questions…');
    expect(await screen.findByText('Added 1 draft. Edit or remove them before Create.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(onAdd).toHaveBeenCalledWith([{ prompt: 'Open on Sundays.', type: 'binary', tags: [] }]);
    expect(screen.getByRole('button', { name: 'Suggest questions' })).toBeEnabled();
  });

  it('shows OpenAI’s refusal as an alert and adds nothing', async () => {
    globalThis.fetch = answer(401, {
      error: { message: 'Incorrect API key provided: sk-test.' },
    }) as unknown as typeof fetch;
    const onAdd = jest.fn();
    render(<SetupSuggestQuestions draft={DRAFT} pending={NO_FILES} apiKey="sk-test" onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'OpenAI didn’t accept the key. Check the OpenAI key under AI.',
    );
    expect(onAdd).not.toHaveBeenCalled();
  });
});
