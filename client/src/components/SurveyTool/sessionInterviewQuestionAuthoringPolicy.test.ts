import {
  resolveSuggestedQuestionAuthoringState,
  shouldHideSuggestedQuestionSection,
} from './sessionInterviewQuestionAuthoringPolicy';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';

const ACCOUNT = '0x0000000000000000000000000000000000000001';
const ADMIN = '0x00000000000000000000000000000000000000aa';
const SESSION_ID = `0x${'1'.repeat(32)}`;
const WORKER_URL = 'https://session-worker.example.test';

const buildWorkerProfile = (storageProfile?: Record<string, unknown>): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  if (storageProfile?.payloadAccessControl) {
    const access = storageProfile.payloadAccessControl as Record<string, unknown>;
    if (access.encryption === 'lit') {
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      profile.evm.registryChainId = 11155420;
      profile.encryption = { mode: 'lit' };
      if (profile.storage.payloadAccessControl) profile.storage.payloadAccessControl.encryption = 'lit';
    }
  }
  return profile;
};

const buildRegistryProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  return profile;
};

const buildWorkerConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  slug: 'demo4',
  sessionId: SESSION_ID,
  corsWorkerUrl: `${WORKER_URL}/`,
  sessionModeProfile: buildWorkerProfile(),
  workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active' },
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
  ...overrides,
});

const buildRegistryConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sessionModeProfile: buildRegistryProfile(),
  storageProfile: { backend: 'arweave', resources: { questions: 'active' } },
  ...overrides,
});

