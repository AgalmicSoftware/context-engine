'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const readIfPresent = (relativePath) => (
  fs.existsSync(path.join(ROOT, relativePath)) ? read(relativePath) : null
);

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

test('canonical docs keep native Hosted deployment separate from token-based fallbacks', () => {
  const readme = read('README.md');
  const architecture = read('ARCHITECTURE.md');
  const overview = read('docs/architecture-overview.md');
  const spec = read('spec.md');

  assert.match(readme, /Native setup uses a Cloudflare account\/dashboard login[\s\S]{0,160}does not ask for a Cloudflare API token/);
  assert.doesNotMatch(readme, /default Cloudflare profile needs only a Cloudflare deploy token/i);
  assert.match(architecture, /Native Deploy to Cloudflare[\s\S]{0,80}no API token/);
  assert.match(architecture, /Legacy deploy-helper \/ Agent Wrapped[\s\S]{0,100}request-only Cloudflare token/);
  assert.match(overview, /native Deploy to Cloudflare template[\s\S]{0,100}no API token/);
  assert.match(overview, /default `\/new` path[\s\S]{0,160}without requesting an API token/);
  assert.match(spec, /explicit legacy Session[\s\S]{0,160}default Hosted & Fast path uses the native Cloudflare dashboard handoff/);
});

test('profile docs use the current wizard labels', () => {
  const runModes = read('docs/run-modes.md');
  const workerDoc = read('docs/session-cors-worker.md');
  const e2eCadence = readIfPresent('docs/e2e-cadence.md');

  assert.match(runModes, /Hosted & Fast[\s\S]*`Centralized \(Cloudflare\)`/);
  assert.match(runModes, /Trustless & Slower[\s\S]*`Decentralized \(Arweave \+ EVM\)`/);
  assert.match(workerDoc, /Hosted & Fast[\s\S]{0,100}`Centralized \(Cloudflare\)`/);
  if (e2eCadence) {
    assert.match(e2eCadence, /Hosted & Fast profile \(`Centralized \(Cloudflare\)`/);
  }

  for (const [relativePath, source] of [
    ['docs/run-modes.md', runModes],
    ['docs/session-cors-worker.md', workerDoc],
    ...(e2eCadence ? [['docs/e2e-cadence.md', e2eCadence]] : []),
  ]) {
    assert.doesNotMatch(source, /Fast & Private \(Cloudflare\)|Trustless & Public \(Decentralized\)/, relativePath);
  }
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

test('architecture docs inventory Agent Bridge and encrypted-envelope export boundaries', () => {
  const overview = read('docs/architecture-overview.md');
  const spec = read('spec.md');

  for (const [relativePath, source] of [
    ['docs/architecture-overview.md', overview],
    ['spec.md', spec],
  ]) {
    assert.match(source, /workers\/agentBridgeWorker\//, relativePath);
    assert.match(source, /workers\/shared\//, relativePath);
    assert.match(source, /\/storage\/export-envelopes/, relativePath);
  }

  assert.match(spec, /\/api\/agent\/\*/);
  assert.match(spec, /\/telegram\/webhook/);
  assert.match(spec, /\/admin\/abuse-summary/);
  assert.match(overview, /AgentBridge -.->\|policy-enabled direct submit\| Contracts/);
  assert.match(overview, /Surveys contract[\s\S]{0,120}remain canonical/);
});

test('public Agent Bridge docs keep the current storage-profile split', () => {
  const bridgeReadme = read('workers/agentBridgeWorker/README.md');

  assert.match(bridgeReadme, /workers\/agentBridgeWorker\//);
  assert.match(bridgeReadme, /separate from `workers\/sessionCorsWorker\//);
  assert.match(bridgeReadme, /ships as part of the public\s+worker surface/);
  assert.match(bridgeReadme, /Hosted &\s+Fast[\s\S]{0,180}default\/recommended[\s\S]{0,180}Cloudflare/i);
  assert.match(bridgeReadme, /Trustless &\s+Slower[\s\S]{0,180}Arweave/i);
  assert.match(bridgeReadme, /legacy\/custom drafts[\s\S]{0,180}Arweave\s+fallback/i);
  assert.doesNotMatch(bridgeReadme, /\barweave\b[^\n]{0,80}\b(?:is|remains)\b[^\n]{0,30}\bdefault\b/i);
});

test('architecture docs distinguish Base support policy from active manifest state', () => {
  const overview = read('docs/architecture-overview.md');
  const architecture = read('ARCHITECTURE.md');
  const agentGuide = readIfPresent('AGENTS.md');

  for (const [relativePath, source] of [
    ['docs/architecture-overview.md', overview],
    ['ARCHITECTURE.md', architecture],
    ...(agentGuide ? [['AGENTS.md', agentGuide]] : []),
  ]) {
    assert.match(source, /Base\s+Sepolia[\s\S]{0,180}best-effort/i, relativePath);
    assert.match(source, /Base\s+Sepolia[\s\S]{0,240}not\s+an\s+actively\s+supported/i, relativePath);
    assert.match(source, /canonical[^\n]*manifest|manifest[^\n]*canonical/i, relativePath);
  }

  assert.match(architecture, /## Contract Addresses[\s\S]*OP Sepolia \(11155420\)/);
  assert.match(architecture, /### Historical Base Sepolia Record/);
  assert.match(architecture, /maps each configured chain ID/);
  assert.doesNotMatch(architecture, /^\| Base Sepolia \(84532\) \|/m);
});

test('session publication docs keep Worker-canonical and chain-backed effects separate', () => {
  const architecture = read('ARCHITECTURE.md');
  const spec = read('spec.md');
  const wizardMap = readIfPresent('docs/SessionWizard.MAP.md');
  const publishFlow = wizardMap?.match(/### Publish flow[\s\S]*?```text([\s\S]*?)```/)?.[1] || '';
  const publishFlowLines = publishFlow.split('\n');
  const registryRefreshLine = publishFlowLines.find((line) => line.includes('registry refresh')) || '';
  const hostedSettlementLine = publishFlowLines.find((line) => line.includes('Hosted & Fast success')) || '';

  assert.match(architecture, /No Arweave upload, registry write, RPC call, gas payment, or EVM transaction/);
  assert.match(spec, /Hosted & Fast publishes canonical Worker config without EVM\/Arweave/);
  assert.match(spec, /Worker-canonical Cloudflare storage[\s\S]{0,240}does not infer plaintext/);
  assert.doesNotMatch(spec, /Worker-canonical sessions use Worker authority:[\s\S]{0,160}default to plaintext/);
  if (wizardMap) {
    assert.match(wizardMap, /Hosted & Fast completes against canonical\s+Worker state without Arweave or EVM/);
    assert.match(wizardMap, /when the profile requires EVM registration/);
    assert.match(registryRefreshLine, /chain-backed success/);
    assert.match(hostedSettlementLine, /without the registry publish adapter/);
    assert.match(wizardMap, /Feeds profile-selected Worker config persistence or Arweave metadata\/EVM registration/);
    assert.match(wizardMap, /selected default\/recommended Hosted profile compiles to Cloudflare/);
    assert.match(wizardMap, /pending on-chain SBT metadata\/deploy\/finalize, independent of the session authority profile/);
    assert.match(wizardMap, /deferred draft held in tab memory[\s\S]{0,120}does not survive reload/);
  }
});
