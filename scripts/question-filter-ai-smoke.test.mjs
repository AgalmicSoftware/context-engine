import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectWorkerAiFilter } from './question-filter-ai-smoke.mjs';

// Playwright's locator.waitFor takes only these options and ignores any other
// key, so a misspelled timeout silently falls back to the default.
const WAIT_FOR_OPTIONS = new Set(['state', 'timeout']);

test('the Worker AI filter smoke passes only options that waitFor supports', async () => {
  const waits = [];
  const locator = {
    getByRole: () => locator,
    getByTestId: () => locator,
    getByText: () => locator,
    isVisible: async () => true,
    isEnabled: async () => true,
    fill: async () => {},
    click: async () => {},
    waitFor: async (options = {}) => {
      waits.push(options);
    },
  };

  await inspectWorkerAiFilter(locator);

  assert(waits.length > 0, 'The smoke waits for the AI result and the closed dialog');
  for (const options of waits) {
    assert.deepEqual(
      Object.keys(options).filter((key) => !WAIT_FOR_OPTIONS.has(key)),
      [],
      `Unsupported waitFor options: ${JSON.stringify(options)}`,
    );
  }
});
