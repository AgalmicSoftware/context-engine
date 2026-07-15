import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { buildSecondPassAnalysisInput } from '../src/analysis-export.mjs';
import { limitQuestionBank } from '../src/report-inputs.mjs';
import { buildResultsReport } from '../src/scoring.mjs';

const readJson = async (url) => JSON.parse(await fs.readFile(url, 'utf8'));

test('second-pass analysis input exposes report, risk popup, and debate atlas contracts', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    2
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: { ossStatus: 'open-weights' } },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: { ossStatus: 'closed' } },
    ],
  };
  const [consensusQuestion, splitQuestion] = questionBank.questions;
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [
      { modelId: 'model-a', questionId: consensusQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-b', questionId: consensusQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-a', questionId: splitQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-b', questionId: splitQuestion.id, polarity: 'canonical', normalizedAnswer: 'Disagree' },
    ],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  const analysisInput = buildSecondPassAnalysisInput(report);

  assert.equal(analysisInput.kind, 'ai_discourse_bench_second_pass_analysis_input');
  assert.equal(analysisInput.participants.length, 2);
  assert.equal(analysisInput.questions.length, 2);
  assert.equal(analysisInput.questions[0].aggregate.stanceLabel, 'net support');
  assert.equal(analysisInput.questions[0].aggregate.winningResponseConsistency.rate, 1);
  assert.equal(analysisInput.questions[1].modelDifference, 2);
  const capabilityLaborTarget = analysisInput.riskMatrix.aggregateCellTargets.find((cell) => cell.id === 'Capabilities_vs_Labor');
  assert.ok(capabilityLaborTarget);
  assert.ok(capabilityLaborTarget.expectedOverlayFields.includes('scenarios'));
  assert.equal(capabilityLaborTarget.scenarioSchema.valence, 'risk | opportunity | mixed');
  assert.equal(analysisInput.outputSchema.kind, 'ai_discourse_bench_analysis_overlay');
  assert.ok(Array.isArray(analysisInput.outputSchema.debateAtlas.compasses));
  assert.ok(Array.isArray(analysisInput.outputSchema.riskMatrix.cells.Capabilities_vs_Labor.scenarios));
  assert.ok(analysisInput.debateAtlas.requestedOutputs.compasses.includes('2-axis maps'));
});
