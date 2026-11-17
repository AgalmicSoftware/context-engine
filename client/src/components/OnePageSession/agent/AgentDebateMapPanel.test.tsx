import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AgentDebateMapPanel from './AgentDebateMapPanel';
import type { AgentQuestion } from '../../../utilities/session/agentSessionData';

const questions = [{ prompt: 'Should parks get more money?' }] as AgentQuestion[];

const setClipboard = (writeText: jest.Mock) =>
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

it('shows Copied once the prompt is copied', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  setClipboard(writeText);
  render(<AgentDebateMapPanel questions={questions} results={null} />);
  fireEvent.click(screen.getByTestId('ce-agent-http-debate-map-copy'));
  expect(await screen.findByText('Copied')).toBeInTheDocument();
  expect(writeText.mock.calls[0][0]).toContain('1. Should parks get more money?');
});

it('selects the prompt and says so when copying is refused', async () => {
  setClipboard(jest.fn().mockRejectedValue(new Error('denied')));
  render(<AgentDebateMapPanel questions={questions} results={null} />);
  fireEvent.click(screen.getByTestId('ce-agent-http-debate-map-copy'));
  expect(await screen.findByRole('status')).toHaveTextContent(
    "Copying isn't allowed here, so the prompt is selected. Copy it yourself.",
  );
  expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  expect(window.getSelection()?.toString()).toContain('Should parks get more money?');
});
