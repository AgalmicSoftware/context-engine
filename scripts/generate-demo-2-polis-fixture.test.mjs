import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'generate-demo-2-polis-fixture.mjs');
const DEMO_DIR = path.join(__dirname, '..', 'client', 'src', 'variables', 'demo');
const QUESTION_SET_PATH = path.join(DEMO_DIR, 'demo_2_question_set.json');
const STANCES_PATH = path.join(DEMO_DIR, 'demo_2_persona_stances.json');
const COMMITTED_FIXTURE_PATH = path.join(DEMO_DIR, 'demo_2_polis_data.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

function runGenerator(env = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo2-gen-test-'));
  try {
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('regenerating from committed inputs is a byte-identical no-op', () => {
  withTempDir((tempDir) => {
    const outputPath = path.join(tempDir, 'out.json');
    const result = runGenerator({ DEMO2_OUTPUT_PATH: outputPath });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(outputPath, 'utf8'),
      fs.readFileSync(COMMITTED_FIXTURE_PATH, 'utf8')
    );
  });
});

function runWithCorruptedQuestionSet(tempDir, mutate) {
  const questionSet = readJson(QUESTION_SET_PATH);
  mutate(questionSet);
  const corruptPath = path.join(tempDir, 'question_set.json');
  fs.writeFileSync(corruptPath, JSON.stringify(questionSet));
  const outputPath = path.join(tempDir, 'out.json');
  const result = runGenerator({
    DEMO2_QUESTION_SET_PATH: corruptPath,
    DEMO2_OUTPUT_PATH: outputPath,
  });
  return { result, outputPath };
}

function runWithCorruptedStances(tempDir, mutate) {
  const stances = readJson(STANCES_PATH);
  mutate(stances);
  const corruptPath = path.join(tempDir, 'stances.json');
  fs.writeFileSync(corruptPath, JSON.stringify(stances));
  const outputPath = path.join(tempDir, 'out.json');
  const result = runGenerator({
    DEMO2_STANCES_PATH: corruptPath,
    DEMO2_OUTPUT_PATH: outputPath,
  });
  return { result, outputPath };
}

test('fails closed on an empty rating scale without writing output', () => {
  withTempDir((tempDir) => {
    const { result, outputPath } = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      const rating = questionSet.questions.find((question) => question.type === 'rating');
      rating.scale = {};
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /scale\.min/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed on an unknown question type', () => {
  withTempDir((tempDir) => {
    const { result, outputPath } = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.questions[0].type = 'ranked-choice';
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /type must be one of/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed on a broken vote model', () => {
  withTempDir((tempDir) => {
    const { result, outputPath } = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.voteModel.noiseScale = null;
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /noiseScale/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed on non-numeric or unknown-axis scoring inputs', () => {
  withTempDir((tempDir) => {
    const badLoading = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.questions[0].loadings.techOptimism = 'not-a-number';
    });
    assert.equal(badLoading.result.status, 1);
    assert.match(badLoading.result.stderr, /loadings\.techOptimism/);
    assert.equal(fs.existsSync(badLoading.outputPath), false);

    const unknownAxis = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.questions[0].loadings.techOptimsim = 0.5;
    });
    assert.equal(unknownAxis.result.status, 1);
    assert.match(unknownAxis.result.stderr, /unknown axis techOptimsim/);
    assert.equal(fs.existsSync(unknownAxis.outputPath), false);

    const badOptionLoading = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      const poll = questionSet.questions.find((question) => question.type === 'poll');
      poll.options[0].loadings.egalitarianism = null;
    });
    assert.equal(badOptionLoading.result.status, 1);
    assert.match(badOptionLoading.result.stderr, /options\[0\]\.loadings/);
    assert.equal(fs.existsSync(badOptionLoading.outputPath), false);

    const badBias = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.questions[0].bias = '0.2';
    });
    assert.equal(badBias.result.status, 1);
    assert.match(badBias.result.stderr, /bias/);
    assert.equal(fs.existsSync(badBias.outputPath), false);
  });
});

test('fails closed on duplicate persona identities', () => {
  withTempDir((tempDir) => {
    const { result, outputPath } = runWithCorruptedStances(tempDir, (stances) => {
      stances.personas[1] = { ...stances.personas[0] };
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate persona xid/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed when distinct xids resolve to a duplicate address', () => {
  withTempDir((tempDir) => {
    const legacyPolis = readJson(path.join(DEMO_DIR, 'demo_polis_data.json'));
    legacyPolis.participantsVotes[1].participant = legacyPolis.participantsVotes[0].participant;
    const corruptLegacyPath = path.join(tempDir, 'legacy_polis.json');
    fs.writeFileSync(corruptLegacyPath, JSON.stringify(legacyPolis));
    const outputPath = path.join(tempDir, 'out.json');
    const result = runGenerator({
      DEMO2_LEGACY_POLIS_PATH: corruptLegacyPath,
      DEMO2_OUTPUT_PATH: outputPath,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /resolves to an address already used/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed on empty personas, duplicate axes, and non-string freeform answers', () => {
  withTempDir((tempDir) => {
    const emptyPersonas = runWithCorruptedStances(tempDir, (stances) => {
      stances.personas = [];
    });
    assert.equal(emptyPersonas.result.status, 1);
    assert.match(emptyPersonas.result.stderr, /personas must be a non-empty array/);
    assert.equal(fs.existsSync(emptyPersonas.outputPath), false);

    const duplicateAxes = runWithCorruptedQuestionSet(tempDir, (questionSet) => {
      questionSet.axes = [...questionSet.axes, questionSet.axes[0]];
    });
    assert.equal(duplicateAxes.result.status, 1);
    assert.match(duplicateAxes.result.stderr, /axes must be unique/);
    assert.equal(fs.existsSync(duplicateAxes.outputPath), false);

    const badFreeform = runWithCorruptedStances(tempDir, (stances) => {
      const persona = stances.personas.find((entry) => entry.freeform);
      const slug = Object.keys(persona.freeform)[0];
      persona.freeform[slug] = { value: 'wrapped object' };
    });
    assert.equal(badFreeform.result.status, 1);
    assert.match(badFreeform.result.stderr, /must be a non-empty string/);
    assert.equal(fs.existsSync(badFreeform.outputPath), false);
  });
});

test('fails closed when the stance model does not declare exactly 3 clusters', () => {
  withTempDir((tempDir) => {
    const { result, outputPath } = runWithCorruptedStances(tempDir, (stances) => {
      stances.clusters = stances.clusters.slice(0, 2);
      stances.personas.forEach((persona) => {
        if (persona.cluster > 1) persona.cluster = 1;
      });
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exactly 3 entries/);
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test('fails closed on invalid persona engagement and cluster ids', () => {
  withTempDir((tempDir) => {
    const engagement = runWithCorruptedStances(tempDir, (stances) => {
      stances.personas[0].engagement = 0;
    });
    assert.equal(engagement.result.status, 1);
    assert.match(engagement.result.stderr, /engagement/);
    assert.equal(fs.existsSync(engagement.outputPath), false);

    const cluster = runWithCorruptedStances(tempDir, (stances) => {
      stances.personas[0].cluster = 9;
    });
    assert.equal(cluster.result.status, 1);
    assert.match(cluster.result.stderr, /cluster/);
    assert.equal(fs.existsSync(cluster.outputPath), false);
  });
});
