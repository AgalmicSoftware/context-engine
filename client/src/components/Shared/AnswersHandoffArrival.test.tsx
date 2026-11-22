import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AnswersHandoffArrival, { describeLoadedAnswers } from './AnswersHandoffArrival';

const NOTE_KEY = 'ce:answersHandoff:note';
afterEach(() => sessionStorage.clear());

it('shows nothing when no copied answers arrived', () => {
  const { container } = render(<AnswersHandoffArrival />);
  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('says once what was loaded and what to do next', () => {
  sessionStorage.setItem(NOTE_KEY, JSON.stringify({ kind: 'loaded', typed: 12, interview: 0, kept: 0 }));
  render(<AnswersHandoffArrival />);
  expect(screen.getByTestId('ce-answers-handoff-loaded-body')).toHaveTextContent(
    'Loaded 12 answers. Check them, then sign in and submit.',
  );
  expect(sessionStorage.getItem(NOTE_KEY)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(screen.queryByTestId('ce-answers-handoff-loaded-body')).not.toBeInTheDocument();
});

it('words interview answers and answers left out', () => {
  expect(describeLoadedAnswers({ typed: 0, interview: 1, kept: 0 })).toBe(
    'Loaded 1 interview answer: open Interview to review them. Check them, then sign in and submit.',
  );
  expect(describeLoadedAnswers({ typed: 0, interview: 0, kept: 2 })).toBe(
    '2 copied answers were not loaded, because this browser already holds answers of its own.',
  );
});

it('offers a box to paste the copied message, and says why a paste could not be read', async () => {
  sessionStorage.setItem(NOTE_KEY, JSON.stringify({ kind: 'paste', error: '' }));
  render(<AnswersHandoffArrival />);
  fireEvent.change(screen.getByLabelText('Copied answers'), { target: { value: 'half a mess' } });
  fireEvent.click(screen.getByRole('button', { name: 'Load answers' }));
  expect(await screen.findByText(/cut off/)).toBeInTheDocument();
  expect(screen.getByLabelText('Copied answers')).toHaveAccessibleDescription(/cut off/);
});
