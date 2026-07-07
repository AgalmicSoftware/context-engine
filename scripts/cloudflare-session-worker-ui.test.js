'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectWorkerEnvelopeModeUi,
} = require('./e2e/cloudflare/session-worker');

test('worker envelope UI helper honors the mode-entry continue gate', async () => {
  const calls = [];
  const page = {
    getByTestId(testId) {
      return {
        click: async () => {
          calls.push(['testId', testId]);
        },
      };
    },
    getByRole(role, options) {
      return {
        click: async () => {
          calls.push(['role', role, String(options?.name)]);
        },
      };
    },
  };

  await selectWorkerEnvelopeModeUi(page);

  assert.deepEqual(calls, [
    ['testId', 'ce-new-preset-fast_cheap_cloudflare'],
    ['role', 'button', '/Continue/i'],
    ['role', 'button', '/Advanced options/i'],
  ]);
});
