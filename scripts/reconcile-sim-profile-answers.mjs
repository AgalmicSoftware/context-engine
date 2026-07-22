#!/usr/bin/env node

// Reconciles simulated-profile binary answers in historical_figure_users.json with
// the canonical demo vote fixtures so SimUserPage stances match the figure's votes
// in POLIS/breakdown surfaces.
//
// Evidence priority per binary profile question (questions reference the
// all_300_questions.json policy list via commentIndex):
//   1. The figure's POLIS vote on the demo comment linked by a verbatim
//      key_tension match (polarity pinned in the reconciliation config).
//   2. The figure's atlas tree vote on the node the linked comment maps to in
//      demo_analysis_generation_config.json (the manually validated mapping the
//      breakdown generator already trusts), using the generator's thresholds.
//   3. The figure's atlas tree vote on a manually validated bank-question node
//      mapping from the reconciliation config (explicit polarity + rationale).
//   4. No evidence: the existing answer is left unchanged.
//
// Deterministic and idempotent. Run via: npm run demo:sim-answers:reconcile

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEMO_DIR = path.join(REPO_ROOT, 'client', 'src', 'variables', 'demo');

const USERS_PATH = path.join(DEMO_DIR, 'historical_figure_users.json');
const QUESTION_BANK_PATH = path.join(DEMO_DIR, 'all_300_questions.json');
const DEMO_POLIS_PATH = path.join(DEMO_DIR, 'demo_polis_data.json');
const TREE_VOTES_PATH = path.join(DEMO_DIR, 'historical_figures_tree_qs_and_votes.json');
const GENERATION_CONFIG_PATH = path.join(DEMO_DIR, 'demo_analysis_generation_config.json');
const RECONCILIATION_CONFIG_PATH = path.join(DEMO_DIR, 'sim_profile_answer_reconciliation.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const VOTE_TO_ANSWER = Object.freeze({ 1: 'Agree', 0: 'Unsure', '-1': 'Disagree' });

export const buildKeyTensionCommentIndex = (comments) => {
  const byKeyTension = new Map();
  (comments || []).forEach((comment, index) => {
    const keyTension = String(comment?.key_tension || '').trim();
    if (!keyTension) return;
    if (byKeyTension.has(keyTension)) {
      throw new Error(
        `Duplicate key_tension across demo comments (indexes ${byKeyTension.get(keyTension)} and ${index}); ` +
          'the key_tension link would be ambiguous. Fix demo_polis_data.json before reconciling.'
      );
    }
    byKeyTension.set(keyTension, index);
  });
  return byKeyTension;
};

export const resolvePolisAnswer = (rawVote, polarity) => {
  const vote = Number(rawVote);
  if (!Number.isInteger(vote) || vote < -1 || vote > 1) return null;
  const oriented = vote * (polarity === -1 ? -1 : 1);
  return VOTE_TO_ANSWER[String(oriented)] || null;
};

export const resolveTreeAnswer = (rawScore, polarity, thresholds) => {
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  const oriented = score * (polarity === -1 ? -1 : 1);
  if (oriented >= thresholds.agreeMin) return 'Agree';
  if (oriented <= thresholds.disagreeMax) return 'Disagree';
  return 'Unsure';
};

const main = () => {
  const figures = readJson(USERS_PATH);
  const questionBank = readJson(QUESTION_BANK_PATH);
  const demoPolis = readJson(DEMO_POLIS_PATH);
  const treeVotesByUser = readJson(TREE_VOTES_PATH);
  const generationConfig = readJson(GENERATION_CONFIG_PATH);
  const reconciliationConfig = readJson(RECONCILIATION_CONFIG_PATH);

  const policyQuestions = (questionBank?.questions || []).filter((question) => question?.list === 'policy');
  const comments = Array.isArray(demoPolis?.comments) ? demoPolis.comments : [];
  const commentIndexByKeyTension = buildKeyTensionCommentIndex(comments);
  const validatedNodeIdByCommentIndex = generationConfig?.treeNodeIdsByQuestionId || {};
  const polisPolarityByPolicyIndex = reconciliationConfig?.polisLinkPolarityByPolicyIndex || {};
  const bankQuestionTreeNodeIds = reconciliationConfig?.bankQuestionTreeNodeIds || {};
  const thresholds = {
    agreeMin: Number(reconciliationConfig?.treeScoreThresholds?.agreeMin ?? 2),
    disagreeMax: Number(reconciliationConfig?.treeScoreThresholds?.disagreeMax ?? -2),
  };

  const polisVotesByXid = new Map();
  (demoPolis?.participantsVotes || []).forEach((participant) => {
    const xid = String(participant?.xid || '').trim();
    if (xid) polisVotesByXid.set(xid, participant?.votes || {});
  });

  const counts = {
    binaryQuestions: 0,
    polisEvidence: 0,
    validatedTreeEvidence: 0,
    configTreeEvidence: 0,
    noEvidence: 0,
    changed: 0,
  };
  const distribution = { before: {}, after: {} };
  const changes = [];
  const bump = (bucket, value) => {
    bucket[value] = (bucket[value] || 0) + 1;
  };

  figures.forEach((figure) => {
    const username = String(figure?.username || '').trim();
    const polisVotes = polisVotesByXid.get(username) || {};
    const treeVotes = treeVotesByUser?.[username]?.votes || {};

    (figure?.questions || []).forEach((question) => {
      if (question?.questionType !== 'binary') return;
      const policyIndex = question?.commentIndex;
      if (!Number.isInteger(policyIndex) || policyIndex < 0 || policyIndex >= policyQuestions.length) return;
      counts.binaryQuestions += 1;
      const currentValue = String(question?.answer?.value ?? '');
      bump(distribution.before, currentValue);

      let nextValue = null;
      let evidence = null;

      const keyTension = String(policyQuestions[policyIndex]?.key_tension || '').trim();
      const linkedCommentIndex = keyTension ? commentIndexByKeyTension.get(keyTension) : undefined;

      if (linkedCommentIndex !== undefined) {
        const polarity = Number(polisPolarityByPolicyIndex[String(policyIndex)]);
        if (polarity !== 1 && polarity !== -1) {
          throw new Error(
            `Policy index ${policyIndex} links to demo comment ${linkedCommentIndex} via key_tension but has no ` +
              'polarity entry in sim_profile_answer_reconciliation.json. Add one before reconciling.'
          );
        }
        const polisAnswer = resolvePolisAnswer(polisVotes[String(linkedCommentIndex)], polarity);
        if (polisAnswer) {
          nextValue = polisAnswer;
          evidence = 'polis';
          counts.polisEvidence += 1;
        } else {
          const validatedNodeId = validatedNodeIdByCommentIndex[String(linkedCommentIndex)];
          const treeAnswer = validatedNodeId
            ? resolveTreeAnswer(treeVotes[validatedNodeId], polarity, thresholds)
            : null;
          if (treeAnswer) {
            nextValue = treeAnswer;
            evidence = 'validated-tree';
            counts.validatedTreeEvidence += 1;
          }
        }
      }

      if (!nextValue) {
        const mapping = bankQuestionTreeNodeIds[String(policyIndex)];
        if (mapping?.nodeId) {
          const treeAnswer = resolveTreeAnswer(treeVotes[mapping.nodeId], mapping.polarity, thresholds);
          if (treeAnswer) {
            nextValue = treeAnswer;
            evidence = 'config-tree';
            counts.configTreeEvidence += 1;
          }
        }
      }

      if (!nextValue) {
        counts.noEvidence += 1;
        bump(distribution.after, currentValue);
        return;
      }

      bump(distribution.after, nextValue);
      if (nextValue !== currentValue) {
        counts.changed += 1;
        changes.push({ username, policyIndex, from: currentValue, to: nextValue, evidence });
        question.answer.value = nextValue;
      }
    });
  });

  fs.writeFileSync(USERS_PATH, `${JSON.stringify(figures, null, 2)}\n`, 'utf8');

  console.log('Reconciled simulated-profile binary answers.');
  console.log(`  binary questions in policy range: ${counts.binaryQuestions}`);
  console.log(`  POLIS-vote evidence:              ${counts.polisEvidence}`);
  console.log(`  validated tree-vote evidence:     ${counts.validatedTreeEvidence}`);
  console.log(`  config tree-vote evidence:        ${counts.configTreeEvidence}`);
  console.log(`  no evidence (left unchanged):     ${counts.noEvidence}`);
  console.log(`  answers changed:                  ${counts.changed}`);
  console.log(`  distribution before: ${JSON.stringify(distribution.before)}`);
  console.log(`  distribution after:  ${JSON.stringify(distribution.after)}`);
  changes.forEach((change) => {
    console.log(`    ${change.username} policy[${change.policyIndex}] ${change.from} -> ${change.to} (${change.evidence})`);
  });
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
