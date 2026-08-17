import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeWorkerConfigRecords,
  mergeWorkerLimitRecords,
  normalizeWorkerAllowOrigins,
  normalizeWorkerConfigRecord,
} from './sessionConfigNormalization.js';

test('normalizeWorkerAllowOrigins splits legacy string values and dedupes entries', () => {
  assert.deepEqual(
    normalizeWorkerAllowOrigins([
      ' https://app.example,\nhttps://other.example ',
      'https://app.example',
      '',
    ]),
    ['https://app.example', 'https://other.example']
  );
});

test('normalizeWorkerConfigRecord trims nested strings and keeps route slug authoritative when slug exists', () => {
  const normalized = normalizeWorkerConfigRecord({
    slug: ' wrong slug ',
    sessionName: ' Worker Session ',
    allowOrigins: ' https://app.example,\nhttps://other.example ',
    limits: { perWalletPerDay: ' 3 ' },
    scopes: { ai: true },
    rpcUrlsByChainId: {
      84532: ' https://rpc.one, https://rpc.two ',
    },
  }, { slug: 'debate' });

  assert.deepEqual(normalized, {
    slug: 'rxc',
    sessionName: 'Worker Session',
    allowOrigins: ['https://app.example', 'https://other.example'],
    limits: { perWalletPerDay: '3' },
    scopes: { ai: true },
    rpcUrlsByChainId: {
      84532: ['https://rpc.one', 'https://rpc.two'],
    },
  });
});

test('mergeWorkerConfigRecords preserves existing limits/scopes when incoming branches are malformed', () => {
  const merged = mergeWorkerConfigRecords({
    slug: 'target-session',
    existingConfig: {
      slug: 'legacy-session',
      sessionName: 'Existing Session',
      allowOrigins: ['https://allowed.example'],
      limits: { perWalletPerDay: 3 },
      scopes: { ai: true },
    },
    incomingConfig: {
      slug: 'attacker-session',
      sessionName: 'Updated Session',
      allowOrigins: 'https://next.example',
      limits: 'bad-limits',
      scopes: 'bad-scopes',
    },
  });

  assert.deepEqual(merged, {
    slug: 'target-session',
    sessionName: 'Updated Session',
    allowOrigins: ['https://next.example'],
    limits: { perWalletPerDay: 3 },
    scopes: { ai: true },
  });
});

test('mergeWorkerLimitRecords updates only the limits branch', () => {
  const merged = mergeWorkerLimitRecords({
    slug: 'alpha',
    existingConfig: {
      sessionName: 'Existing Session',
      limits: { perWalletPerDay: 3 },
      scopes: { ai: true },
    },
    incomingLimits: {
      perIpPerHour: 8,
    },
  });

  assert.deepEqual(merged, {
    sessionName: 'Existing Session',
    limits: {
      perWalletPerDay: 3,
      perIpPerHour: 8,
    },
    scopes: { ai: true },
  });
});

test('normalizeWorkerConfigRecord preserves the canonical embedded deploy-helper toggle', () => {
  const normalized = normalizeWorkerConfigRecord({
    sessionName: 'Alpha',
    embeddedDeployHelperEnabled: false,
    deployHelperEnabled: true,
  }, { slug: 'alpha' });

  assert.deepEqual(normalized, {
    sessionName: 'Alpha',
    embeddedDeployHelperEnabled: false,
  });
});

test('normalizeWorkerConfigRecord keeps only an allowlisted exact appearance shape', () => {
  assert.deepEqual(
    normalizeWorkerConfigRecord({ appearance: { colorSchemeId: ' AMBER ' } }, { slug: 'alpha' }),
    { appearance: { colorSchemeId: 'amber' } },
  );
  assert.deepEqual(
    normalizeWorkerConfigRecord(
      { appearance: { colorSchemeId: 'ocean', stylesheet: 'https://example.invalid/theme.css' } },
      { slug: 'alpha' },
    ),
    {},
  );
});
