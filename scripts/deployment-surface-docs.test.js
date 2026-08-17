'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('deployment docs distinguish source, deploy templates, and release bundles', () => {
  const boundaryDoc = read('deploy/README.md');
  const structureDoc = read('docs/repo-structure.md');

  assert.match(boundaryDoc, /workers\/sessionCorsWorker\//);
  assert.match(boundaryDoc, /deploy\/cloudflare\/session-worker\//);
  assert.match(boundaryDoc, /dist\/sessionCorsWorker\.bundle\.js/);
  assert.match(boundaryDoc, /GitHub Worker-bundle releases/);
  assert.match(structureDoc, /`deploy\/` holds reviewed, installable deployment packages/);
});

test('session Worker docs keep immutable publication separate from latest promotion', () => {
  const workerDoc = read('docs/session-cors-worker.md');

  assert.match(workerDoc, /publish-worker-bundles\.yml[^\n]*publishes verified bundle/);
  assert.match(workerDoc, /promote-worker-bundles\.yml[^\n]*re-verifies/);
  assert.doesNotMatch(workerDoc, /publish-worker-bundles\.yml[^\n]*(?:marks|marked)[^\n]*latest/i);
});

test('session creation docs align mode-specific deployment inputs', () => {
  const creationDoc = read('docs/session-creation-guide.md');

  assert.match(
    creationDoc,
    /\| Cloudflare API token[^\n]*Agent Session Wrapped[^\n]*explicit legacy deploy-helper fallback[^\n]*not the native default/,
  );
  assert.match(creationDoc, /\| AI provider key[^\n]*every reachable `\/new` profile/);
  assert.match(creationDoc, /key for every provider used by the selected fast,\s+thinking,\s+and\s+transcription models/i);
  assert.doesNotMatch(creationDoc, /changes which single provider key is required/i);
});

test('session Worker docs define group authority, counts, and id compatibility', () => {
  const workerDoc = read('docs/session-cors-worker.md');

  assert.match(workerDoc, /complete active membership set[\s\S]*Durable Object/);
  assert.match(workerDoc, /principal indexes[\s\S]*cannot prove that the set is empty/);
  assert.match(workerDoc, /503 with reason `worker_group_projection_unavailable`/);
  assert.match(workerDoc, /`crypto\.randomUUID\(\)`/);
  assert.match(workerDoc, /`0x` plus 40 hexadecimal\s+characters/);
  assert.match(workerDoc, /legacy\s+address-shaped IDs remain readable/);
  assert.match(workerDoc, /Join returns the coordinator's post-mutation\s+`memberCount`/);
  assert.match(workerDoc, /session-visible leave[\s\S]*restricted leave/);
});

test('route docs preserve legacy address-shaped Worker group links', () => {
  let checkedDocuments = 0;
  for (const relativePath of ['CHANGELOG.md', 'docs/MainSite.MAP.md', 'docs/e2e-testid-api.md']) {
    if (!fs.existsSync(path.join(ROOT, relativePath))) continue;
    checkedDocuments += 1;
    const routeDoc = read(relativePath);
    assert.match(routeDoc, /non-address[\s\S]{0,160}Worker[\s\S]{0,160}`\/group\/<groupId>/i, relativePath);
    assert.match(
      routeDoc,
      /address-shaped[\s\S]{0,160}Worker[\s\S]{0,160}`\/groups\?sessionName=<slug>#group-<groupId>`/i,
      relativePath,
    );
  }
  assert.ok(checkedDocuments > 0, 'expected at least one public route document');
});

test('first-visit redirect configuration describes root-only eligibility', () => {
  const appConfig = read('client/src/variables/appConfig.ts');
  const flagContract = appConfig.match(
    /\/\/[^\n]*\nexport const CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED = readPublicBoolEnv\(/,
  )?.[0] || '';

  assert.match(flagContract, /initial normalized root document load/);
  assert.doesNotMatch(flagContract, /cached-session|session document/i);
});

test('chain-neutral deployment docs keep deployment separate from supported-chain policy', () => {
  const foundryDoc = read('foundry/script/README.md');
  const packageJson = JSON.parse(read('package.json'));

  assert.equal(packageJson.scripts['deploy:evm'], 'node scripts/deploy-evm.mjs');
  assert.match(foundryDoc, /npm run deploy:evm/);
  assert.match(foundryDoc, /does not update the client contract\s+manifest or make the target chain supported/i);
});
