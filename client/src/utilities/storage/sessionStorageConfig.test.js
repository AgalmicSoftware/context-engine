import {
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  normalizeSessionStorageConfig,
  requiresLitForSessionStorage,
  resolveSessionStorageBackend,
  usesCloudflareSessionStorage,
  usesPublicReadCloudflareStorage,
  usesWorkerSbtGateCloudflareStorage,
} from './sessionStorageConfig.js';
import { STORAGE_BACKENDS } from './storageRefs.js';

describe('sessionStorageConfig', () => {
  test('defaults to Arweave for sessions without storage config', () => {
    expect(resolveSessionStorageBackend(null)).toBe(STORAGE_BACKENDS.ARWEAVE);
    expect(normalizeSessionStorageConfig({}).resources.docsContext).toBe('active');
  });

  test('keeps lit-arweave available and selected for encrypted document payloads', () => {
    expect(resolveSessionStorageBackend({}, { encrypted: true })).toBe(STORAGE_BACKENDS.LIT_ARWEAVE);
    expect(resolveSessionStorageBackend({ storageProfile: { backend: 'lit-arweave' } })).toBe(
      STORAGE_BACKENDS.LIT_ARWEAVE,
    );
    expect(requiresLitForSessionStorage({ storageProfile: { backend: 'lit-arweave' } })).toBe(true);
  });

  test('routes explicit Cloudflare session storage through worker storage endpoints', () => {
    const sessionConfig = { storageProfile: { backend: 'cloudflare' } };
    expect(resolveSessionStorageBackend(sessionConfig)).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'questions' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'surveys' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'responses' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(usesCloudflareSessionStorage(sessionConfig)).toBe(true);
    expect(usesWorkerSbtGateCloudflareStorage(sessionConfig)).toBe(true);
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode).toBe(
      SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
    );
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl).toEqual({
      gate: SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE,
      encryption: SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.NONE,
      mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
    });
    expect(requiresLitForSessionStorage(sessionConfig, { encrypted: true })).toBe(false);
  });

  test('marks Cloudflare lit_encrypted mode as Lit-required while retaining Cloudflare routing', () => {
    const sessionConfig = {
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { mode: 'lit_encrypted' },
      },
    };
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'responses' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(requiresLitForSessionStorage(sessionConfig, { resource: 'responses' })).toBe(true);
    expect(usesWorkerSbtGateCloudflareStorage(sessionConfig)).toBe(false);
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode).toBe(
      SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED,
    );
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.encryption).toBe(
      SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT,
    );
  });

  test('marks Cloudflare public_read mode as non-Lit and non-SBT-gated', () => {
    const sessionConfig = {
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { mode: 'public_read' },
      },
    };
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'questions' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(requiresLitForSessionStorage(sessionConfig, { resource: 'questions' })).toBe(false);
    expect(usesWorkerSbtGateCloudflareStorage(sessionConfig)).toBe(false);
    expect(usesPublicReadCloudflareStorage(sessionConfig)).toBe(true);
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.mode).toBe(
      SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ,
    );
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl.gate).toBe(
      SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE,
    );
  });

  test('normalizes v2 worker_envelope access without requiring Lit', () => {
    const accessConditions = {
      match: 'any',
      conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
    };
    const sessionConfig = {
      storageProfile: {
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope', accessConditions },
      },
    };
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'responses' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
    expect(requiresLitForSessionStorage(sessionConfig, { resource: 'responses' })).toBe(false);
    expect(usesWorkerSbtGateCloudflareStorage(sessionConfig)).toBe(true);
    expect(normalizeSessionStorageConfig(sessionConfig).payloadAccessControl).toEqual({
      gate: SESSION_STORAGE_PAYLOAD_ACCESS_GATES.SBT_GATE,
      encryption: SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE,
      mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
      accessConditions,
    });
  });

  test('keeps explicitly staged Cloudflare resources on legacy Arweave fallback', () => {
    const sessionConfig = {
      storageProfile: {
        backend: 'cloudflare',
        resources: { questions: 'staged' },
      },
    };
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'questions' })).toBe(STORAGE_BACKENDS.ARWEAVE);
    expect(resolveSessionStorageBackend(sessionConfig, { resource: 'responses' })).toBe(STORAGE_BACKENDS.CLOUDFLARE);
  });
});
