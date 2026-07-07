import { runSurveyResultsAnalysisLifecycleController } from './surveyResultsAnalysisLifecycleController';
import { buildSurveyResultsAnalysisLifecyclePlan } from './surveyResultsAnalysisLifecyclePlan';
import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

const allSections: SessionResultsAnalysisSectionKey[] = ['breakdown', 'argumentMap', 'riskMatrix', 'atlas'];

const createArtifact = (
  inputSignature = 'input-sig',
  availableSections: SessionResultsAnalysisSectionKey[] = allSections,
): SessionResultsGeneratedAnalysisArtifact => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: availableSections.includes('argumentMap'), debates: [] },
    atlas: { available: availableSections.includes('atlas'), edges: [], nodes: [] },
    breakdown: {
      available: availableSections.includes('breakdown'),
      dimensions: [],
      groups: [],
      summary: {},
    },
    riskMatrix: {
      available: availableSections.includes('riskMatrix'),
      categories: [],
      comments: [],
      heatmap: {},
      scenarioLinks: [],
    },
  },
  source: 'ai-generated',
  version: 1,
});

describe('surveyResultsAnalysisLifecycleController', () => {
  it('routes ready artifacts through the ready-state port without requesting generation', () => {
    const artifact = createArtifact('ready-input');
    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      cachedArtifact: artifact,
      inputSignature: 'ready-input',
      requestedSections: ['breakdown'],
    });
    const calls: string[] = [];
    const applyReadyState = jest.fn((patch: Record<string, unknown>) => {
      calls.push(`ready:${String(patch.htmlReportAnalysisInputSignature || '')}`);
    });
    const applyBlockedState = jest.fn();
    const applyGenerateStartState = jest.fn();

    const result = runSurveyResultsAnalysisLifecycleController({
      plan,
      ports: {
        applyBlockedState,
        applyGenerateStartState,
        applyReadyState,
      },
    });

    expect(result).toEqual({
      appliedPort: 'ready-state',
      handled: true,
      patch: plan.statePatch,
      shouldGenerate: false,
      status: 'ready-artifact',
      target: plan.target,
    });
    expect(calls).toEqual(['ready:ready-input']);
    expect(applyReadyState).toHaveBeenCalledWith(plan.statePatch);
    expect(applyBlockedState).not.toHaveBeenCalled();
    expect(applyGenerateStartState).not.toHaveBeenCalled();
  });

  it('routes blocked plans through the blocked-state port before generation starts', () => {
    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections: [],
      inputSignature: 'blocked-input',
      requestedSections: [],
    });
    const calls: string[] = [];
    const applyBlockedState = jest.fn((patch: Record<string, unknown>) => {
      calls.push(`blocked:${String(patch.htmlReportAnalysisInputSignature || '')}`);
    });
    const applyReadyState = jest.fn();
    const applyGenerateStartState = jest.fn();

    const result = runSurveyResultsAnalysisLifecycleController({
      plan,
      ports: {
        applyBlockedState,
        applyGenerateStartState,
        applyReadyState,
      },
    });

    expect(result).toEqual({
      appliedPort: 'blocked-state',
      handled: true,
      patch: plan.statePatch,
      shouldGenerate: false,
      status: 'blocked',
      target: plan.target,
    });
    expect(calls).toEqual(['blocked:blocked-input']);
    expect(applyBlockedState).toHaveBeenCalledWith(plan.statePatch);
    expect(applyReadyState).not.toHaveBeenCalled();
    expect(applyGenerateStartState).not.toHaveBeenCalled();
  });

  it('routes generation-start plans through the generate-start port and leaves execution to the parent', () => {
    const partialArtifact = createArtifact('generate-input', ['breakdown']);
    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      cachedArtifact: partialArtifact,
      inputSignature: 'generate-input',
      requestedSections: ['breakdown', 'riskMatrix'],
    });
    const calls: string[] = [];
    const applyGenerateStartState = jest.fn((patch: Record<string, unknown>) => {
      calls.push(`generate:${String(patch.htmlReportAnalysisInputSignature || '')}`);
    });
    const applyReadyState = jest.fn();
    const applyBlockedState = jest.fn();

    const result = runSurveyResultsAnalysisLifecycleController({
      plan,
      ports: {
        applyBlockedState,
        applyGenerateStartState,
        applyReadyState,
      },
    });

    expect(result).toEqual({
      appliedPort: 'generate-start-state',
      handled: false,
      patch: plan.statePatch,
      shouldGenerate: true,
      status: 'generate-missing-sections',
      target: plan.target,
    });
    expect(calls).toEqual(['generate:generate-input']);
    expect(plan.missingSections).toEqual(['riskMatrix']);
    expect(applyGenerateStartState).toHaveBeenCalledWith(plan.statePatch);
    expect(applyReadyState).not.toHaveBeenCalled();
    expect(applyBlockedState).not.toHaveBeenCalled();
  });

  it('routes failure recovery through only the failure-recovery port', () => {
    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      inputSignature: 'failure-input',
      requestedSections: ['breakdown'],
    });
    const applyFailureRecoveryState = jest.fn();
    const applyGenerateStartState = jest.fn();

    const result = runSurveyResultsAnalysisLifecycleController({
      phase: 'failure-recovery',
      plan,
      ports: {
        applyFailureRecoveryState,
        applyGenerateStartState,
      },
    });

    expect(result).toEqual({
      appliedPort: 'failure-recovery-state',
      handled: true,
      patch: plan.failureRecovery.statePatch,
      shouldGenerate: false,
      status: 'failure-recovery',
      target: plan.target,
    });
    expect(applyFailureRecoveryState).toHaveBeenCalledWith(plan.failureRecovery.statePatch);
    expect(applyGenerateStartState).not.toHaveBeenCalled();
  });

  it('reports missing plans without calling ports', () => {
    const applyReadyState = jest.fn();
    const applyBlockedState = jest.fn();
    const applyGenerateStartState = jest.fn();
    const applyFailureRecoveryState = jest.fn();

    expect(
      runSurveyResultsAnalysisLifecycleController({
        plan: null,
        ports: {
          applyBlockedState,
          applyFailureRecoveryState,
          applyGenerateStartState,
          applyReadyState,
        },
      }),
    ).toEqual({
      appliedPort: '',
      handled: false,
      patch: null,
      shouldGenerate: false,
      status: 'missing-plan',
      target: null,
    });
    expect(applyReadyState).not.toHaveBeenCalled();
    expect(applyBlockedState).not.toHaveBeenCalled();
    expect(applyGenerateStartState).not.toHaveBeenCalled();
    expect(applyFailureRecoveryState).not.toHaveBeenCalled();
  });
});
