/**
 * Shared RTL harness for behavior-level SurveyResults tests.
 *
 * Test-only module: renders the UNCONNECTED SurveyResults component inside a
 * minimal Redux store (needed only by connected children such as
 * Connect(QuestionFilter)) and a MemoryRouter. Replaces the legacy
 * `new (Connected as any).WrappedComponent(props)` headless-instance pattern,
 * which cannot survive the class-to-hooks conversion.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createStore } from 'redux';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import ConnectedSurveyResults from './SurveyResults';
import type { SurveyResultsProps } from './SurveyResults';

const SurveyResults = (
  ConnectedSurveyResults as unknown as { WrappedComponent: React.ComponentType<SurveyResultsProps> }
).WrappedComponent;

export type SurveyResultsHarnessStoreState = {
  profile?: Record<string, unknown>;
  sessionState?: Record<string, unknown>;
};

export const createSurveyResultsTestStore = (overrides: SurveyResultsHarnessStoreState = {}) =>
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

export type RenderSurveyResultsOptions = {
  /**
   * Initial URL for the test. SurveyResults (and children like QuestionFilter)
   * read window.location directly, so this is synced onto window.history (not
   * just MemoryRouter); the previous URL is restored automatically afterEach.
   */
  route?: string;
  store?: ReturnType<typeof createSurveyResultsTestStore>;
  storeState?: SurveyResultsHarnessStoreState;
};

export type SurveyResultsHarness = RenderResult & {
  /** Re-render with merged props, preserving wrappers (componentDidUpdate paths). */
  rerenderSurveyResults: (nextProps: SurveyResultsProps) => void;
  /** Live view of the currently-applied props (tracks rerenderSurveyResults). */
  readonly props: SurveyResultsProps;
};

// Jest global; declared manually because the production tsconfig (which
// type-checks this non-.test helper) does not include jest ambient types.
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

export const renderSurveyResults = (
  props: SurveyResultsProps = {},
  options: RenderSurveyResultsOptions = {},
): SurveyResultsHarness => {
  const store = options.store ?? createSurveyResultsTestStore(options.storeState);
  if (options.route) {
    if (harnessUrlToRestore === null) {
      harnessUrlToRestore = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }
    window.history.replaceState({}, '', options.route);
  }
  const baseProps: SurveyResultsProps = {
    network: { id: 84532 },
    ...props,
  };
  const wrap = (p: SurveyResultsProps) => (
    <Provider store={store}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>
        <SurveyResults {...p} />
      </MemoryRouter>
    </Provider>
  );
  const result = render(wrap(baseProps));
  let currentProps = baseProps;
  const rerenderSurveyResults = (nextProps: SurveyResultsProps): void => {
    currentProps = { ...currentProps, ...nextProps };
    result.rerender(wrap(currentProps));
  };
  const harness = Object.assign(result, { rerenderSurveyResults }) as SurveyResultsHarness;
  Object.defineProperty(harness, 'props', {
    get: () => currentProps,
  });
  return harness;
};
