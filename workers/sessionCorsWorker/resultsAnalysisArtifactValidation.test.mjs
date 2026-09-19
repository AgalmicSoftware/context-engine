import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeResultsAnalysisArtifact,
} from './resultsAnalysisArtifactValidation.js';

const source = {
  signature: 'sha256:validator-test',
  participants: [
    { syntheticId: 'participant_001', displayAddress: '0x1111111111111111111111111111111111111111' },
    { syntheticId: 'participant_002' },
  ],
  snapshot: {
    questions: [
      { id: 'q1', prompt: 'What should improve?' },
      { id: 'q2', prompt: 'What could fail?' },
    ],
    responses: [
      { participantId: 'participant_001', questionId: 'q1', answer: 'More rehearsal' },
      { participantId: 'participant_002', questionId: 'q2', answer: 'Late setup' },
    ],
  },
  aiSnapshot: {
    questions: [
      { id: 'q1', prompt: 'What should improve?' },
      { id: 'q2', prompt: 'What could fail?' },
    ],
    responses: [
      { participantId: 'participant_001', questionId: 'q1', answer: 'More rehearsal' },
      { participantId: 'participant_002', questionId: 'q2', answer: 'Late setup' },
    ],
  },
};

const normalize = (overrides = {}) => normalizeResultsAnalysisArtifact({
  source,
  generatedAt: '2026-09-19T10:00:00.000Z',
  model: 'test-model-with-human-readable-metadata',
  sections: ['argumentMap', 'breakdown', 'riskMatrix'],
  ...overrides,
});

test('normalizes a valid three-view artifact to the exact client artifact envelope', () => {
  const artifact = normalize({
    value: {
      sections: {
        argumentMap: {
          debates: [
            {
              id: 'debate_1',
              title: 'Which readiness issue matters most?',
              claims: [
                {
                  id: 'claim_1',
                  label: 'Rehearsal should come before expansion',
                  summary: 'Participants connected quality risk to limited rehearsal time.',
                  participantIds: ['participant_001'],
                  questionIds: ['q1'],
                  stance: 'support',
                },
              ],
            },
          ],
        },
        breakdown: {
          summary: {
            overview: 'Readiness divides between rehearsal confidence and setup blockers.',
            themes: [{ label: 'Rehearsal confidence', summary: 'Confidence depends on setup stability.' }],
          },
          dimensions: [
            {
              id: 'dimension_readiness',
              label: 'Readiness theme',
              values: [{ label: 'Stable setup', count: 999, nested: { forbidden: true } }],
            },
          ],
          groups: [
            {
              id: 'group_1',
              label: 'Setup blockers',
              summary: 'Setup blockers were repeatedly mentioned.',
              participantIds: ['participant_002'],
              questionIds: ['q2'],
            },
          ],
        },
        riskMatrix: {
          axes: {
            x: {
              id: 'readiness_uncertainty',
              label: 'Readiness uncertainty',
              levels: [{ id: 'settled', label: 'Settled' }, { id: 'uncertain', label: 'Uncertain' }],
            },
            y: {
              id: 'coordination_load',
              label: 'Coordination load',
              levels: [{ id: 'light', label: 'Light' }, { id: 'heavy', label: 'Heavy' }],
            },
          },
          assessments: [
            {
              id: 'risk_setup',
              label: 'Setup Risk',
              summary: 'Late setup changes could reduce quality.',
              xLevelId: 'uncertain',
              yLevelId: 'heavy',
              participantIds: ['participant_002'],
              questionIds: ['q2'],
            },
          ],
          scenarioLinks: [{ id: 'demo-scenario-should-drop' }],
        },
      },
    },
  });

  assert.equal(artifact.kind, 'ce_session_results_analysis_artifact');
  assert.equal(artifact.version, 1);
  assert.equal(artifact.source, 'ai-generated');
  assert.equal(artifact.generatedAt, '2026-09-19T10:00:00.000Z');
  assert.equal(artifact.inputSignature, 'sha256:validator-test');
  assert.equal(artifact.model, 'test-model-with-human-readable-metadata');
  assert.deepEqual(artifact.participants, [{ syntheticId: 'participant_001' }, { syntheticId: 'participant_002' }]);
  assert.equal(artifact.sections.argumentMap.available, true);
  assert.equal(artifact.sections.breakdown.available, true);
  assert.equal(artifact.sections.riskMatrix.available, true);
  assert.equal(artifact.sections.atlas.available, false);
  assert.equal(artifact.sections.riskMatrix.axes.x.label, 'Readiness uncertainty');
  assert.equal(artifact.sections.riskMatrix.axes.y.label, 'Coordination load');
  assert.deepEqual(artifact.sections.riskMatrix.assessments[0], {
    id: 'risk_setup',
    label: 'Setup Risk',
    summary: 'Late setup changes could reduce quality.',
    xLevelId: 'uncertain',
    yLevelId: 'heavy',
    participantIds: ['participant_002'],
    questionIds: ['q2'],
  });
  assert.deepEqual(artifact.sections.riskMatrix.scenarioLinks, []);
  assert.equal('count' in artifact.sections.breakdown.dimensions[0].values[0], false);
  assert.equal('nested' in artifact.sections.breakdown.dimensions[0].values[0], false);
  assert.equal(JSON.stringify(artifact).includes('0x1111111111111111111111111111111111111111'), false);
});

