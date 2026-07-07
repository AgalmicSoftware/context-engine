'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isRetryableWorkerLoginFailure,
  isRetryableWorkerReadinessFailure,
} = require('./e2e/cloudflare/worker-login-result');

const cloudflareWorkersPageNotFound = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Page not found</title>
      <link rel="icon" href="https://workers.cloudflare.com/favicon.ico">
    </head>
    <body>There is nothing here yet</body>
  </html>
`;

test('Cloudflare workers.dev page-not-found is a retryable readiness failure', () => {
  const result = {
    status: 404,
    data: { raw: cloudflareWorkersPageNotFound },
  };

  assert.equal(isRetryableWorkerReadinessFailure(result), true);
  assert.equal(isRetryableWorkerLoginFailure(result), true);
});

test('generic application 404s are not retryable worker readiness failures', () => {
  const result = {
    status: 404,
    data: { error: 'Not found.' },
  };

  assert.equal(isRetryableWorkerReadinessFailure(result), false);
  assert.equal(isRetryableWorkerLoginFailure(result), false);
});
