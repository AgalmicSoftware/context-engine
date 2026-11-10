import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSessionPolicy } from './sessionPolicy.mjs';
import { inferQuestionTags, sessionContextFromPolicySession } from './agentQuestionProposals.mjs';

// The Session Worker stores sessionContext as { title, paragraphs, links }.
const sessionContext = {
  title: 'Cycling',
  paragraphs: ['Neighbourhood buses and protected lanes.'],
  links: [{ label: 'Plan', url: 'https://example.org/plan' }],
};

test('agent policy reads a stored context object as its text, not "[object Object]"', () => {
  const [session] = normalizeSessionPolicy({ sessions: [{ sessionSlug: 'alpha', sessionContext }] }).linkedSessions;
  assert.equal(session.sessionContext, 'Cycling Neighbourhood buses and protected lanes. Plan');
  assert.equal(sessionContextFromPolicySession({ sessionContext }), session.sessionContext);
  // An empty context falls back to the description, as a missing one does.
  const [described] = normalizeSessionPolicy({
    sessions: [{ sessionSlug: 'alpha', sessionContext: { title: '', paragraphs: [], links: [] }, description: 'Parks' }],
  }).linkedSessions;
  assert.equal(described.sessionContext, 'Parks');
  assert.equal(sessionContextFromPolicySession({ sessionContext: { paragraphs: [] }, description: 'Parks' }), 'Parks');
});

test('tag inference for agent questions uses the context text and never tags "object"', () => {
  const [session] = normalizeSessionPolicy({ sessions: [{ sessionSlug: 'alpha', sessionContext }] }).linkedSessions;
  for (const candidate of [session, { sessionSlug: 'alpha', sessionContext }]) {
    const tags = inferQuestionTags({ prompt: 'Should the council fund this?', questionType: 'binary', session: candidate });
    assert.equal(tags.includes('object'), false, JSON.stringify(tags));
    assert.ok(tags.includes('cycling'), JSON.stringify(tags));
  }
});
