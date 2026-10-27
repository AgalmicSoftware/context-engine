import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftProvenance, persistAnswerDraft, readAnswerDraft } from './answerDrafts.mjs';
class MemoryKv {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    if (options && typeof options === 'object' && Object.hasOwn(options, 'metadata')) {
      this.metadata.set(key, options.metadata);
    } else {
      this.metadata.delete(key);
    }
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = Array.from(this.store.keys())
      .filter((key) => String(key).startsWith(prefix))
      .sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({
        name,
        ...(this.metadata.has(name) ? { metadata: this.metadata.get(name) } : {}),
      })),
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }
}

class MemoryAnalytics {
  constructor() {
    this.points = [];
  }

  writeDataPoint(point) {
    this.points.push(point);
  }
}

const NORMALIZED = {
  user: { telegramUserId: '42', username: 'host' },
  chat: { chatId: '42', isPrivate: true },
};

function draftEnv() {
  return {
    AGENT_ACTION_KV: new MemoryKv(),
  };
}

async function saveAgentDraft(env, {
  answerValue = JSON.stringify({ questionType: 'binary', value: 'agree', comments: 'Matches priorities.' }),
  answerLabel = 'Agree',
  createdAt = '2026-06-11T10:00:00.000Z',
} = {}) {
  return persistAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
    answerLabel,
    answerValue,
    controlType: 'agree_unsure_disagree',
    metadata: {
      source: 'agent_handoff',
      endpoint: '/api/agent/preferences',
      reviewRequired: true,
    },
    agentMetadata: { agentName: 'hermes', platform: 'openclaw', model: 'claude-fable-5' },
    createdAt,
  });
}


test('buildDraftProvenance reports stance flips, latency, and both plaintexts', async () => {
  const env = draftEnv();
  await saveAgentDraft(env);
  await persistAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
    answerLabel: 'Disagree',
    answerValue: JSON.stringify({ questionType: 'binary', value: 'disagree', comments: 'Changed my mind.' }),
    controlType: 'agree_unsure_disagree',
    metadata: { source: 'mini_app' },
    createdAt: '2026-06-11T10:05:00.000Z',
  });
  const draft = await readAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
  });

  const provenance = buildDraftProvenance({
    draft,
    submittedAt: '2026-06-11T10:10:00.000Z',
    firstViewedAt: '2026-06-11T10:02:00.000Z',
  });

  assert.equal(provenance.agentDrafted, true);
  assert.equal(provenance.editedFromOrigin, true);
  assert.equal(provenance.editedFromAgentDraft, true);
  assert.equal(provenance.editCount, 1);
  assert.equal(provenance.firstViewedAt, '2026-06-11T10:02:00.000Z');
  assert.equal(provenance.draftToSubmitMs, 10 * 60 * 1000);
  assert.match(provenance.origin.answerValue, /agree/);
  assert.match(provenance.finalAnswer.answerValue, /disagree/);
  assert.equal(provenance.delta.kind, 'binary');
  assert.equal(provenance.delta.changed, true);
  assert.equal(provenance.delta.stanceBefore, 'agree');
  assert.equal(provenance.delta.stanceAfter, 'disagree');
  assert.equal(provenance.delta.stanceChanged, true);
  assert.equal(provenance.delta.commentsChanged, true);
});

test('buildDraftProvenance ignores stale view stamps older than draft origin', () => {
  const provenance = buildDraftProvenance({
    draft: {
      answerLabel: 'Agree',
      answerValue: JSON.stringify({ questionType: 'binary', value: 'agree', comments: '' }),
      controlType: 'agree_unsure_disagree',
      origin: {
        source: 'agent_handoff',
        answerLabel: 'Agree',
        answerValue: JSON.stringify({ questionType: 'binary', value: 'agree', comments: '' }),
        controlType: 'agree_unsure_disagree',
        savedAt: '2026-06-11T10:10:00.000Z',
      },
      editCount: 0,
    },
    submittedAt: '2026-06-11T10:12:00.000Z',
    firstViewedAt: '2026-06-11T10:02:00.000Z',
  });

  assert.equal(provenance.firstViewedAt, null);
  assert.equal(provenance.draftToSubmitMs, 2 * 60 * 1000);
});

