import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INVALID_SESSION_SLUG_ERROR,
  normalizeWorkerSessionSlug,
  resolveRequestedWorkerSlugPayload,
  resolveCoordinatorSessionSlugStorageKey,
  resolveWorkerBodySlugContext,
  resolveWorkerRequestSlugContext,
  sessionSlugStorageKey,
  SLUG_MISMATCH_ERROR,
  validateInboundWorkerSessionSlug,
} from './sessionSlugResolution.js';

test('normalizeWorkerSessionSlug keeps reserved alias handling narrow', () => {
  assert.equal(normalizeWorkerSessionSlug(' general '), '');
  assert.equal(normalizeWorkerSessionSlug('DeBaTe'), 'rxc');
  assert.equal(normalizeWorkerSessionSlug('Alpha Beta!'), 'alphabeta');
});

test('sessionSlugStorageKey maps the identity sentinel to the stable storage sentinel', () => {
  assert.equal(sessionSlugStorageKey(''), 'general');
  assert.equal(sessionSlugStorageKey('general'), 'general');
  assert.equal(sessionSlugStorageKey('debate'), 'rxc');
  assert.equal(sessionSlugStorageKey('alpha'), 'alpha');
});

test('validateInboundWorkerSessionSlug preserves strict inbound validation', () => {
  assert.deepEqual(validateInboundWorkerSessionSlug(null), { ok: true, slug: '', error: '' });
  assert.deepEqual(validateInboundWorkerSessionSlug('general'), { ok: true, slug: '', error: '' });
  assert.deepEqual(validateInboundWorkerSessionSlug('debate'), { ok: true, slug: 'rxc', error: '' });
  assert.deepEqual(validateInboundWorkerSessionSlug('alpha_beta-9'), { ok: true, slug: 'alpha_beta-9', error: '' });

  assert.equal(validateInboundWorkerSessionSlug('Alpha').ok, false);
  assert.equal(validateInboundWorkerSessionSlug('Alpha').error, INVALID_SESSION_SLUG_ERROR);
  assert.equal(validateInboundWorkerSessionSlug('bad slug').error, INVALID_SESSION_SLUG_ERROR);
});

test('resolveCoordinatorSessionSlugStorageKey preserves strict coordinator validation', () => {
  assert.equal(resolveCoordinatorSessionSlugStorageKey(null), '');
  assert.equal(resolveCoordinatorSessionSlugStorageKey(''), 'general');
  assert.equal(resolveCoordinatorSessionSlugStorageKey('general'), 'general');
  assert.equal(resolveCoordinatorSessionSlugStorageKey('debate'), 'rxc');
  assert.equal(resolveCoordinatorSessionSlugStorageKey('alpha'), 'alpha');
  assert.equal(resolveCoordinatorSessionSlugStorageKey('Alpha'), '');
  assert.equal(resolveCoordinatorSessionSlugStorageKey('bad slug'), '');
});

test('resolveRequestedWorkerSlugPayload ignores legacy groupSlug body fields', () => {
  const sessionOnly = resolveRequestedWorkerSlugPayload({ sessionSlug: 'alpha', groupSlug: 'beta' });
  assert.equal(sessionOnly.ok, true);
  assert.equal(sessionOnly.hasSessionSlug, true);
  assert.equal(sessionOnly.hasGroupSlug, true);
  assert.equal(sessionOnly.sessionSlug, 'alpha');
  assert.equal(sessionOnly.groupSlug, 'beta');
  assert.equal(sessionOnly.requestedSlug, 'alpha');
  assert.equal(sessionOnly.aliasMismatch, true);

  const legacyOnly = resolveRequestedWorkerSlugPayload({ groupSlug: 'beta' });
  assert.equal(legacyOnly.ok, true);
  assert.equal(legacyOnly.hasSessionSlug, false);
  assert.equal(legacyOnly.hasGroupSlug, true);
  assert.equal(legacyOnly.hasAnySlug, false);
  assert.equal(legacyOnly.groupSlug, 'beta');
  assert.equal(legacyOnly.requestedSlug, '');
});