test('marks malformed and invalid sections unavailable while preserving valid requested sections', () => {
  const artifact = normalize({
    sections: ['argumentMap', 'breakdown', 'riskMatrix', 'atlas'],
    value: {
      argumentMap: 'not an object',
      atlas: {
        nodes: [{ id: 'atlas_1', label: 'A root' }],
        edges: [{ source: 'atlas_1', target: 'missing_node' }],
      },
      breakdown: {
        summary: { overview: 'A valid generated overview.' },
        dimensions: [],
        groups: [],
      },
      riskMatrix: {
        categories: [{ id: 'risk_1', label: 'Risk without valid severity' }],
        heatmap: { risk_1: { likelihood: 'likely', impact: 'huge' } },
        comments: [],
      },
    },
  });

  assert.equal(artifact.sections.breakdown.available, true);
  assert.equal(artifact.sections.argumentMap.available, false);
  assert.match(artifact.sections.argumentMap.reason, /argument-map data/i);
  assert.equal(artifact.sections.atlas.available, false);
  assert.match(artifact.sections.atlas.reason, /invalid atlas/i);
  assert.equal(artifact.sections.riskMatrix.available, false);
  assert.match(artifact.sections.riskMatrix.reason, /invalid risk matrix/i);
});

test('fails instead of producing an all-unavailable artifact for empty output', () => {
  assert.throws(() => normalize({
    sections: ['argumentMap', 'breakdown', 'riskMatrix'],
    value: { sections: { argumentMap: {}, breakdown: {}, riskMatrix: {} } },
  }), /did not include any renderable requested sections/i);
});


test('does not coerce arbitrary objects into renderable text', () => {
  assert.throws(() => normalize({
    sections: ['argumentMap'],
    value: {
      argumentMap: {
        debates: [
          {
            title: { unexpected: true },
            claims: [{ label: { alsoUnexpected: true }, participantIds: ['participant_001'], questionIds: ['q1'] }],
          },
        ],
      },
    },
  }), /did not include any renderable requested sections/i);
});

test('rejects unknown source refs relative to the AI input ids', () => {
  const artifact = normalize({
    sections: ['argumentMap', 'breakdown'],
    value: {
      argumentMap: {
        debates: [
          {
            title: 'Unknown participant debate',
            claims: [{ label: 'Unknown source claim', participantIds: ['participant_999'], questionIds: ['q1'] }],
          },
        ],
      },
      breakdown: { summary: { overview: 'Valid fallback content keeps the artifact usable.' }, dimensions: [], groups: [] },
    },
  });

  assert.equal(artifact.sections.argumentMap.available, false);
  assert.match(artifact.sections.argumentMap.reason, /unknown source ids/i);
  assert.equal(artifact.sections.breakdown.available, true);

  assert.throws(() => normalize({
    sections: ['argumentMap'],
    value: {
      argumentMap: {
        debates: [
          {
            title: 'Unknown question debate',
            claims: [{ label: 'Unknown source claim', participantIds: ['participant_001'], questionIds: ['missing_q'] }],
          },
        ],
      },
    },
  }), /did not include any renderable requested sections/i);
});


test('validates references against aiSnapshot ids when the broader source snapshot has extra ids', () => {
  assert.throws(() => normalizeResultsAnalysisArtifact({
    source: {
      signature: 'sha256:ai-snapshot-only',
      participants: [{ syntheticId: 'participant_001' }, { syntheticId: 'participant_snapshot_only' }],
      snapshot: {
        questions: [{ id: 'q1' }, { id: 'q_snapshot_only' }],
        responses: [{ participantId: 'participant_snapshot_only', questionId: 'q_snapshot_only' }],
      },
      aiSnapshot: {
        questions: [{ id: 'q1' }],
        responses: [{ participantId: 'participant_001', questionId: 'q1' }],
      },
    },
    sections: ['argumentMap'],
    generatedAt: '2026-09-19T10:00:00.000Z',
    value: {
      argumentMap: {
        debates: [
          {
            title: 'Snapshot-only ref debate',
            claims: [
              { label: 'Snapshot-only references must not pass', participantIds: ['participant_snapshot_only'], questionIds: ['q_snapshot_only'] },
            ],
          },
        ],
      },
    },
  }), /did not include any renderable requested sections/i);

  assert.throws(() => normalizeResultsAnalysisArtifact({
    source: {
      signature: 'sha256:empty-ai-snapshot',
      participants: [{ syntheticId: 'participant_001' }],
      snapshot: {
        questions: [{ id: 'q1' }],
        responses: [{ participantId: 'participant_001', questionId: 'q1' }],
      },
      aiSnapshot: { questions: [], responses: [] },
    },
    sections: ['argumentMap'],
    generatedAt: '2026-09-19T10:00:00.000Z',
    value: {
      argumentMap: {
        debates: [
          {
            title: 'Snapshot refs should fail when AI input is empty',
            claims: [{ label: 'Snapshot-only claim', participantIds: ['participant_001'], questionIds: ['q1'] }],
          },
        ],
      },
    },
  }), /did not include any renderable requested sections/i);
});

