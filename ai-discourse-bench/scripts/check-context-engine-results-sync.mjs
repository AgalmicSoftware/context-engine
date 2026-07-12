import fs from 'node:fs/promises';

import { writeJsonFile } from '../src/io.mjs';
import {
  buildResultsSyncSnapshot,
  compareResultsSyncSnapshot,
  defaultSyncPaths,
} from '../src/results-sync.mjs';

const { contextEngineRoot, manifestPath } = defaultSyncPaths();
const write = process.argv.includes('--write');
const snapshot = await buildResultsSyncSnapshot(contextEngineRoot);

if (write) {
  await writeJsonFile(manifestPath, snapshot);
  console.log(`updated Context Engine Results sync snapshot at ${manifestPath}`);
  process.exit(0);
}

let expected;
try {
  expected = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
} catch (error) {
  if (error?.code === 'ENOENT') {
    throw new Error(`Results sync snapshot is missing. Run: node ./scripts/check-context-engine-results-sync.mjs --write`);
  }
  throw error;
}

const drift = compareResultsSyncSnapshot(expected, snapshot);
if (drift.length) {
  const lines = drift.map((entry) => `- ${entry.path}`).join('\n');
  throw new Error(`Context Engine Results sources changed since the standalone renderer was last synchronized:\n${lines}\nRun the ai-discourse-bench-results-sync skill before accepting a new snapshot.`);
}

console.log(`Context Engine Results sync check passed (${Object.keys(snapshot.files).length} source files)`);
