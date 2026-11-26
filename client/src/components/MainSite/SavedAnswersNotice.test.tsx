import React from 'react';
import { act, render, screen } from '@testing-library/react';
import SavedAnswersNotice, { isSavedAnswersRoute, SAVED_ANSWERS_SLOW_MS } from './SavedAnswersNotice';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { resolveWorkerResponseHydrationRun } from '../../utilities/survey/workerResponseHydrationRuntime';
import { readSurveyToolScopedCacheNode } from '../SurveyTool/surveyToolWorkerCacheIsolation';

jest.mock('../SurveyTool/surveyToolWorkerCacheIsolation', () => ({
  ...jest.requireActual<object>('../SurveyTool/surveyToolWorkerCacheIsolation'),
  readSurveyToolScopedCacheNode: jest.fn(() => null),
}));

const sessionConfig = {
  slug: 'example',
  sessionId: `0x${'1'.repeat(32)}`,
  corsWorkerUrl: 'https://worker.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

const notice = (props: Partial<React.ComponentProps<typeof SavedAnswersNotice>>) => (
  <SavedAnswersNotice
    sessionConfig={sessionConfig}
    sessionSlug="example"
    signedIn
    answersReady={false}
    answersFailed={false}
    {...props}
  />
);

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it('says saved answers are loading until they are, and to reload if they stay away', () => {
  const { rerender } = render(notice({}));
  expect(screen.getByRole('status')).toHaveTextContent('Loading your saved answers');
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.getByRole('status')).toHaveTextContent('if they do not appear, reload the page');
  rerender(notice({ answersReady: true }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('counts the answers read so far, as Results does, while they load', () => {
  const progress = (loaded: number, listed: number, listComplete: boolean) =>
    jest.mocked(readSurveyToolScopedCacheNode).mockReturnValue({
      workerResponseLoadProgress: { loaded, listed, listComplete },
    });
  progress(1200, 2000, false);
  const { rerender } = render(notice({}));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading your saved answers... (1,200 of 2,000+ session answers read)',
  );
  progress(2000, 2000, true);
  rerender(notice({ signedIn: true }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading your saved answers... (2,000 of 2,000 session answers read)',
  );
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.getByRole('status')).toHaveTextContent('still loading (2,000 of 2,000 session answers read)');
  jest.mocked(readSurveyToolScopedCacheNode).mockReturnValue(null);
});

it('leaves a failed load, or a partial load of this session, to their own messages', () => {
  const { rerender } = render(notice({ answersFailed: true }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  const run = resolveWorkerResponseHydrationRun({ sessionConfig, sessionSlug: 'example' });
  rerender(notice({ partialRuns: { [run!.key]: true } }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(notice({ partialRuns: { 'worker:another-session': true } }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading your saved answers');
});

it('stops saying the answers are loading once their list has failed, as a cut request leaves it', () => {
  const status = (workerResponseHydrationStatus: string) =>
    jest.mocked(readSurveyToolScopedCacheNode).mockReturnValue({ workerResponseHydrationStatus });
  status('loading');
  const { rerender } = render(notice({}));
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.getByRole('status')).toHaveTextContent('still loading');
  // The route's own load error stays false: only the answer list failed, and the form says so with a retry.
  status('failed');
  rerender(notice({ answersFailed: false }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  // A retry loads again, and says so again.
  status('loading');
  rerender(notice({}));
  expect(screen.getByRole('status')).toHaveTextContent('Loading your saved answers');
  jest.mocked(readSurveyToolScopedCacheNode).mockReturnValue(null);
});

it('says nothing to a signed-out person, and counts their saved answers once they log in', () => {
  const { container, rerender } = render(notice({ signedIn: false }));
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  // No empty status region either, so nothing sits under the navbar.
  expect(container).toBeEmptyDOMElement();
  rerender(notice({ signedIn: true }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading your saved answers');
});

it('says nothing on a session whose answers do not come from a Worker', () => {
  render(notice({ sessionConfig: { slug: 'example' } }));
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('says nothing on a private session shown before the person is let in', () => {
  const { rerender } = render(notice({ sessionConfig: { ...sessionConfig, privateSession: 'invite_required' } }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(SAVED_ANSWERS_SLOW_MS);
  });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it.each([
  ['/session/rxc', true],
  ['/session/rxc/', true],
  ['/session/rxc/questions', true],
  ['/session/rxc/Questions/Results', true],
  ['/session/rxc/docs', false],
  ['/session/rxc/settings', false],
  ['/session/rxc/questions/other', false],
  ['/questions', false],
])('shows on the pages with the answer form only (%s)', (path, shown) => {
  expect(isSavedAnswersRoute(path)).toBe(shown);
});
