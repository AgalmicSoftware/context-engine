import allQuestions from './all_300_questions.json';
import demoPolisData from './demo_polis_data.json';
import historicalFigureUsers from './historical_figure_users.json';
import treeVotesByUser from './historical_figures_tree_qs_and_votes.json';
import reconciliationConfig from './sim_profile_answer_reconciliation.json';

const VOTE_TO_ANSWER = { 1: 'Agree', 0: 'Unsure', '-1': 'Disagree' };

const policyQuestions = allQuestions.questions.filter((question) => question.list === 'policy');

const buildKeyTensionCommentIndex = () => {
  const byKeyTension = new Map();
  demoPolisData.comments.forEach((comment, index) => {
    const keyTension = String(comment?.key_tension || '').trim();
    if (keyTension) byKeyTension.set(keyTension, index);
  });
  return byKeyTension;
};

describe('simulated profile answer consistency', () => {
  it('keeps key_tension links between the policy bank and demo comments unambiguous', () => {
    const seen = new Map();
    demoPolisData.comments.forEach((comment, index) => {
      const keyTension = String(comment?.key_tension || '').trim();
      if (!keyTension) return;
      expect(seen.has(keyTension)).toBe(false);
      seen.set(keyTension, index);
    });
  });

  it('keeps every POLIS-linked profile binary answer consistent with the figure vote fixture', () => {
    const commentIndexByKeyTension = buildKeyTensionCommentIndex();
    const polisVotesByXid = new Map(
      demoPolisData.participantsVotes.map((participant) => [participant.xid, participant.votes || {}]),
    );
    const polarityByPolicyIndex = reconciliationConfig.polisLinkPolarityByPolicyIndex || {};
    const mismatches = [];

    historicalFigureUsers.forEach((figure) => {
      const votes = polisVotesByXid.get(figure.username) || {};
      (figure.questions || []).forEach((question) => {
        if (question?.questionType !== 'binary') return;
        const policyIndex = question?.commentIndex;
        if (!Number.isInteger(policyIndex) || policyIndex < 0 || policyIndex >= policyQuestions.length) return;
        const keyTension = String(policyQuestions[policyIndex]?.key_tension || '').trim();
        const linkedCommentIndex = keyTension ? commentIndexByKeyTension.get(keyTension) : undefined;
        if (linkedCommentIndex === undefined) return;
        const polarity = Number(polarityByPolicyIndex[String(policyIndex)]);
        expect([1, -1]).toContain(polarity);
        const rawVote = Number(votes[String(linkedCommentIndex)]);
        if (!Number.isInteger(rawVote) || rawVote < -1 || rawVote > 1) return;
        const expected = VOTE_TO_ANSWER[String(rawVote * polarity)];
        if (question.answer?.value !== expected) {
          mismatches.push(
            `${figure.username} policy[${policyIndex}] answer "${question.answer?.value}" != POLIS-derived "${expected}"`,
          );
        }
      });
    });

    expect(mismatches).toEqual([]);
  });

  it('keeps the curated bank-question tree mappings valid and on empirically reliable anchors', () => {
    const mappings = reconciliationConfig.bankQuestionTreeNodeIds || {};
    const mappingEntries = Object.entries(mappings);
    expect(mappingEntries.length).toBeGreaterThan(0);

    const minAgreement = Number(reconciliationConfig.treeAnchorMinDirectionalAgreement);
    expect(minAgreement).toBeGreaterThanOrEqual(0.8);

    const knownNodeIds = new Set();
    Object.values(treeVotesByUser).forEach((figure) => {
      Object.keys(figure?.votes || {}).forEach((nodeId) => knownNodeIds.add(nodeId));
    });
    const polisVotesByXid = new Map(
      demoPolisData.participantsVotes.map((participant) => [participant.xid, participant.votes || {}]),
    );
    const agreeMin = Number(reconciliationConfig.treeScoreThresholds?.agreeMin ?? 2);

    mappingEntries.forEach(([policyIndex, mapping]) => {
      const parsedIndex = Number(policyIndex);
      expect(Number.isInteger(parsedIndex)).toBe(true);
      expect(parsedIndex).toBeGreaterThanOrEqual(0);
      expect(parsedIndex).toBeLessThan(policyQuestions.length);
      expect([1, -1]).toContain(mapping.polarity);
      expect(typeof mapping.rationale).toBe('string');
      expect(mapping.rationale.trim().length).toBeGreaterThan(0);
      expect(knownNodeIds.has(mapping.nodeId)).toBe(true);
      expect(Array.isArray(mapping.anchorCommentIndexes)).toBe(true);
      expect(mapping.anchorCommentIndexes.length).toBeGreaterThan(0);

      // The node's tree votes must agree directionally with the figure's POLIS votes
      // on the anchor statements for at least the configured share of figures.
      let directionalAgreements = 0;
      let directionalSamples = 0;
      Object.entries(treeVotesByUser).forEach(([username, figure]) => {
        const treeScore = Number(figure?.votes?.[mapping.nodeId]);
        if (!Number.isFinite(treeScore) || Math.abs(treeScore) < agreeMin) return;
        const votes = polisVotesByXid.get(username) || {};
        mapping.anchorCommentIndexes.forEach((anchorIndex) => {
          const vote = Number(votes[String(anchorIndex)]);
          if (vote !== 1 && vote !== -1) return;
          directionalSamples += 1;
          if (treeScore > 0 === vote > 0) directionalAgreements += 1;
        });
      });

      expect(directionalSamples).toBeGreaterThan(0);
      expect(directionalAgreements / directionalSamples).toBeGreaterThanOrEqual(minAgreement);
    });
  });

  it('keeps the simulated profile binary answers away from the monotone all-Agree regression', () => {
    const distribution = {};
    historicalFigureUsers.forEach((figure) => {
      (figure.questions || []).forEach((question) => {
        if (question?.questionType !== 'binary') return;
        const value = String(question?.answer?.value ?? '');
        distribution[value] = (distribution[value] || 0) + 1;
      });
    });
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const nonAgree = total - (distribution.Agree || 0);

    expect(total).toBeGreaterThan(0);
    // The fixture shipped with 90% Agree (38/391 non-Agree). Reconciliation against the
    // vote fixtures keeps at least 12% of answers off Agree; don't regress below that.
    expect(nonAgree / total).toBeGreaterThanOrEqual(0.12);
  });
});