test('resolveWorkerBodySlugContext preserves env mismatch, alias mismatch, and fallback behavior', () => {
  const envMismatch = resolveWorkerBodySlugContext({
    body: { sessionSlug: 'beta' },
    env: { DEFAULT_SESSION_SLUG: 'alpha' },
  });
  assert.equal(envMismatch.ok, false);
  assert.equal(envMismatch.error, SLUG_MISMATCH_ERROR);
  assert.equal(envMismatch.targetSlug, 'alpha');

  const aliasMismatch = resolveWorkerBodySlugContext({
    body: { sessionSlug: 'alpha', groupSlug: 'beta' },
  });
  assert.equal(aliasMismatch.ok, false);
  assert.equal(aliasMismatch.error, 'sessionSlug aliases do not match.');
  assert.equal(aliasMismatch.targetSlug, 'alpha');

  const ignoredLegacyGroupSlug = resolveWorkerBodySlugContext({
    body: { groupSlug: 'beta' },
    slugHint: 'general',
  });
  assert.equal(ignoredLegacyGroupSlug.ok, true);
  assert.equal(ignoredLegacyGroupSlug.targetSlug, '');
  assert.equal(ignoredLegacyGroupSlug.slugPayload.hasAnySlug, false);

  const generalHint = resolveWorkerBodySlugContext({
    body: {},
    slugHint: 'general',
  });
  assert.equal(generalHint.ok, true);
  assert.equal(generalHint.targetSlug, '');
  assert.equal(generalHint.explicitSlugProvided, true);

  const explicitGeneralBody = resolveWorkerBodySlugContext({
    body: { sessionSlug: 'general' },
  });
  assert.equal(explicitGeneralBody.ok, true);
  assert.equal(explicitGeneralBody.targetSlug, '');
  assert.equal(explicitGeneralBody.explicitSlugProvided, true);

  const debateEnv = resolveWorkerBodySlugContext({
    body: {},
    env: { DEFAULT_SESSION_SLUG: 'debate' },
  });
  assert.equal(debateEnv.ok, true);
  assert.equal(debateEnv.envSlug, 'rxc');
  assert.equal(debateEnv.targetSlug, 'rxc');
});

test('resolveWorkerRequestSlugContext preserves env, header, token, and hint precedence', () => {
  const fromEnv = resolveWorkerRequestSlugContext({
    env: { DEFAULT_SESSION_SLUG: 'alpha' },
    headerSlug: 'beta',
    tokenSlug: 'gamma',
    tokenHasSlug: true,
    slugHint: 'delta',
    countEmptyHeaderAsExplicit: true,
  });
  assert.equal(fromEnv.ok, true);
  assert.equal(fromEnv.slug, 'alpha');

  const fromHeader = resolveWorkerRequestSlugContext({
    headerSlug: 'beta',
    tokenSlug: 'gamma',
    tokenHasSlug: true,
    slugHint: 'delta',
  });
  assert.equal(fromHeader.ok, true);
  assert.equal(fromHeader.slug, 'beta');

  const fromToken = resolveWorkerRequestSlugContext({
    tokenSlug: 'gamma',
    tokenHasSlug: true,
    slugHint: 'delta',
  });
  assert.equal(fromToken.ok, true);
  assert.equal(fromToken.slug, 'gamma');

  const fromHint = resolveWorkerRequestSlugContext({
    slugHint: 'delta',
  });
  assert.equal(fromHint.ok, true);
  assert.equal(fromHint.slug, 'delta');
  assert.equal(fromHint.explicitSlugProvided, true);

  const generalHint = resolveWorkerRequestSlugContext({
    slugHint: 'general',
  });
  assert.equal(generalHint.ok, true);
  assert.equal(generalHint.slug, '');
  assert.equal(generalHint.explicitSlugProvided, true);

  const debateHint = resolveWorkerRequestSlugContext({
    slugHint: 'debate',
  });
  assert.equal(debateHint.ok, true);
  assert.equal(debateHint.slug, 'rxc');
  assert.equal(debateHint.explicitSlugProvided, true);
});

test('resolveWorkerRequestSlugContext preserves blank-header explicit handling differences', () => {
  const authStyle = resolveWorkerRequestSlugContext({
    headerSlug: ' ',
    countEmptyHeaderAsExplicit: true,
  });
  assert.equal(authStyle.ok, true);
  assert.equal(authStyle.slug, '');
  assert.equal(authStyle.explicitSlugProvided, true);

  const anonymousStyle = resolveWorkerRequestSlugContext({
    headerSlug: ' ',
    countEmptyHeaderAsExplicit: false,
  });
  assert.equal(anonymousStyle.ok, true);
  assert.equal(anonymousStyle.slug, '');
  assert.equal(anonymousStyle.explicitSlugProvided, false);
});
