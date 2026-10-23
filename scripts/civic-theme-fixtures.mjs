import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const sessions = JSON.parse(readFileSync(new URL('../client/src/variables/demo/demo_sessions.json', import.meta.url)));
const registry = new ethers.utils.Interface(
  JSON.parse(readFileSync(new URL('../client/src/contractsABI/SESSION_REGISTRY_ABI.json', import.meta.url))),
);
const rpcChainIds = new Map([
  ['https://sepolia.optimism.io', '0xaa37dc'],
  ['https://eth.api.pocket.network', '0x1'],
  ['http://127.0.0.1:8545', '0x7a69'],
]);

export const CIVIC_FIXTURE_GROUP_LABEL = 'Civic reviewers';

// Demo-2's checked-in questions still wait for its registry identity to settle.
// Provide that identity and a response gate for the audience-details overlay;
// no chain or provider data is fetched.
function civicRpcResponse(call, chainId) {
  try {
    let result;
    if (call.method === 'eth_chainId') result = chainId;
    else if (call.method === 'eth_blockNumber') result = '0x1';
    else if (call.method === 'eth_getLogs') result = [];
    else if (call.method === 'eth_call') {
      const read = registry.parseTransaction({ data: call.params[0].data });
      if (read.args.length && read.args[0] !== 'demo-2') throw new Error('Unknown fixture session');
      const values = {
        getSessionBySlug: ['demo-2', 11155420, '', '', ethers.constants.AddressZero, 1, 1, `0x${'2'.repeat(32)}`],
        getResourceGate: [
          read.args[1] === 'questionResponses' ? ['0x00000000000000000000000000000000000000a2'] : [],
          11155420,
          0,
          1,
        ],
        getSessionFields: [Array.isArray(read.args[1]) ? read.args[1].map(() => '') : []],
        getSessionField: [''],
        getSessionCount: [0],
        sessionExists: [true],
      }[read.name];
      if (!values) throw new Error(`Unsupported fixture registry read: ${read.name}`);
      result = registry.encodeFunctionResult(read.name, values);
    } else throw new Error(`Unsupported fixture RPC method: ${call.method}`);
    return { jsonrpc: '2.0', id: call.id, result };
  } catch (error) {
    return { jsonrpc: '2.0', id: call.id, error: { code: -32000, message: error.message } };
  }
}

// A fresh browser has no Stats data. Supply public reads at the Worker boundary
// so contrast/navigation checks exercise populated UI without a deployed session.
export async function installCivicThemeFixtures(context, baseUrl) {
  const localOrigin = new URL(baseUrl).origin;
  assert(
    ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname),
    'Civic fixtures require a local Vite server',
  );
  const config = {
    ...sessions['demo-sh'],
    corsWorkerUrl: 'https://civic-worker.example.test',
    sessionName: 'Civic smoke session',
  };
  const creator = '0x00000000000000000000000000000000000000a1';
  const question = {
    id: `0x${'1'.repeat(64)}`,
    prompt: 'Which civic service should improve?',
    type: 'binary',
    creator,
    sessionSlug: config.slug,
    sessionId: config.sessionId,
  };
  const survey = {
    id: `0x${'2'.repeat(64)}`,
    surveyID: `0x${'2'.repeat(64)}`,
    title: 'Civic smoke survey',
    questionIDs: [question.id],
    creator,
    sessionSlug: config.slug,
    sessionId: config.sessionId,
  };
  const group = {
    groupId: 'civic-reviewers',
    label: CIVIC_FIXTURE_GROUP_LABEL,
    sessionSlug: config.slug,
    joinMode: 'open',
    memberVisibility: 'session',
  };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === localOrigin) return route.continue();
    if (rpcChainIds.has(url.origin)) {
      const payload = route.request().postDataJSON();
      if (!payload) return route.abort();
      const respond = (call) => civicRpcResponse(call, rpcChainIds.get(url.origin));
      return route.fulfill({ json: Array.isArray(payload) ? payload.map(respond) : respond(payload) });
    }
    if (url.origin !== new URL(config.corsWorkerUrl).origin) return route.abort();
    assert.equal(route.request().method(), 'GET', 'Civic smoke only reads fixture Worker data');
    if (url.pathname === '/session-config') {
      return route.fulfill({ json: { ok: true, sessionSlug: config.slug, sessionId: config.sessionId, config } });
    }
    if (url.pathname === '/storage/list') {
      const resource = url.searchParams.get('resource');
      const items = resource === 'questions' ? [question] : resource === 'surveys' ? [survey] : [];
      return route.fulfill({
        json: {
          items: items.map((item) => ({
            storageRef: { backend: 'cloudflare', id: item.id, resource },
            metadata: { createdAt: '2026-10-01T00:00:00.000Z', resource },
          })),
          listComplete: true,
          cursor: null,
        },
      });
    }
    if (url.pathname === '/storage/read') {
      const item = [question, survey].find((item) => item.id === url.searchParams.get('id'));
      return route.fulfill({ status: item ? 200 : 404, json: item || {} });
    }
    if (url.pathname === '/groups/list') {
      return route.fulfill({
        json: { ok: true, sessionId: config.sessionId, sessionSlug: config.slug, groups: [group] },
      });
    }
    if (url.pathname === '/resource-presence') {
      return route.fulfill({ json: { resources: { ai: false, arweave: false, rpc: false, txGas: false } } });
    }
    return route.fulfill({ status: 404, json: { error: 'unknown_civic_fixture_read' } });
  });
  // Retain the checked-in demo-2 question/report preview; isolate the session
  // catalog from live discovery while testing the real selector and cache paths.
  await context.route('**/src/variables/demo/demo_sessions.json?import*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export default ${JSON.stringify({ general: sessions.general, 'demo-sh': config, 'demo-2': sessions['demo-2'] })};`,
    }),
  );
  await context.addInitScript(() => {
    if (!localStorage.getItem('ce:primarySessionSlug')) {
      localStorage.setItem('ce:primarySessionSlug', 'demo-sh');
      localStorage.setItem('ce:selectedSessionScope', 'active');
    }
  });
}