describe('session interview suggested question authoring policy', () => {
  it('keeps suggestions visible before login and hides unresolved signed-in policy', () => {
    expect(resolveSuggestedQuestionAuthoringState({ loginComplete: false, account: '', sessionConfig: null })).toBe(
      'prelogin',
    );
    expect(shouldHideSuggestedQuestionSection('prelogin')).toBe(false);
    expect(resolveSuggestedQuestionAuthoringState({ loginComplete: true, account: '', sessionConfig: null })).toBe(
      'checking',
    );
    expect(resolveSuggestedQuestionAuthoringState({ loginComplete: true, account: ACCOUNT, sessionConfig: null })).toBe(
      'checking',
    );
    expect(shouldHideSuggestedQuestionSection('checking')).toBe(true);
  });

  it('allows demo-style public Cloudflare question authoring when storage scope and public payload access both apply', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig(),
      }),
    ).toBe('allowed');
  });

  it('intersects participant storage scope with config.scopes before allowing Worker storage', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          workerAuthority: { version: 1, participantScopes: ['storage'] },
          scopes: { storage: false },
        }),
      }),
    ).toBe('denied');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({ workerAuthority: { version: 1, participantScopes: ['ai'] } }),
      }),
    ).toBe('denied');
  });

  it('accepts arweave fallback scope for the same valid Cloudflare Worker target', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          workerAuthority: { version: 1, participantScopes: ['arweave'] },
          scopes: { storage: false },
        }),
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          workerAuthority: { version: 1, participantScopes: ['arweave'] },
          scopes: { storage: true },
        }),
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          workerAuthority: { version: 1, participantScopes: ['storage', 'arweave'] },
          scopes: { storage: false, arweave: false },
        }),
      }),
    ).toBe('denied');
  });

  it('fails closed for invalid Worker-canonical Arweave profiles instead of guessing a write path', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          sessionModeProfile: {
            ...buildWorkerProfile(),
            preset: SESSION_MODE_PRESET_IDS.CUSTOM,
            storage: { backend: 'arweave' },
          },
          workerAuthority: { version: 1, participantScopes: ['arweave'] },
          storageProfile: { backend: 'arweave', resources: { questions: 'active' } },
        }),
      }),
    ).toBe('denied');
  });

  it('allows publicly provable admin role gates and denies non-admin role gates', () => {
    const roleGatedConfig = buildWorkerConfig({
      adminAddress: ADMIN,
      storageProfile: {
        backend: 'cloudflare',
        resources: { questions: 'active', surveys: 'active' },
        payloadAccessControl: { gate: 'role_gate', encryption: 'none', role: 'admin' },
      },
    });

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ADMIN,
        sessionSlug: 'demo4',
        sessionConfig: roleGatedConfig,
      }),
    ).toBe('allowed');
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: roleGatedConfig,
      }),
    ).toBe('denied');
  });

  it('evaluates explicit public condition documents and fails closed for unprovable group or SBT conditions', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          storageProfile: {
            backend: 'cloudflare',
            resources: { questions: 'active', surveys: 'active' },
            payloadAccessControl: {
              gate: 'none',
              encryption: 'none',
              accessConditions: { conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }] },
            },
          },
        }),
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ADMIN,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          adminAddress: ADMIN,
          storageProfile: {
            backend: 'cloudflare',
            resources: { questions: 'active', surveys: 'active' },
            payloadAccessControl: {
              gate: 'none',
              encryption: 'none',
              accessConditions: {
                match: 'any',
                conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'worker_group', groupId: 'reviewers' }],
              },
            },
          },
        }),
      }),
    ).toBe('allowed');

    for (const condition of [
      { kind: 'worker_group', groupId: 'reviewers' },
      { kind: 'sbt_onchain', contract: '0x0000000000000000000000000000000000000011' },
      { kind: 'mystery_gate' },
    ]) {
      expect(
        resolveSuggestedQuestionAuthoringState({
          loginComplete: true,
          account: ACCOUNT,
          sessionSlug: 'demo4',
          sessionConfig: buildWorkerConfig({
            storageProfile: {
              backend: 'cloudflare',
              resources: { questions: 'active', surveys: 'active' },
              payloadAccessControl: {
                gate: 'none',
                encryption: 'none',
                accessConditions: { conditions: [condition] },
              },
            },
          }),
        }),
      ).toBe('denied');
    }
  });

  it('keeps Lit encrypted Cloudflare sessions visible while deferring real proof to Lit and Worker upload', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          sessionModeProfile: buildWorkerProfile({
            backend: 'cloudflare',
            payloadAccessControl: { gate: 'none', encryption: 'lit' },
          }),
          storageProfile: {
            backend: 'cloudflare',
            resources: { questions: 'active', surveys: 'active' },
            payloadAccessControl: { gate: 'sbt_gate', encryption: 'lit' },
          },
        }),
      }),
    ).toBe('allowed');
  });

  it('fails closed for ended sessions, inactive question storage, invalid profile identity, and mismatched slug', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({ sessionEndsAt: '2000-01-01T00:00:00.000Z' }),
      }),
    ).toBe('denied');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({
          storageProfile: { backend: 'cloudflare', resources: { questions: 'staged', surveys: 'active' } },
        }),
      }),
    ).toBe('denied');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'demo4',
        sessionConfig: buildWorkerConfig({ sessionId: '' }),
      }),
    ).toBe('denied');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionSlug: 'other-session',
        sessionConfig: buildWorkerConfig(),
      }),
    ).toBe('denied');
  });

  it('allows registry sessions when question storage resolves to Arweave and arweave is not disabled', () => {
    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionConfig: buildRegistryConfig(),
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionConfig: buildRegistryConfig({ storageProfile: { backend: 'arweave' } }),
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionConfig: buildRegistryConfig({ scopes: { arweave: false } }),
      }),
    ).toBe('denied');
  });

  it('uses legacy registry fallback only when no explicit profile is present', () => {
    const legacyRegistryConfig = {
      __registry: { registryChainId: 11155420, sessionIdHex: SESSION_ID },
      storageProfile: { backend: 'arweave', resources: { questions: 'active' } },
    };

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionConfig: legacyRegistryConfig,
      }),
    ).toBe('allowed');

    expect(
      resolveSuggestedQuestionAuthoringState({
        loginComplete: true,
        account: ACCOUNT,
        sessionConfig: { ...legacyRegistryConfig, sessionModeProfile: {} },
      }),
    ).toBe('denied');
  });

});
