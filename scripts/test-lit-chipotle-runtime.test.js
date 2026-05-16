'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeRequestBody,
  resolveLitChipotleRuntimeE2eConfig,
  runLitChipotleRuntimeSmokeTest,
} = require('./test-lit-chipotle-runtime.js');

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

test('resolveLitChipotleRuntimeE2eConfig derives the runtime smoke defaults', () => {
  const config = resolveLitChipotleRuntimeE2eConfig({
    env: {
      LIT_USAGE_API_KEY: 'lit-secret',
      LIT_GROUP_ID: 'group_123',
      LIT_PKP_ID: 'pkp_123',
      CHAIN_ID: '11155420',
      LIT_E2E_RUNTIME_ADDRESS: '0x00000000000000000000000000000000000000aa',
      LIT_E2E_SBT_ADDRESSES: '0x00000000000000000000000000000000000000bb',
    },
  });

  assert.equal(config.runtimeAddress, '0x00000000000000000000000000000000000000aa');
  assert.deepEqual(config.sbtAddresses, ['0x00000000000000000000000000000000000000bb']);
  assert.equal(config.gateChainId, 11155420);
  assert.equal(config.gateMode, 'any');
  assert.equal(config.autoProvision, false);
  assert.match(config.actionCode, /async function main/);
});

test('buildRuntimeRequestBody matches the authenticated Chipotle route contract', () => {
  const request = buildRuntimeRequestBody({
    config: {
      actionCode: 'async function main() {}',
      sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
      gateChainId: 11155420,
      gateMode: 'all',
      messageHex: '0x' + '11'.repeat(32),
    },
    op: 'encrypt',
  });

  assert.deepEqual(request, {
    action: 'lit_chipotle_execute',
    actionCode: 'async function main() {}',
    op: 'encrypt',
    sbtAddresses: ['0x00000000000000000000000000000000000000bb'],
    chainId: 11155420,
    gateMode: 'all',
    message: '0x' + '11'.repeat(32),
  });
});

test('runLitChipotleRuntimeSmokeTest bootstraps from only an account key and uses chain-default RPC fallback for the runtime path', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const normalizedUrl = String(url);
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    calls.push([normalizedUrl, options, body]);

    if (normalizedUrl.endsWith('/core/v1/billing/balance')) {
      return jsonResponse({ balance_display: '$5.00 credit' });
    }
    if (normalizedUrl.endsWith('/core/v1/get_lit_action_client_config')) {
      return jsonResponse({ timeout_ms: 30000 });
    }
    if (normalizedUrl.endsWith('/core/v1/add_group')) {
      return jsonResponse({ group_id: '7' });
    }
    if (normalizedUrl.endsWith('/core/v1/create_wallet')) {
      return jsonResponse({ wallet_address: '0xpkp123' });
    }
    if (normalizedUrl.endsWith('/core/v1/list_wallets?page_number=0&page_size=100')) {
      return jsonResponse([{ id: 'pkp_123', wallet_address: '0xpkp123' }]);
    }
    if (normalizedUrl.includes('/core/v1/list_wallets_in_group')) {
      return jsonResponse([{ id: 'pkp_123', wallet_address: '0xpkp' }]);
    }
    if (normalizedUrl.includes('/core/v1/list_actions')) {
      return jsonResponse([]);
    }
    if (normalizedUrl.endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse('QmAction123');
    }
    if (normalizedUrl.endsWith('/core/v1/add_action')) {
      return jsonResponse({ ok: true });
    }
    if (normalizedUrl.endsWith('/core/v1/add_action_to_group')) {
      return jsonResponse({ ok: true });
    }
    if (normalizedUrl.endsWith('/core/v1/add_pkp_to_group')) {
      return jsonResponse({ ok: true });
    }
    if (normalizedUrl.endsWith('/core/v1/add_usage_api_key')) {
      return jsonResponse({ usage_api_key: 'usage-key' });
    }
    if (normalizedUrl.endsWith('/core/v1/lit_action')) {
      if (body?.js_params?.op === 'check') {
        assert.equal(body?.js_params?.rpcUrl, 'https://op-sepolia-testnet.api.pocket.network/');
        return jsonResponse({
          has_error: false,
          response: {
            ok: true,
            allowed: true,
            op: 'check',
            gate: { allowed: true },
          },
        });
      }
      if (body?.js_params?.op === 'encrypt') {
        assert.equal(body?.js_params?.rpcUrl, undefined);
        return jsonResponse({
          has_error: false,
          response: {
            ok: true,
            allowed: true,
            op: 'encrypt',
            ciphertext: 'wrapped-cek',
          },
        });
      }
      if (body?.js_params?.op === 'decrypt') {
        assert.equal(body?.js_params?.rpcUrl, 'https://op-sepolia-testnet.api.pocket.network/');
        return jsonResponse({
          has_error: false,
          response: {
            ok: true,
            allowed: true,
            op: 'decrypt',
            plaintext: body?.js_params?.ciphertext === 'wrapped-cek'
              ? '0x' + '11'.repeat(32)
              : '',
          },
        });
      }
    }

    throw new Error(`Unexpected URL: ${normalizedUrl}`);
  };

  const report = await runLitChipotleRuntimeSmokeTest({
    env: {
      LIT_ACCOUNT_API_KEY: 'account-secret',
      LIT_API_BASE: 'https://api.chipotle.litprotocol.com',
      CHAIN_ID: '11155420',
      LIT_E2E_RUNTIME_ADDRESS: '0x00000000000000000000000000000000000000aa',
      LIT_E2E_SBT_ADDRESSES: '0x00000000000000000000000000000000000000bb',
      AI_RUN_TAG: 'chipotle-runtime-test',
      SESSION_SLUG: 'chipotle-runtime-smoke',
    },
    fetchImpl,
    persistArtifacts: false,
  });

  assert.equal(report.ok, true);
  assert.equal(report.setConfig.ok, true);
  assert.equal(report.setSecrets.ok, true);
  assert.equal(report.statusCheck.ok, true);
  assert.equal(report.bootstrap.ok, true);
  assert.equal(report.provision.ok, true);
  assert.equal(report.runtimeCheck.ok, true);
  assert.equal(report.runtimeEncrypt.ok, true);
  assert.equal(report.runtimeDecrypt.ok, true);
  assert.equal(report.results.litGroupId, '7');
  assert.equal(report.results.litPkpId, 'pkp_123');
  assert.equal(report.results.litActionCid, 'QmAction123');
  assert.equal(report.results.plaintext, '0x' + '11'.repeat(32));
  assert.equal(
    calls.some(([url]) => url.endsWith('/core/v1/add_group')),
    true,
  );
  assert.equal(
    calls.some(([url, _options, body]) => url.endsWith('/core/v1/lit_action') && body?.js_params?.op === 'encrypt'),
    true,
  );
  assert.equal(
    calls.some(([url, _options, body]) => url.endsWith('/core/v1/lit_action') && body?.js_params?.op === 'decrypt'),
    true,
  );
});
