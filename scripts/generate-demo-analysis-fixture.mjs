#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEMO_POLIS_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'demo_polis_data.json'
);
const TREE_VOTES_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'historical_figures_tree_qs_and_votes.json'
);
const OUTPUT_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'demo_analysis_data.json'
);

export const TREE_AGREE_THRESHOLD = 2;
export const TREE_DISAGREE_THRESHOLD = -2;
export const SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID = Object.freeze({});

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const normalizePolisVote = (value) => {
  const numericValue = Number(value);
  if (numericValue === 1 || numericValue === 0 || numericValue === -1) {
    return numericValue;
  }
  return null;
};

export const mapTreeVoteToTriState = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  if (numericValue >= TREE_AGREE_THRESHOLD) return 1;
  if (numericValue <= TREE_DISAGREE_THRESHOLD) return -1;
  return 0;
};

// Atlas node ids are not a safe automatic join key for these survey questions.
// Only use tree votes for question/node pairs that were manually validated as
// the same proposition.
export const getExplicitTreeVoteNodeIdForQuestion = (
  comment = {},
  questionKey = '',
  semanticTreeNodeIdsByQuestion = SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID
) => {
  const mappedNodeId = String(semanticTreeNodeIdsByQuestion?.[questionKey] || '').trim();
  if (!mappedNodeId) return null;

  const commentNodeId = String(comment?.nodeId || '').trim();
  return commentNodeId && commentNodeId === mappedNodeId ? mappedNodeId : null;
};

export const buildTreeVoteNodeIdsByQuestion = (
  comments = [],
  semanticTreeNodeIdsByQuestion = SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID
) => (Array.isArray(comments) ? comments : []).map((comment, index) => (
  getExplicitTreeVoteNodeIdForQuestion(comment, String(index), semanticTreeNodeIdsByQuestion)
));

export const deriveParticipantVotes = (
  participant = {},
  comments = [],
  treeVotesByFigure = {},
  treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments)
) => {
  const derivedVotes = {};

  comments.forEach((comment, index) => {
    const questionKey = String(index);
    const treeNodeId = treeNodeIdsByQuestion[index];
    const treeVote = treeNodeId ? mapTreeVoteToTriState(treeVotesByFigure?.[treeNodeId]) : null;
    const fallbackVote = normalizePolisVote(participant?.votes?.[questionKey]);
    const nextVote = treeVote ?? fallbackVote;

    if (nextVote === null) return;
    derivedVotes[questionKey] = nextVote;
  });

  return derivedVotes;
};

const buildParticipantRow = (
  participant = {},
  comments = [],
  treeData = {},
  treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments)
) => {
  const xid = String(participant?.xid || '').trim();
  const treeVotesByFigure = treeData?.[xid]?.votes || {};
  const votes = deriveParticipantVotes(
    participant,
    comments,
    treeVotesByFigure,
    treeNodeIdsByQuestion
  );
  const normalizedVotes = Object.values(votes).map((value) => Number(value));

  return {
    participant: String(participant?.participant || '').trim(),
    xid,
    groupId: Number(participant?.groupId ?? 0),
    nVotes: normalizedVotes.length,
    nAgree: normalizedVotes.filter((value) => value === 1).length,
    nDisagree: normalizedVotes.filter((value) => value === -1).length,
    votes,
  };
};

const buildCommentRows = (comments = [], participantsVotes = []) => comments.map((comment, index) => {
  const summary = participantsVotes.reduce((acc, participant) => {
    const vote = normalizePolisVote(participant?.votes?.[String(index)]);
    if (vote === 1) acc.agrees += 1;
    if (vote === -1) acc.disagrees += 1;
    return acc;
  }, { agrees: 0, disagrees: 0 });

  return {
    ...comment,
    agrees: summary.agrees,
    disagrees: summary.disagrees,
  };
});

export const buildDemoAnalysisFixture = () => {
  const demoPolisData = readJson(DEMO_POLIS_PATH);
  const treeData = readJson(TREE_VOTES_PATH);
  const comments = Array.isArray(demoPolisData?.comments) ? demoPolisData.comments : [];
  const participants = Array.isArray(demoPolisData?.participantsVotes)
    ? demoPolisData.participantsVotes
    : [];
  const treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments);

  const participantsVotes = participants.map((participant) => (
    buildParticipantRow(participant, comments, treeData, treeNodeIdsByQuestion)
  ));

  return {
    comments: buildCommentRows(comments, participantsVotes),
    participantsVotes,
  };
};

export const stringifyDemoAnalysisFixture = (fixture = buildDemoAnalysisFixture()) => (
  `${JSON.stringify(fixture, null, 2)}\n`
);

export const writeDemoAnalysisFixture = (outputPath = OUTPUT_PATH) => {
  const fixture = buildDemoAnalysisFixture();
  fs.writeFileSync(outputPath, stringifyDemoAnalysisFixture(fixture));
  return {
    fixture,
    outputPath,
  };
};

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMainModule) {
  const { fixture, outputPath } = writeDemoAnalysisFixture();
  console.log(
    `[generate-demo-analysis-fixture] wrote ${fixture.comments.length} questions and ${fixture.participantsVotes.length} participants to ${path.relative(REPO_ROOT, outputPath)}`
  );
}
