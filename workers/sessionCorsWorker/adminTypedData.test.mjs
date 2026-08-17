import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import * as workerEthersModule from 'ethers';

import {
  ADMIN_ACTION_AUTH_FIELDS as CLIENT_AUTH_FIELDS,
  ADMIN_ACTION_DOMAIN as CLIENT_DOMAIN,
  ADMIN_ACTION_TYPES as CLIENT_TYPES,
  buildAdminActionBodyHash as buildClientBodyHash,
  buildAdminActionTypedData as buildClientTypedData,
  stripAdminActionAuthFields as stripClientAuthFields,
} from '../../client/src/utilities/worker/adminTypedData.mjs';
import { verifyAdminActionSignature } from './adminRequestAuthority.js';
import {
  ADMIN_ACTION_AUTH_FIELDS as WORKER_AUTH_FIELDS,
  ADMIN_ACTION_DOMAIN as WORKER_DOMAIN,
  ADMIN_ACTION_TYPES as WORKER_TYPES,
  buildAdminActionBodyHash as buildWorkerBodyHash,
  buildAdminActionTypedData as buildWorkerTypedData,
  stripAdminActionAuthFields as stripWorkerAuthFields,
} from './adminTypedData.mjs';

const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const clientEthersModule = clientRequire('ethers');
const clientEthers = clientEthersModule?.ethers || clientEthersModule;
const workerEthers = workerEthersModule?.ethers || workerEthersModule;

const EXPECTED_DOMAIN = Object.freeze({
  name: 'ContextEngineAdmin',
  version: '1',
});

const EXPECTED_TYPES = Object.freeze({
  AdminAction: [
    { name: 'action', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'bodyHash', type: 'bytes32' },
    { name: 'nonce', type: 'string' },
    { name: 'audience', type: 'string' },
    { name: 'expiration', type: 'uint256' },
  ],
});

const EXPECTED_AUTH_FIELDS = Object.freeze([
  'address',
  'signature',
  'action',
  'slug',
  'bodyHash',
  'nonce',
  'audience',
  'expiration',
]);

test('client v5 and Worker v6 admin typed-data twins share constants and build semantics', () => {
  assert.deepEqual(CLIENT_DOMAIN, EXPECTED_DOMAIN);
  assert.deepEqual(WORKER_DOMAIN, EXPECTED_DOMAIN);
  assert.deepEqual(CLIENT_TYPES, EXPECTED_TYPES);
  assert.deepEqual(WORKER_TYPES, EXPECTED_TYPES);
  assert.deepEqual(CLIENT_AUTH_FIELDS, EXPECTED_AUTH_FIELDS);
  assert.deepEqual(WORKER_AUTH_FIELDS, EXPECTED_AUTH_FIELDS);

  const params = {
    action: ' set-config ',
    slug: ' cross-runtime ',
    bodyHash: ` 0x${'ab'.repeat(32)} `,
    nonce: ' nonce-1 ',
    audience: ' https://contextengine.xyz ',
    expiration: '2000000000',
  };
  const expectedTypedData = {
    domain: EXPECTED_DOMAIN,
    primaryType: 'AdminAction',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
      ],
      ...EXPECTED_TYPES,
    },
    message: {
      action: 'set-config',
      slug: 'cross-runtime',
      bodyHash: `0x${'ab'.repeat(32)}`,
      nonce: 'nonce-1',
      audience: 'https://contextengine.xyz',
      expiration: 2_000_000_000,
    },
  };
  assert.deepEqual(buildClientTypedData(params), expectedTypedData);
  assert.deepEqual(buildWorkerTypedData(params), expectedTypedData);
  assert.equal(buildClientTypedData({ ...params, expiration: 'invalid' }).message.expiration, 0);
  assert.equal(buildWorkerTypedData({ ...params, expiration: 'invalid' }).message.expiration, 0);
});

test('client v5 and Worker v6 admin typed-data twins strip and hash the same body bytes', () => {
  const body = {
    address: '0x0000000000000000000000000000000000000001',
    signature: '0xsig',
    action: 'set-config',
    slug: 'cross-runtime',
    bodyHash: '0xold',
    nonce: 'nonce-1',
    audience: 'https://contextengine.xyz',
    expiration: 2_000_000_000,
    config: { allowOrigins: ['https://contextengine.xyz'] },
    keep: true,
  };
  const unsignedBody = {
    config: { allowOrigins: ['https://contextengine.xyz'] },
    keep: true,
  };
  const expectedHash = workerEthers.keccak256(
    workerEthers.toUtf8Bytes(JSON.stringify(unsignedBody)),
  );

  assert.deepEqual(stripClientAuthFields(body), unsignedBody);
  assert.deepEqual(stripWorkerAuthFields(body), unsignedBody);
  assert.equal(buildClientBodyHash(body), expectedHash);
  assert.equal(buildWorkerBodyHash(body), expectedHash);
});

test('an ethers-v5 client signature verifies in the ethers-v6 Worker and rejects invalid expiration', async () => {
  assert.match(String(clientEthers.version), /^(?:ethers\/)?5\./);
  assert.match(String(workerEthers.version), /^6\./);
  const wallet = clientEthers.Wallet.createRandom();
  const bodyHash = buildClientBodyHash({ config: { allowOrigins: ['https://contextengine.xyz'] } });
  const params = {
    action: 'set-config',
    slug: 'cross-runtime',
    bodyHash,
    nonce: 'nonce-1',
    audience: 'https://contextengine.xyz',
    expiration: 2_000_000_000,
  };
  const typedData = buildClientTypedData(params);
  const signature = await wallet._signTypedData(typedData.domain, CLIENT_TYPES, typedData.message);

  const verified = verifyAdminActionSignature({
    ...params,
    signature,
    expectedAddress: wallet.address,
    deps: { now: () => 1_900_000_000 },
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.address.toLowerCase(), wallet.address.toLowerCase());

  const invalidParams = { ...params, expiration: 'invalid' };
  const invalidTypedData = buildClientTypedData(invalidParams);
  const invalidSignature = await wallet._signTypedData(
    invalidTypedData.domain,
    CLIENT_TYPES,
    invalidTypedData.message,
  );
  assert.deepEqual(verifyAdminActionSignature({
    ...invalidParams,
    signature: invalidSignature,
    expectedAddress: wallet.address,
    deps: { now: () => 1_900_000_000 },
  }), {
    valid: false,
    error: 'Invalid admin action expiration.',
  });
});
