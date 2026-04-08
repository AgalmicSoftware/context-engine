'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '..');
const generatorModuleUrl = pathToFileURL(
  path.join(repoRoot, 'scripts', 'generate-demo-analysis-fixture.mjs')
).href;
const outputPath = path.join(
  repoRoot,
  'client',
  'src',
  'variables',
  'demo',
  'demo_analysis_data.json'
);

test('generate-demo-analysis-fixture stays in sync with the committed fixture output', async () => {
  const {
    buildDemoAnalysisFixture,
    stringifyDemoAnalysisFixture,
  } = await import(generatorModuleUrl);

  const generatedFixture = buildDemoAnalysisFixture();
  const committedFixture = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.deepEqual(generatedFixture, committedFixture);
  assert.equal(
    stringifyDemoAnalysisFixture(generatedFixture),
    fs.readFileSync(outputPath, 'utf8')
  );
});

test('deriveParticipantVotes ignores unique nodeIds without an explicit semantic mapping', async () => {
  const {
    buildTreeVoteNodeIdsByQuestion,
    deriveParticipantVotes,
  } = await import(generatorModuleUrl);

  const comments = [
    { nodeId: 'unique-node' },
    { nodeId: 'another-unique-node' },
  ];
  const participant = {
    votes: {
      0: -1,
      1: 0,
    },
  };
  const treeVotesByFigure = {
    'unique-node': '7',
    'another-unique-node': '-7',
  };

  const treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments);

  assert.deepEqual(treeNodeIdsByQuestion, [null, null]);
  assert.deepEqual(
    deriveParticipantVotes(participant, comments, treeVotesByFigure, treeNodeIdsByQuestion),
    {
      0: -1,
      1: 0,
    }
  );
});

test('deriveParticipantVotes uses tree votes only for explicitly validated mappings', async () => {
  const {
    buildTreeVoteNodeIdsByQuestion,
    deriveParticipantVotes,
  } = await import(generatorModuleUrl);

  const comments = [
    { nodeId: 'validated-node' },
    { nodeId: 'unmapped-node' },
    { nodeId: 'stale-comment-node' },
  ];
  const participant = {
    votes: {
      0: -1,
      1: 0,
      2: 1,
    },
  };
  const treeVotesByFigure = {
    'validated-node': '8',
    'unmapped-node': '-8',
    'stale-node-from-old-mapping': '-8',
  };

  const treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments, {
    0: 'validated-node',
    2: 'stale-node-from-old-mapping',
  });

  assert.deepEqual(treeNodeIdsByQuestion, ['validated-node', null, null]);
  assert.deepEqual(
    deriveParticipantVotes(participant, comments, treeVotesByFigure, treeNodeIdsByQuestion),
    {
      0: 1,
      1: 0,
      2: 1,
    }
  );
});