test('buildDraftProvenance computes typed deltas for rating, multichoice, and freeform', () => {
  const rating = buildDraftProvenance({
    draft: {
      answerLabel: '8',
      answerValue: JSON.stringify({ questionType: 'rating', value: 8, comments: '' }),
      controlType: 'rating_button',
      origin: {
        source: 'agent_handoff',
        answerLabel: '4',
        answerValue: JSON.stringify({ questionType: 'rating', value: 4, comments: '' }),
        controlType: 'rating_button',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
    submittedAt: '2026-06-11T10:01:00.000Z',
  });
  assert.equal(rating.delta.ratingBefore, 4);
  assert.equal(rating.delta.ratingAfter, 8);
  assert.equal(rating.delta.ratingShift, 4);

  const multichoice = buildDraftProvenance({
    draft: {
      answerLabel: 'A, C',
      answerValue: JSON.stringify({ questionType: 'multichoice', values: ['A', 'C'], comments: '' }),
      controlType: 'multi_select_toggle',
      origin: {
        source: 'agent_handoff',
        answerLabel: 'A, B',
        answerValue: JSON.stringify({ questionType: 'multichoice', values: ['A', 'B'], comments: '' }),
        controlType: 'multi_select_toggle',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
  });
  assert.deepEqual(multichoice.delta.addedValues, ['C']);
  assert.deepEqual(multichoice.delta.removedValues, ['B']);

  const freeform = buildDraftProvenance({
    draft: {
      answerLabel: 'Review the budget and timeline first.',
      answerValue: JSON.stringify({ questionType: 'freeform', text: 'Review the budget and timeline first.', comments: '' }),
      controlType: 'freeform_text',
      origin: {
        source: 'agent_handoff',
        answerLabel: 'Review the budget.',
        answerValue: JSON.stringify({ questionType: 'freeform', text: 'Review the budget.', comments: '' }),
        controlType: 'freeform_text',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
  });
  assert.equal(freeform.delta.kind, 'freeform');
  assert.equal(freeform.delta.textChanged, true);
  assert.equal(freeform.delta.lengthBefore, 'Review the budget.'.length);
  assert.equal(freeform.delta.lengthAfter, 'Review the budget and timeline first.'.length);
  assert.equal(freeform.delta.lengthDelta, freeform.delta.lengthAfter - freeform.delta.lengthBefore);
});

test('quadratic draft provenance compares ordered votes as an allocation', () => {
  const before = { answerValue: JSON.stringify({ questionType: 'quadratic', value: [3, -4, 0] }), controlType: 'quadratic_allocation' };
  const draft = { ...before, origin: { ...before, source: 'agent_handoff' },
    answerValue: JSON.stringify({ questionType: 'quadratic', value: [-4, 3, 0] }) };
  const provenance = buildDraftProvenance({ draft });
  assert.equal(provenance.delta.kind, 'quadratic');
  assert.equal(provenance.delta.changedOptionCount, 2);
  assert.equal(provenance.editedFromOrigin, true);
  assert.equal(buildDraftProvenance({ draft: { ...draft, answerValue: before.answerValue } }).delta.changed, false);
});

test('legacy drafts without an origin block report unknown edit state', () => {
  const provenance = buildDraftProvenance({
    draft: {
      answerLabel: 'Agree',
      answerValue: 'Agree',
      controlType: 'agree_unsure_disagree',
      selectedAt: '2026-06-11T10:00:00.000Z',
    },
    submittedAt: '2026-06-11T10:01:00.000Z',
  });
  assert.equal(provenance.origin, null);
  assert.equal(provenance.editedFromOrigin, null);
  assert.equal(provenance.agentDrafted, false);
  assert.equal(provenance.editedFromAgentDraft, false);
  assert.equal(provenance.draftToSubmitMs, null);
  assert.equal(provenance.delta, null);
});

test('draft records reject token-shaped metadata values', async () => {
  const env = draftEnv();
  await assert.rejects(
    () => persistAnswerDraft({
      env,
      normalized: NORMALIZED,
      sessionSlug: 'alpha',
      selectedQuestionId: 'q-binary',
      answerLabel: 'Agree',
      answerValue: JSON.stringify({ questionType: 'binary', value: 'agree', comments: '' }),
      controlType: 'agree_unsure_disagree',
      metadata: { source: 'agent_handoff' },
      agentMetadata: { agentName: `ceagt_${'A'.repeat(43)}` },
      createdAt: '2026-06-11T10:00:00.000Z',
    }),
    /Agent answer drafts must not serialize secrets/,
  );

  await assert.rejects(
    () => persistAnswerDraft({
      env,
      normalized: NORMALIZED,
      sessionSlug: 'alpha',
      selectedQuestionId: 'q-binary',
      answerLabel: 'Agree',
      answerValue: JSON.stringify({ questionType: 'binary', value: 'agree', comments: '' }),
      controlType: 'agree_unsure_disagree',
      metadata: { source: 'agent_handoff', clientSource: `sk-${'B'.repeat(24)}` },
      createdAt: '2026-06-11T10:00:00.000Z',
    }),
    /Agent answer drafts must not serialize secrets/,
  );
});

test('an agent revising its own draft is not counted as a human edit', async () => {
  const env = draftEnv();
  await saveAgentDraft(env);
  // Agent revises its own draft (e.g. a later digest run).
  await saveAgentDraft(env, {
    answerLabel: 'Disagree',
    answerValue: JSON.stringify({ questionType: 'binary', value: 'disagree', comments: 'New context.' }),
    createdAt: '2026-06-11T10:03:00.000Z',
  });
  // User accepts the agent's revision verbatim via the mini app.
  const accepted = await persistAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
    answerLabel: 'Disagree',
    answerValue: JSON.stringify({
      questionType: 'agree_unsure_disagree',
      value: 'disagree',
      label: 'Disagree',
      comments: 'New context.',
    }),
    controlType: 'agree_unsure_disagree',
    metadata: { source: 'mini_app' },
    createdAt: '2026-06-11T10:05:00.000Z',
  });

  assert.equal(accepted.draft.editCount, 1);
  assert.equal(accepted.draft.humanEditCount, 0);
  assert.equal(accepted.draft.lastEditSource, 'agent_handoff');
  const provenance = buildDraftProvenance({
    draft: accepted.draft,
    submittedAt: '2026-06-11T10:06:00.000Z',
  });
  // Final differs from the FIRST agent draft but matches the agent's latest
  // revision, so this is not a human edit of the agent's proposal.
  assert.equal(provenance.editedFromOrigin, true);
  assert.equal(provenance.editedFromAgentDraft, false);
  assert.equal(provenance.humanEditCount, 0);
  assert.equal(provenance.agentRevisionSavedAt, '2026-06-11T10:03:00.000Z');
});

test('plain-string private-chat answers produce correct typed deltas', () => {
  // Private-chat drafts store bare strings ('agree', '4', 'Option A'), not JSON.
  const stanceFlip = buildDraftProvenance({
    draft: {
      answerLabel: 'Disagree',
      answerValue: 'disagree',
      controlType: 'agree_unsure_disagree',
      origin: {
        source: 'telegram_private_chat',
        answerLabel: 'Agree',
        answerValue: 'agree',
        controlType: 'agree_unsure_disagree',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
    submittedAt: '2026-06-11T10:01:00.000Z',
  });
  assert.equal(stanceFlip.delta.kind, 'binary');
  assert.equal(stanceFlip.delta.stanceBefore, 'agree');
  assert.equal(stanceFlip.delta.stanceAfter, 'disagree');
  assert.equal(stanceFlip.delta.stanceChanged, true);

  // Cross-lane: agent JSON origin confirmed unchanged via a private-chat tap.
  const verbatimCrossLane = buildDraftProvenance({
    draft: {
      answerLabel: 'Agree',
      answerValue: 'agree',
      controlType: 'agree_unsure_disagree',
      origin: {
        source: 'agent_handoff',
        answerLabel: 'Agree',
        answerValue: JSON.stringify({ questionType: 'binary', value: 'agree', comments: '' }),
        controlType: 'agree_unsure_disagree',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 0,
    },
    submittedAt: '2026-06-11T10:01:00.000Z',
  });
  assert.equal(verbatimCrossLane.editedFromOrigin, false);
  assert.equal(verbatimCrossLane.editedFromAgentDraft, false);
  assert.equal(verbatimCrossLane.delta.stanceChanged, false);

  const ratingShift = buildDraftProvenance({
    draft: {
      answerLabel: '8',
      answerValue: '8',
      controlType: 'rating_button',
      origin: {
        source: 'telegram_private_chat',
        answerLabel: '4',
        answerValue: '4',
        controlType: 'rating_button',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
  });
  assert.equal(ratingShift.delta.kind, 'rating');
  assert.equal(ratingShift.delta.ratingBefore, 4);
  assert.equal(ratingShift.delta.ratingAfter, 8);
  assert.equal(ratingShift.delta.ratingShift, 4);

  const choiceChange = buildDraftProvenance({
    draft: {
      answerLabel: 'Option B',
      answerValue: 'Option B',
      controlType: 'single_select',
      origin: {
        source: 'telegram_private_chat',
        answerLabel: 'Option A',
        answerValue: 'Option A',
        controlType: 'single_select',
        savedAt: '2026-06-11T10:00:00.000Z',
      },
      editCount: 1,
    },
  });
  assert.equal(choiceChange.delta.kind, 'multichoice');
  assert.deepEqual(choiceChange.delta.addedValues, ['Option B']);
  assert.deepEqual(choiceChange.delta.removedValues, ['Option A']);
});

test('reordering the same multichoice selection set is not an edit', async () => {
  const env = draftEnv();
  await persistAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-choice',
    answerLabel: 'A, B',
    answerValue: JSON.stringify({ questionType: 'multichoice', values: ['A', 'B'], comments: '' }),
    controlType: 'multi_select_toggle',
    metadata: { source: 'agent_handoff' },
    createdAt: '2026-06-11T10:00:00.000Z',
  });
  // Toggling a choice off and back on re-appends it, reordering the array.
  const reordered = await persistAnswerDraft({
    env,
    normalized: NORMALIZED,
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-choice',
    answerLabel: 'B, A',
    answerValue: JSON.stringify({ questionType: 'multichoice', values: ['B', 'A'], comments: '' }),
    controlType: 'multichoice',
    metadata: { source: 'mini_app' },
    createdAt: '2026-06-11T10:05:00.000Z',
  });

  assert.equal(reordered.draft.editCount, 0);
  assert.equal(reordered.draft.humanEditCount, 0);
  const provenance = buildDraftProvenance({
    draft: reordered.draft,
    submittedAt: '2026-06-11T10:06:00.000Z',
  });
  assert.equal(provenance.editedFromOrigin, false);
  assert.equal(provenance.editedFromAgentDraft, false);
  assert.equal(provenance.delta.changed, false);
  assert.deepEqual(provenance.delta.addedValues, []);
  assert.deepEqual(provenance.delta.removedValues, []);
});
