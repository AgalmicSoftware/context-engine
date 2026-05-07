#!/usr/bin/env node
// Renders the CE statusline from /api/hook/question stats or CLI args.
// Usage: node render.mjs [wallet] [answered] [total] [cooldownMs]
// Or pipe hook JSON to stdin.

import { readFileSync } from 'fs';
import { renderStatusLine } from './statusline.mjs';

const wallet = process.argv[2] || '';
const answered = Number(process.argv[3] || 0);
const total = Number(process.argv[4] || 0);
const cooldownMs = Number(process.argv[5] || 600000);

process.stdout.write(renderStatusLine({
  hasToken: true,
  wallet,
  serverUrl: 'http://localhost:7391',
  config: { serverUrl: 'http://localhost:7391', selectedSessions: ['test-10'], cooldownMs },
  totals: { sessions: 1, pending: 0, answered, total },
  cooldown: { active: cooldownMs > 0, remainingMs: cooldownMs, totalMs: cooldownMs },
}) + '\n');
