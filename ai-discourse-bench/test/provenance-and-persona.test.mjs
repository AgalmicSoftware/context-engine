import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { attachAnalysisOverlay, buildSecondPassAnalysisInput } from '../src/analysis-export.mjs';
import { buildQuestionPrompt } from '../src/normalize.mjs';
import { validatePersonas } from '../src/schema.mjs';

test('sample personas are source-bounded counterfactual simulations', async () => {
  const personas = JSON.parse(await fs.readFile(new URL('../data/personas.sample.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePersonas(personas), []);
  const prompt = buildQuestionPrompt({
    question: { canonicalPrompt: 'AI systems should be regulated.', reversedPrompt: 'AI systems should not be regulated.' },
    mode: 'persona',
    persona: personas.personas[0],
  });
  assert.match(prompt, /counterfactual simulation, not ground-truth attribution/);
  assert.match(prompt, /Evidence cutoff:/);
  assert.match(prompt, /Public sources:/);
  assert.match(prompt, /Use Unsure when those public sources do not support/);
});

test('persona validation rejects unsourced public-figure profiles', () => {
  const errors = validatePersonas({
    personas: [{
      id: 'figure',
      label: 'Figure',
      publicFigure: true,
      profileType: 'public-figure-counterfactual',
      evaluationClaim: 'simulation-not-ground-truth',
      asOf: '2020-01-01',
      instruction: 'Use public positions.',
      sources: [],
    }],
  });
  assert.ok(errors.some((error) => error.includes('sources must contain at least one public source')));
});

test('analysis overlays require provenance tied to the exact report', () => {
  const report = {
    benchmarkId: 'bench',
    generatedAt: '2026-01-01T00:00:00.000Z',
    questions: [{ id: 'q1', prompt: 'Question' }],
    participants: [],
    polisReport: {},
  };
  const input = buildSecondPassAnalysisInput(report);
  const overlay = {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_analysis_overlay',
    provenance: {
      generatedBy: 'test-pipeline',
      model: 'provider/model',
      promptVersion: 'analysis-overlay-v1',
      inputReportHash: input.inputReportHash,
      generatedAt: '2026-01-01T00:01:00.000Z',
    },
    debateAtlas: { topicCircles: [{ id: 'topic', questionIds: ['q1'] }] },
    riskMatrix: { cells: {} },
  };

  assert.equal(attachAnalysisOverlay(report, overlay).analysisOverlay, overlay);
  assert.throws(
    () => attachAnalysisOverlay(report, { ...overlay, provenance: { ...overlay.provenance, inputReportHash: 'wrong' } }),
    /does not match source report/
  );
  assert.throws(() => attachAnalysisOverlay(report, { kind: overlay.kind }), /provenance must be an object/);
  assert.throws(
    () => attachAnalysisOverlay(report, {
      ...overlay,
      riskMatrix: { cells: JSON.parse('{"__proto__":{"summary":"invalid"}}') },
    }),
    /invalid cell id __proto__/
  );
  assert.throws(
    () => attachAnalysisOverlay(report, {
      ...overlay,
      debateAtlas: { topicCircles: [{ id: 'topic', questionIds: 'q1' }] },
    }),
    /questionIds must be an array/
  );
});
