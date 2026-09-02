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
const demoPolisPath = path.join(
  repoRoot,
  'client',
  'src',
  'variables',
  'demo',
  'demo_polis_data.json'
);
const configPath = path.join(
  repoRoot,
  'client',
  'src',
  'variables',
  'demo',
  'demo_analysis_generation_config.json'
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

test('resolveQuestionMajorityVote treats tied top counts as neutral instead of favoring agree', async () => {
  const { resolveQuestionMajorityVote } = await import(generatorModuleUrl);

  assert.equal(
    resolveQuestionMajorityVote(new Map([
      [-1, 27],
      [0, 6],
      [1, 27],
    ])),
    0
  );
  assert.equal(
    resolveQuestionMajorityVote(new Map([
      [-1, 12],
      [0, 7],
      [1, 19],
    ])),
    1
  );
});

test('buildDemoAnalysisFixture applies breakdown-specific statement overrides and tree-backed votes', async () => {
  const { buildDemoAnalysisFixture } = await import(generatorModuleUrl);

  const fixture = buildDemoAnalysisFixture();
  const demoPolisData = JSON.parse(fs.readFileSync(demoPolisPath, 'utf8'));
  const generationConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const bismarckFixtureRow = fixture.participantsVotes.find((participant) => participant.xid === 'OttoVonBismarck');
  const bismarckPolisRow = demoPolisData.participantsVotes.find((participant) => participant.xid === 'OttoVonBismarck');

  assert.equal(
    fixture.comments[38].commentBody,
    generationConfig.questionOverridesByQuestionId['38'].commentBody
  );
  assert.equal(fixture.comments[38].type, 'binary');
  assert.equal(
    fixture.comments[38].sources,
    generationConfig.questionOverridesByQuestionId['38'].sourceTags.join(', ')
  );
  assert.equal(
    fixture.comments[39].category,
    generationConfig.questionOverridesByQuestionId['39'].category
  );
  assert.ok(bismarckFixtureRow);
  assert.ok(bismarckPolisRow);
  assert.equal(bismarckFixtureRow.votes['38'], 1);
  assert.equal(bismarckPolisRow.votes['38'], -1);
});

test('buildDemoAnalysisFixture expands deterministic synthetic participants from config', async () => {
  const { buildDemoAnalysisFixture } = await import(generatorModuleUrl);

  const fixture = buildDemoAnalysisFixture();
  const demoPolisData = JSON.parse(fs.readFileSync(demoPolisPath, 'utf8'));
  const generationConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const syntheticVariantCount = Array.isArray(generationConfig?.syntheticParticipantConfig?.variantProfiles)
    ? generationConfig.syntheticParticipantConfig.variantProfiles.length
    : 0;
  const expectedParticipantCount = demoPolisData.participantsVotes.length * (syntheticVariantCount + 1);
  const participantIds = fixture.participantsVotes.map((participant) => participant.participant);

  assert.equal(fixture.participantsVotes.length, expectedParticipantCount);
  assert.equal(new Set(participantIds).size, participantIds.length);
  assert.ok(
    fixture.participantsVotes.some(
      (participant) => participant.participant !== demoPolisData.participantsVotes[0].participant
        && participant.xid === demoPolisData.participantsVotes[0].xid
    )
  );
  assert.ok(
    fixture.participantsVotes.some(
      (participant) => participant.profileId === 'historical_baseline'
        && participant.profileLabel === 'Historical persona baseline'
        && participant.profileConfidence === 'High'
    )
  );
  assert.ok(
    fixture.participantsVotes.some(
      (participant) => participant.profileId === 'consensus_echo'
        && participant.profileLabel === 'Consensus echo'
        && participant.profileConfidence === 'Medium'
    )
  );
});

test('buildDemoAnalysisFixture normalizes comment datetime strings from canonical timestamps', async () => {
  const { buildDemoAnalysisFixture } = await import(generatorModuleUrl);

  const fixture = buildDemoAnalysisFixture();

  assert.equal(fixture.comments[0].datetime, 'Wed Mar 06 16:00:00 UTC 2024');
  assert.equal(fixture.comments[16].datetime, 'Wed Mar 06 16:16:00 UTC 2024');
  assert.equal(fixture.comments[41].datetime, 'Wed Mar 06 16:41:00 UTC 2024');
});

test('canonical legacy demo questions remain stable Worker seed inputs', () => {
  const demoPolisData = JSON.parse(fs.readFileSync(demoPolisPath, 'utf8'));

  assert.equal(demoPolisData.comments.length, 42);
  demoPolisData.comments.forEach((comment, questionIndex) => {
    assert.ok(String(comment.commentId || '').trim(), `question ${questionIndex} id`);
    assert.ok(String(comment.commentBody || '').trim(), `question ${questionIndex} prompt`);
  });
  assert.equal(
    demoPolisData.comments[22].commentBody,
    'If an AI resists modification, should we respect that preference?',
  );
  assert.deepEqual(demoPolisData.comments[30].options, [
    'Technical researchers',
    'AI developers and labs',
    'Governments and regulators',
    'The general public',
    'Affected communities',
  ]);
});

test('breakdown type overrides discard stale poll options', async () => {
  const { buildDemoAnalysisFixture } = await import(generatorModuleUrl);
  const fixture = buildDemoAnalysisFixture({
    questionOverridesByQuestion: {
      30: {
        type: 'binary',
        commentBody: 'Public participation should guide AI development.',
      },
    },
  });

  assert.equal(fixture.comments[30].type, 'binary');
  assert.equal(fixture.comments[30].options, undefined);
});
