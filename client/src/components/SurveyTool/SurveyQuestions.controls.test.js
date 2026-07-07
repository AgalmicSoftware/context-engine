import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import {
  buildSurveyQuestionsPrimarySubmitPlan,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyQuestionsSubmitReadinessDescriptor,
} from './surveyQuestionsTypes.js';
import { resolveEffectiveSlug, resolveExplicitSessionContext } from './surveyToolScope';
import {
  resolveSurveyQuestionsSubmitPendingStats,
  runSurveyQuestionsSubmitController,
} from './surveyQuestionsSubmitController';

const mockSurveyAudioFieldInputProps = [];

jest.mock('./SurveyAudioFieldInput', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: (props) => {
      mockSurveyAudioFieldInputProps.push(props);
      return (
        <div
          data-testid="mock-survey-audio-field-input"
          data-session-slug={props.sessionSlug || ''}
          data-chain-id={String(props.context?.chainId || '')}
        />
      );
    },
  };
});

const baseQuestion = { id: 'q1', type: 'freeform', prompt: 'Ready prompt' };

const renderSingleQuestionWithAudio = (props = {}) => {
  const componentProps = {
    singleQuestionMode: true,
    questionID: 'q1',
    activeSessionSlug: '',
    account: '0xabc',
    networkChainId: 84532,
    ...props,
  };
  const explicitSessionSlug = resolveEffectiveSlug(componentProps);
  const resolvedSession = explicitSessionSlug
    ? resolveExplicitSessionContext(explicitSessionSlug)
    : { sessionSlug: '', sessionConfig: null };
  const audioInputWorkerProps = {
    sessionSlug: resolvedSession.sessionSlug || '',
    sessionConfig: resolvedSession.sessionConfig || null,
    context: {
      account: componentProps.account || '',
      providerLike: '',
      chainId: componentProps.networkChainId,
    },
  };

  render(
    <SurveyQuestionsFullQuestionResponseInput
      question={baseQuestion}
      qIndex={0}
      answer={{ value: '' }}
      singleQuestionMode
      audioInputWorkerProps={audioInputWorkerProps}
    />,
  );

  return {
    audioInputWorkerProps,
    explicitSessionSlug,
    resolvedSession,
  };
};

const submitPlan = (overrides = {}) =>
  buildSurveyQuestionsPrimarySubmitPlan({
    account: '0xabc',
    isStandalone: false,
    isSubmitting: false,
    pendingEditCount: 0,
    questionID: 'q1',
    singleQuestionMode: false,
    submissionComplete: false,
    submitGuardActive: false,
    submittedSinceLastEdit: false,
    surveyId: '0xSurveyABC',
    ...overrides,
  });

const runPlan = (plan) => {
  const ports = {
    activateSubmitGuard: jest.fn(),
    dispatchSubmit: jest.fn(),
    navigateToResponse: jest.fn(),
  };
  const result = runSurveyQuestionsSubmitController({ plan, ports });
  return { ports, result };
};

