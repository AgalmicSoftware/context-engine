import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { attachAnalysisOverlay, buildSecondPassAnalysisInput } from '../src/analysis-export.mjs';
import { buildQuestionPrompt } from '../src/normalize.mjs';
import { validateModelRoster, validatePersonas } from '../src/schema.mjs';

test('sample personas use only the public figure name and model weights', async () => {
  const personas = JSON.parse(await fs.readFile(new URL('../data/personas.sample.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePersonas(personas), []);
  const prompt = buildQuestionPrompt({
    question: { canonicalPrompt: 'AI systems should be regulated.', reversedPrompt: 'AI systems should not be regulated.' },
    mode: 'persona',
    persona: {
      ...personas.personas[0],
      instruction: 'FORBIDDEN PROFILE INSTRUCTION',
      asOf: '1852-11-27',
      sources: [{ title: 'FORBIDDEN SOURCE', url: 'https://example.test/source' }],
      evidence: [{ summary: 'FORBIDDEN EVIDENCE' }],
    },
  });
  assert.match(prompt, /Public figure: Ada Lovelace/);
  assert.match(prompt, /knowledge already present in your model weights/);
  assert.match(prompt, /model interpretation, not a ground-truth attribution/);
  assert.match(prompt, /Use Unsure when your model weights do not support/);
  assert.doesNotMatch(prompt, /Evidence cutoff:/);
  assert.doesNotMatch(prompt, /Public sources:/);
  assert.doesNotMatch(prompt, /Evidence packet/);
  assert.doesNotMatch(prompt, /FORBIDDEN|example\.test|1852-11-27/);
  assert.doesNotMatch(prompt, /ada-lovelace|public-figure-weights-only/);
});

test('persona validation accepts a weights-only public-figure identity', () => {
  assert.deepEqual(validatePersonas({
    personas: [{
      id: 'figure',
      label: 'Figure',
      publicFigure: true,
      profileType: 'public-figure-weights-only',
      evaluationClaim: 'model-interpretation-not-ground-truth',
    }],
  }), []);
});

test('persona validation rejects prompt-conditioning fields in weights-only mode', () => {
  const errors = validatePersonas({
    personas: [{
      id: 'figure',
      label: 'Figure',
      publicFigure: true,
      profileType: 'public-figure-weights-only',
      evaluationClaim: 'model-interpretation-not-ground-truth',
      instruction: 'Use a supplied interpretation.',
      sources: [{ title: 'Source', url: 'https://example.test/source' }],
      evidence: [{ summary: 'Conditioning material.' }],
      asOf: '1950-01-01',
    }],
  });
  for (const field of ['instruction', 'sources', 'evidence', 'asOf']) {
    assert.ok(errors.some((error) => error.includes(`.${field} is not allowed`)));
  }
});

test('model roster validation constrains OpenRouter routing fields', () => {
  assert.deepEqual(validateModelRoster({
    models: [{
      id: 'model', label: 'Model', model: 'provider/model', provider: 'openrouter', traits: {},
      providerRouting: { allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
    }],
  }), []);
  const errors = validateModelRoster({
    models: [{
      id: 'model', label: 'Model', model: 'provider/model', provider: 'local', traits: {},
      providerRouting: { unknown: true },
    }],
  });
  assert.ok(errors.some((error) => error.includes('only valid for openrouter models')));
  assert.ok(errors.some((error) => error.includes('unknown is not supported')));
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
