import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));

const renderFull = (value: unknown, commit = jest.fn()) => {
  render(
    <SurveyQuestionsFullQuestionResponseInput
      question={{ id: 'q-rating', type: 'rating', scale: { min: 0, max: 10 } } as any}
      answer={{ value } as any}
      onDeferredRatingCommit={commit}
      {...({} as any)}
    />,
  );
  return commit;
};

describe('full view (DeferredRatingSlider, commitUnchanged)', () => {
  it('K1 ArrowRight on an unanswered rating commits once, with 1', () => {
    const commit = renderFull('');
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });

    expect(commit.mock.calls).toEqual([[1]]);
  });

  it('K2 control: ArrowRight on an answered rating commits once', () => {
    const commit = renderFull(3);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(commit.mock.calls).toEqual([[4]]);
  });

  it('D1 drag on an unanswered rating commits once on release', () => {
    const commit = renderFull('');
    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '6' } });
    fireEvent.mouseUp(slider);
    expect(commit.mock.calls).toEqual([[6]]);
  });
});

describe('pile (CESlider onChange + onChangeComplete)', () => {
  const createEngine = () => {
    const engine: any = {
      props: { loginComplete: false, account: '' },
      state: { editBaseline: null, userAnswers: null, isSubmitting: false },
      setState: jest.fn(),
      buildSliceFromUserAnswers: () => null,
      buildSliceFromLocalCache: () => null,
    };
    try {
      createPileViewRuntimeStrategy().buildInitialState?.(engine);
    } catch (_) {
      // Only the attached render methods are needed here.
    }
    engine.state = { editBaseline: null, userAnswers: null, isSubmitting: false };
    engine.handleAnswerPile = jest.fn();
    engine.flushDraftPersistAfterSliderChange = jest.fn();
    return engine;
  };
  const question = { id: 'rating-q1', type: 'rating', prompt: 'Rate it', scale: { min: 0, max: 10 } };

  it('K3 ArrowRight on an unanswered pile rating commits once and flushes the draft', () => {
    const engine = createEngine();
    render(engine.renderPileResponseInput({ question, answer: { value: '' }, inputNamePrefix: 'pile' }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });

    expect(engine.handleAnswerPile).toHaveBeenCalledTimes(1);
    expect(engine.flushDraftPersistAfterSliderChange).toHaveBeenCalledTimes(1);
  });

  it('K4 interview draft editor: ArrowRight on an unanswered rating reports one change', () => {
    const engine = createEngine();
    const onAnswerChange = jest.fn();
    render(
      engine.renderPileResponseInput({
        question,
        answer: { value: '' },
        onAnswerChange,
        inputNamePrefix: 'interview-draft',
      }),
    );
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });

    expect(onAnswerChange).toHaveBeenCalledTimes(1);
  });
});

describe('real pile engine', () => {
  const { renderSurveyPileViewMode } = require('./surveyQuestionsTestHarness');
  const mount = () => {
    let engine: any = null;
    const strategy: any = createPileViewRuntimeStrategy();
    const renderPile = strategy.render;
    strategy.render = (current: any) => {
      engine = current;
      return renderPile(current);
    };
    renderSurveyPileViewMode({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      loginComplete: false,
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
      questionsCacheNonce: 2,
      onFilterChange: jest.fn(),
      runtimeStrategy: strategy,
      questionPool: [{ id: 'rating-q1', type: 'rating', prompt: 'Rate it', scale: { min: 0, max: 10 } }],
    } as any);
    const calls = { answer: [] as unknown[], flush: 0 };
    // Sticky wrappers: the pile re-attaches bound methods on every render.
    const sticky = (name: string, onCall: (args: unknown[]) => void) => {
      let inner = engine[name];
      Object.defineProperty(engine, name, {
        configurable: true,
        get:
          () =>
          (...args: unknown[]) => {
            onCall(args);
            return inner(...args);
          },
        set: (next) => {
          inner = next;
        },
      });
    };
    sticky('handleAnswerPile', (args) => calls.answer.push(args.slice(0, 2)));
    sticky('flushDraftPersistAfterSliderChange', () => {
      calls.flush += 1;
    });
    return calls;
  };

  it('D2 drag on an unanswered pile rating: one commit per move and a flush on release', () => {
    const calls = mount();
    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '6' } });
    fireEvent.mouseUp(slider);

    expect(calls.answer).toEqual([['rating-q1', 6]]);
    expect(calls.flush).toBe(1);
  });

  it('K5 ArrowRight on an unanswered real pile rating commits once', () => {
    const calls = mount();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });

    expect(calls.answer).toEqual([['rating-q1', 1]]);
  });
});