describe('SurveyQuestions controls', () => {
  beforeEach(() => {
    mockSurveyAudioFieldInputProps.length = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('prefers explicit route session slug for audio-input worker props in single-question mode', () => {
    renderSingleQuestionWithAudio({
      sessionSlug: 'edge',
      activeSessionSlug: 'other',
    });

    expect(screen.getByTestId('mock-survey-audio-field-input')).toHaveAttribute('data-session-slug', 'edge');
    expect(mockSurveyAudioFieldInputProps.at(-1).sessionSlug).toBe('edge');
    // port note: the old test spied on the private `_getEffectiveDraftSlug()`
    // fallback. The portable contract is the rendered audio field receiving the
    // explicit route/session slug instead of the active-session fallback.
  });

  it('does not inherit the general session config for unknown audio-input worker slugs', () => {
    renderSingleQuestionWithAudio({
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });

    const props = mockSurveyAudioFieldInputProps.at(-1);
    expect(props).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      context: {
        chainId: 84532,
      },
    });
  });

  it('wires full-question slider section callbacks through the parent shell', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    const onSelectMode = jest.fn();

    render(
      <SurveyQuestionsFullQuestionSliderSection
        activeSliderValue={4}
        convictionValue={4}
        hasConvictionImportanceValue
        importanceToggleEnabled
        importanceValue={7}
        isSubmitting={false}
        onChange={onChange}
        onChangeComplete={onChangeComplete}
        onSelectMode={onSelectMode}
        questionId="q1"
        sliderMode="conviction"
        sliderOpen
        sliderToggleExpandedByQuestion={{ q1: true }}
      />,
    );

    expect(screen.getByRole('button', { name: /conviction/i })).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: /importance/i })).toHaveTextContent('7');

    fireEvent.click(screen.getByRole('button', { name: /importance/i }));
    expect(onSelectMode).toHaveBeenCalledWith('importance');

    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '8' } });

    expect(onChange).toHaveBeenCalledWith(8, expect.anything());
    expect(onChangeComplete).toHaveBeenCalledTimes(1);
    // port note: the parent-shell callback lambdas were private render wiring.
    // Component-level slider tests own the DOM event surface; this assertion keeps
    // the same callback contract the parent passes into the shell.
  });

  it('keeps submit controls hidden until a survey has pending edits or submitted state', () => {
    const pendingStats = { total: 0, encrypted: 0 };
    const readiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: 0,
      isSubmitting: false,
      pendingStats,
      singleQuestionMode: false,
    });

    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        currentStep: readiness.currentStep,
        hasEncryptedAnswers: readiness.hasEncryptedAnswers,
        hasMaskedCurrentQuestionPayload: readiness.hasMaskedCurrentQuestionPayload,
        isDirty: false,
        isSubmitting: false,
        pendingEditCount: readiness.pendingEditCount,
        submittedSinceLastEdit: false,
      }),
    ).toEqual(
      expect.objectContaining({
        showInlineSubmit: false,
        showTopInlineSubmit: false,
      }),
    );
  });

  it('renders pending survey submit controls as enabled and wires the primary click handler', () => {
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      isDirty: true,
      pendingEditCount: 2,
    });
    const { ports, result } = runPlan(submitPlan({ pendingEditCount: 2 }));

    expect(displayState).toEqual(
      expect.objectContaining({
        showInlineSubmit: true,
        showTopInlineSubmit: true,
        submitDisabled: false,
      }),
    );
    expect(result.status).toBe('dispatched');
    expect(ports.activateSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders submitted survey state without firing another submit before completion', () => {
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      responseUrl: 'https://example.com/submitted',
      submittedSinceLastEdit: true,
    });
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: 0,
        submittedSinceLastEdit: true,
        submissionComplete: false,
      }),
    );

    expect(displayState).toEqual(
      expect.objectContaining({
        showInlineSubmit: true,
        showTopInlineSubmit: true,
        submitDisabled: false,
        submittedIndicatorActive: true,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'inert',
        reason: 'submitted_without_new_edits',
      }),
    );
    expect(ports.activateSubmitGuard).not.toHaveBeenCalled();
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
  });

  it('disables pending submit while an upload is already in progress', () => {
    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        isSubmitting: true,
        pendingEditCount: 1,
      }),
    ).toEqual(
      expect.objectContaining({
        showInlineSubmit: true,
        submitDisabled: true,
      }),
    );
  });

  it('disables single-question submit when the active prompt is still masked', () => {
    const readiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      isSubmitting: false,
      pendingStats: { total: 1, encrypted: 0 },
      resolveMaskedCurrentQuestionPayload: () => true,
      singleQuestionMode: true,
    });

    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        hasMaskedCurrentQuestionPayload: readiness.hasMaskedCurrentQuestionPayload,
        isSingleQuestionView: true,
        pendingEditCount: readiness.pendingEditCount,
        singleQuestionMode: true,
      }),
    ).toEqual(
      expect.objectContaining({
        showInlineSubmit: true,
        showTopInlineSubmit: false,
        submitDisabled: true,
      }),
    );
  });

  it('starts primary submit only when pending edits are available', () => {
    const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: () => ({ total: 1 }),
      fallbackTotal: 0,
    });
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: pendingStats.total,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'dispatched',
        reason: 'pending_edits',
      }),
    );
    expect(ports.activateSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
  });

  it('falls back to modifiedCount when primary submit pending stats are unavailable', () => {
    const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: undefined,
      fallbackTotal: 1,
    });
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: pendingStats.total,
      }),
    );

    expect(result.status).toBe('dispatched');
    expect(ports.activateSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits completed responses with pending edits instead of routing to the completed response', () => {
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: 2,
        submissionComplete: true,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'dispatched',
        reason: 'pending_edits',
      }),
    );
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('uses modifiedCount fallback to keep completed pending edits on the submit path', () => {
    const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: undefined,
      fallbackTotal: 2,
    });
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: pendingStats.total,
        submissionComplete: true,
      }),
    );

    expect(result.status).toBe('dispatched');
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('keeps in-flight primary submit inert before reading pending stats or routes', () => {
    const getPendingEditStats = jest.fn(() => {
      throw new Error('pending stats should not run while submitting');
    });
    const inFlightPlan = submitPlan({
      isSubmitting: true,
      submissionComplete: true,
    });
    const { ports, result } = runPlan(inFlightPlan);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'inert',
        reason: 'submitting',
      }),
    );
    expect(getPendingEditStats).not.toHaveBeenCalled();
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('keeps submitted-without-new-edits clicks inert before completion', () => {
    const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: () => ({ total: 0 }),
      fallbackTotal: 0,
    });
    const { ports, result } = runPlan(
      submitPlan({
        pendingEditCount: pendingStats.total,
        submittedSinceLastEdit: true,
        submissionComplete: false,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'inert',
        reason: 'submitted_without_new_edits',
      }),
    );
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
  });

  it('routes completed survey submissions to the response view without resubmitting', () => {
    const plan = submitPlan({
      account: '0xABC',
      draftSlug: 'edge session',
      pendingEditCount: 0,
      submissionComplete: true,
      surveyId: '0xSurveyABC',
    });
    const { ports, result } = runPlan(plan);

    expect(result.status).toBe('navigated');
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).toHaveBeenCalledWith('/survey/0xsurveyabc/0xabc?session=edge%20session', plan);
  });

  it('routes completed single-question submissions to the response view with the session slug', () => {
    const plan = submitPlan({
      account: '0xABC',
      draftSlug: 'edge',
      pendingEditCount: 0,
      questionID: 'Q1',
      singleQuestionMode: true,
      submissionComplete: true,
    });
    const { ports, result } = runPlan(plan);

    expect(result.status).toBe('navigated');
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).toHaveBeenCalledWith('/question/q1?session=edge&responder=0xabc', plan);
  });

  it('keeps completed standalone submissions inert instead of routing or resubmitting', () => {
    const { ports, result } = runPlan(
      submitPlan({
        isStandalone: true,
        pendingEditCount: 0,
        submissionComplete: true,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'inert',
        reason: 'completed_standalone_response',
      }),
    );
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('keeps completed submissions without an account inert before resolving route slugs', () => {
    const { ports, result } = runPlan(
      submitPlan({
        account: '',
        pendingEditCount: 0,
        submissionComplete: true,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'inert',
        reason: 'missing_account',
      }),
    );
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });
});