test('requires explicit generated axes for dynamic risk matrix assessments', () => {
  assert.throws(() => normalize({
    sections: ['riskMatrix'],
    value: {
      riskMatrix: {
        assessments: [
          {
            id: 'risk_without_axes',
            label: 'Risk without axes',
            summary: 'This should not fall back to fixed likelihood/impact axes.',
            xLevelId: 'medium',
            yLevelId: 'high',
            participantIds: ['participant_001'],
            questionIds: ['q1'],
          },
        ],
      },
    },
  }), /did not include any renderable requested sections/i);
});

test('rejects cyclic atlas graphs without replacing a valid breakdown section', () => {
  const artifact = normalize({
    sections: ['atlas', 'breakdown'],
    value: {
      atlas: {
        nodes: [
          { id: 'a', label: 'Node A', questionIds: ['q1'] },
          { id: 'b', label: 'Node B', questionIds: ['q2'] },
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' },
        ],
      },
      breakdown: { summary: { overview: 'Valid breakdown survives.' }, dimensions: [], groups: [] },
    },
  });

  assert.equal(artifact.sections.atlas.available, false);
  assert.match(artifact.sections.atlas.reason, /cycle/i);
  assert.equal(artifact.sections.breakdown.available, true);

  assert.throws(() => normalize({
    sections: ['atlas'],
    value: {
      atlas: {
        nodes: [{ id: 'a', label: 'Node A' }, { id: 'b', label: 'Node B' }],
        edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }],
      },
    },
  }), /did not include any renderable requested sections/i);
});

test('clamps oversized arrays and text and returns only bounded renderer fields', () => {
  const longText = `${'x'.repeat(1200)} 0x2222222222222222222222222222222222222222`;
  const artifact = normalize({
    sections: ['breakdown', 'riskMatrix'],
    value: {
      breakdown: {
        summary: {
          overview: longText,
          themes: Array.from({ length: 40 }, (_, index) => ({
            id: `theme_${index}`,
            label: `Theme ${index}`,
            summary: longText,
            extraNested: { shouldDrop: true },
          })),
        },
        dimensions: Array.from({ length: 40 }, (_, index) => ({
          id: `dimension_${index}`,
          label: `Dimension ${index}`,
          values: Array.from({ length: 40 }, (_unused, valueIndex) => ({ label: `Value ${valueIndex}`, count: 1000 })),
        })),
        groups: Array.from({ length: 80 }, (_, index) => ({
          label: `Group ${index}`,
          summary: longText,
          participantIds: ['participant_001'],
          questionIds: ['q1'],
        })),
      },
      riskMatrix: {
        categories: Array.from({ length: 40 }, (_, index) => ({
          id: `risk_${index}`,
          label: `Risk ${index}`,
          likelihood: 'low',
          impact: 'medium',
        })),
        comments: Array.from({ length: 120 }, (_, index) => ({
          id: `comment_${index}`,
          categoryId: `risk_${index % 24}`,
          summary: longText,
          participantIds: ['participant_001'],
          questionIds: ['q1'],
        })),
        heatmap: {},
        scenarioLinks: Array.from({ length: 10 }, (_, index) => ({ id: `scenario_${index}` })),
      },
    },
  });

  assert.equal(artifact.sections.breakdown.summary.overview.length, 900);
  assert.equal(artifact.sections.breakdown.summary.overview.includes('0x2222222222222222222222222222222222222222'), false);
  assert.equal(artifact.sections.breakdown.summary.themes.length, 24);
  assert.equal(artifact.sections.breakdown.dimensions.length, 24);
  assert.equal(artifact.sections.breakdown.dimensions[0].values.length, 24);
  assert.equal('count' in artifact.sections.breakdown.dimensions[0].values[0], false);
  assert.equal(artifact.sections.breakdown.groups.length, 40);
  assert.equal(artifact.sections.riskMatrix.categories.length, 24);
  assert.equal(artifact.sections.riskMatrix.comments.length, 80);
  assert.equal(artifact.sections.riskMatrix.scenarioLinks.length, 0);
  assert.equal(JSON.stringify(artifact).includes('extraNested'), false);
});
