import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const runtime = read('./telegramAgentHandoff.mjs').match(/DEFAULT_AGENT_SKILL_URL = '[^']*\?v=(\d+)'/)[1];

test('skill install links match the runtime skill version', () => {
  const files = [
    './skills/ce-telegram-agent-handoff/SKILL.md',
    './skills/ce-telegram-bot-reference/SKILL.md',
    './docs/context-engine-geo-node.md',
    './telegramCommands.mjs',
  ];
  const stale = [];
  for (const file of files) {
    for (const match of read(file).matchAll(/\/api\/agent\/skill\?v=(\d+)/g)) {
      if (match[1] !== runtime) stale.push(`${file}: ?v=${match[1]} (runtime ?v=${runtime})`);
    }
  }
  assert.deepEqual(stale, []);
});
