import {
  buildGeneratedBreakdownAnalysisData,
  buildGeneratedDebateMapAdapter,
  buildGeneratedRiskMatrixAdapter,
} from './sessionResultsGeneratedViewAdapters';
import {
  SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  type SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

const buildArtifact = (
  sections: Partial<SessionResultsGeneratedAnalysisArtifact['sections']>,
): SessionResultsGeneratedAnalysisArtifact => ({
  generatedAt: '2026-09-17T00:00:00.000Z',
  inputSignature: 'session-results-analysis-v1-test',
  kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  participants: [],
  sections: {
    argumentMap: { available: false, debates: [], reason: 'missing' },
    atlas: { available: false, edges: [], nodes: [], reason: 'missing' },
    breakdown: { available: false, dimensions: [], groups: [], summary: {}, reason: 'missing' },
    riskMatrix: { available: false, categories: [], comments: [], heatmap: {}, scenarioLinks: [], reason: 'missing' },
    ...sections,
  },
  source: 'ai-generated',
  version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
});

describe('sessionResultsGeneratedViewAdapters', () => {
  it('maps generated argument-map debates into explicit DebateMap tree data without demo controls', () => {
    const artifact = buildArtifact({
      argumentMap: {
        available: true,
        debates: [
          {
            id: 'debate-session-priorities',
            title: 'Which session priority should lead the roadmap?',
            claims: [
              {
                id: 'claim-access',
                label: 'Access should come before automation',
                participantIds: ['participant_001', 'participant_002'],
                questionIds: ['q1'],
                stance: 'support',
                summary: 'Two participants emphasized access constraints.',
              },
            ],
          },
        ],
      },
    });

    const result = buildGeneratedDebateMapAdapter(artifact);

    expect(result.unavailableReason).toBe('');
    expect(result.props?.hideDemoModeToggle).toBe(true);
    expect(result.props?.readOnly).toBe(true);
    expect(result.props?.atlasRootLabel).toBe('Session Results Atlas');
    expect(result.props?.treeData?.[0]?.name).toBe('Which session priority should lead the roadmap?');
    expect(result.props?.treeData?.[0]?.children?.[0]?.name).toBe('Access should come before automation');
    expect(result.props?.treeData?.[0]?.votes).toEqual({ up: 0, down: 0 });
    expect(result.props?.treeData?.[0]?.children?.[0]?.votes).toEqual({ up: 0, down: 0 });
  });

  it('does not leak demo atlas fixtures when generated debate data is used', () => {
    const artifact = buildArtifact({
      argumentMap: {
        available: true,
        debates: [
          {
            title: 'Generated session-only debate',
            claims: [{ label: 'Generated session-only claim', participantIds: ['participant_001'] }],
          },
        ],
      },
    });

    const resultJson = JSON.stringify(buildGeneratedDebateMapAdapter(artifact).props);

    expect(resultJson).toContain('Generated session-only debate');
    expect(resultJson).not.toContain('AI Policy Atlas');
    expect(resultJson).not.toContain('Safety');
    expect(resultJson).not.toContain('Capabilities');
  });

  it('builds deterministic breakdown distributions from submitted responses', () => {
    const result = buildGeneratedBreakdownAnalysisData({
      questions: [
        {
          id: 'q1',
          prompt: 'Should the demo include live regeneration?',
          options: ['Yes', 'No'],
          tags: ['Operations'],
        },
      ],
      responses: [
        { questionId: 'q1', answer: 'Yes', participantId: 'p1', segments: { Role: 'Admin' } },
        { questionId: 'q1', answer: 'No', participantId: 'p1', segments: { Role: 'Admin' } },
        { questionId: 'q1', answer: 'No', participantId: 'p2', segments: { Role: 'Admin' } },
        { questionId: 'q1', answer: 'Yes', participantId: 'p3', segments: { Role: 'Viewer' } },
        { questionId: 'missing-question', answer: 'Yes', participantId: 'p4', segments: { Role: 'Ghost' } },
      ],
    });

    expect(result.unavailableReason).toBe('');
    expect(result.analysisData?.questions).toHaveLength(1);
    expect(result.analysisData?.demographics.Role).toEqual([
      { value: 'Admin', count: 2 },
      { value: 'Viewer', count: 1 },
    ]);
    expect(
      result.analysisData?.flatResponses.find(
        (row) => row.questionId === 'q1' && row.segmentKey === 'All' && row.responseText === 'Yes',
      ),
    ).toMatchObject({ count: 2, totalVotes: 3, rate: 2 / 3 });
    expect(JSON.stringify(result.analysisData)).not.toContain('Ghost');
    expect(JSON.stringify(result.analysisData)).not.toContain('missing-question');
  });

  it('rejects generated atlas graphs that would render recursively', () => {
    const result = buildGeneratedDebateMapAdapter(
      buildArtifact({
        atlas: {
          available: true,
          nodes: [
            { id: 'a', label: 'Node A' },
            { id: 'b', label: 'Node B' },
          ],
          edges: [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'a' },
          ],
        },
      }),
    );

    expect(result.props).toBeNull();
    expect(result.unavailableReason).toMatch(/cycle/i);
  });

  it('returns unavailable states for empty or malformed generated input', () => {
    expect(buildGeneratedDebateMapAdapter({}).props).toBeNull();
    expect(buildGeneratedDebateMapAdapter({ source: 'ai-generated' }).props).toBeNull();
    expect(buildGeneratedRiskMatrixAdapter({ source: 'ai-generated' }).props).toBeNull();
    expect(buildGeneratedDebateMapAdapter({ source: 'ai-generated', sections: {} }).props).toBeNull();
    expect(buildGeneratedBreakdownAnalysisData().analysisData).toBeNull();
    expect(
      buildGeneratedRiskMatrixAdapter(
        buildArtifact({
          riskMatrix: {
            available: true,
            categories: [{ id: 'risk_1', label: 'Delivery Risk' }],
            comments: [],
            heatmap: { risk_1: { impact: 'high', likelihood: 'medium' } },
            scenarioLinks: [],
          },
        }),
      ).props,
    ).toBeNull();
  });

  it('maps dynamic generated risk axes and assessments into qualitative RiskMatrix props', () => {
    const result = buildGeneratedRiskMatrixAdapter(
      buildArtifact({
        riskMatrix: {
          available: true,
          axes: {
            x: {
              id: 'readiness_uncertainty',
              label: 'Readiness uncertainty',
              levels: [
                { id: 'settled', label: 'Settled' },
                { id: 'uncertain', label: 'Uncertain' },
              ],
            },
            y: {
              id: 'coordination_load',
              label: 'Coordination load',
              levels: [
                { id: 'light', label: 'Light' },
                { id: 'heavy', label: 'Heavy' },
              ],
            },
          },
          assessments: [
            {
              id: 'risk_setup',
              label: 'Setup Risk',
              summary: 'Late setup changes may reduce quality.',
              xLevelId: 'uncertain',
              yLevelId: 'heavy',
              questionIds: ['q2'],
            },
          ],
          categories: [],
          comments: [],
          heatmap: {},
          scenarioLinks: [],
        },
      }),
    );

    expect(result.unavailableReason).toBe('');
    expect(result.props?.generatedSeverityAxes?.x.label).toBe('Readiness uncertainty');
    expect(result.props?.generatedSeverityAxes?.y.label).toBe('Coordination load');
    expect(result.props?.generatedSeverityAssessments).toEqual([
      {
        id: 'risk_setup',
        category: 'Setup Risk',
        summary: 'Late setup changes may reduce quality.',
        xLevelId: 'uncertain',
        yLevelId: 'heavy',
        sourceRefs: ['q2'],
      },
    ]);
    expect(result.props?.initialComments).toEqual([]);
  });

  it('maps explicit generated likelihood and impact into qualitative RiskMatrix props', () => {
    const result = buildGeneratedRiskMatrixAdapter(
      buildArtifact({
        riskMatrix: {
          available: true,
          categories: [
            {
              id: 'risk_1',
              label: 'Rehearsal Readiness',
              description: 'Late setup changes may reduce rehearsal quality.',
            },
          ],
          comments: [
            {
              id: 'risk_comment_1',
              categoryId: 'risk_1',
              summary: 'Participants noted that late setup changes could reduce rehearsal quality.',
            },
          ],
          heatmap: { risk_1: { impact: 'high', likelihood: 'medium' } },
          scenarioLinks: [],
        },
      }),
    );

    expect(result.unavailableReason).toBe('');
    expect(result.props?.readOnly).toBe(true);
    expect(result.props?.commentEyebrow).toBe('Generated note');
    expect(result.props?.initialComments).toEqual([]);
    expect(result.props?.generatedSeverityAssessments).toEqual([
      {
        id: 'risk_1',
        category: 'Rehearsal Readiness',
        impact: 'high',
        likelihood: 'medium',
        summary: 'Late setup changes may reduce rehearsal quality.',
      },
    ]);
  });
});
