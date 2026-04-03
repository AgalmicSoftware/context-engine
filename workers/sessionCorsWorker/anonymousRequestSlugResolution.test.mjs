import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAnonymousRequestSlug } from './anonymousRequestSlugResolution.js';

test('resolveAnonymousRequestSlug prefers X-Session-Slug and preserves successful output shape', () => {
  let received = null;

  const result = resolveAnonymousRequestSlug({
    request: {
      headers: new Headers({
        'X-Session-Slug': 'session-header',
        'X-Group-Slug': 'legacy-header',
      }),
    },
    env: { DEFAULT_SESSION_SLUG: '' },
    slugHint: 'env-slug',
    deps: {
      resolveWorkerRequestSlugContext: (value) => {
        received = value;
        return {
          ok: true,
          slug: 'resolved-session',
          explicitSlugProvided: true,
        };
      },
    },
  });

  assert.deepEqual(received, {
    headerSlug: 'session-header',
    env: { DEFAULT_SESSION_SLUG: '' },
    slugHint: 'env-slug',
    countEmptyHeaderAsExplicit: false,
  });
  assert.deepEqual(result, {
    ok: true,
    slug: 'resolved-session',
    explicitSlugProvided: true,
  });
});

test('resolveAnonymousRequestSlug accepts legacy X-Group-Slug when X-Session-Slug is absent', () => {
  let received = null;

  resolveAnonymousRequestSlug({
    request: {
      headers: new Headers({
        'X-Group-Slug': 'legacy-header',
      }),
    },
    deps: {
      resolveWorkerRequestSlugContext: (value) => {
        received = value;
        return {
          ok: true,
          slug: 'legacy-header',
          explicitSlugProvided: true,
        };
      },
    },
  });

  assert.equal(received?.headerSlug, 'legacy-header');
  assert.equal(received?.countEmptyHeaderAsExplicit, false);
});

test('resolveAnonymousRequestSlug preserves missing-explicit success and error passthrough', () => {
  const missingExplicit = resolveAnonymousRequestSlug({
    request: {
      headers: new Headers(),
    },
    deps: {
      resolveWorkerRequestSlugContext: () => ({
        ok: true,
        slug: '',
        explicitSlugProvided: false,
      }),
    },
  });

  assert.deepEqual(missingExplicit, {
    ok: true,
    slug: '',
    explicitSlugProvided: false,
  });

  const failure = resolveAnonymousRequestSlug({
    request: {
      headers: new Headers({ 'X-Session-Slug': 'bad' }),
    },
    deps: {
      resolveWorkerRequestSlugContext: () => ({
        ok: false,
        error: 'Invalid session slug.',
      }),
    },
  });

  assert.deepEqual(failure, {
    ok: false,
    error: 'Invalid session slug.',
  });
});
