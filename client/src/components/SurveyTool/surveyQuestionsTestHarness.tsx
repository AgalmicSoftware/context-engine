/**
 * Shared RTL harness for behavior-level SurveyQuestions and PileViewMode tests.
 *
 * Test-only module: renders the SurveyQuestions/PileViewMode runtimes inside the same minimal
 * Provider/MemoryRouter wrapper used by the SurveyResults harness so coupled
 * headless tests can exercise DOM behavior through the hooks wrappers.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createStore } from 'redux';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import type { SurveyQuestionsProps } from './surveyQuestionsTypes';

export type SurveyQuestionsHarnessStoreState = {
  profile?: Record<string, unknown>;
  sessionState?: Record<string, unknown>;
};

export const createSurveyQuestionsTestStore = (overrides: SurveyQuestionsHarnessStoreState = {}) =>
  createStore(
    (
      state = {
        profile: {
          account: '',
          network: { id: 84532 },
          ...(overrides.profile || {}),
        },
        sessionState: {
          activeSessionSlug: '',
          loginComplete: false,
          ...(overrides.sessionState || {}),
        },
      },
    ) => state,
  );

export type RenderSurveyQuestionsOptions = {
  route?: string;
  store?: ReturnType<typeof createSurveyQuestionsTestStore>;
  storeState?: SurveyQuestionsHarnessStoreState;
};

export type SurveyQuestionsHarness = RenderResult & {
  rerenderSurveyQuestions: (nextProps: SurveyQuestionsProps) => void;
  readonly props: SurveyQuestionsProps;
};

declare const afterEach: undefined | ((fn: () => void) => void);

let harnessUrlToRestore: string | null = null;
if (typeof afterEach === 'function') {
  afterEach(() => {
    if (harnessUrlToRestore !== null) {
      window.history.replaceState({}, '', harnessUrlToRestore);
      harnessUrlToRestore = null;
    }
  });
}

const createDefaultSurveyQuestionsProps = (props: SurveyQuestionsProps = {}): SurveyQuestionsProps => ({
  account: '',
  displayAnswerMode: false,
  isStandalone: false,
  loginComplete: false,
  network: { id: 84532 },
  networkChainId: 84532,
  questionPool: [],
  singleQuestionMode: false,
  surveyIndex: 0,
  ...props,
});

const syncRoute = (route?: string): void => {
  if (!route) return;
  if (harnessUrlToRestore === null) {
    harnessUrlToRestore = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }
  window.history.replaceState({}, '', route);
};

const renderWithSurveyQuestionsWrappers = (
  element: React.ReactElement,
  options: RenderSurveyQuestionsOptions = {},
  store = options.store ?? createSurveyQuestionsTestStore(options.storeState),
): RenderResult => {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>{element}</MemoryRouter>
    </Provider>,
  );
};

const createHarness = (
  Component: React.ComponentType<SurveyQuestionsProps>,
  props: SurveyQuestionsProps = {},
  options: RenderSurveyQuestionsOptions = {},
): SurveyQuestionsHarness => {
  syncRoute(options.route);
  const store = options.store ?? createSurveyQuestionsTestStore(options.storeState);
  let currentProps = createDefaultSurveyQuestionsProps(props);
  const wrap = (nextProps: SurveyQuestionsProps) => <Component {...nextProps} />;
  const result = renderWithSurveyQuestionsWrappers(wrap(currentProps), options, store);
  const rerenderSurveyQuestions = (nextProps: SurveyQuestionsProps): void => {
    currentProps = { ...currentProps, ...nextProps };
    result.rerender(
      <Provider store={store}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{wrap(currentProps)}</MemoryRouter>
      </Provider>,
    );
  };
  const harness = Object.assign(result, { rerenderSurveyQuestions }) as SurveyQuestionsHarness;
  Object.defineProperty(harness, 'props', {
    get: () => currentProps,
  });
  return harness;
};

export const renderSurveyQuestions = (
  props: SurveyQuestionsProps = {},
  options: RenderSurveyQuestionsOptions = {},
): SurveyQuestionsHarness => createHarness(SurveyQuestions, props, options);

export const renderSurveyPileViewMode = (
  props: SurveyQuestionsProps = {},
  options: RenderSurveyQuestionsOptions = {},
): SurveyQuestionsHarness => createHarness(PileViewMode, props, options);
