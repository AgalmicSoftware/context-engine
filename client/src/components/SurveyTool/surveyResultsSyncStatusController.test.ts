import { buildSurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';
import { buildSurveyResultsRefreshStatusSequencePlan } from './surveyResultsHelpers';

describe('surveyResultsSyncStatusController', () => {
  it('builds the missing-block loading fallback', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
      }),
    ).toEqual({
      isSynced: false,
      isSyncingOrLoading: true,
      question: {
        color: 'info',
        label: '',
        progress: 0,
        remainingBlocks: 0,
        showRemainingSpinner: false,
        showSpinner: true,
      },
      response: {
        color: 'info',
        label: '',
        progress: 0,
        remainingBlocks: 0,
        showRemainingSpinner: false,
        showSpinner: true,
      },
      showLongSyncNotice: false,
      showQuickRefresh: true,
      syncStatusText: 'Loading...',
      viewMode: 'questions',
    });
  });

  it('builds stale question-mode progress labels and percentages', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: 80,
        responseLocalBlock: 60,
      }),
    ).toMatchObject({
      isSynced: false,
      isSyncingOrLoading: true,
      question: {
        color: 'info',
        label: 'Remaining Blocks: 20 (Current: 80 / Latest: 100)',
        progress: 80,
        remainingBlocks: 20,
        showRemainingSpinner: false,
        showSpinner: false,
      },
      response: {
        color: 'info',
        label: 'Remaining Blocks: 40 (Current: 60 / Latest: 100)',
        progress: 60,
        remainingBlocks: 40,
        showRemainingSpinner: false,
        showSpinner: false,
      },
      showQuickRefresh: true,
      syncStatusText: 'Syncing...',
    });
  });

  it('marks complete question-mode progress current and hides quick refresh', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: 120,
        responseLocalBlock: 100,
        showLongSyncNotice: true,
      }),
    ).toMatchObject({
      isSynced: true,
      isSyncingOrLoading: false,
      question: {
        color: 'success',
        label: 'In Sync (Current: 100 / Latest: 100)',
        progress: 100,
        showSpinner: false,
      },
      response: {
        color: 'success',
        label: 'In Sync (Current: 100 / Latest: 100)',
        progress: 100,
        showSpinner: false,
      },
      showLongSyncNotice: false,
      showQuickRefresh: false,
      syncStatusText: 'In Sync',
    });
  });

  it('uses survey local blocks for survey-mode response progress', () => {
    const plan = buildSurveyResultsSyncStatusDisplayPlan({
      viewMode: 'survey',
      networkLatestBlock: 50,
      questionLocalBlock: 1,
      responseLocalBlock: 2,
      surveyLocalBlock: 25,
    });

    expect(plan.question).toEqual({
      color: 'info',
      label: '',
      progress: 0,
      remainingBlocks: 0,
      showRemainingSpinner: false,
      showSpinner: false,
    });
    expect(plan.response).toMatchObject({
      color: 'info',
      label: 'Remaining Blocks: 25 (Current: 25 / Latest: 50)',
      progress: 50,
      remainingBlocks: 25,
      showRemainingSpinner: false,
      showSpinner: false,
    });
    expect(plan.isSynced).toBe(false);
    expect(plan.syncStatusText).toBe('Syncing...');
  });

  it('uses refresh targets for in-progress labels with inline spinner descriptors', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: 20,
        responseLocalBlock: 30,
        refreshTargetQuestionBlock: 80,
        refreshTargetResponseBlock: 60,
        showLongSyncNotice: true,
      }),
    ).toMatchObject({
      isSynced: false,
      isSyncingOrLoading: true,
      question: {
        color: 'info',
        label: 'Remaining Blocks: 60',
        progress: 25,
        remainingBlocks: 60,
        showRemainingSpinner: true,
        showSpinner: false,
      },
      response: {
        color: 'info',
        label: 'Remaining Blocks: 30',
        progress: 50,
        remainingBlocks: 30,
        showRemainingSpinner: true,
        showSpinner: false,
      },
      showLongSyncNotice: true,
      showQuickRefresh: true,
      syncStatusText: 'Syncing...',
    });
  });

  it('keeps sequence-plan refresh target patches compatible with syncing copy', () => {
    const sequencePlan = buildSurveyResultsRefreshStatusSequencePlan({
      latestBlock: 100,
      followUpEffects: ['manualRefreshDispatch'],
    });
    if (!sequencePlan.statePatch) throw new Error('Expected a refresh target state patch');

    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: 20,
        responseLocalBlock: 40,
        ...sequencePlan.statePatch,
      }),
    ).toMatchObject({
      isSynced: false,
      isSyncingOrLoading: true,
      question: {
        label: 'Remaining Blocks: 80',
        progress: 20,
        remainingBlocks: 80,
        showRemainingSpinner: true,
      },
      response: {
        label: 'Remaining Blocks: 60',
        progress: 40,
        remainingBlocks: 60,
        showRemainingSpinner: true,
      },
      showQuickRefresh: true,
      syncStatusText: 'Syncing...',
    });
  });

  it('marks refresh target completion against the target block', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'survey',
        networkLatestBlock: 100,
        surveyLocalBlock: 75,
        refreshTargetSurveyBlock: 70,
      }),
    ).toMatchObject({
      isSynced: true,
      response: {
        color: 'success',
        label: 'In Sync (Current: 75 / Latest: 70)',
        progress: 100,
        remainingBlocks: 0,
        showRemainingSpinner: false,
        showSpinner: false,
      },
      showQuickRefresh: false,
      syncStatusText: 'In Sync',
    });
  });

  it('keeps unknown view modes on response-only fallback semantics', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'unknown',
        networkLatestBlock: 10,
        questionLocalBlock: 10,
        responseLocalBlock: 10,
      }),
    ).toMatchObject({
      isSynced: true,
      question: {
        color: 'info',
        label: '',
        progress: 0,
        remainingBlocks: 0,
        showRemainingSpinner: false,
        showSpinner: false,
      },
      response: {
        color: 'success',
        label: 'In Sync (Current: 10 / Latest: 10)',
        progress: 100,
      },
      showQuickRefresh: false,
      syncStatusText: 'In Sync',
      viewMode: 'unknown',
    });
  });

  it('normalizes malformed block values before building progress text', () => {
    expect(
      buildSurveyResultsSyncStatusDisplayPlan({
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: Number.POSITIVE_INFINITY,
        responseLocalBlock: 'not-a-block',
        refreshTargetQuestionBlock: Number.POSITIVE_INFINITY,
        refreshTargetResponseBlock: 80,
      }),
    ).toMatchObject({
      isSynced: false,
      question: {
        color: 'info',
        label: '',
        progress: 0,
        remainingBlocks: 0,
        showSpinner: true,
      },
      response: {
        color: 'info',
        label: '',
        progress: 0,
        remainingBlocks: 0,
        showSpinner: true,
      },
      syncStatusText: 'Loading...',
    });
  });
});
