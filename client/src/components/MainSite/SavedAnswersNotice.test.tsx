import React from 'react';
import { act, render, screen } from '@testing-library/react';
import SavedAnswersNotice, { SAVED_ANSWERS_SLOW_MS } from './SavedAnswersNotice';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const sessionConfig = {
  slug: 'example',
  sessionId: `0x${'1'.repeat(32)}`,
  corsWorkerUrl: 'https://worker.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

afterEach(() => jest.useRealTimers());

it('says saved answers are loading until they are, and to reload if they stay away', () => {
  jest.useFakeTimers();
  const { rerender } = render(<SavedAnswersNotice sessionConfig={sessionConfig} signedIn answersLoaded={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading your saved answers');
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.getByRole('status')).toHaveTextContent('if they do not appear, reload the page');
  rerender(<SavedAnswersNotice sessionConfig={sessionConfig} signedIn answersLoaded />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('tells a signed-out person that saved answers show after logging in', () => {
  render(<SavedAnswersNotice sessionConfig={sessionConfig} signedIn={false} answersLoaded={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Log in to see your saved answers');
});

it('says nothing on a session whose answers do not come from a Worker', () => {
  render(<SavedAnswersNotice sessionConfig={{ slug: 'example' }} signedIn={false} answersLoaded={false} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
