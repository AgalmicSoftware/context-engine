import test from 'node:test';
import assert from 'node:assert/strict';

import { createFetchHelpersWithWorkerDeps } from './fetchExecutionBinding.js';

test('createFetchHelpersWithWorkerDeps preserves the worker-specific fetch deps bundle', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const responses = {
    image: new Response('image'),
    url: new Response('html'),
  };

  const helpers = createFetchHelpersWithWorkerDeps({
    deps: {
      fetchImage: async (value) => {
        assert.deepEqual(value, {
          url: 'https://example.com/image.png',
          baseHeaders,
          deps: {
            json: 'json',
            normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
            safeFetch: 'safeFetch',
          },
        });
        return responses.image;
      },
      fetchUrl: async (value) => {
        assert.deepEqual(value, {
          url: 'https://example.com/page',
          baseHeaders,
          deps: {
            json: 'json',
            normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
            safeFetch: 'safeFetch',
          },
        });
        return responses.url;
      },
      json: 'json',
      normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
      safeFetch: 'safeFetch',
    },
  });

  assert.equal(
    await helpers.fetchImage('https://example.com/image.png', baseHeaders),
    responses.image
  );
  assert.equal(
    await helpers.fetchUrl('https://example.com/page', baseHeaders),
    responses.url
  );
});
